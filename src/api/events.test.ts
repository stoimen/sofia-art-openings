import { describe, expect, it } from 'vitest';
import { normalizeAndDeduplicateEvents, normalizeEvent } from './events';

function rawEvent(overrides: Record<string, unknown> = {}) {
  return {
    id: 'evt-1',
    title: 'Изложба',
    venue: 'Галерия',
    eventType: 'exhibition',
    source: 'manual',
    sourceUrl: 'https://example.com/evt-1',
    lastUpdated: '2026-04-01T00:00:00Z',
    ...overrides,
  };
}

describe('normalizeEvent', () => {
  it('rejects records that are missing required fields', () => {
    expect(normalizeEvent({})).toBeUndefined();
    expect(normalizeEvent(rawEvent({ title: '' }))).toBeUndefined();
    expect(normalizeEvent(rawEvent({ venue: undefined }))).toBeUndefined();
    expect(normalizeEvent(rawEvent({ sourceUrl: undefined }))).toBeUndefined();
    expect(normalizeEvent(rawEvent({ lastUpdated: 'not a date' }))).toBeUndefined();
  });

  it('rejects records with an unknown source', () => {
    expect(normalizeEvent(rawEvent({ source: 'unknown-source' }))).toBeUndefined();
  });

  it('coerces unknown event types to "other"', () => {
    const event = normalizeEvent(rawEvent({ eventType: 'wonderfest' }));
    expect(event?.eventType).toBe('other');
  });

  it('always adds a tag derived from the event type', () => {
    const event = normalizeEvent(rawEvent({ eventType: 'opening' }));
    expect(event?.tags).toContain('Откриване');
  });

  it('translates known English tags to Bulgarian', () => {
    const event = normalizeEvent(rawEvent({ tags: ['Painting', 'Photography', 'Custom tag'] }));
    expect(event?.tags).toEqual(expect.arrayContaining(['Живопис', 'Фотография', 'Custom tag']));
  });

  it('parses numeric strings for latitude/longitude', () => {
    const event = normalizeEvent(rawEvent({ latitude: '42.7', longitude: '23.3' }));
    expect(event?.latitude).toBe(42.7);
    expect(event?.longitude).toBe(23.3);
  });

  it('rejects non-finite numbers for latitude/longitude', () => {
    const event = normalizeEvent(rawEvent({ latitude: 'NaN', longitude: 'inf' }));
    expect(event?.latitude).toBeUndefined();
    expect(event?.longitude).toBeUndefined();
  });

  it('builds a fallback id when none is provided', () => {
    const event = normalizeEvent(rawEvent({ id: undefined }));
    expect(event?.id).toBeTruthy();
    expect(event?.id).toMatch(/manual/);
  });
});

describe('normalizeAndDeduplicateEvents', () => {
  it('drops invalid records silently', () => {
    const events = normalizeAndDeduplicateEvents([rawEvent(), { invalid: true }, null]);
    expect(events).toHaveLength(1);
  });

  it('deduplicates by lowercase title + venue + opening minute', () => {
    const events = normalizeAndDeduplicateEvents([
      rawEvent({ id: 'a', openingStart: '2026-05-01T18:00:00Z' }),
      rawEvent({ id: 'b', title: 'изложба', venue: 'галерия', openingStart: '2026-05-01T18:00:00Z' }),
    ]);
    expect(events).toHaveLength(1);
  });

  it('prefers the more complete record when merging duplicates', () => {
    const events = normalizeAndDeduplicateEvents([
      rawEvent({
        id: 'sparse',
        openingStart: '2026-05-01T18:00:00Z',
      }),
      rawEvent({
        id: 'rich',
        openingStart: '2026-05-01T18:00:00Z',
        artist: 'Иван Петров',
        address: 'Ул. Славянска 2',
        latitude: 42.7,
        longitude: 23.3,
        description: 'Описание',
      }),
    ]);

    expect(events).toHaveLength(1);
    const merged = events[0];
    expect(merged.artist).toBe('Иван Петров');
    expect(merged.address).toBe('Ул. Славянска 2');
    expect(merged.latitude).toBe(42.7);
    expect(merged.longitude).toBe(23.3);
  });

  it('treats events with different opening times as distinct', () => {
    const events = normalizeAndDeduplicateEvents([
      rawEvent({ id: 'a', openingStart: '2026-05-01T18:00:00Z' }),
      rawEvent({ id: 'b', openingStart: '2026-05-02T18:00:00Z' }),
    ]);
    expect(events).toHaveLength(2);
  });

  it('sorts results chronologically and stably by title', () => {
    const events = normalizeAndDeduplicateEvents([
      rawEvent({ id: 'b', title: 'B', openingStart: '2026-05-02T18:00:00Z' }),
      rawEvent({ id: 'a', title: 'A', openingStart: '2026-05-02T18:00:00Z' }),
      rawEvent({ id: 'c', title: 'C', openingStart: '2026-05-01T18:00:00Z' }),
    ]);

    expect(events.map((event) => event.title)).toEqual(['C', 'A', 'B']);
  });
});
