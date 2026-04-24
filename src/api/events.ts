import type { ArtEvent, EventSource } from '../types';

const validSources = new Set<EventSource>([
  'nationalgallery',
  'sghg',
  'visitsofia',
  'icasofia',
  'toplocentrala',
  'manual',
]);

const validEventTypes = new Set<ArtEvent['eventType']>([
  'opening',
  'exhibition',
  'talk',
  'performance',
  'screening',
  'other',
]);

export const sourceLabels: Record<EventSource, string> = {
  nationalgallery: 'Национална галерия',
  sghg: 'Софийска градска художествена галерия',
  visitsofia: 'Visit Sofia',
  icasofia: 'ICA-Sofia',
  toplocentrala: 'Топлоцентрала',
  manual: 'Ръчно',
};

export const sourceReliability: Record<EventSource, number> = {
  nationalgallery: 1,
  sghg: 1,
  visitsofia: 2,
  icasofia: 1,
  toplocentrala: 1,
  manual: 3,
};

type LoadEventsOptions = {
  signal?: AbortSignal;
  bustCache?: boolean;
};

function normalizeText(value: unknown) {
  if (typeof value !== 'string') {
    return undefined;
  }

  const trimmed = value.replace(/\s+/g, ' ').trim();
  return trimmed || undefined;
}

function normalizeNumber(value: unknown) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }

  return undefined;
}

function normalizeIsoDateTime(value: unknown) {
  const text = normalizeText(value);
  if (!text) {
    return undefined;
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    return `${text}T00:00:00`;
  }

  const parsed = new Date(text);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed.toISOString();
}

function normalizeIsoDate(value: unknown) {
  const text = normalizeText(value);
  if (!text) {
    return undefined;
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    return text;
  }

  const parsed = new Date(text);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed.toISOString().slice(0, 10);
}

