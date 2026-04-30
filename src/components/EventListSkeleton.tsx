type EventListSkeletonProps = {
  count?: number;
};

export function EventListSkeleton({ count = 3 }: EventListSkeletonProps) {
  const placeholders = Array.from({ length: count }, (_, index) => index);

  return (
    <div className="event-stack" aria-busy="true" aria-live="polite" aria-label="Зареждане на събития">
      {placeholders.map((index) => (
        <article key={index} className="event-card event-card-skeleton" aria-hidden="true">
          <div className="skeleton-shimmer skeleton-tag-row" />
          <div className="skeleton-shimmer skeleton-media" />
          <div className="skeleton-shimmer skeleton-title" />
          <div className="skeleton-shimmer skeleton-line" />
          <div className="skeleton-shimmer skeleton-line short" />
        </article>
      ))}
    </div>
  );
}
