type EmptyStateProps = {
  hasFilters: boolean;
  savedOnly: boolean;
  favoriteCount: number;
};

export function EmptyState({ hasFilters, savedOnly, favoriteCount }: EmptyStateProps) {
  const message = savedOnly
    ? favoriteCount > 0
      ? 'No saved events match the current filters. Try widening the date window, source selection, or distance filter.'
      : 'You have not saved any events yet. Use the bookmark button on an event card to build a shortlist.'
    : hasFilters
      ? 'Try widening the date window, source selection, or distance filter.'
      : 'The local dataset is empty right now. Refresh or update public/data/events.json.';

  return (
    <section className="state-panel" aria-live="polite">
      <h2>No matching events</h2>
      <p>{message}</p>
    </section>
  );
}
