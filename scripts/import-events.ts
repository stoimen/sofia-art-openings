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

type ParsedDateRange = {
  start?: string;
  end?: string;
  matchedText?: string;
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

function stripOrdinals(value: string) {
  return value.replace(/\b(\d{1,2})(st|nd|rd|th)\b/gi, '$1');
}

function normalizeDateText(value: string) {
  return stripOrdinals(value)
    .replace(/[–—]/g, '-')
    .replace(/\s+/g, ' ')
    .trim();
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

function monthNumberFromName(value: string) {
  const monthMap: Record<string, string> = {
    january: '01',
    february: '02',
    march: '03',
    april: '04',
    may: '05',
    june: '06',
    july: '07',
    august: '08',
    september: '09',
    october: '10',
    november: '11',
    december: '12',
    януари: '01',
    февруари: '02',
    март: '03',
    април: '04',
    май: '05',
    юни: '06',
    юли: '07',
    август: '08',
    септември: '09',
    октомври: '10',
    ноември: '11',
    декември: '12',
  };

  return monthMap[value.toLowerCase()];
}

function createIsoDate(year: string, monthName: string, day: string) {
  const month = monthNumberFromName(monthName);
  return month ? toIsoDate(year, month, day) : undefined;
}

function extractDateRange(value?: string): ParsedDateRange {
  const text = normalizeText(value);
  if (!text) {
    return {};
  }

  const normalized = normalizeDateText(text);
  const monthPattern =
    '(January|February|March|April|May|June|July|August|September|October|November|December|януари|февруари|март|април|май|юни|юли|август|септември|октомври|ноември|декември)';

  let match =
    normalized.match(/\b(\d{1,2})\.(\d{1,2})\.?\s*-\s*(\d{1,2})\.(\d{1,2})\.(\d{4})\b/) ??
    normalized.match(/\b(\d{1,2})\s*-\s*(\d{1,2})\.(\d{1,2})\.(\d{4})\b/);

  if (match) {
    if (match[2].includes('.')) {
      return {};
    }

    if (match[0].includes('.')) {
      if (match.length === 6) {
        return {
          start: toIsoDate(match[5], match[2], match[1]),
          end: toIsoDate(match[5], match[4], match[3]),
          matchedText: match[0],
        };
      }

      return {
        start: toIsoDate(match[4], match[3], match[1]),
        end: toIsoDate(match[4], match[3], match[2]),
        matchedText: match[0],
      };
    }
  }

  match = normalized.match(
    new RegExp(`(\\d{1,2})\\s+${monthPattern}\\s+(\\d{4})\\s*-\\s*(\\d{1,2})\\s+${monthPattern}\\s+(\\d{4})`, 'i'),
  );
  if (match) {
    return {
      start: createIsoDate(match[3], match[2], match[1]),
      end: createIsoDate(match[6], match[5], match[4]),
      matchedText: match[0],
    };
  }

  match = normalized.match(new RegExp(`${monthPattern}\\s+(\\d{1,2})\\s*-\\s*${monthPattern}\\s+(\\d{1,2}),\\s*(\\d{4})`, 'i'));
  if (match) {
    return {
      start: createIsoDate(match[5], match[1], match[2]),
      end: createIsoDate(match[5], match[3], match[4]),
      matchedText: match[0],
    };
  }

  match = normalized.match(new RegExp(`${monthPattern}\\s+(\\d{1,2})\\s*-\\s*(\\d{1,2}),\\s*(\\d{4})`, 'i'));
  if (match) {
    return {
      start: createIsoDate(match[4], match[1], match[2]),
      end: createIsoDate(match[4], match[1], match[3]),
      matchedText: match[0],
    };
  }

  match = normalized.match(new RegExp(`(\\d{1,2})\\s*-\\s*(\\d{1,2})\\s+${monthPattern}\\s+(\\d{4})`, 'i'));
  if (match) {
    return {
      start: createIsoDate(match[4], match[3], match[1]),
      end: createIsoDate(match[4], match[3], match[2]),
      matchedText: match[0],
    };
  }

  match = normalized.match(new RegExp(`(\\d{1,2})\\s+${monthPattern}\\s*-\\s*(\\d{1,2})\\s+${monthPattern}\\s+(\\d{4})`, 'i'));
  if (match) {
    return {
      start: createIsoDate(match[5], match[2], match[1]),
      end: createIsoDate(match[5], match[4], match[3]),
      matchedText: match[0],
    };
  }

  return {};
}

function isCurrentOrUpcomingEvent(event: ArtEvent, now = new Date()) {
  const dateCandidate = event.exhibitionEnd ?? event.exhibitionStart ?? event.openingStart?.slice(0, 10);
  if (!dateCandidate) {
    return false;
  }

  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  const boundary = today.toISOString().slice(0, 10);
  return dateCandidate >= boundary;
}

function extractBackgroundImageUrl(styleValue?: string) {
  const match = styleValue?.match(/url\((['"]?)(.+?)\1\)/);
  return match ? match[2] : undefined;
}

function extractMapCenterCoordinates(url?: string) {
  const match = url?.match(/[?&]center=([-0-9.]+),([-0-9.]+)/);
  if (!match) {
    return {};
  }

  return {
    latitude: Number(match[1]),
    longitude: Number(match[2]),
  };
}

function extractArtistFromText(value?: string) {
  const text = normalizeText(value);
  if (!text) {
    return undefined;
  }

  const byMatch = text.match(
    /\b(?:solo exhibition by|an exhibition by|exhibition by|by)\s+(.+?)(?=\s+(?:Opening|Exhibition dates|Duration)\b|[.,|]|$)/i,
  );
  if (byMatch) {
    return normalizeText(byMatch[1]);
  }

  return undefined;
}

function extractArtistFromTitle(value?: string) {
  const title = normalizeText(value);
  if (!title) {
    return undefined;
  }

  const colonMatch = title.match(/:\s*(.+)$/);
  if (colonMatch) {
    return normalizeText(colonMatch[1]);
  }

  const dashParts = title.split(' – ').map((part) => normalizeText(part)).filter(Boolean);
  if (dashParts.length === 2) {
    return dashParts[1];
  }

  return undefined;
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
    signal: AbortSignal.timeout(20_000),
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

async function fetchHtmlCached(url: string, cache: Map<string, Promise<string>>) {
  let request = cache.get(url);

  if (!request) {
    request = fetchHtml(url);
    cache.set(url, request);
  }

  return request;
}

function toAbsoluteUrl(value?: string, baseUrl?: string) {
  const text = normalizeText(value);
  if (!text) {
    return undefined;
  }

  try {
    return new URL(text, baseUrl).toString();
  } catch {
    return undefined;
  }
}

function stripWordPressImageSize(url: string) {
  return url.replace(/-\d+x\d+(?=\.(?:avif|gif|jpe?g|png|webp)(?:[?#].*)?$)/i, '');
}

function normalizeImageUrl(value?: string, baseUrl?: string) {
  const absoluteUrl = toAbsoluteUrl(value, baseUrl);
  if (!absoluteUrl) {
    return undefined;
  }

  return absoluteUrl.includes('/wp-content/uploads/') ? stripWordPressImageSize(absoluteUrl) : absoluteUrl;
}

function isLikelyImageUrl(url: string) {
  return /\.(?:avif|gif|jpe?g|png|webp)(?:[?#].*)?$/i.test(url);
}

function isLikelyContentImage(url: string) {
  if (!isLikelyImageUrl(url)) {
    return false;
  }

  const haystack = url.toLowerCase();
  const blockedFragments = [
    '/logo',
    'logo-',
    '/icon',
    'icon-',
    '/flags/',
    'loader',
    'clock.',
    'phone.',
    'search-black',
    'youtube-icon',
    'fb-icon',
    'instagram-logo',
    'gerb-moc',
    'en-logo',
    'bg-logo',
  ];

  return !blockedFragments.some((fragment) => haystack.includes(fragment));
}

function addImageCandidate(candidates: string[], value: string | undefined, baseUrl?: string) {
  const imageUrl = normalizeImageUrl(value, baseUrl);
  if (!imageUrl || !isLikelyContentImage(imageUrl) || candidates.includes(imageUrl)) {
    return;
  }

  candidates.push(imageUrl);
}

function addJsonLdImageCandidates(node: unknown, candidates: string[], baseUrl?: string) {
  if (!node) {
    return;
  }

  if (typeof node === 'string') {
    addImageCandidate(candidates, node, baseUrl);
    return;
  }

  if (Array.isArray(node)) {
    node.forEach((value) => addJsonLdImageCandidates(value, candidates, baseUrl));
    return;
  }

  if (typeof node !== 'object') {
    return;
  }

  const record = node as Record<string, unknown>;

  if ('image' in record) {
    addJsonLdImageCandidates(record.image, candidates, baseUrl);
  }

  if ('thumbnailUrl' in record) {
    addJsonLdImageCandidates(record.thumbnailUrl, candidates, baseUrl);
  }

  const typeName = Array.isArray(record['@type']) ? String(record['@type'][0] ?? '') : String(record['@type'] ?? '');
  if (typeName.toLowerCase().includes('image')) {
    addJsonLdImageCandidates(record.url, candidates, baseUrl);
  }

  for (const value of Object.values(record)) {
    if (value && typeof value === 'object') {
      addJsonLdImageCandidates(value, candidates, baseUrl);
    }
  }
}

function extractJsonLdImageCandidates(html: string, baseUrl?: string) {
  const $ = load(html);
  const candidates: string[] = [];

  $('script[type="application/ld+json"]')
    .toArray()
    .map((element) => $(element).text())
    .filter(Boolean)
    .forEach((rawBlock) => {
      try {
        addJsonLdImageCandidates(JSON.parse(rawBlock), candidates, baseUrl);
      } catch {
        return;
      }
    });

  return candidates;
}

function normalizeMatchText(value?: string) {
  const text = normalizeText(value);
  if (!text) {
    return '';
  }

  return text
    .toLowerCase()
    .normalize('NFKD')
    .replace(/\p{Mark}+/gu, '')
    .replace(/&/g, ' and ')
    .replace(/[^0-9\p{Letter}]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function titleMatchScore(expectedTitle: string, candidateTitle?: string) {
  const expected = normalizeMatchText(expectedTitle);
  const candidate = normalizeMatchText(candidateTitle);

  if (!expected || !candidate) {
    return 0;
  }

  if (expected === candidate || candidate.includes(expected) || expected.includes(candidate)) {
    return 1;
  }

  const expectedTokens = [...new Set(expected.split(' ').filter((token) => token.length > 1))];
  if (expectedTokens.length === 0) {
    return 0;
  }

  const candidateTokens = new Set(candidate.split(' ').filter((token) => token.length > 1));
  const matchedTokens = expectedTokens.filter((token) => candidateTokens.has(token)).length;

  return matchedTokens / expectedTokens.length;
}

function extractGenericImageFromHtml(html: string, baseUrl: string) {
  const $ = load(html);
  const candidates: string[] = [];

  addImageCandidate(candidates, $('meta[property="og:image"]').attr('content'), baseUrl);
  addImageCandidate(candidates, $('meta[name="twitter:image"]').attr('content'), baseUrl);
  addImageCandidate(candidates, $('meta[name="twitter:image:src"]').attr('content'), baseUrl);

  extractJsonLdImageCandidates(html, baseUrl).forEach((candidate) => addImageCandidate(candidates, candidate, baseUrl));

  $('.gallery-item a[href], #jevents-details-gallery img, img[itemprop="image"], .itemImage img, .itemImageBlock img, .post-thumbnail img, .entry-content img, article img')
    .toArray()
    .forEach((element) => {
      const root = $(element);
      addImageCandidate(candidates, root.attr('href') ?? root.attr('src'), baseUrl);
    });

  return candidates[0];
}

function extractNationalGalleryDetailImage(html: string, sourceUrl: string) {
  const $ = load(html);
  const candidates: string[] = [];

  $('.gallery-item a[href], .gallery-item img')
    .toArray()
    .forEach((element) => {
      const root = $(element);
      addImageCandidate(candidates, root.attr('href') ?? root.attr('src'), sourceUrl);
    });

  return candidates[0] ?? extractGenericImageFromHtml(html, sourceUrl);
}

function extractNationalGalleryListImage(html: string, event: ArtEvent) {
  const $ = load(html);
  let bestMatch:
    | {
        imageUrl: string;
        score: number;
      }
    | undefined;

  $('article.exhibition, article.type-exhibition')
    .toArray()
    .forEach((article) => {
      const root = $(article);
      const candidateTitle = normalizeText(root.find('.entry-title').text());
      const score = titleMatchScore(event.title, candidateTitle);
      const imageUrl = normalizeImageUrl(root.find('.entry-format img').first().attr('src'), event.sourceUrl);

      if (!imageUrl || score < 0.6) {
        return;
      }

      if (!bestMatch || score > bestMatch.score) {
        bestMatch = { imageUrl, score };
      }
    });

  return bestMatch?.imageUrl;
}

function extractSghgListImage(html: string, event: ArtEvent) {
  const $ = load(html);
  let bestMatch:
    | {
        imageUrl: string;
        score: number;
      }
    | undefined;

  $('li.ongoing-exhibition')
    .toArray()
    .forEach((item) => {
      const root = $(item);
      const candidateTitle = normalizeText(root.find('.img-description').text());
      const score = titleMatchScore(event.title, candidateTitle);
      const imageUrl = normalizeImageUrl(root.find('img.ongoing-exhibition-image').first().attr('src'), event.sourceUrl);

      if (!imageUrl || score < 0.6) {
        return;
      }

      if (!bestMatch || score > bestMatch.score) {
        bestMatch = { imageUrl, score };
      }
    });

  return bestMatch?.imageUrl;
}

function extractVisitSofiaImage(html: string, sourceUrl: string) {
  const $ = load(html);
  const imageUrl =
    normalizeImageUrl($('#jevents-details-gallery img.jev_image').first().attr('src'), sourceUrl) ??
    normalizeImageUrl($('.jev_image').first().attr('src'), sourceUrl);

  return imageUrl ?? extractGenericImageFromHtml(html, sourceUrl);
}

function extractIcaSofiaImage(html: string, sourceUrl: string) {
  const $ = load(html);
  const jsonLdImages = extractJsonLdImageCandidates(html, sourceUrl);
  const preferredJsonLdImage = jsonLdImages.find((imageUrl) => imageUrl.toLowerCase().includes('_xl.')) ?? jsonLdImages[0];

  return (
    preferredJsonLdImage ??
    normalizeImageUrl($('img[itemprop="image"]').first().attr('src'), sourceUrl) ??
    normalizeImageUrl($('.itemImage img').first().attr('src'), sourceUrl) ??
    extractGenericImageFromHtml(html, sourceUrl)
  );
}

async function resolveEventImageUrl(event: ArtEvent, htmlCache: Map<string, Promise<string>>) {
  if (!event.sourceUrl || event.imageUrl) {
    return event.imageUrl;
  }

  if (event.source === 'nationalgallery') {
    const listUrl = 'https://nationalgallery.bg/exhibitions/';

    if (event.sourceUrl === listUrl) {
      const html = await fetchHtmlCached(listUrl, htmlCache);
      return extractNationalGalleryListImage(html, event);
    }

    const html = await fetchHtmlCached(event.sourceUrl, htmlCache);
    return extractNationalGalleryDetailImage(html, event.sourceUrl);
  }

  if (event.source === 'sghg') {
    const listUrl = 'https://sghg.bg/en/%D0%BD%D0%B0%D1%81%D1%82%D0%BE%D1%8F%D1%89%D0%B8/';
    const html = await fetchHtmlCached(listUrl, htmlCache);
    return extractSghgListImage(html, event);
  }

  if (event.source === 'visitsofia') {
    const html = await fetchHtmlCached(event.sourceUrl, htmlCache);
    return extractVisitSofiaImage(html, event.sourceUrl);
  }

  if (event.source === 'icasofia') {
    const html = await fetchHtmlCached(event.sourceUrl, htmlCache);
    return extractIcaSofiaImage(html, event.sourceUrl);
  }

  const html = await fetchHtmlCached(event.sourceUrl, htmlCache);
  return extractGenericImageFromHtml(html, event.sourceUrl);
}

async function enrichMissingEventImages(events: ArtEvent[]) {
  const htmlCache = new Map<string, Promise<string>>();

  return Promise.all(
    events.map(async (event) => {
      if (event.imageUrl) {
        return event;
      }

      try {
        const imageUrl = await resolveEventImageUrl(event, htmlCache);
        return imageUrl ? { ...event, imageUrl } : event;
      } catch (error) {
        console.warn(`[${event.source}] image enrichment skipped for ${event.title}`, error);
        return event;
      }
    }),
  );
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

function eventPayloadWithoutLastUpdated(event: ArtEvent) {
  const { lastUpdated: _lastUpdated, ...payload } = event;
  return payload;
}

function preserveLastUpdated(existingEvents: ArtEvent[], importedEvents: ArtEvent[], refreshedAt: string) {
  const existingEventsById = new Map(existingEvents.map((event) => [event.id, event]));

  return importedEvents.map((event) => {
    const existingEvent = existingEventsById.get(event.id);
    if (!existingEvent) {
      return {
        ...event,
        lastUpdated: refreshedAt,
      };
    }

    const hasChanged =
      JSON.stringify(eventPayloadWithoutLastUpdated(existingEvent)) !==
      JSON.stringify(eventPayloadWithoutLastUpdated(event));

    return {
      ...event,
      lastUpdated: hasChanged ? refreshedAt : existingEvent.lastUpdated,
    };
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

function createCredoBonumImporter(): SourceImporter {
  const source = 'credobonum' as const;
  const listUrl = 'https://credobonum.bg/en/exhibitions/';
  const venue = 'Credo Bonum Gallery';
  const address = '2 Slavyanska St., entrance from Benkovski St., 1000 Sofia, Bulgaria';

  return {
    source,
    listUrl,
    async run() {
      const html = await fetchHtml(listUrl);
      const $ = load(html);

      return $('article.post')
        .toArray()
        .map<ArtEvent | undefined>((article) => {
          const root = $(article);
          const title = normalizeText(root.find('.post__title a').first().text());
          const sourceUrl = normalizeText(root.find('.post__title a').first().attr('href'));
          const dateLine = normalizeText(root.find('.sec-title').first().text());
          const description = normalizeText(root.find('.excerpt').first().text());
          const imageUrl = normalizeText(root.find('img').first().attr('src'));

          if (!title || !sourceUrl) {
            return undefined;
          }

          const range = extractDateRange([dateLine, description].filter(Boolean).join(' '));
          const artist = extractArtistFromText(description) ?? extractArtistFromTitle(title);

          return {
            id: buildId(source, title, venue, range.start ?? dateLine),
            title,
            artist,
            venue,
            address,
            exhibitionStart: range.start,
            exhibitionEnd: range.end,
            eventType: 'exhibition',
            source,
            sourceUrl,
            description,
            imageUrl,
            tags: undefined,
            lastUpdated: new Date().toISOString(),
          };
        })
        .filter((event): event is ArtEvent => event !== undefined)
        .filter((event) => isCurrentOrUpcomingEvent(event));
    },
  };
}

function createHostGalleryImporter(): SourceImporter {
  const source = 'hostgallery' as const;
  const listUrl = 'https://host.gallery/';
  const venue = 'HOSTGALLERY';
  const address = '102 Acad. Ivan Evstratiev Geshov Blvd., inner entrance, 1612 Sofia, Bulgaria';

  return {
    source,
    listUrl,
    async run() {
      const html = await fetchHtml(listUrl);
      const $ = load(html);
      const artist = normalizeText($('h1.wp-block-heading').first().text());
      const title = normalizeText($('h2.wp-block-heading').first().text());
      const dateLine = normalizeText($('h3.wp-block-heading').first().text());
      const openingLine = normalizeText(
        $('p')
          .toArray()
          .map((element) => $(element).text())
          .find((text) => text.includes('Opening and artist talk')),
      );
      const imageUrl = normalizeText($('meta[property="og:image"]').attr('content'));

      if (!title) {
        return [];
      }

      const range = extractDateRange(dateLine);
      const openingStart = normalizeDateTime(
        openingLine
          ?.replace(/^Opening and artist talk:\s*/i, '')
          .replace(/^Opening Reception:\s*/i, '')
          .replace('|', ','),
      );

      const event: ArtEvent = {
        id: buildId(source, title, venue, openingStart ?? range.start),
        title,
        artist,
        venue,
        address,
        openingStart,
        exhibitionStart: range.start,
        exhibitionEnd: range.end,
        eventType: 'exhibition',
        source,
        sourceUrl: listUrl,
        description: openingLine,
        imageUrl,
        tags: undefined,
        lastUpdated: new Date().toISOString(),
      };

      return isCurrentOrUpcomingEvent(event) ? [event] : [];
    },
  };
}

function createDechkoUzunovImporter(): SourceImporter {
  const source = 'dechkouzunov' as const;
  const listUrl = 'https://dug.sghg.bg/en/';
  const address = '24 Dragan Tsankov Blvd., Izgrev, 1113 Sofia, Bulgaria';

  return {
    source,
    listUrl,
    async run() {
      const html = await fetchHtml(listUrl);
      const $ = load(html);
      const slide = $('.section_exhibition_slider .slide').first();
      const venue = normalizeText(slide.find('.slider-content p').first().text()) ?? 'Dechko Uzunov Art Gallery';
      const headline = normalizeText(slide.find('.slider-content h2').first().text());
      const imageUrl = extractBackgroundImageUrl(slide.find('.home_exhibition_slider').attr('style'));

      if (!headline) {
        return [];
      }

      const range = extractDateRange(headline);
      const title = normalizeText(normalizeDateText(headline).replace(range.matchedText ?? '', ''));

      if (!title) {
        return [];
      }

      const event: ArtEvent = {
        id: buildId(source, title, venue, range.start),
        title,
        venue,
        address,
        exhibitionStart: range.start,
        exhibitionEnd: range.end,
        eventType: 'exhibition',
        source,
        sourceUrl: listUrl,
        description: undefined,
        imageUrl,
        tags: undefined,
        lastUpdated: new Date().toISOString(),
      };

      return isCurrentOrUpcomingEvent(event) ? [event] : [];
    },
  };
}

async function collectProgramataExhibitionUrls(startUrl: string, maxPages = 1) {
  const urls = new Set<string>();
  let nextPageUrl: string | undefined = startUrl;
  let page = 0;

  while (nextPageUrl && page < maxPages) {
    const html = await fetchHtml(nextPageUrl);
    const $ = load(html);

    $('.post-list-entry h3 a[href]')
      .toArray()
      .map((element) => normalizeText($(element).attr('href')))
      .filter((href): href is string => Boolean(href))
      .forEach((href) => {
        if (href.includes('/izlozhbi/izlozhba/')) {
          urls.add(href);
        }
      });

    nextPageUrl = normalizeText($('.pagination .next.page-numbers').attr('href'));
    page += 1;
  }

  return [...urls];
}

function createProgramataImporter(): SourceImporter {
  const source = 'programata' as const;
  const listUrl = 'https://programata.bg/izlozhbi/izlozhba/';

  return {
    source,
    listUrl,
    async run() {
      const exhibitionUrls = await collectProgramataExhibitionUrls(listUrl, 3);
      const importedEvents: ArtEvent[] = [];

      for (const exhibitionUrl of exhibitionUrls) {
        try {
          const html = await fetchHtml(exhibitionUrl);
          const $ = load(html);
          const title = normalizeText($('h1').first().text()) ?? normalizeText($('title').first().text()?.split('|')[0]);
          const imageUrl = normalizeText($('.post-thumbnail img').first().attr('src'));
          const description = normalizeText($('.post-content p').first().text());

          if (!title) {
            continue;
          }

          $('.program .tab-pane')
            .toArray()
            .forEach((element) => {
              const root = $(element);
              const paneId = root.attr('id');
              const city = normalizeText($(`button[data-bs-target="#${paneId}"]`).first().text());
              if (city !== 'София') {
                return;
              }

              root.find('.schedule-venue > div')
                .toArray()
                .forEach((venueElement) => {
                  const venueRoot = $(venueElement);
                  const venue = normalizeText(venueRoot.find('a').first().text());
                  const fullText = normalizeText(venueRoot.text());
                  const range = extractDateRange(fullText);

                  if (!venue || !range.start) {
                    return;
                  }

                  const event: ArtEvent = {
                    id: buildId(source, title, venue, range.start),
                    title,
                    artist: title.includes('|') ? normalizeText(title.split('|').slice(1).join('|')) : undefined,
                    venue,
                    exhibitionStart: range.start,
                    exhibitionEnd: range.end,
                    eventType: inferEventType(title, fullText, venue),
                    source,
                    sourceUrl: exhibitionUrl,
                    description,
                    imageUrl,
                    tags: undefined,
                    lastUpdated: new Date().toISOString(),
                  };

                  if (isCurrentOrUpcomingEvent(event)) {
                    importedEvents.push(event);
                  }
                });
            });
        } catch (error) {
          console.warn(`[programata] skipped ${exhibitionUrl}`, error);
          continue;
        }
      }

      return dedupeEvents(importedEvents);
    },
  };
}

const importers: SourceImporter[] = [
  createCredoBonumImporter(),
  createHostGalleryImporter(),
  createDechkoUzunovImporter(),
  createProgramataImporter(),
];

async function main() {
  const existingEvents = await readExistingEvents();
  const refreshedSources = new Set<EventSource>(['credobonum', 'hostgallery', 'dechkouzunov', 'programata']);
  const protectedEvents = existingEvents.filter((event) => !refreshedSources.has(event.source));
  const refreshedAt = new Date().toISOString();
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
  const enrichedEvents = await enrichMissingEventImages(mergedEvents);
  const finalEvents = preserveLastUpdated(existingEvents, enrichedEvents, refreshedAt);

  await fs.writeFile(eventsPath, `${JSON.stringify(finalEvents, null, 2)}\n`, 'utf8');
  console.log(`Wrote ${finalEvents.length} Sofia events to public/data/events.json`);
}

void main();
