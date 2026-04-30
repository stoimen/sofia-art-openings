import { describe, expect, it } from 'vitest';
import type { ArtEvent } from '../types';
import { createEventIcs } from './ics';

function makeEvent(overrides: Partial<ArtEvent>): ArtEvent {
  return {
    id: 'test-id',
    title: 'Изложба',
    venue: 'Галерия',
    eventType: 'opening',
    source: 'manual',
    sourceUrl: 'https://example.com/event',
    lastUpdated: '2026-04-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('createEventIcs', () => {
  it('returns undefined for an event without any usable date', () => {
    expect(createEventIcs(makeEvent({}))).toBeUndefined();
  });

  it('emits a timed VEVENT with DTSTART/DTEND for openingStart', () => {
    const ics = createEventIcs(
      makeEvent({
        openingStart: '2026-05-01T18:00:00Z',
        openingEnd: '2026-05-01T20:00:00Z',
      }),
    );

    expect(ics).toBeDefined();
    expect(ics!).toContain('BEGIN:VEVENT');
    expect(ics!).toContain('DTSTART:20260501T180000Z');
    expect(ics!).toContain('DTEND:20260501T200000Z');
    expect(ics!).toContain('END:VEVENT');
  });

  it('defaults a missing openingEnd to two hours after openingStart', () => {
    const ics = createEventIcs(makeEvent({ openingStart: '2026-05-01T18:00:00Z' }));
    expect(ics).toContain('DTSTART:20260501T180000Z');
    expect(ics).toContain('DTEND:20260501T200000Z');
  });

  it('emits an all-day window for exhibition-only events with DTEND on the next day (per RFC 5545)', () => {
    const ics = createEventIcs(
      makeEvent({
        openingStart: undefined,
        exhibitionStart: '2026-05-01',
        exhibitionEnd: '2026-05-03',
      }),
    );

    expect(ics).toContain('DTSTART;VALUE=DATE:20260501');
    expect(ics).toContain('DTEND;VALUE=DATE:20260504');
  });

  it('escapes commas, semicolons, newlines and backslashes in text fields', () => {
    const ics = createEventIcs(
      makeEvent({
        title: 'A, B; C\\D\nE',
        openingStart: '2026-05-01T18:00:00Z',
        description: 'Line 1\nLine 2, with comma; and semicolon',
        address: 'Slavyanska 2, Sofia',
      }),
    );

    expect(ics).toContain('SUMMARY:A\\, B\\; C\\\\D\\nE');
    expect(ics).toContain('Line 1\\nLine 2\\, with comma\\; and semicolon');
    expect(ics).toContain('LOCATION:Галерия\\, Slavyanska 2\\, Sofia');
  });

  it('uses CRLF line endings as required by RFC 5545', () => {
    const ics = createEventIcs(makeEvent({ openingStart: '2026-05-01T18:00:00Z' }));
    expect(ics).toContain('\r\n');
    expect(ics?.split('\r\n').length).toBeGreaterThan(5);
  });
});