function createFallbackId(event: Omit<ArtEvent, 'id'>) {
  return [event.source, event.title, event.venue, event.openingStart ?? event.exhibitionStart ?? event.lastUpdated]
    .join('::')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function normalizeTags(event: Pick<ArtEvent, 'eventType' | 'tags'>) {
  const tags = new Set<string>();
  const eventTypeTagMap: Record<ArtEvent['eventType'], string> = {
    opening: 'Откриване',
    exhibition: 'Изложба',
    talk: 'Разговор',
    performance: 'Пърформанс',
    screening: 'Прожекция',
    other: 'Друго',
  };
  const tagTranslations: Record<string, string> = {
    Opening: 'Откриване',
    Exhibition: 'Изложба',
    Talk: 'Разговор',
    Performance: 'Пърформанс',
    Screening: 'Прожекция',
    Other: 'Друго',
    'Contemporary Art': 'Съвременно изкуство',
    'Modern Bulgarian Art': 'Модерно българско изкуство',
    Painting: 'Живопис',
    Photography: 'Фотография',
    Upcoming: 'Предстоящо',
    Retrospective: 'Ретроспектива',
    Immersive: 'Имерсивна изложба',
  };

  tags.add(eventTypeTagMap[event.eventType]);

  for (const rawTag of event.tags ?? []) {
    const tag = normalizeText(rawTag);
    if (tag) {
      tags.add(tagTranslations[tag] ?? tag);
    }
  }

  return [...tags];
}

function countCompleteness(event: ArtEvent) {
  return [
    event.artist,
    event.address,
    event.latitude,
    event.longitude,
    event.openingStart,
    event.openingEnd,
    event.exhibitionStart,
    event.exhibitionEnd,
    event.description,
    event.imageUrl,
  ].filter((value) => value !== undefined).length;
}

function mergeEvents(preferred: ArtEvent, secondary: ArtEvent): ArtEvent {
  return {
    ...secondary,
    ...preferred,
    artist: preferred.artist ?? secondary.artist,
    address: preferred.address ?? secondary.address,
    latitude: preferred.latitude ?? secondary.latitude,
    longitude: preferred.longitude ?? secondary.longitude,
    openingStart: preferred.openingStart ?? secondary.openingStart,
    openingEnd: preferred.openingEnd ?? secondary.openingEnd,
    exhibitionStart: preferred.exhibitionStart ?? secondary.exhibitionStart,
    exhibitionEnd: preferred.exhibitionEnd ?? secondary.exhibitionEnd,
    description: preferred.description ?? secondary.description,
    imageUrl: preferred.imageUrl ?? secondary.imageUrl,
    tags: [...new Set([...(preferred.tags ?? []), ...(secondary.tags ?? [])])],
    lastUpdated: preferred.lastUpdated > secondary.lastUpdated ? preferred.lastUpdated : secondary.lastUpdated,
  };
}

function dedupeKey(event: ArtEvent) {
  return [
    event.title.toLowerCase(),
    event.venue.toLowerCase(),
    event.openingStart?.slice(0, 16) ?? event.exhibitionStart ?? 'date-tba',
  ].join('::');
}

export function normalizeEvent(rawEvent: unknown): ArtEvent | undefined {
  if (!rawEvent || typeof rawEvent !== 'object') {
    return undefined;
  }

  const record = rawEvent as Record<string, unknown>;
  const title = normalizeText(record.title);
  const venue = normalizeText(record.venue);
  const sourceUrl = normalizeText(record.sourceUrl);
  const source = normalizeText(record.source) as EventSource | undefined;
  const eventType = normalizeText(record.eventType) as ArtEvent['eventType'] | undefined;
  const lastUpdated = normalizeIsoDateTime(record.lastUpdated);

  if (!title || !venue || !sourceUrl || !source || !lastUpdated || !validSources.has(source)) {
    return undefined;
  }

  const normalizedEventType = eventType && validEventTypes.has(eventType) ? eventType : 'other';
  const baseEvent: Omit<ArtEvent, 'id'> = {
    title,
    venue,
    eventType: normalizedEventType,
    source,
    sourceUrl,
    lastUpdated,
    artist: normalizeText(record.artist),
    address: normalizeText(record.address),
    latitude: normalizeNumber(record.latitude),
    longitude: normalizeNumber(record.longitude),
    openingStart: normalizeIsoDateTime(record.openingStart),
    openingEnd: normalizeIsoDateTime(record.openingEnd),
    exhibitionStart: normalizeIsoDate(record.exhibitionStart),
    exhibitionEnd: normalizeIsoDate(record.exhibitionEnd),
    description: normalizeText(record.description),
    imageUrl: normalizeText(record.imageUrl),
    tags: Array.isArray(record.tags)
      ? record.tags.map((tag) => normalizeText(tag)).filter((tag): tag is string => Boolean(tag))
      : undefined,
  };

  return {
    id: normalizeText(record.id) ?? createFallbackId(baseEvent),
    ...baseEvent,
    tags: normalizeTags(baseEvent),
  };
}

export function normalizeAndDeduplicateEvents(rawEvents: unknown[]) {
  const events = rawEvents
    .map((rawEvent) => normalizeEvent(rawEvent))
    .filter((event): event is ArtEvent => Boolean(event));

  const uniqueEvents = new Map<string, ArtEvent>();

  for (const event of events) {
    const key = dedupeKey(event);
    const current = uniqueEvents.get(key);

    if (!current) {
      uniqueEvents.set(key, event);
      continue;
    }

    const currentScore = countCompleteness(current) - sourceReliability[current.source];
    const nextScore = countCompleteness(event) - sourceReliability[event.source];
    const preferred = nextScore > currentScore ? event : current;
    const secondary = preferred === event ? current : event;
    uniqueEvents.set(key, mergeEvents(preferred, secondary));
  }

  return [...uniqueEvents.values()].sort((left, right) => {
    const leftTime = left.openingStart ?? left.exhibitionStart ?? left.lastUpdated;
    const rightTime = right.openingStart ?? right.exhibitionStart ?? right.lastUpdated;
    return leftTime.localeCompare(rightTime) || left.title.localeCompare(right.title);
  });
}

export async function loadEvents(options: LoadEventsOptions = {}) {
  const url = new URL(`${import.meta.env.BASE_URL}data/events.json`, window.location.origin);

  if (options.bustCache) {
    url.searchParams.set('t', String(Date.now()));
  }

  const response = await fetch(url.toString(), {
    signal: options.signal,
    cache: options.bustCache ? 'reload' : 'default',
  });

  if (!response.ok) {
    throw new Error(`Неуспешно зареждане на events.json (${response.status})`);
  }

  const data = (await response.json()) as unknown;
  const rawEvents = Array.isArray(data)
    ? data
    : data && typeof data === 'object' && Array.isArray((data as { events?: unknown[] }).events)
      ? (data as { events: unknown[] }).events
      : [];

  const events = normalizeAndDeduplicateEvents(rawEvents);
  const lastUpdated = events.reduce<string | undefined>((latest, event) => {
    if (!latest || event.lastUpdated > latest) {
      return event.lastUpdated;
    }

    return latest;
  }, undefined);

  return {
    events,
    lastUpdated,
  };
}
