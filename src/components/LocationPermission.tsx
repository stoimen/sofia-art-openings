import type { LocationPermissionStatus } from '../types';

type LocationPermissionProps = {
  status: LocationPermissionStatus;
  errorMessage?: string;
  onRequest: () => void;
};

function getCopy(status: LocationPermissionStatus, errorMessage?: string) {
  switch (status) {
    case 'granted':
      return 'Nearby ranking is active. Events with coordinates are sorted by date first, then by distance.';
    case 'loading':
      return 'Checking your position. Your browser should show a location prompt if permission has not been decided yet.';
    case 'denied':
      return 'Location access is off, so ranking falls back to date only. You can re-enable it in your browser settings.';
    case 'error':
      return errorMessage ?? 'Location lookup failed. You can keep using the app with date-based sorting.';
    case 'unsupported':
      return 'This browser does not expose geolocation. Nearby ranking is unavailable.';
    case 'prompt':
    case 'idle':
    default:
      return 'The app will ask for your location to emphasize nearby openings and enable distance filtering.';
  }
}

export function LocationPermission({ status, errorMessage, onRequest }: LocationPermissionProps) {
  return (
    <section className="location-panel" aria-labelledby="location-panel-title">
      <div>
        <p className="eyebrow">Location</p>
        <h2 id="location-panel-title">Prioritize nearby galleries</h2>
        <p>{getCopy(status, errorMessage)}</p>
      </div>

      <button type="button" className="primary-button" onClick={onRequest} disabled={status === 'loading'}>
        {status === 'granted' ? 'Refresh location' : status === 'loading' ? 'Locating…' : 'Use my location'}
      </button>
    </section>
  );
}
