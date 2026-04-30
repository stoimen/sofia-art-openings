import { startTransition, useDeferredValue, useEffect, useRef, useState } from 'react';
import { loadEvents, sourceReliability } from './api/events';
import { EmptyState } from './components/EmptyState';
import { ErrorBoundary } from './components/ErrorBoundary';
import { ErrorState } from './components/ErrorState';
import { EventList } from './components/EventList';
import { EventListSkeleton } from './components/EventListSkeleton';
import { Filters, type FilterState } from './components/Filters';
import { Layout } from './components/Layout';
import { LocationPermission } from './components/LocationPermission';
import type { ArtEvent, DisplayEvent, LocationPermissionStatus } from './types';
import { haversineDistanceKm } from './utils/distance';
import { getEventAnchorTime, isFutureStartEvent, matchesTimeframe, isUpcomingEvent } from './utils/date';

const FAVORITES_STORAGE_KEY = 'sofia-art-openings:favorites';

const defaultFilters: FilterState = {
  timeframe: 'all',
  upcomingOnly: true,
  openingsOnly: false,
  savedOnly: false,
  search: '',
  source: 'all',
  maxDistanceKm: 'all',
};

type LocationState = {
  status: LocationPermissionStatus;
  latitude?: number;
  longitude?: number;
  errorMessage?: string;
};

function readFavoriteIds() {
  if (typeof window === 'undefined') {
    return [];
  }

  try {
    const rawValue = window.localStorage.getItem(FAVORITES_STORAGE_KEY);
    const parsed = rawValue ? (JSON.parse(rawValue) as unknown) : [];
    return Array.isArray(parsed) ? parsed.filter((value): value is string => typeof value === 'string') : [];
  } catch {
    return [];
  }
}

function hasCoordinates(event: ArtEvent): event is ArtEvent & { latitude: number; longitude: number } {
  return typeof event.latitude === 'number' && typeof event.longitude === 'number';
}

function compareByDate(left: DisplayEvent, right: DisplayEvent) {
  return (
    getEventAnchorTime(left) - getEventAnchorTime(right) ||
    sourceReliability[left.source] - sourceReliability[right.source] ||
    left.title.localeCompare(right.title)
  );
}

function compareByNearbyScore(left: DisplayEvent, right: DisplayEvent) {
  const leftDistance = left.distanceKm ?? Number.POSITIVE_INFINITY;
  const rightDistance = right.distanceKm ?? Number.POSITIVE_INFINITY;

  return (
    getEventAnchorTime(left) - getEventAnchorTime(right) ||
    leftDistance - rightDistance ||
    sourceReliability[left.source] - sourceReliability[right.source] ||
    left.title.localeCompare(right.title)
  );
}

