import { Timestamp } from 'firebase-admin/firestore';
import * as logger from 'firebase-functions/logger';
import { db } from '../firebase.js';
import {
  cleanAddressForGeocoding,
  coordinatesPlausibleForMunicipality,
  parseRtaRecord,
  type OfficialVutRecord,
} from '../domain/openrta.js';
import { buildOfficialCells } from '../domain/openrta-cells.js';

const SEARCH_URL = 'https://datos.juntadeandalucia.es/api/v0/openrta/search';
const PAGE_SIZE = 10_000;

/**
 * Andalusian municipalities we mirror (OpenRTA enum spelling). The API cannot
 * paginate beyond 10k, but an ASC+DESC pass by id covers up to 20k per
 * municipality — enough for every current value (Málaga tops at ~12.7k).
 */
export const SYNCED_MUNICIPALITIES: readonly string[] = [
  'SEVILLA',
  'MÁLAGA',
  'GRANADA',
  'CÓRDOBA',
  'CÁDIZ',
  'HUELVA',
  'JAÉN',
  'ALMERÍA',
  'JEREZ DE LA FRONTERA',
  'MARBELLA',
];

async function fetchPage(
  municipality: string,
  mode: 'ASC' | 'DESC',
  fetchImplementation: typeof fetch,
): Promise<{ totalHits: number; results: Record<string, unknown>[] }> {
  const url = new URL(SEARCH_URL);
  const params: Record<string, string> = {
    id: '-',
    object_type: 'Vivienda de uso turístico',
    category: '-',
    group: '-',
    modality: '-',
    province: '-',
    municipality,
    order_by: 'id',
    mode,
    size: String(PAGE_SIZE),
  };
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  const response = await fetchImplementation(url, { signal: AbortSignal.timeout(120_000) });
  if (!response.ok) {
    throw new Error(`OpenRTA devolvió HTTP ${response.status} para ${municipality}`);
  }
  const payload = (await response.json()) as {
    total_hits?: number;
    results?: Record<string, unknown>[];
  };
  return { totalHits: payload.total_hits ?? 0, results: payload.results ?? [] };
}

async function fetchMunicipality(
  municipality: string,
  fetchImplementation: typeof fetch,
): Promise<OfficialVutRecord[]> {
  const ascending = await fetchPage(municipality, 'ASC', fetchImplementation);
  const rows = new Map<unknown, Record<string, unknown>>();
  for (const row of ascending.results) rows.set(row.id, row);
  if (ascending.totalHits > PAGE_SIZE) {
    const descending = await fetchPage(municipality, 'DESC', fetchImplementation);
    for (const row of descending.results) rows.set(row.id, row);
    if (ascending.totalHits > PAGE_SIZE * 2) {
      logger.warn('OpenRTA municipality exceeds double-pass coverage', {
        municipality,
        totalHits: ascending.totalHits,
      });
    }
  }
  const records: OfficialVutRecord[] = [];
  for (const row of rows.values()) {
    const record = parseRtaRecord(row);
    if (record !== null) records.push(record);
  }
  return records;
}

async function writeBatched(records: OfficialVutRecord[], geohashFor: GeohashFn): Promise<void> {
  const CHUNK = 400;
  for (let index = 0; index < records.length; index += CHUNK) {
    const batch = db.batch();
    for (const record of records.slice(index, index + CHUNK)) {
      const reference = db.collection('officialVut').doc(`rta-${record.rtaId}`);
      batch.set(reference, {
        ...record,
        geohash:
          record.latitude !== null && record.longitude !== null
            ? geohashFor([record.latitude, record.longitude])
            : null,
        syncedAt: Timestamp.now(),
      });
    }
    await batch.commit();
  }
}

type GeohashFn = (location: [number, number], precision?: number) => string;

/**
 * Address-based repair for records whose source coordinates are missing or
 * implausible (some RTA rows are typed hundreds of km away). Results — also
 * the failures — persist in `officialGeoCache`, so each address is paid to
 * the Geocoding API at most once across weekly syncs.
 */
const GEO_CACHE_COLLECTION = 'officialGeoCache';
const MAX_GEOCODES_PER_RUN = 700;

/** Bump when the geocoding query improves: cached failures from older
 * versions are retried once with the new query shape. */
const GEOCODE_QUERY_VERSION = 4;

/** Pace towards the Geocoding API: ~2 requests/second keeps us well under
 * the per-minute quota that OVER_QUERY_LIMIT enforces. */
const GEOCODE_PACE_MS = 500;

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

/** Failures worth retrying on a future run: never cache them as permanent. */
function isTransientGeocodeFailure(failure: string): boolean {
  return (
    failure.startsWith('http_') ||
    failure === 'status_OVER_QUERY_LIMIT' ||
    failure === 'status_UNKNOWN_ERROR' ||
    failure === 'exception'
  );
}

/** Result types too coarse to pin a dwelling: a marker at the city center or
 * postal-code centroid would mislead. Anything finer (neighborhood, route,
 * premise…) is acceptable — the municipality radius already guards gross errors. */
