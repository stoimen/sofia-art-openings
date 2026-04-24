type ErrorStateProps = {
  message: string;
  onRetry: () => void;
};

export function ErrorState({ message, onRetry }: ErrorStateProps) {
  return (
    <section className="state-panel error-panel" role="alert">
      <h2>Could not load events</h2>
      <p>{message}</p>
      <button type="button" className="primary-button" onClick={onRetry}>
        Retry
      </button>
    </section>
  );
}
