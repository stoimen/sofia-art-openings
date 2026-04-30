import { Component, type ErrorInfo, type ReactNode } from 'react';

type ErrorBoundaryProps = {
  children: ReactNode;
  fallback?: (error: Error, reset: () => void) => ReactNode;
};

type ErrorBoundaryState = {
  error?: Error;
};

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = {};

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('UI render error:', error, info.componentStack);
  }

  reset = () => {
    this.setState({ error: undefined });
  };

  render() {
    const { error } = this.state;
    if (!error) {
      return this.props.children;
    }

    if (this.props.fallback) {
      return this.props.fallback(error, this.reset);
    }

    return (
      <section className="state-panel error-panel" role="alert">
        <h2>Нещо се обърка</h2>
        <p>Възникна грешка при показването на тази секция. Можете да опитате отново или да презаредите страницата.</p>
        <button type="button" className="primary-button" onClick={this.reset}>
          Опитай отново
        </button>
      </section>
    );
  }
}