const COARSE_RESULT_TYPES = new Set([
  'locality',
  'postal_code',
  'postal_code_prefix',
  'administrative_area_level_1',
  'administrative_area_level_2',
  'administrative_area_level_3',
  'administrative_area_level_4',
  'country',
  'political',
]);

interface GeocodeState {
  apiKey: string;
  remaining: number;
  failures: Record<string, number>;
  /** Consecutive rate-limited addresses; trips the circuit breaker. */
  rateLimitedStreak: number;
}

interface GeoCacheEntry {
  latitude: number | null;
  longitude: number | null;
  version: number;
}

async function readGeoCache(ids: string[]): Promise<Map<string, GeoCacheEntry>> {
  const entries = new Map<string, GeoCacheEntry>();
  for (let index = 0; index < ids.length; index += 300) {
    const references = ids
      .slice(index, index + 300)
      .map((id) => db.collection(GEO_CACHE_COLLECTION).doc(id));
    const snapshots = await db.getAll(...references);
    for (const snapshot of snapshots) {
      if (!snapshot.exists) continue;
      const data = snapshot.data() ?? {};
      entries.set(snapshot.id, {
        latitude: typeof data.latitude === 'number' ? data.latitude : null,
        longitude: typeof data.longitude === 'number' ? data.longitude : null,
        version: typeof data.version === 'number' ? data.version : 1,
      });
    }
  }
  return entries;
}

type GeocodeOutcome =
  { located: { latitude: number; longitude: number } } | { located: null; failure: string };

async function geocodeOfficialAddress(
  record: OfficialVutRecord,
  apiKey: string,
  fetchImplementation: typeof fetch,
): Promise<GeocodeOutcome> {
  const url = new URL('https://maps.googleapis.com/maps/api/geocode/json');
  url.searchParams.set(
    'address',
    `${cleanAddressForGeocoding(record.addressText)}, ${record.postalCode} ${record.municipality}, España`,
  );
  url.searchParams.set('components', 'country:ES');
  url.searchParams.set('language', 'es');
  url.searchParams.set('region', 'es');
  url.searchParams.set('key', apiKey);
  const response = await fetchImplementation(url, { signal: AbortSignal.timeout(8_000) });
  if (!response.ok) return { located: null, failure: `http_${response.status}` };
  const payload = (await response.json()) as {
    status?: unknown;
    results?: Array<{
      types?: unknown;
      geometry?: { location?: { lat?: unknown; lng?: unknown } };
    }>;
  };
  if (payload.status !== 'OK' || !Array.isArray(payload.results)) {
    const status = typeof payload.status === 'string' ? payload.status : 'unknown';
    return { located: null, failure: `status_${status}` };
  }
  const result = payload.results[0];
  const latitude = Number(result?.geometry?.location?.lat);
  const longitude = Number(result?.geometry?.location?.lng);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return { located: null, failure: 'no_geometry' };
  }
  const types = Array.isArray(result?.types)
    ? result.types.filter((t) => typeof t === 'string')
    : [];
  if (types.length > 0 && types.every((type) => COARSE_RESULT_TYPES.has(type))) {
    return { located: null, failure: 'coarse_result' };
  }
  if (!coordinatesPlausibleForMunicipality(record.municipality, latitude, longitude)) {
    return { located: null, failure: 'implausible' };
  }
  return { located: { latitude, longitude } };
}

async function repairMissingCoordinates(
  records: OfficialVutRecord[],
  state: GeocodeState,
  fetchImplementation: typeof fetch,
): Promise<number> {
  const missing = records.filter((record) => record.latitude === null || record.longitude === null);
  if (missing.length === 0) return 0;
  const cache = await readGeoCache(missing.map((record) => `rta-${record.rtaId}`));
  const cacheWrites: Array<{ id: string; data: Record<string, unknown> }> = [];
  let repaired = 0;
  for (const record of missing) {
    const id = `rta-${record.rtaId}`;
    const cached = cache.get(id);
    if (cached !== undefined) {
      if (cached.latitude !== null && cached.longitude !== null) {
        record.latitude = cached.latitude;
        record.longitude = cached.longitude;
        repaired += 1;
        continue;
      }
      // Failed with the current query shape: don't pay for it again.
      if (cached.version >= GEOCODE_QUERY_VERSION) continue;
    }
    if (state.apiKey.length === 0 || state.remaining <= 0) continue;
    state.remaining -= 1;
    let outcome: GeocodeOutcome = { located: null, failure: 'exception' };
    for (let attempt = 0; attempt < 3; attempt += 1) {
      outcome = await geocodeOfficialAddress(record, state.apiKey, fetchImplementation).catch(
        (): GeocodeOutcome => ({ located: null, failure: 'exception' }),
      );
      if (outcome.located !== null || outcome.failure !== 'status_OVER_QUERY_LIMIT') break;
      // Rate limited: back off before retrying this same address.
      await delay(5_000 * (attempt + 1));
    }
    await delay(GEOCODE_PACE_MS);
    const located = outcome.located;
    if (located === null) {
      const failure = 'failure' in outcome ? outcome.failure : 'unknown';
      state.failures[failure] = (state.failures[failure] ?? 0) + 1;
      if (failure === 'status_OVER_QUERY_LIMIT') {
        state.rateLimitedStreak += 1;
        // Quota is exhausted for this run: stop burning time and retry on
        // the next sync (transient failures are never cached).
        if (state.rateLimitedStreak >= 5) state.remaining = 0;
      } else {
        state.rateLimitedStreak = 0;
      }
      if (isTransientGeocodeFailure(failure)) continue;
    } else {
      state.rateLimitedStreak = 0;
    }
    cacheWrites.push({
      id,
      data: {
        latitude: located?.latitude ?? null,
        longitude: located?.longitude ?? null,
        addressText: record.addressText,
        municipality: record.municipality,
        source: 'geocoding',
        version: GEOCODE_QUERY_VERSION,
        updatedAt: Timestamp.now(),
      },
    });
    if (located !== null) {
      record.latitude = located.latitude;
      record.longitude = located.longitude;
      repaired += 1;
    }
  }
  const CHUNK = 400;
  for (let index = 0; index < cacheWrites.length; index += CHUNK) {
    const batch = db.batch();
    for (const { id, data } of cacheWrites.slice(index, index + CHUNK)) {
      batch.set(db.collection(GEO_CACHE_COLLECTION).doc(id), data);
    }
    await batch.commit();
  }
  return repaired;
}

