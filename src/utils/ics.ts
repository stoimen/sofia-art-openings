import type { ArtEvent } from '../types';
import { parseDateValue } from './date';

function escapeIcsText(value: string) {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/\n/g, '\\n')
    .replace(/,/g, '\\,')
    .replace(/;/g, '\\;');
}

function formatUtcDate(value: Date) {
  return value
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d{3}Z$/, 'Z');
}

function buildDateOnly(value: Date) {
  return value.toISOString().slice(0, 10).replace(/-/g, '');
}

function getIcsWindow(event: ArtEvent) {
  const timedStart = parseDateValue(event.openingStart);
  const timedEnd = parseDateValue(event.openingEnd);

  if (timedStart) {
    return {
      allDay: false,
      start: timedStart,
      end: timedEnd ?? new Date(timedStart.getTime() + 2 * 60 * 60 * 1000),
    };
  }

  const dayStart = parseDateValue(event.exhibitionStart);
  if (dayStart) {
    const dayEnd = parseDateValue(event.exhibitionEnd) ?? dayStart;
    const nextDay = new Date(dayEnd);
    nextDay.setDate(nextDay.getDate() + 1);
    return {
      allDay: true,
      start: dayStart,
      end: nextDay,
    };
  }

  return undefined;
}

export function createEventIcs(event: ArtEvent) {
  const window = getIcsWindow(event);
  if (!window) {
    return undefined;
  }

  const location = event.address ? `${event.venue}, ${event.address}` : event.venue;
  const descriptionLines = [event.description, `Източник: ${event.sourceUrl}`].filter(Boolean).join('\n\n');

  const dateLines = window.allDay
    ? [
        `DTSTART;VALUE=DATE:${buildDateOnly(window.start)}`,
        `DTEND;VALUE=DATE:${buildDateOnly(window.end)}`,
      ]
    : [`DTSTART:${formatUtcDate(window.start)}`, `DTEND:${formatUtcDate(window.end)}`];

  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Sofia Art Openings//BG',
    'BEGIN:VEVENT',
    `UID:${event.id}@sofia-art-openings`,
    `DTSTAMP:${formatUtcDate(new Date())}`,
    ...dateLines,
    `SUMMARY:${escapeIcsText(event.title)}`,
    `DESCRIPTION:${escapeIcsText(descriptionLines)}`,
    `LOCATION:${escapeIcsText(location)}`,
    `URL:${event.sourceUrl}`,
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n');
}

export function downloadEventIcs(event: ArtEvent) {
  const ics = createEventIcs(event);
  if (!ics) {
    return;
  }

  const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${event.id}.ics`;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
