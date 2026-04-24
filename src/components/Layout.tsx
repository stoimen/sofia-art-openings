import type { ReactNode } from 'react';
import { formatDateTime } from '../utils/date';

type LayoutProps = {
  children: ReactNode;
  totalEvents: number;
  nearbyCount: number;
  favoriteCount: number;
  locationEnabled: boolean;
  lastUpdated?: string;
  isRefreshing: boolean;
  onRefresh: () => void;
};

export function Layout({
  children,
  totalEvents,
  nearbyCount,
  favoriteCount,
  locationEnabled,
  lastUpdated,
  isRefreshing,
  onRefresh,
}: LayoutProps) {
  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="brand-block">
          <p className="eyebrow">Календар на софийското изкуство</p>
          <h1>София Арт</h1>
          <p className="lead">
            Предстоящи изложби, откривания и събития за съвременно изкуство в София. Споделете местоположението си,
            за да виждате първо близките места.
          </p>
        </div>

        <div className="hero-panel" aria-label="Обобщение на приложението">
          <div>
            <p className="hero-label">Близо до мен</p>
            <strong>{locationEnabled ? `${nearbyCount} събития с разстояние` : 'Включете локация'}</strong>
          </div>
          <div>
            <p className="hero-label">Предстоящи</p>
            <strong>{totalEvents} заредени събития</strong>
          </div>
          <div>
            <p className="hero-label">Запазени</p>
            <strong>{favoriteCount} в списъка</strong>
          </div>
          <button type="button" className="refresh-button" onClick={onRefresh} disabled={isRefreshing}>
            {isRefreshing ? 'Обновяване…' : 'Обнови'}
          </button>
          <p className="update-stamp">
            {lastUpdated ? `Последно обновяване ${formatDateTime(lastUpdated)}` : 'Няма информация за последно обновяване'}
          </p>
        </div>
      </header>

      <main>{children}</main>

      <footer className="app-footer">
        <p>Изградено като статично React + Vite PWA за GitHub Pages с опционални локални импорт скриптове.</p>
      </footer>
    </div>
  );
}
