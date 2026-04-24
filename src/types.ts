export type EventSource =
  | 'nationalgallery'
  | 'sghg'
  | 'visitsofia'
  | 'icasofia'
  | 'toplocentrala'
  | 'credobonum'
  | 'hostgallery'
  | 'dechkouzunov'
  | 'programata'
  | 'manual';

export type ArtEvent = {
  id: string;
  title: string;
  artist?: string;
  venue: string;
  address?: string;
  latitude?: number;
  longitude?: number;
  openingStart?: string;
  openingEnd?: string;
  exhibitionStart?: string;
  exhibitionEnd?: string;
  eventType: 'opening' | 'exhibition' | 'talk' | 'performance' | 'screening' | 'other';
  source: EventSource;
  sourceUrl: string;
  description?: string;
  imageUrl?: string;
  tags?: string[];
  lastUpdated: string;
};

export type LocationPermissionStatus =
  | 'idle'
  | 'prompt'
  | 'loading'
  | 'granted'
  | 'denied'
  | 'error'
  | 'unsupported';

export type TimeframeFilter = 'all' | 'today' | 'tomorrow' | 'week';

export type DisplayEvent = ArtEvent & {
  distanceKm?: number;
  isFavorite: boolean;
};
