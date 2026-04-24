type EmptyStateProps = {
  hasFilters: boolean;
  savedOnly: boolean;
  favoriteCount: number;
};

export function EmptyState({ hasFilters, savedOnly, favoriteCount }: EmptyStateProps) {
  const message = savedOnly
    ? favoriteCount > 0
      ? 'Нито едно запазено събитие не отговаря на текущите филтри. Разширете периода, източниците или филтъра за разстояние.'
      : 'Още нямате запазени събития. Използвайте бутона за запазване в картата на събитието.'
    : hasFilters
      ? 'Разширете периода, източниците или филтъра за разстояние.'
      : 'Локалният набор от данни е празен в момента. Обновете или актуализирайте public/data/events.json.';

  return (
    <section className="state-panel" aria-live="polite">
      <h2>Няма съвпадащи събития</h2>
      <p>{message}</p>
    </section>
  );
}
