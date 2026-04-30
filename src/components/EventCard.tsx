import { useState } from 'react';
import type { DisplayEvent } from '../types';
import { sourceLabels } from '../api/events';
import { formatDistance } from '../utils/distance';
import { formatDateRange, formatOpeningWindow } from '../utils/date';
import { downloadEventIcs } from '../utils/ics';

type EventCardProps = {
  event: DisplayEvent;
  locationEnabled: boolean;
  onToggleFavorite: (eventId: string) => void;
};

function buildMapsUrl(event: DisplayEvent) {
  const locationQuery = event.address ? `${event.venue}, ${event.address}` : event.venue;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(locationQuery)}`;
}

export function EventCard({ event, locationEnabled, onToggleFavorite }: EventCardProps) {
  const [imageFailed, setImageFailed] = useState(false);
  const tagList = event.tags?.length ? event.tags : [event.eventType];
  const favoriteLabel = event.isFavorite ? 'Премахни от запазените' : 'Запази';
  const imageAlt = event.artist ? `${event.title} от ${event.artist}` : event.title;
  const showImage = Boolean(event.imageUrl) && !imageFailed;

  return (
    <article className="event-card">
      <div className="event-card-header">
        <div className="tag-row" aria-label="Етикети на събитието">
          {tagList.map((tag) => (
            <span key={tag} className="tag">
              {tag}
            </span>
          ))}
          {event.distanceKm !== undefined && event.distanceKm <= 3 ? <span className="tag nearby">Близо до вас</span> : null}
        </div>

        <button
          type="button"
          className={event.isFavorite ? 'icon-circle-button active' : 'icon-circle-button'}
          aria-pressed={event.isFavorite}
          aria-label={favoriteLabel}
          title={favoriteLabel}
          onClick={() => onToggleFavorite(event.id)}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M6 4.5A1.5 1.5 0 0 1 7.5 3h8.4a2.1 2.1 0 0 1 1.48.62l1.99 1.99A2.1 2.1 0 0 1 20 7.1V19.5A1.5 1.5 0 0 1 18.5 21h-13A1.5 1.5 0 0 1 4 19.5v-13A2 2 0 0 1 6 4.5Z" />
            <path d="M8 5h7v4H8z" fill="var(--surface-strong)" />
            <path d="M8 14h8v5H8z" fill="var(--surface-strong)" />
          </svg>
        </button>
      </div>

      {showImage ? (
        <div className="event-card-media">
          <img
            className="event-card-image"
            src={event.imageUrl}
            alt={imageAlt}
            loading="lazy"
            decoding="async"
            onError={() => setImageFailed(true)}
          />
        </div>
      ) : null}

      <div className="event-card-body">
        <div>
          <p className="event-source">{sourceLabels[event.source]}</p>
          <h3>{event.title}</h3>
          {event.artist ? <p className="artist-line">{event.artist}</p> : null}
        </div>

        <dl className="event-meta">
          <div>
            <dt>Място</dt>
            <dd>{event.venue}</dd>
          </div>
          <div>
            <dt>Адрес</dt>
            <dd>{event.address ?? 'Адресът не е уточнен'}</dd>
          </div>
          <div>
            <dt>Откриване</dt>
            <dd>{formatOpeningWindow(event)}</dd>
          </div>
          <div>
            <dt>Изложба</dt>
            <dd>{formatDateRange(event.exhibitionStart, event.exhibitionEnd)}</dd>
          </div>
          <div>
            <dt>Разстояние</dt>
            <dd>
              {formatDistance(event.distanceKm, {
                locationEnabled,
                hasCoordinates: typeof event.latitude === 'number' && typeof event.longitude === 'number',
              })}
            </dd>
          </div>
        </dl>

        {event.description ? <p className="event-description">{event.description}</p> : null}
      </div>

      <div className="event-actions">
        <button
          type="button"
          className="icon-circle-button"
          onClick={() => downloadEventIcs(event)}
          aria-label="Добави в календара"
          title="Добави в календара"
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M7 3a1 1 0 0 1 1 1v1h8V4a1 1 0 1 1 2 0v1h1a2 2 0 0 1 2 2v11a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3V7a2 2 0 0 1 2-2h1V4a1 1 0 0 1 1-1Z" />
            <path d="M5 10h14v8a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1v-8Z" fill="var(--surface-strong)" />
            <path d="M8 13h3v3H8zM13 13h3v3h-3z" />
          </svg>
        </button>
        <a
          className="icon-circle-button map-circle-button"
          href={buildMapsUrl(event)}
          target="_blank"
          rel="noreferrer"
          aria-label={`Отвори ${event.venue} в Google Maps`}
          title="Отвори в Google Maps"
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M12 21C10.8 19.5 6 13.6 6 10a6 6 0 1 1 12 0c0 3.6-4.8 9.5-6 11Z" />
            <circle cx="12" cy="10" r="2.5" />
          </svg>
        </a>
        <a
          className="icon-circle-button source-circle-button"
          href={event.sourceUrl}
          target="_blank"
          rel="noreferrer"
          aria-label="Отвори източника в нов раздел"
          title="Отвори източника"
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M14 5h5v5h-2V8.41l-6.29 6.3-1.42-1.42 6.3-6.29H14V5Z" />
            <path d="M6 6h5v2H7.5A1.5 1.5 0 0 0 6 9.5v7A1.5 1.5 0 0 0 7.5 18h7a1.5 1.5 0 0 0 1.5-1.5V13h2v3.5a3.5 3.5 0 0 1-3.5 3.5h-7A3.5 3.5 0 0 1 4 16.5v-7A3.5 3.5 0 0 1 7.5 6H6Z" />
          </svg>
        </a>
      </div>
    </article>
  );
}
