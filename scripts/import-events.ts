import { createHash } from 'node:crypto';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { load } from 'cheerio';
import type { ArtEvent, EventSource } from '../src/types';

type SourceImporter = {
  source: EventSource;
  listUrl: string;
  run: () => Promise<ArtEvent[]>;
};

const directoryName = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(directoryName, '..');
const eventsPath = path.join(projectRoot, 'public', 'data', 'events.json');

const userAgent =
  process.env.IMPORT_USER_AGENT ??
  'SofiaArtOpeningsImporter/0.1 (+https://github.com/replace-this/sofia-art-openings)';

function normalizeText(value?: string | null) {
  return value?.replace(/\s+/g, ' ').trim() || undefined;
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function toIsoDate(year: string, month: string, day: string) {
  return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
}

function replaceEuropeanDates(value: string) {
  return value.replace(/\b(\d{1,2})\.(\d{1,2})\.(\d{4})\b/g, (_, day, month, year) => toIsoDate(year, month, day));
}

function normalizeDateTime(value?: string) {
  const text = normalizeText(value);
  if (!text) {
    return undefined;
  }

  const normalizedText = replaceEuropeanDates(text);

  if (/^\d{4}-\d{2}-\d{2}$/.test(normalizedText)) {
    return new Date(`${normalizedText}T00:00:00`).toISOString();
  }

  const parsed = new Date(normalizedText);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed.toISOString();
}

function normalizeDate(value?: string) {
  const text = normalizeText(value);
  if (!text) {
    return undefined;
  }

  const normalizedText = replaceEuropeanDates(text);

  if (/^\d{4}-\d{2}-\d{2}$/.test(normalizedText)) {
    return normalizedText;
  }

  const parsed = new Date(normalizedText);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed.toISOString().slice(0, 10);
}

function inferEventType(...values: Array<string | undefined>) {
  const haystack = values.filter(Boolean).join(' ').toLowerCase();

  if (haystack.includes('opening') || haystack.includes('vernissage')) {
    return 'opening' as const;
  }

  if (haystack.includes('talk') || haystack.includes('lecture') || haystack.includes('discussion')) {
    return 'talk' as const;
  }

  if (haystack.includes('performance')) {
    return 'performance' as const;
  }

  if (haystack.includes('screening') || haystack.includes('film')) {
    return 'screening' as const;
  }

  if (haystack.includes('exhibition') || haystack.includes('gallery')) {
    return 'exhibition' as const;
  }

  return 'other' as const;
}

function buildId(source: EventSource, title: string, venue: string, date?: string) {
  const rawKey = [source, title, venue, date ?? 'tba'].join('::');
  const digest = createHash('sha1').update(rawKey).digest('hex').slice(0, 10);
  return `${source}-${slugify(title)}-${digest}`;
}

async function fetchHtml(url: string) {
  const response = await fetch(url, {
    headers: {
      'user-agent': userAgent,
      'accept-language': 'en-US,en;q=0.8',
    },
  });

  if (!response.ok) {
    throw new Error(`Request failed for ${url} (${response.status})`);
  }

  return response.text();
}

function extractJsonLdEvents(html: string, source: EventSource, listUrl: string) {
  const $ = load(html);
  const rawBlocks = $('script[type="application/ld+json"]')
    .toArray()
    .map((element) => $(element).text())
    .filter(Boolean);

  const events: ArtEvent[] = [];

  function visitNode(node: unknown) {
    if (Array.isArray(node)) {
      node.forEach(visitNode);
      return;
    }

    if (!node || typeof node !== 'object') {
      return;
    }

    const record = node as Record<string, unknown>;
    const typeName = Array.isArray(record['@type']) ? String(record['@type'][0]) : String(record['@type'] ?? '');

    if (typeName.toLowerCase().includes('event')) {
      const title = normalizeText(String(record.name ?? ''));
      if (!title) {
        return;
      }

      const locationRecord =
        record.location && typeof record.location === 'object'
          ? (record.location as Record<string, unknown>)
          : undefined;

      const venue =
        normalizeText(String(locationRecord?.name ?? record.organizer ?? '')) ??
        normalizeText(String(record.location ?? '')) ??
        'Sofia venue';
      const addressRecord =
        locationRecord?.address && typeof locationRecord.address === 'object'
          ? (locationRecord.address as Record<string, unknown>)
          : undefined;
      const address = normalizeText(
        [addressRecord?.streetAddress, addressRecord?.postalCode, addressRecord?.addressLocality]
          .filter(Boolean)
          .join(', '),
      );

      const openingStart = normalizeDateTime(String(record.startDate ?? ''));
      const openingEnd = normalizeDateTime(String(record.endDate ?? ''));
      const description = normalizeText(String(record.description ?? ''));

      events.push({
        id: buildId(source, title, venue, openingStart),
        title,
        venue,
        address,
        openingStart,
        openingEnd,
        exhibitionStart: openingStart?.slice(0, 10),
        exhibitionEnd: openingEnd?.slice(0, 10),
        eventType: inferEventType(title, description),
        source,
        sourceUrl: normalizeText(String(record.url ?? '')) ?? listUrl,
        description,
        imageUrl: normalizeText(String(record.image ?? '')),
        tags: undefined,
        lastUpdated: new Date().toISOString(),
      });
    }

    for (const value of Object.values(record)) {
      visitNode(value);
    }
  }

  for (const rawBlock of rawBlocks) {
    try {
      visitNode(JSON.parse(rawBlock));
    } catch {
      continue;
    }
  }

  return events;
}

function extractGenericCards(html: string, source: EventSource, listUrl: string) {
  const $ = load(html);
  const cards =
    $('article, .event-item, .calendar-item, .items-row > div, li, .tribe-events-calendar-list__event-row')
      .toArray()
      .slice(0, 64);

  return cards
    .map<ArtEvent | undefined>((card) => {
      const root = $(card);
      const title =
        normalizeText(root.find('h1, h2, h3, [itemprop="name"], .title').first().text()) ??
        normalizeText(root.find('a').first().text());
      const link = normalizeText(root.find('a[href]').first().attr('href'));
      const venue =
        normalizeText(root.find('.venue, .location, [itemprop="location"], [itemprop="organizer"]').first().text()) ??
        'Sofia venue';
      const address = normalizeText(root.find('.address, [itemprop="streetAddress"]').first().text());
      const timeValue = root.find('time').first().attr('datetime') ?? root.find('time').first().text();
      const dateValue =
        normalizeText(root.find('.date, .event-date, .meta-date, .published').first().text()) ?? normalizeText(timeValue);
      const description = normalizeText(root.find('p').first().text());

      if (!title || !link) {
        return undefined;
      }

      const openingStart = normalizeDateTime(timeValue);

      return {
        id: buildId(source, title, venue, openingStart ?? dateValue),
        title,
        venue,
        address,
        openingStart,
        exhibitionStart: openingStart?.slice(0, 10) ?? normalizeDate(dateValue),
        eventType: inferEventType(title, description, dateValue),
        source,
        sourceUrl: new URL(link, listUrl).toString(),
        description,
        imageUrl: normalizeText(root.find('img').first().attr('src')),
        tags: undefined,
        lastUpdated: new Date().toISOString(),
      };
    })
    .filter((event): event is ArtEvent => event !== undefined);
}

function dedupeEvents(events: ArtEvent[]) {
  const unique = new Map<string, ArtEvent>();

  for (const event of events) {
    const key = [slugify(event.title), slugify(event.venue), event.openingStart?.slice(0, 10) ?? event.exhibitionStart].join(
      '::',
    );

    if (!unique.has(key)) {
      unique.set(key, event);
    }
  }

  return [...unique.values()].sort((left, right) => {
    const leftDate = left.openingStart ?? left.exhibitionStart ?? left.lastUpdated;
    const rightDate = right.openingStart ?? right.exhibitionStart ?? right.lastUpdated;
    return leftDate.localeCompare(rightDate) || left.title.localeCompare(right.title);
  });
}

async function readExistingEvents() {
  try {
    const fileContents = await fs.readFile(eventsPath, 'utf8');
    const parsed = JSON.parse(fileContents) as unknown;
    return Array.isArray(parsed) ? (parsed as ArtEvent[]) : [];
  } catch {
    return [];
  }
}

function createHeuristicImporter(source: EventSource, listUrl: string): SourceImporter {
  return {
    source,
    listUrl,
    async run() {
      const html = await fetchHtml(listUrl);
      const jsonLdEvents = extractJsonLdEvents(html, source, listUrl);
      if (jsonLdEvents.length > 0) {
        return jsonLdEvents;
      }

      return extractGenericCards(html, source, listUrl);
    },
  };
}

const importers: SourceImporter[] = [
  createHeuristicImporter('nationalgallery', 'https://nationalgallery.bg/exhibitions/'),
  createHeuristicImporter('visitsofia', 'https://www.visitsofia.bg/en/exhibitions'),
  createHeuristicImporter('icasofia', 'https://www.ica-sofia.org/en/ica-gallery/exhibitions'),
  createHeuristicImporter('toplocentrala', 'https://toplocentrala.bg/en/program/visual'),
];

async function main() {
  const existingEvents = await readExistingEvents();
  const protectedEvents = existingEvents.filter((event) => event.source === 'manual' || event.source === 'sghg');
  const importedEvents: ArtEvent[] = [];

  for (const importer of importers) {
    try {
      const events = await importer.run();
      importedEvents.push(...events);
      console.log(`[${importer.source}] imported ${events.length} events`);
    } catch (error) {
      console.error(`[${importer.source}] import failed`, error);
    }
  }

  if (importedEvents.length === 0) {
    console.warn('No source importers returned events. Keeping the existing dataset untouched.');
    return;
  }

  const mergedEvents = dedupeEvents([...protectedEvents, ...importedEvents]);
  await fs.writeFile(eventsPath, `${JSON.stringify(mergedEvents, null, 2)}\n`, 'utf8');
  console.log(`Wrote ${mergedEvents.length} Sofia events to public/data/events.json`);
}

void main();