export default function App() {
  const [events, setEvents] = useState<ArtEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string>();
  const [refreshTick, setRefreshTick] = useState(0);
  const [lastUpdated, setLastUpdated] = useState<string>();
  const [filters, setFilters] = useState<FilterState>(defaultFilters);
  const [favoriteIds, setFavoriteIds] = useState<string[]>(readFavoriteIds);
  const [locationState, setLocationState] = useState<LocationState>({ status: 'idle' });
  const [isOnline, setIsOnline] = useState(() =>
    typeof navigator === 'undefined' ? true : navigator.onLine,
  );
  const autoLocationAttemptedRef = useRef(false);
  const locationRequestInFlightRef = useRef(false);

  const deferredSearch = useDeferredValue(filters.search.trim().toLowerCase());

  useEffect(() => {
    const controller = new AbortController();

    async function run() {
      setLoading(true);
      setErrorMessage(undefined);

      try {
        const result = await loadEvents({
          signal: controller.signal,
          bustCache: refreshTick > 0,
        });
        setEvents(result.events);
        setLastUpdated(result.lastUpdated);
      } catch (error) {
        if (controller.signal.aborted) {
          return;
        }

        setErrorMessage(error instanceof Error ? error.message : 'Възникна неизвестна грешка при зареждане на събитията.');
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }

    void run();
    return () => controller.abort();
  }, [refreshTick]);

  useEffect(() => {
    if (!('geolocation' in navigator)) {
      setLocationState({ status: 'unsupported' });
      return;
    }

    let cancelled = false;
    let permissionStatus: PermissionStatus | undefined;

    async function inspectPermission() {
      if (!('permissions' in navigator) || !navigator.permissions.query) {
        setLocationState((current) => ({ ...current, status: current.status === 'idle' ? 'prompt' : current.status }));
        return;
      }

      try {
        const nextPermissionStatus = await navigator.permissions.query({ name: 'geolocation' });
        permissionStatus = nextPermissionStatus;
        if (cancelled) {
          return;
        }

        setLocationState((current) => ({
          ...current,
          status: nextPermissionStatus.state === 'granted' ? 'granted' : nextPermissionStatus.state,
        }));

        nextPermissionStatus.onchange = () => {
          if (cancelled) {
            return;
          }

          setLocationState((current) => ({
            ...current,
            status: nextPermissionStatus.state === 'granted' ? 'granted' : nextPermissionStatus.state,
          }));
        };
      } catch {
        setLocationState((current) => ({ ...current, status: current.status === 'idle' ? 'prompt' : current.status }));
      }
    }

    void inspectPermission();

    return () => {
      cancelled = true;
      if (permissionStatus) {
        permissionStatus.onchange = null;
      }
    };
  }, []);

  useEffect(() => {
    window.localStorage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify(favoriteIds));
  }, [favoriteIds]);

  useEffect(() => {
    function handleOnline() {
      setIsOnline(true);
    }
    function handleOffline() {
      setIsOnline(false);
    }

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  function requestLocation(mode: 'auto' | 'manual' = 'manual') {
    if (!('geolocation' in navigator)) {
      setLocationState({ status: 'unsupported' });
      return;
    }

    if (locationRequestInFlightRef.current) {
      return;
    }

    if (mode === 'auto') {
      autoLocationAttemptedRef.current = true;
    }

    locationRequestInFlightRef.current = true;

    setLocationState((current) => ({
      ...current,
      status: 'loading',
      errorMessage: undefined,
    }));

    navigator.geolocation.getCurrentPosition(
      (position) => {
        locationRequestInFlightRef.current = false;
        setLocationState({
          status: 'granted',
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        });
      },
      (error) => {
        locationRequestInFlightRef.current = false;
        setLocationState({
          status: error.code === error.PERMISSION_DENIED ? 'denied' : 'error',
          errorMessage: error.message,
        });
      },
      {
        enableHighAccuracy: false,
        timeout: 10_000,
        maximumAge: 15 * 60 * 1000,
      },
    );
  }

  useEffect(() => {
    if (
      !autoLocationAttemptedRef.current &&
      (locationState.status === 'prompt' || locationState.status === 'granted') &&
      locationState.latitude === undefined
    ) {
      requestLocation('auto');
    }
  }, [locationState.status, locationState.latitude]);

  function handleRefresh() {
    startTransition(() => {
      setRefreshTick((current) => current + 1);
    });
  }

  function handleToggleFavorite(eventId: string) {
    setFavoriteIds((current) =>
      current.includes(eventId) ? current.filter((favoriteId) => favoriteId !== eventId) : [...current, eventId],
    );
  }

  const displayedEvents = events
    .filter((event) => isUpcomingEvent(event))
    .map<DisplayEvent>((event) => ({
      ...event,
      distanceKm:
        locationState.status === 'granted' &&
        locationState.latitude !== undefined &&
        locationState.longitude !== undefined &&
        hasCoordinates(event)
          ? haversineDistanceKm(locationState.latitude, locationState.longitude, event.latitude, event.longitude)
          : undefined,
      isFavorite: favoriteIds.includes(event.id),
    }))
    .filter((event) => {
      if (filters.upcomingOnly && !isFutureStartEvent(event)) {
        return false;
      }

      if (filters.openingsOnly && event.eventType !== 'opening') {
        return false;
      }

      if (filters.savedOnly && !event.isFavorite) {
        return false;
      }

      if (!matchesTimeframe(event, filters.timeframe)) {
        return false;
      }

      if (filters.source !== 'all' && event.source !== filters.source) {
        return false;
      }

      if (
        filters.maxDistanceKm !== 'all' &&
        (event.distanceKm === undefined || event.distanceKm > filters.maxDistanceKm)
      ) {
        return false;
      }

      if (!deferredSearch) {
        return true;
      }

      const searchableText = [
        event.title,
        event.artist,
        event.venue,
        event.address,
        event.description,
        ...(event.tags ?? []),
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      return searchableText.includes(deferredSearch);
    })
    .sort(locationState.status === 'granted' ? compareByNearbyScore : compareByDate);

  const nearbyCount = displayedEvents.filter((event) => event.distanceKm !== undefined).length;
  const hasFiltersApplied =
    filters.timeframe !== defaultFilters.timeframe ||
    filters.upcomingOnly !== defaultFilters.upcomingOnly ||
    filters.openingsOnly !== defaultFilters.openingsOnly ||
    filters.savedOnly !== defaultFilters.savedOnly ||
    filters.search.trim().length > 0 ||
    filters.source !== defaultFilters.source ||
    filters.maxDistanceKm !== defaultFilters.maxDistanceKm;

  return (
    <Layout
      totalEvents={events.length}
      nearbyCount={nearbyCount}
      favoriteCount={favoriteIds.length}
      locationEnabled={
        locationState.status === 'granted' &&
        locationState.latitude !== undefined &&
        locationState.longitude !== undefined
      }
      lastUpdated={lastUpdated}
      isRefreshing={loading && events.length > 0}
      onRefresh={handleRefresh}
    >
      <LocationPermission
        status={locationState.status}
        errorMessage={locationState.errorMessage}
        onRequest={requestLocation}
      />

      <Filters
        value={filters}
        hasLocation={locationState.status === 'granted'}
        onChange={setFilters}
        onReset={() => setFilters(defaultFilters)}
      />

      {!isOnline && events.length > 0 ? (
        <p className="offline-banner" role="status">
          Офлайн режим — показваме последните кеширани събития.
        </p>
      ) : null}

      {loading && events.length === 0 ? <EventListSkeleton /> : null}

      {errorMessage ? <ErrorState message={errorMessage} onRetry={handleRefresh} /> : null}

      {!errorMessage && !loading && displayedEvents.length === 0 ? (
        <EmptyState hasFilters={hasFiltersApplied} savedOnly={filters.savedOnly} favoriteCount={favoriteIds.length} />
      ) : null}

      {!errorMessage && displayedEvents.length > 0 ? (
        <ErrorBoundary>
          <EventList
            events={displayedEvents}
            locationEnabled={
              locationState.status === 'granted' &&
              locationState.latitude !== undefined &&
              locationState.longitude !== undefined
            }
            onToggleFavorite={handleToggleFavorite}
          />
        </ErrorBoundary>
      ) : null}
    </Layout>
  );
}
