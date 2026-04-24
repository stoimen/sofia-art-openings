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
          <p className="eyebrow">Sofia Art Calendar</p>
          <h1>Sofia Art</h1>
          <p className="lead">
            Upcoming exhibitions, openings, and contemporary art events across Sofia. Share your location to
            prioritize nearby venues.
          </p>
        </div>

        <div className="hero-panel" aria-label="App summary">
          <div>
            <p className="hero-label">Near me</p>
            <strong>{locationEnabled ? `${nearbyCount} events with distance` : 'Enable location'}</strong>
          </div>
          <div>
            <p className="hero-label">Upcoming</p>
            <strong>{totalEvents} events loaded</strong>
          </div>
          <div>
            <p className="hero-label">Saved</p>
            <strong>{favoriteCount} shortlisted</strong>
          </div>
          <button type="button" className="refresh-button" onClick={onRefresh} disabled={isRefreshing}>
            {isRefreshing ? 'Refreshing…' : 'Refresh'}
          </button>
          <p className="update-stamp">
            {lastUpdated ? `Last updated ${formatDateTime(lastUpdated)}` : 'Last updated timestamp unavailable'}
          </p>
        </div>
      </header>

      <main>{children}</main>

      <footer className="app-footer">
        <p>Built as a static React + Vite PWA for GitHub Pages with optional local import scripts.</p>
      </footer>
    </div>
  );
}
