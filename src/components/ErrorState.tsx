type ErrorStateProps = {
  message: string;
  onRetry: () => void;
};

export function ErrorState({ message, onRetry }: ErrorStateProps) {
  return (
    <section className="state-panel error-panel" role="alert">
      <h2>Събитията не можаха да бъдат заредени</h2>
      <p>{message}</p>
      <button type="button" className="primary-button" onClick={onRetry}>
        Опитай отново
      </button>
    </section>
  );
}
