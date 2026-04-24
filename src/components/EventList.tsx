import type { DisplayEvent } from '../types';
import { groupEventsByDate } from '../utils/date';
import { EventCard } from './EventCard';

type EventListProps = {
  events: DisplayEvent[];
  locationEnabled: boolean;
  onToggleFavorite: (eventId: string) => void;
};

export function EventList({ events, locationEnabled, onToggleFavorite }: EventListProps) {
  const groups = groupEventsByDate(events);

  return (
    <div className="event-groups">
      {groups.map((group) => (
        <section key={group.key} className="event-group" aria-labelledby={`group-${group.key}`}>
          <div className="group-heading">
            <p className="eyebrow">Дата</p>
            <h2 id={`group-${group.key}`}>{group.label}</h2>
          </div>
          <div className="event-stack">
            {group.events.map((event) => (
              <EventCard
                key={event.id}
                event={event}
                locationEnabled={locationEnabled}
                onToggleFavorite={onToggleFavorite}
              />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
