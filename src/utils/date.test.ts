import { describe, expect, it } from 'vitest';
import type { ArtEvent } from '../types';
import {
  getEventAnchorDate,
  getEventAnchorTime,
  getEventEndDate,
  getGroupingKey,
  groupEventsByDate,
  isFutureStartEvent,
  isUpcomingEvent,
  matchesTimeframe,
  parseDateValue,
} from './date';

function makeEvent(overrides: Partial<ArtEvent>): ArtEvent {
  return {
    id: 'test-id',
    title: 'Test event',
    venue: 'Test venue',
    eventType: 'exhibition',
    source: 'manual',
    sourceUrl: 'https://example.com',
    lastUpdated: '2026-04-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('parseDateValue', () => {
  it('parses ISO date-only strings as local midnight', () => {
    const date = parseDateValue('2026-05-01');
    expect(date).toBeInstanceOf(Date);
    expect(date?.getHours()).toBe(0);
    expect(date?.getMinutes()).toBe(0);
  });

  it('parses ISO date-only strings as end-of-day when requested', () => {
    const date = parseDateValue('2026-05-01', true);
    expect(date?.getHours()).toBe(23);
    expect(date?.getMinutes()).toBe(59);
  });

  it('parses full ISO datetime strings', () => {
    const date = parseDateValue('2026-05-01T18:30:00Z');
    expect(date?.toISOString()).toBe('2026-05-01T18:30:00.000Z');
  });

  it('returns undefined for empty input', () => {
    expect(parseDateValue(undefined)).toBeUndefined();
    expect(parseDateValue('')).toBeUndefined();
  });

  it('returns undefined for unparseable input', () => {
    expect(parseDateValue('not a date')).toBeUndefined();
  });
});

describe('getEventAnchorDate', () => {
  it('prefers openingStart over other dates', () => {
    const event = makeEvent({
      openingStart: '2026-05-01T18:00:00Z',
      exhibitionStart: '2026-05-02',
    });
    expect(getEventAnchorDate(event)?.toISOString()).toBe('2026-05-01T18:00:00.000Z');
  });

  it('falls back through exhibitionStart, openingEnd, exhibitionEnd', () => {
    expect(getEventAnchorDate(makeEvent({ exhibitionStart: '2026-05-02' }))?.toISOString().slice(0, 10)).toBe(
      '2026-05-02',
    );
    expect(getEventAnchorDate(makeEvent({ openingEnd: '2026-05-03T20:00:00Z' }))?.toISOString()).toBe(
      '2026-05-03T20:00:00.000Z',
    );
    expect(getEventAnchorDate(makeEvent({ exhibitionEnd: '2026-05-04' }))?.toISOString().slice(0, 10)).toBe(
      '2026-05-04',
    );
  });

  it('returns undefined when no usable date is present', () => {
    expect(getEventAnchorDate(makeEvent({}))).toBeUndefined();
  });
});

describe('getEventAnchorTime', () => {
  it('returns numeric timestamp for dated events', () => {
    const event = makeEvent({ openingStart: '2026-05-01T18:00:00Z' });
    expect(getEventAnchorTime(event)).toBe(Date.parse('2026-05-01T18:00:00Z'));
  });

  it('returns +Infinity for undated events so they sort last', () => {
    expect(getEventAnchorTime(makeEvent({}))).toBe(Number.POSITIVE_INFINITY);
  });
});

describe('getEventEndDate', () => {
  it('prefers openingEnd over exhibitionEnd', () => {
    const event = makeEvent({
      openingEnd: '2026-05-01T20:00:00Z',
      exhibitionEnd: '2026-05-02',
    });
    expect(getEventEndDate(event)?.toISOString()).toBe('2026-05-01T20:00:00.000Z');
  });

  it('returns undefined when nothing is parseable', () => {
    expect(getEventEndDate(makeEvent({}))).toBeUndefined();
  });
});

