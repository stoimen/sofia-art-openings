# Sofia Art Openings

Sofia Art Openings is a mobile-first React + TypeScript + Vite PWA for browsing exhibitions, openings, and contemporary art events in Sofia, Bulgaria. It is designed to work as a static site on GitHub Pages while keeping the data layer ready for optional local import scripts.

## Features

- Grouped event list by date
- Nearby ranking with browser geolocation and Haversine distance
- Filters for `Today`, `Tomorrow`, `This week`, `Openings only`, `Saved only`, `Source`, free text, and max distance
- Favorites stored in `localStorage`
- One-click `.ics` calendar download per event
- Google Maps links for venues
- Installable PWA with cached shell assets, cached `events.json`, and an offline fallback page
- GitHub Pages deployment workflow

## Stack

- React 19
- TypeScript
- Vite
- `vite-plugin-pwa`
- Plain CSS
- Optional Node.js scripts with built-in type stripping and `cheerio`

## Local development

```bash
npm install
npm run dev
```

Open the local Vite URL shown in the terminal.

## NPM scripts

- `npm run dev` starts the local development server
- `npm run build` type-checks and creates the production build
- `npm run preview` serves the production build locally
- `npm run lint` runs ESLint
- `npm test` runs the Vitest unit suite
- `npm run test:watch` runs Vitest in watch mode
- `npm run import:events` runs the local importer and writes `public/data/events.json`
- `npm run geocode:venues` geocodes missing venue coordinates and updates `public/data/venues.json`

## Data model and loading

The app loads static JSON from:

- `public/data/events.json`
- `public/data/venues.json`

At runtime the browser only fetches the generated JSON file. There is no backend requirement, which keeps the app GitHub Pages compatible.

Two data modes are supported:

1. Static curated JSON mode for deployment.
2. Optional local import mode using Node.js scripts that fetch and normalize data before writing back to `public/data/events.json`.

The browser app validates and normalizes records, deduplicates by normalized title plus venue plus opening date, and handles missing coordinates gracefully.

## Updating event data

Manual curation:

1. Edit `public/data/events.json`.
2. Keep records aligned with `src/types.ts`.
3. Add coordinates directly when known, or run the geocoder script later.

Importer workflow:

```bash
npm run import:events
```

The importer is intentionally conservative:

- one importer entry per source
- isolated failure handling so one bad source does not break the whole import
- curated `sghg` entries are preserved because that site still needs source-specific selector work
- unchanged imported events keep their previous `lastUpdated` timestamp, so automated refreshes only create commits when source data actually changes

## Current source set

Official or venue-run sources:

- National Gallery Sofia: `https://nationalgallery.bg/exhibitions/`
- Sofia City Art Gallery: `https://sghg.bg/en/%D0%BD%D0%B0%D1%81%D1%82%D0%BE%D1%8F%D1%89%D0%B8/`
- ICA-Sofia: `https://www.ica-sofia.org/en/ica-gallery/exhibitions`
- Toplocentrala visual arts programme: `https://toplocentrala.bg/en/program/visual`
- Credo Bonum Gallery: `https://credobonum.bg/en/exhibitions/`
- HOSTGALLERY: `https://host.gallery/`
- Dechko Uzunov Art Gallery: `https://dug.sghg.bg/en/`

City-wide discovery source:

- Visit Sofia exhibitions calendar: `https://www.visitsofia.bg/en/exhibitions`

## Notes on the source mix

Unlike the Berlin version, Sofia has fewer broad art-opening aggregators with stable, scraper-friendly markup. Because of that:

- the app defaults to showing all exhibitions instead of openings only
- the seed dataset is curated from verified official pages
- `visitsofia` is useful for discovery and venue coverage
- `nationalgallery`, `sghg`, `icasofia`, and `toplocentrala` are the most reliable institutional sources

## Geocoding venues

```bash
NOMINATIM_EMAIL=you@example.com npm run geocode:venues
```

The geocoder:

- reads events without coordinates
- checks `public/data/venues.json` first
- queries OpenStreetMap Nominatim only for uncached addresses
- rate limits requests to respect the public usage policy
- updates both `public/data/venues.json` and `public/data/events.json`

Use Nominatim sparingly and only for small, local import batches. For production-scale geocoding, switch to a compliant paid provider or a self-hosted service.

## GitHub Pages deployment

1. Push this repository to the `main` branch.
2. In GitHub, open `Settings` → `Pages`.
3. Set the source to `GitHub Actions`.
4. Push to `main` or run the workflow manually.

The Vite base path is configured for GitHub Pages:

```ts
base: process.env.GITHUB_REPOSITORY
  ? `/${process.env.GITHUB_REPOSITORY.split('/')[1]}/`
  : "/"
```

The workflow file is at `.github/workflows/deploy.yml`.

## Automated refreshes

The repository also includes a scheduled refresh workflow at `.github/workflows/refresh-data.yml`.

- It runs every Monday at `03:34 UTC`.
- It executes `npm run import:events`.
- If `public/data/events.json` changed, it commits the refreshed file back to `main`.
- It then builds and deploys the updated static site to GitHub Pages in the same workflow run.

This is intentionally separate from the normal push deploy workflow because GitHub Pages is static hosting only: the browser app cannot scrape sources live at runtime.

## Static hosting limitations and CORS

GitHub Pages cannot run server-side scraping. Because of that:

- the browser app does not scrape third-party pages live
- the runtime relies on static JSON only
- import and geocoding scripts run locally before deployment

Direct browser scraping is intentionally avoided because CORS, bot protection, and HTML instability make it unreliable.

## Source reliability note

Nearby ranking uses:

1. opening soonest
2. distance from the user
3. source reliability

When the same event appears in two sources, the more reliable source's record
also wins as the canonical entry during deduplication (in `normalizeAndDeduplicateEvents`).

### Reliability weights

Lower numbers mean more reliable. The defaults live in `src/api/events.ts`:

| Source           | Weight | Rationale                                                                 |
| ---------------- | -----: | ------------------------------------------------------------------------- |
| `nationalgallery` |     1 | Official institution, stable curated calendar.                            |
| `sghg`            |     1 | Sofia City Art Gallery, official institutional calendar.                  |
| `icasofia`        |     1 | ICA-Sofia, well-curated and consistently dated.                           |
| `toplocentrala`   |     1 | Toplocentrala, stable visual-arts programme listing.                      |
| `credobonum`      |     1 | Single venue with clean per-exhibition pages.                             |
| `hostgallery`     |     1 | Single venue, hand-edited landing page.                                   |
| `dechkouzunov`    |     1 | Dechko Uzunov gallery, institutional calendar.                            |
| `visitsofia`      |     2 | Aggregator with broad coverage but weaker per-event metadata.             |
| `programata`      |     3 | Generalist city listings; useful for discovery, noisier metadata.         |
| `manual`          |     3 | Curated entries; intentionally low so any scraped institutional record wins on conflict. |

Update the weights when a source's data quality changes — keep the table above in sync.

## Test plan

```bash
npm test
```

Vitest covers the high-risk pure logic: date parsing/grouping, distance,
`.ics` escaping, and the normalize-and-deduplicate pipeline. Tests run on
every push and refresh through GitHub Actions.

## Scraping and legal note

Scraping public event pages can be technically and legally fragile. Prefer official calendars and institutional exhibition pages where available. Treat `scripts/import-events.ts` as a local convenience tool rather than a guaranteed production ingestion pipeline.
