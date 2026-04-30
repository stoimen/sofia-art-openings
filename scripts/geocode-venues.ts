import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { ArtEvent } from '../src/types';

type VenueCache = Record<
  string,
  {
    latitude: number;
    longitude: number;
    displayName: string;
    updatedAt: string;
  }
>;

const directoryName = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(directoryName, '..');
const eventsPath = path.join(projectRoot, 'public', 'data', 'events.json');
const venuesPath = path.join(projectRoot, 'public', 'data', 'venues.json');

const userAgent =
  process.env.GEOCODER_USER_AGENT ??
  'SofiaArtOpeningsGeocoder/0.1 (+https://github.com/stoimen/sofia-art-openings)';

function normalizeKey(address: string) {
  return address.trim().toLowerCase();
}

function delay(milliseconds: number) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function readJsonFile<T>(filePath: string, fallbackValue: T) {
  try {
    const fileContents = await fs.readFile(filePath, 'utf8');
    return JSON.parse(fileContents) as T;
  } catch {
    return fallbackValue;
  }
}

async function geocodeAddress(address: string) {
  // Nominatim requires local, low-volume use and a clearly identifiable user agent.
  // Keep this script to small manual batches and do not parallelize requests.
  const url = new URL('https://nominatim.openstreetmap.org/search');
  url.searchParams.set('format', 'jsonv2');
  url.searchParams.set('limit', '1');
  url.searchParams.set('countrycodes', 'bg');
  url.searchParams.set('q', address);

  if (process.env.NOMINATIM_EMAIL) {
    url.searchParams.set('email', process.env.NOMINATIM_EMAIL);
  }

  const response = await fetch(url, {
    headers: {
      'user-agent': userAgent,
      'accept-language': 'en-US,en;q=0.8',
    },
  });

  if (!response.ok) {
    throw new Error(`Geocoding failed for "${address}" (${response.status})`);
  }

  const results = (await response.json()) as Array<{
    lat: string;
    lon: string;
    display_name: string;
  }>;

  if (results.length === 0) {
    return undefined;
  }

  const topResult = results[0];
  return {
    latitude: Number(topResult.lat),
    longitude: Number(topResult.lon),
    displayName: topResult.display_name,
    updatedAt: new Date().toISOString(),
  };
}

async function main() {
  const events = await readJsonFile<ArtEvent[]>(eventsPath, []);
  const cache = await readJsonFile<VenueCache>(venuesPath, {});

  let geocodedCount = 0;

  for (const event of events) {
    if (typeof event.latitude === 'number' && typeof event.longitude === 'number') {
      continue;
    }

    if (!event.address) {
      continue;
    }

    const cacheKey = normalizeKey(event.address);
    const cachedVenue = cache[cacheKey];

    if (cachedVenue) {
      event.latitude = cachedVenue.latitude;
      event.longitude = cachedVenue.longitude;
      continue;
    }

    try {
      const result = await geocodeAddress(`${event.address}, Sofia, Bulgaria`);
      if (result) {
        cache[cacheKey] = result;
        event.latitude = result.latitude;
        event.longitude = result.longitude;
        geocodedCount += 1;
      }
    } catch (error) {
      console.error(`Failed to geocode "${event.address}"`, error);
    }

    await delay(1100);
  }

  await fs.writeFile(venuesPath, `${JSON.stringify(cache, null, 2)}\n`, 'utf8');
  await fs.writeFile(eventsPath, `${JSON.stringify(events, null, 2)}\n`, 'utf8');

  console.log(`Updated ${geocodedCount} venues and rewrote public/data/events.json`);
}

void main();