describe('getGroupingKey', () => {
  it('returns the local date key for dated events', () => {
    const event = makeEvent({ openingStart: '2026-05-01T18:00:00Z' });
    expect(getGroupingKey(event)).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('returns "undated" when no anchor date exists', () => {
    expect(getGroupingKey(makeEvent({}))).toBe('undated');
  });
});

describe('isUpcomingEvent', () => {
  const today = new Date('2026-04-30T12:00:00Z');

  it('keeps events whose end date is today or later', () => {
    expect(isUpcomingEvent(makeEvent({ exhibitionEnd: '2026-04-30' }), today)).toBe(true);
    expect(isUpcomingEvent(makeEvent({ exhibitionEnd: '2026-05-15' }), today)).toBe(true);
  });

  it('drops events whose end date is in the past', () => {
    expect(isUpcomingEvent(makeEvent({ exhibitionEnd: '2026-04-29' }), today)).toBe(false);
  });

  it('keeps undated events visible (their date is unknown, not past)', () => {
    expect(isUpcomingEvent(makeEvent({}), today)).toBe(true);
  });
});

describe('isFutureStartEvent', () => {
  const today = new Date('2026-04-30T12:00:00Z');

  it('returns true when the anchor is today or later', () => {
    expect(isFutureStartEvent(makeEvent({ openingStart: '2026-05-01T19:00:00Z' }), today)).toBe(true);
  });

  it('returns false for past starts', () => {
    expect(isFutureStartEvent(makeEvent({ openingStart: '2026-04-01T19:00:00Z' }), today)).toBe(false);
  });

  it('returns false for undated events so they do not pollute "upcoming only" by default', () => {
    expect(isFutureStartEvent(makeEvent({}), today)).toBe(false);
  });
});

describe('matchesTimeframe', () => {
  const now = new Date('2026-04-30T12:00:00Z');

  it('always matches when the timeframe is "all"', () => {
    expect(matchesTimeframe(makeEvent({}), 'all', now)).toBe(true);
  });

  it('rejects undated events for any specific timeframe', () => {
    expect(matchesTimeframe(makeEvent({}), 'today', now)).toBe(false);
    expect(matchesTimeframe(makeEvent({}), 'tomorrow', now)).toBe(false);
    expect(matchesTimeframe(makeEvent({}), 'week', now)).toBe(false);
  });

  it('matches "today" only for events anchored today', () => {
    expect(matchesTimeframe(makeEvent({ openingStart: '2026-04-30T19:00:00Z' }), 'today', now)).toBe(true);
    expect(matchesTimeframe(makeEvent({ openingStart: '2026-05-01T19:00:00Z' }), 'today', now)).toBe(false);
  });

  it('matches "tomorrow" only for events anchored tomorrow', () => {
    expect(matchesTimeframe(makeEvent({ openingStart: '2026-05-01T19:00:00Z' }), 'tomorrow', now)).toBe(true);
    expect(matchesTimeframe(makeEvent({ openingStart: '2026-04-30T19:00:00Z' }), 'tomorrow', now)).toBe(false);
  });

  it('matches "week" for events anchored within the next seven days', () => {
    expect(matchesTimeframe(makeEvent({ openingStart: '2026-05-03T19:00:00Z' }), 'week', now)).toBe(true);
    expect(matchesTimeframe(makeEvent({ openingStart: '2026-05-08T19:00:00Z' }), 'week', now)).toBe(false);
  });
});

describe('groupEventsByDate', () => {
  it('groups events by local date and places undated events under the "undated" key', () => {
    const dated = makeEvent({ id: 'a', openingStart: '2026-05-01T18:00:00Z' });
    const undated = makeEvent({ id: 'b' });

    const groups = groupEventsByDate([
      { ...dated, isFavorite: false },
      { ...undated, isFavorite: false },
    ]);

    const keys = groups.map((group) => group.key);
    expect(keys).toContain('undated');
    expect(keys.some((key) => /^\d{4}-\d{2}-\d{2}$/.test(key))).toBe(true);
  });
});