/**
 * Overwrites a mirror collection with the freshly computed documents and
 * deletes any document that no longer exists (stale cells after a resync).
 */
async function replaceCollection(
  name: string,
  documents: Array<{ id: string; data: Record<string, unknown> }>,
): Promise<void> {
  const existing = await db.collection(name).select().get();
  const nextIds = new Set(documents.map((document) => document.id));
  const stale = existing.docs.map((snapshot) => snapshot.id).filter((id) => !nextIds.has(id));
  const CHUNK = 400;
  for (let index = 0; index < documents.length; index += CHUNK) {
    const batch = db.batch();
    for (const { id, data } of documents.slice(index, index + CHUNK)) {
      batch.set(db.collection(name).doc(id), data);
    }
    await batch.commit();
  }
  for (let index = 0; index < stale.length; index += CHUNK) {
    const batch = db.batch();
    for (const id of stale.slice(index, index + CHUNK)) {
      batch.delete(db.collection(name).doc(id));
    }
    await batch.commit();
  }
}

export interface OpenRtaSyncSummary {
  municipalities: number;
  records: number;
}

export async function runOpenRtaSync(
  fetchImplementation: typeof fetch,
  geohashFor: GeohashFn,
  geocodeApiKey = '',
): Promise<OpenRtaSyncSummary> {
  let total = 0;
  let repairedTotal = 0;
  const geocodeState: GeocodeState = {
    apiKey: geocodeApiKey,
    remaining: MAX_GEOCODES_PER_RUN,
    failures: {},
    rateLimitedStreak: 0,
  };
  const allRecords: OfficialVutRecord[] = [];
  for (const municipality of SYNCED_MUNICIPALITIES) {
    const records = await fetchMunicipality(municipality, fetchImplementation);
    const repaired = await repairMissingCoordinates(records, geocodeState, fetchImplementation);
    repairedTotal += repaired;
    allRecords.push(...records);
    await writeBatched(records, geohashFor);
    const cityId = records[0]?.cityId;
    if (cityId !== undefined) {
      const entire = records.filter((record) => record.entire);
      await db
        .collection('officialStats')
        .doc(cityId)
        .set({
          cityId,
          municipality,
          total: records.length,
          entireHomes: entire.length,
          roomsOnly: records.length - entire.length,
          places: records.reduce((sum, record) => sum + record.places, 0),
          withLocation: records.filter((record) => record.latitude !== null).length,
          source: 'openrta',
          updatedAt: Timestamp.now(),
        });
    }
    total += records.length;
    logger.info('OpenRTA municipality synced', {
      municipality,
      records: records.length,
      repairedCoordinates: repaired,
    });
  }
  logger.info('OpenRTA coordinate repair', {
    repaired: repairedTotal,
    geocodesLeft: geocodeState.remaining,
    failures: geocodeState.failures,
  });

  // Geohash cell mirror: the map reads these aggregated bubbles (and the
  // embedded pins at street zoom) instead of querying 50k individual docs.
  const { cells, pinCells } = buildOfficialCells(allRecords, geohashFor);
  const builtAt = Timestamp.now();
  await replaceCollection(
    'officialCells',
    cells.map((cell) => ({
      id: cell.id,
      data: {
        precision: cell.precision,
        lat: cell.lat,
        lng: cell.lng,
        count: cell.count,
        entireCount: cell.entireCount,
        updatedAt: builtAt,
      },
    })),
  );
  await replaceCollection(
    'officialCellPins',
    pinCells.map((cell) => ({
      id: cell.id,
      data: {
        lat: cell.lat,
        lng: cell.lng,
        count: cell.count,
        pins: cell.pins,
        updatedAt: builtAt,
      },
    })),
  );
  logger.info('OpenRTA cells rebuilt', { cells: cells.length, pinCells: pinCells.length });
  return { municipalities: SYNCED_MUNICIPALITIES.length, records: total };
}
