import { Timestamp } from 'firebase-admin/firestore';
import * as logger from 'firebase-functions/logger';
import { db } from '../firebase.js';
import {
  cleanAddressForGeocoding,
  coordinatesPlausibleForMunicipality,
  parseRtaRecord,
  type OfficialVutRecord,
} from '../domain/openrta.js';
import { buildOfficialCells, roomsInhabitantsForPlaces } from '../domain/openrta-cells.js';
import { contentHash, isSuspiciousDrop } from '../domain/sync-integrity.js';
import { parseCatastroCoordinates, GVA_MUNICIPALITIES } from '../domain/gva.js';
import { createCatalunyaFetcher } from './catalunya-source.js';
import { createValenciaFetcher } from './valencia-source.js';
import { createMallorcaFetcher } from './mallorca-source.js';
import { createNavarraFetcher } from './navarra-source.js';
import { createEuskadiFetcher } from './euskadi-source.js';
import { EUSKADI_MUNICIPALITIES } from '../domain/euskadi.js';
import {
  cartoCiudadMunicipality,
  cartoCiudadMuniMatches,
  parseCartoCiudadResponse,
} from '../domain/cartociudad.js';
import { createMadridFetcher } from './madrid-source.js';
import { NAVARRA_MUNICIPALITIES } from '../domain/navarra.js';

/* ------------------------------- Sources ---------------------------------- */

export type OfficialSourceId = 'rta' | 'cat' | 'gva' | 'caib' | 'nav' | 'eus' | 'mad';

/**
 * One mirrored registry. The runner is source-agnostic: every source turns
 * its upstream into `OfficialVutRecord`s and the diff/purge/cells machinery
 * is shared. Doc ids are prefixed per source so the ghost purge of one
 * registry can never touch another's mirror.
 */
interface OfficialSource {
  id: OfficialSourceId;
  /** officialVut / officialGeoCache doc-id prefix, scoping the purge. */
  idPrefix: string;
  /** Persisted in officialStats.source; the city pages pick the credit line. */
  statsSource: string;
  municipalities: readonly string[];
  prepare?: (fetchImplementation: typeof fetch) => Promise<void>;
  fetchMunicipality: (
    municipality: string,
    fetchImplementation: typeof fetch,
  ) => Promise<OfficialVutRecord[]>;
}

const RTA_SEARCH_URL = 'https://datos.juntadeandalucia.es/api/v0/openrta/search';
const RTA_PAGE_SIZE = 10_000;

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

/** Catalan municipalities mirrored from the Registre de Turisme (Socrata
 * spelling). Coordinates come from the city-hall open-data join. */
export const SYNCED_CAT_MUNICIPALITIES: readonly string[] = ['Barcelona', 'Girona', 'Tarragona'];

/** Valencian municipalities mirrored from the GVA register (canonical
 * spelling of domain/gva.ts). Coordinates resolve via the Catastro. */
export const SYNCED_GVA_MUNICIPALITIES: readonly string[] = GVA_MUNICIPALITIES.map(
  (entry) => entry.name,
);

/** Mallorcan municipalities mirrored from the insular register (Municipi
 * spelling, uppercase). Half the features carry WGS84 geometry; the rest
 * geocode by address. */
export const SYNCED_CAIB_MUNICIPALITIES: readonly string[] = ['PALMA', 'CALVIÀ', 'ALCÚDIA'];

/** Navarrese municipalities mirrored from the Registro de Turismo (canonical
 * spelling of domain/navarra.ts). No coordinates upstream: all geocoded. */
export const SYNCED_NAV_MUNICIPALITIES: readonly string[] = NAVARRA_MUNICIPALITIES.map(
  (entry) => entry.name,
);

/** Basque municipalities mirrored from the REATE files (canonical spelling
 * of domain/euskadi.ts). No coordinates upstream: CartoCiudad first, then
 * the Geocoding API for the remainder. */
export const SYNCED_EUS_MUNICIPALITIES: readonly string[] = EUSKADI_MUNICIPALITIES.map(
  (entry) => entry.name,
);

/** Madrid capital, mirrored from the Comunidad de Madrid declarations log.
 * Synthetic ids, no upstream coordinates: CartoCiudad locates the portals. */
export const SYNCED_MAD_MUNICIPALITIES: readonly string[] = ['MADRID'];

async function fetchRtaPage(
  municipality: string,
  mode: 'ASC' | 'DESC',
  fetchImplementation: typeof fetch,
): Promise<{ totalHits: number; results: Record<string, unknown>[] }> {
  const url = new URL(RTA_SEARCH_URL);
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
    size: String(RTA_PAGE_SIZE),
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

async function fetchRtaMunicipality(
  municipality: string,
  fetchImplementation: typeof fetch,
): Promise<OfficialVutRecord[]> {
  const ascending = await fetchRtaPage(municipality, 'ASC', fetchImplementation);
  const rows = new Map<unknown, Record<string, unknown>>();
  for (const row of ascending.results) rows.set(row.id, row);
  if (ascending.totalHits > RTA_PAGE_SIZE) {
    const descending = await fetchRtaPage(municipality, 'DESC', fetchImplementation);
    for (const row of descending.results) rows.set(row.id, row);
    if (ascending.totalHits > RTA_PAGE_SIZE * 2) {
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

function buildSource(id: OfficialSourceId): OfficialSource {
  if (id === 'rta') {
    return {
      id,
      idPrefix: 'rta-',
      statsSource: 'openrta',
      municipalities: SYNCED_MUNICIPALITIES,
      fetchMunicipality: fetchRtaMunicipality,
    };
  }
  if (id === 'cat') {
    const fetcher = createCatalunyaFetcher();
    return {
      id,
      idPrefix: 'cat-',
      statsSource: 'rtc',
      municipalities: SYNCED_CAT_MUNICIPALITIES,
      prepare: fetcher.prepare,
      fetchMunicipality: fetcher.fetchMunicipality,
    };
  }
  if (id === 'gva') {
    const fetcher = createValenciaFetcher();
    return {
      id,
      idPrefix: 'gva-',
      statsSource: 'gva',
      municipalities: SYNCED_GVA_MUNICIPALITIES,
      prepare: fetcher.prepare,
      fetchMunicipality: fetcher.fetchMunicipality,
    };
  }
  if (id === 'caib') {
    const fetcher = createMallorcaFetcher();
    return {
      id,
      idPrefix: 'caib-',
      statsSource: 'caib',
      municipalities: SYNCED_CAIB_MUNICIPALITIES,
      prepare: fetcher.prepare,
      fetchMunicipality: fetcher.fetchMunicipality,
    };
  }
  if (id === 'nav') {
    const fetcher = createNavarraFetcher();
    return {
      id,
      idPrefix: 'nav-',
      statsSource: 'nav',
      municipalities: SYNCED_NAV_MUNICIPALITIES,
      prepare: fetcher.prepare,
      fetchMunicipality: fetcher.fetchMunicipality,
    };
  }
  if (id === 'eus') {
    const fetcher = createEuskadiFetcher();
    return {
      id,
      idPrefix: 'eus-',
      statsSource: 'eus',
      municipalities: SYNCED_EUS_MUNICIPALITIES,
      prepare: fetcher.prepare,
      fetchMunicipality: fetcher.fetchMunicipality,
    };
  }
  const fetcher = createMadridFetcher();
  return {
    id,
    idPrefix: 'mad-',
    statsSource: 'mad',
    municipalities: SYNCED_MAD_MUNICIPALITIES,
    prepare: fetcher.prepare,
    fetchMunicipality: fetcher.fetchMunicipality,
  };
}

/* ------------------------- Differential mirror I/O ------------------------ */

const BATCH_SIZE = 400;
const PARALLEL_BATCHES = 5;

interface DiffDoc {
  id: string;
  /** Persisted fields, timestamps excluded from the hash. */
  data: Record<string, unknown>;
  hash: string;
}

interface DiffCounters {
  written: number;
  skipped: number;
  deleted: number;
}

/** Ids → stored contentHash ('' for legacy docs written before hashing). */
async function loadExistingHashes(name: string): Promise<Map<string, string>> {
  const snapshot = await db.collection(name).select('contentHash').get();
  const hashes = new Map<string, string>();
  for (const document of snapshot.docs) {
    const value: unknown = document.get('contentHash');
    hashes.set(document.id, typeof value === 'string' ? value : '');
  }
  return hashes;
}

async function commitChunks(operations: Array<(batch: FirebaseFirestore.WriteBatch) => void>) {
  const chunks: Array<Array<(batch: FirebaseFirestore.WriteBatch) => void>> = [];
  for (let index = 0; index < operations.length; index += BATCH_SIZE) {
    chunks.push(operations.slice(index, index + BATCH_SIZE));
  }
  for (let index = 0; index < chunks.length; index += PARALLEL_BATCHES) {
    await Promise.all(
      chunks.slice(index, index + PARALLEL_BATCHES).map((chunk) => {
        const batch = db.batch();
        for (const operation of chunk) operation(batch);
        return batch.commit();
      }),
    );
  }
}

/** Writes only the documents whose content changed since the last sync. */
async function writeDocsDiff(
  name: string,
  documents: DiffDoc[],
  existing: Map<string, string>,
  counters: DiffCounters,
): Promise<void> {
  const stamp = Timestamp.now();
  const operations: Array<(batch: FirebaseFirestore.WriteBatch) => void> = [];
  for (const { id, data, hash } of documents) {
    if (existing.get(id) === hash) {
      counters.skipped += 1;
      continue;
    }
    operations.push((batch) =>
      batch.set(db.collection(name).doc(id), { ...data, contentHash: hash, updatedAt: stamp }),
    );
    counters.written += 1;
  }
  await commitChunks(operations);
}

async function deleteDocs(name: string, ids: string[], counters: DiffCounters): Promise<void> {
  counters.deleted += ids.length;
  await commitChunks(ids.map((id) => (batch) => batch.delete(db.collection(name).doc(id))));
}

/* ------------------------------ Sync lock -------------------------------- */

const LOCK_LEASE_MS = 45 * 60 * 1000;

/**
 * Lease-based mutual exclusion between the weekly jobs (one per registry) and
 * the admin-panel trigger: two concurrent runs would interleave their diffs,
 * deletions and the shared cell rebuild.
 */
async function acquireSyncLock(): Promise<() => Promise<void>> {
  const reference = db.doc('syncLocks/openrta');
  await db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(reference);
    const lockedAt: unknown = snapshot.exists ? snapshot.get('lockedAt') : undefined;
    if (lockedAt instanceof Timestamp && Date.now() - lockedAt.toMillis() < LOCK_LEASE_MS) {
      throw new Error('Ya hay una sincronización de datos oficiales en curso.');
    }
    transaction.set(reference, { lockedAt: Timestamp.now() });
  });
  return async () => {
    await reference.delete().catch(() => undefined);
  };
}

/* --------------------- Coordinate repair (geocoding) ---------------------- */

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

/** Wall-clock budget for the whole repair phase: a degraded network must
 * never eat the function timeout and lose the run mid-way. */
const GEOCODE_TIME_BUDGET_MS = 12 * 60 * 1000;

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
  /** Consecutive transient failures; trips the circuit breaker. */
  transientStreak: number;
  startedAt: number;
}

function createGeocodeState(apiKey: string): GeocodeState {
  return {
    apiKey,
    remaining: MAX_GEOCODES_PER_RUN,
    failures: {},
    transientStreak: 0,
    startedAt: Date.now(),
  };
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
  const cache = await readGeoCache(missing.map((record) => record.id));
  const cacheWrites: Array<{ id: string; data: Record<string, unknown> }> = [];
  let repaired = 0;
  for (const record of missing) {
    const cached = cache.get(record.id);
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
    if (Date.now() - state.startedAt > GEOCODE_TIME_BUDGET_MS) {
      state.remaining = 0;
      continue;
    }
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
      if (isTransientGeocodeFailure(failure)) {
        state.transientStreak += 1;
        // The upstream is down or the quota is spent: stop burning time and
        // retry on the next sync (transient failures are never cached).
        const breakerLimit = failure === 'status_OVER_QUERY_LIMIT' ? 5 : 10;
        if (state.transientStreak >= breakerLimit) state.remaining = 0;
        continue;
      }
      state.transientStreak = 0;
    } else {
      state.transientStreak = 0;
    }
    cacheWrites.push({
      id: record.id,
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
  await commitChunks(
    cacheWrites.map(({ id, data }) => (batch: FirebaseFirestore.WriteBatch) => {
      batch.set(db.collection(GEO_CACHE_COLLECTION).doc(id), data);
    }),
  );
  return repaired;
}

/* --------------------- Coordinate repair (Catastro) ----------------------- */

/**
 * Free coordinate resolution for records that carry a cadastral reference
 * (the GVA register): the Sede del Catastro returns the parcel centroid,
 * street-level precision without touching the Geocoding quota. Results and
 * definitive failures persist in `officialGeoCache` under `catastro-<id>`,
 * a namespace separate from the Google entries so both repairs can retry
 * independently.
 */
const CATASTRO_URL =
  'https://ovc.catastro.meh.es/ovcservweb/OVCSWLocalizacionRC/OVCCoordenadas.asmx/Consulta_CPMRC';
const CATASTRO_MAX_PER_RUN = 8_000;
const CATASTRO_PACE_MS = 150;
const CATASTRO_TIME_BUDGET_MS = 15 * 60 * 1000;
/** Polite parallelism against the public service: latency dominates the
 * sequential loop, three lanes triple the throughput at ~7 req/s. */
const CATASTRO_CONCURRENCY = 3;
const CATASTRO_QUERY_VERSION = 1;

interface CatastroState {
  remaining: number;
  transientStreak: number;
  failures: Record<string, number>;
  startedAt: number;
}

function createCatastroState(): CatastroState {
  // startedAt arranca en el primer intento real (0 = aún sin arrancar): el
  // presupuesto de tiempo no debe pagar las descargas previas del registro.
  return { remaining: CATASTRO_MAX_PER_RUN, transientStreak: 0, failures: {}, startedAt: 0 };
}

interface CatastroRepairResult {
  repaired: number;
  /** Records with a cadastral reference this run could not attempt (budget,
   * time or transient failures): the paid Geocoding API must NOT touch them —
   * a future run resolves them for free. */
  deferredIds: Set<string>;
}

async function repairViaCatastro(
  records: OfficialVutRecord[],
  state: CatastroState,
  fetchImplementation: typeof fetch,
): Promise<CatastroRepairResult> {
  const missing = records.filter(
    (record) =>
      (record.latitude === null || record.longitude === null) &&
      typeof record.cadastralRef === 'string',
  );
  const deferredIds = new Set<string>();
  if (missing.length === 0) return { repaired: 0, deferredIds };
  const cache = await readGeoCache(missing.map((record) => `catastro-${record.id}`));
  const cacheWrites: Array<{ id: string; data: Record<string, unknown> }> = [];
  let repaired = 0;

  const queue: OfficialVutRecord[] = [];
  for (const record of missing) {
    const cached = cache.get(`catastro-${record.id}`);
    if (cached !== undefined) {
      if (cached.latitude !== null && cached.longitude !== null) {
        record.latitude = cached.latitude;
        record.longitude = cached.longitude;
        repaired += 1;
        continue;
      }
      // Definitive failure with the current query shape: Google may try it.
      if (cached.version >= CATASTRO_QUERY_VERSION) continue;
    }
    queue.push(record);
  }

  let queueIndex = 0;
  const attemptOne = async (record: OfficialVutRecord): Promise<void> => {
    let located: { latitude: number; longitude: number } | null = null;
    let permanentFailure = false;
    try {
      const url = new URL(CATASTRO_URL);
      url.searchParams.set('Provincia', '');
      url.searchParams.set('Municipio', '');
      url.searchParams.set('SRS', 'EPSG:4326');
      // RC14 = parcel reference; the service ignores the property extras.
      url.searchParams.set('RC', (record.cadastralRef ?? '').slice(0, 14));
      const response = await fetchImplementation(url, { signal: AbortSignal.timeout(10_000) });
      if (response.ok) {
        located = parseCatastroCoordinates(await response.text());
        // A well-formed answer without coordinates is a bad reference:
        // definitive, cache it so it is never paid again.
        permanentFailure = located === null;
      }
    } catch {
      located = null;
    }
    if (
      located !== null &&
      !coordinatesPlausibleForMunicipality(record.municipality, located.latitude, located.longitude)
    ) {
      located = null;
      permanentFailure = true;
      state.failures.implausible = (state.failures.implausible ?? 0) + 1;
    }
    if (located === null && !permanentFailure) {
      // Network/service hiccup: retry on a future run, trip the breaker if
      // the upstream looks down.
      state.failures.transient = (state.failures.transient ?? 0) + 1;
      state.transientStreak += 1;
      if (state.transientStreak >= 8) state.remaining = 0;
      deferredIds.add(record.id);
      return;
    }
    state.transientStreak = 0;
    cacheWrites.push({
      id: `catastro-${record.id}`,
      data: {
        latitude: located?.latitude ?? null,
        longitude: located?.longitude ?? null,
        cadastralRef: record.cadastralRef,
        municipality: record.municipality,
        source: 'catastro',
        version: CATASTRO_QUERY_VERSION,
        updatedAt: Timestamp.now(),
      },
    });
    if (located !== null) {
      record.latitude = located.latitude;
      record.longitude = located.longitude;
      repaired += 1;
    } else {
      state.failures.bad_reference = (state.failures.bad_reference ?? 0) + 1;
    }
  };

  const worker = async (): Promise<void> => {
    for (;;) {
      if (state.remaining <= 0) return;
      if (state.startedAt === 0) state.startedAt = Date.now();
      if (Date.now() - state.startedAt > CATASTRO_TIME_BUDGET_MS) {
        state.remaining = 0;
        return;
      }
      const record = queue[queueIndex];
      if (record === undefined) return;
      queueIndex += 1;
      state.remaining -= 1;
      await attemptOne(record);
      await delay(CATASTRO_PACE_MS);
    }
  };
  await Promise.all(Array.from({ length: CATASTRO_CONCURRENCY }, () => worker()));

  // Whatever the budget/time cut off keeps its free chance for next run.
  for (const record of queue.slice(queueIndex)) deferredIds.add(record.id);

  await commitChunks(
    cacheWrites.map(({ id, data }) => (batch: FirebaseFirestore.WriteBatch) => {
      batch.set(db.collection(GEO_CACHE_COLLECTION).doc(id), data);
    }),
  );
  return { repaired, deferredIds };
}

/* -------------------- Coordinate repair (CartoCiudad) ---------------------- */

/**
 * Free portal-level geocoding via the IGN's CartoCiudad for records without
 * coordinates nor cadastral reference. Same contract as the Catastro lane:
 * results and definitive failures cache under `carto-<id>`, and whatever the
 * budget could not attempt is deferred so the paid Geocoding API never pays
 * for an address a future free pass can resolve.
 */
const CARTOCIUDAD_URL = 'https://www.cartociudad.es/geocoder/api/geocoder/findJsonp';
const CARTOCIUDAD_MAX_PER_RUN = 3_000;
const CARTOCIUDAD_PACE_MS = 200;
const CARTOCIUDAD_CONCURRENCY = 2;
/** Per-call window: each municipality gets its own slice so the first one
 * of a run can never starve the rest (Bilbao learned this the hard way). */
const CARTOCIUDAD_TIME_BUDGET_MS = 6 * 60 * 1000;
/** v2: la consulta ya no incluye el código postal (con él, el servicio
 * devolvía vacío); los fallos cacheados con v1 se reintentan una vez. */
const CARTOCIUDAD_QUERY_VERSION = 2;

interface CartoCiudadState {
  remaining: number;
  transientStreak: number;
  failures: Record<string, number>;
  startedAt: number;
}

function createCartoCiudadState(): CartoCiudadState {
  return { remaining: CARTOCIUDAD_MAX_PER_RUN, transientStreak: 0, failures: {}, startedAt: 0 };
}

async function repairViaCartoCiudad(
  records: OfficialVutRecord[],
  state: CartoCiudadState,
  fetchImplementation: typeof fetch,
): Promise<CatastroRepairResult> {
  const missing = records.filter(
    (record) =>
      (record.latitude === null || record.longitude === null) &&
      typeof record.cadastralRef !== 'string' &&
      record.addressText.length > 0,
  );
  const deferredIds = new Set<string>();
  if (missing.length === 0) return { repaired: 0, deferredIds };
  const cache = await readGeoCache(missing.map((record) => `carto-${record.id}`));
  const cacheWrites: Array<{ id: string; data: Record<string, unknown> }> = [];
  let repaired = 0;

  const queue: OfficialVutRecord[] = [];
  for (const record of missing) {
    const cached = cache.get(`carto-${record.id}`);
    if (cached !== undefined) {
      if (cached.latitude !== null && cached.longitude !== null) {
        record.latitude = cached.latitude;
        record.longitude = cached.longitude;
        repaired += 1;
        continue;
      }
      // Definitive failure at the current version: Google may try it.
      if (cached.version >= CARTOCIUDAD_QUERY_VERSION) continue;
    }
    queue.push(record);
  }

  let queueIndex = 0;
  const callStartedAt = Date.now();
  const attemptOne = async (record: OfficialVutRecord): Promise<void> => {
    let located: { latitude: number; longitude: number } | null = null;
    let transient = false;
    try {
      const url = new URL(CARTOCIUDAD_URL);
      // Sin código postal a propósito: CartoCiudad devuelve vacío cuando la
      // consulta lo incluye ('Bidebarrieta 7, 48005 BILBAO' falla; sin CP no).
      url.searchParams.set(
        'q',
        `${cleanAddressForGeocoding(record.addressText)}, ${cartoCiudadMunicipality(record.municipality)}`,
      );
      const response = await fetchImplementation(url, { signal: AbortSignal.timeout(10_000) });
      if (!response.ok) {
        transient = true;
      } else {
        const parsed = parseCartoCiudadResponse(await response.text());
        if (parsed !== null && !cartoCiudadMuniMatches(parsed.muni, record.municipality)) {
          // Portal found… in another municipality: a Madrid-sized radius
          // would let it through, so the geocoder's own muni is the judge.
          state.failures.wrong_muni = (state.failures.wrong_muni ?? 0) + 1;
          located = null;
        } else {
          located = parsed;
        }
      }
    } catch {
      transient = true;
    }
    if (
      located !== null &&
      !coordinatesPlausibleForMunicipality(record.municipality, located.latitude, located.longitude)
    ) {
      located = null;
      state.failures.implausible = (state.failures.implausible ?? 0) + 1;
    }
    if (transient) {
      state.failures.transient = (state.failures.transient ?? 0) + 1;
      state.transientStreak += 1;
      if (state.transientStreak >= 8) state.remaining = 0;
      deferredIds.add(record.id);
      return;
    }
    state.transientStreak = 0;
    cacheWrites.push({
      id: `carto-${record.id}`,
      data: {
        latitude: located?.latitude ?? null,
        longitude: located?.longitude ?? null,
        addressText: record.addressText,
        municipality: record.municipality,
        source: 'cartociudad',
        version: CARTOCIUDAD_QUERY_VERSION,
        updatedAt: Timestamp.now(),
      },
    });
    if (located !== null) {
      record.latitude = located.latitude;
      record.longitude = located.longitude;
      repaired += 1;
    } else {
      state.failures.no_portal = (state.failures.no_portal ?? 0) + 1;
    }
  };

  const worker = async (): Promise<void> => {
    for (;;) {
      if (state.remaining <= 0) return;
      // Window per repair call, not per run: exhausting it only stops THIS
      // municipality; the next one gets a fresh slice (budget stays global).
      if (Date.now() - callStartedAt > CARTOCIUDAD_TIME_BUDGET_MS) return;
      const record = queue[queueIndex];
      if (record === undefined) return;
      queueIndex += 1;
      state.remaining -= 1;
      await attemptOne(record);
      await delay(CARTOCIUDAD_PACE_MS);
    }
  };
  await Promise.all(Array.from({ length: CARTOCIUDAD_CONCURRENCY }, () => worker()));

  for (const record of queue.slice(queueIndex)) deferredIds.add(record.id);

  await commitChunks(
    cacheWrites.map(({ id, data }) => (batch: FirebaseFirestore.WriteBatch) => {
      batch.set(db.collection(GEO_CACHE_COLLECTION).doc(id), data);
    }),
  );
  return { repaired, deferredIds };
}

/* ------------------------- Global cells rebuild ---------------------------- */

/**
 * The cell layers aggregate EVERY mirrored registry, so they rebuild from the
 * whole `officialVut` collection instead of the just-synced source's records:
 * a Catalonia run must not purge Andalusian cells and vice versa. The field
 * mask keeps the read light — only what the cells and embedded pins need.
 */
async function loadAllRecordsForCells(): Promise<OfficialVutRecord[]> {
  const snapshot = await db
    .collection('officialVut')
    .select(
      'registrationCode',
      'name',
      'addressText',
      'postalCode',
      'municipality',
      'entire',
      'places',
      'latitude',
      'longitude',
    )
    .get();
  return snapshot.docs.map((document) => {
    const data = document.data();
    return {
      id: document.id,
      registrationCode: typeof data.registrationCode === 'string' ? data.registrationCode : '',
      licenseKey: '',
      name: typeof data.name === 'string' ? data.name : '',
      addressText: typeof data.addressText === 'string' ? data.addressText : '',
      street: '',
      number: '',
      postalCode: typeof data.postalCode === 'string' ? data.postalCode : '',
      municipality: typeof data.municipality === 'string' ? data.municipality : '',
      cityId: '',
      entire: data.entire === true,
      places: typeof data.places === 'number' ? data.places : 0,
      latitude: typeof data.latitude === 'number' ? data.latitude : null,
      longitude: typeof data.longitude === 'number' ? data.longitude : null,
    };
  });
}

async function rebuildCells(geohashFor: GeohashFn): Promise<void> {
  const allRecords = await loadAllRecordsForCells();
  const { cells, pinCells } = buildOfficialCells(allRecords, geohashFor);
  const cellCounters: DiffCounters = { written: 0, skipped: 0, deleted: 0 };
  const [existingCells, existingPinCells] = await Promise.all([
    loadExistingHashes('officialCells'),
    loadExistingHashes('officialCellPins'),
  ]);
  const cellDocs: DiffDoc[] = cells.map((cell) => {
    const data = {
      precision: cell.precision,
      lat: cell.lat,
      lng: cell.lng,
      count: cell.count,
      entireCount: cell.entireCount,
      roomsInhabitants: cell.roomsInhabitants,
    };
    return { id: cell.id, data, hash: contentHash(data) };
  });
  const pinCellDocs: DiffDoc[] = pinCells.map((cell) => {
    const data = { lat: cell.lat, lng: cell.lng, count: cell.count, pins: cell.pins };
    return { id: cell.id, data, hash: contentHash(data) };
  });
  await writeDocsDiff('officialCells', cellDocs, existingCells, cellCounters);
  await writeDocsDiff('officialCellPins', pinCellDocs, existingPinCells, cellCounters);
  const cellIds = new Set(cellDocs.map((docItem) => docItem.id));
  const pinCellIds = new Set(pinCellDocs.map((docItem) => docItem.id));
  await deleteDocs(
    'officialCells',
    [...existingCells.keys()].filter((id) => !cellIds.has(id)),
    cellCounters,
  );
  await deleteDocs(
    'officialCellPins',
    [...existingPinCells.keys()].filter((id) => !pinCellIds.has(id)),
    cellCounters,
  );
  logger.info('Official cells rebuilt', {
    records: allRecords.length,
    cells: cells.length,
    pinCells: pinCells.length,
    ...cellCounters,
  });
}

/* --------------------------------- Run ------------------------------------ */

type GeohashFn = (location: [number, number], precision?: number) => string;

export interface OfficialSyncSummary {
  source: OfficialSourceId;
  municipalities: number;
  records: number;
}

async function runSource(
  source: OfficialSource,
  fetchImplementation: typeof fetch,
  geohashFor: GeohashFn,
  geocodeState: GeocodeState,
): Promise<OfficialSyncSummary> {
  const releaseLock = await acquireSyncLock();
  try {
    let total = 0;
    let repairedTotal = 0;
    await source.prepare?.(fetchImplementation);

    // Previous totals guard partial upstream responses; existing hashes
    // drive the differential writes and the source-scoped ghost purge.
    const [existingVut, statsSnapshot] = await Promise.all([
      loadExistingHashes('officialVut'),
      db.collection('officialStats').get(),
    ]);
    const previousTotals = new Map<string, number>();
    for (const document of statsSnapshot.docs) {
      const municipality: unknown = document.get('municipality');
      const previous: unknown = document.get('total');
      if (typeof municipality === 'string' && typeof previous === 'number') {
        previousTotals.set(municipality, previous);
      }
    }

    const vutCounters: DiffCounters = { written: 0, skipped: 0, deleted: 0 };
    const freshIds = new Set<string>();
    const catastroState = createCatastroState();
    const cartoState = createCartoCiudadState();
    for (const municipality of source.municipalities) {
      const records = await source.fetchMunicipality(municipality, fetchImplementation);
      const previous = previousTotals.get(municipality) ?? 0;
      if (isSuspiciousDrop(previous, records.length)) {
        // Abort the whole run: writing (and later purging/rebuilding cells)
        // from a partial response would blank this city for a week.
        throw new Error(
          `El registro oficial devolvió ${records.length} registros para ${municipality} (antes ${previous}); sincronización abortada.`,
        );
      }
      // Free lanes first (Catastro by cadastral reference, CartoCiudad by
      // address); the paid Geocoding API only sees what both failed for good
      // — never records a future free pass could resolve.
      const catastro = await repairViaCatastro(records, catastroState, fetchImplementation);
      const carto = await repairViaCartoCiudad(records, cartoState, fetchImplementation);
      const repaired =
        catastro.repaired +
        carto.repaired +
        (await repairMissingCoordinates(
          records.filter(
            (record) => !catastro.deferredIds.has(record.id) && !carto.deferredIds.has(record.id),
          ),
          geocodeState,
          fetchImplementation,
        ));
      repairedTotal += repaired;
      for (const record of records) freshIds.add(record.id);
      await writeDocsDiff(
        'officialVut',
        records.map((record) => {
          const geohash =
            record.latitude !== null && record.longitude !== null
              ? geohashFor([record.latitude, record.longitude])
              : null;
          const data: Record<string, unknown> = { ...record, geohash };
          // The doc id already carries the record id; keeping it out of the
          // stored data leaves pre-multi-source Andalusian hashes untouched.
          delete data.id;
          return { id: record.id, data, hash: contentHash(data) };
        }),
        existingVut,
        vutCounters,
      );
      const cityId = records[0]?.cityId;
      if (cityId !== undefined) {
        const entire = records.filter((record) => record.entire);
        const statsData = {
          cityId,
          municipality,
          total: records.length,
          entireHomes: entire.length,
          roomsOnly: records.length - entire.length,
          // Rooms-only rentals displace room tenants: ≈1 inhabitant per
          // room (rooms ≈ places ÷ 2, minimum 1 per dwelling).
          roomsInhabitants: records.reduce(
            (sum, record) => sum + (record.entire ? 0 : roomsInhabitantsForPlaces(record.places)),
            0,
          ),
          places: records.reduce((sum, record) => sum + record.places, 0),
          withLocation: records.filter((record) => record.latitude !== null).length,
          source: source.statsSource,
          updatedAt: Timestamp.now(),
        };
        await db.collection('officialStats').doc(cityId).set(statsData);
        // Histórico: una instantánea por ciudad y día (id idempotente), la
        // materia prima de las gráficas de evolución y de la página de
        // estadísticas. Los reruns del mismo día sobreescriben su foto.
        const day = new Date().toISOString().slice(0, 10);
        await db
          .collection('officialHistory')
          .doc(`${cityId}_${day}`)
          .set({ ...statsData, date: day });
      }
      total += records.length;
      logger.info('Official municipality synced', {
        source: source.id,
        municipality,
        records: records.length,
        repairedCoordinates: repaired,
      });
    }
    logger.info('Official coordinate repair', {
      source: source.id,
      repaired: repairedTotal,
      geocodesLeft: geocodeState.remaining,
      failures: geocodeState.failures,
      catastroLeft: catastroState.remaining,
      catastroFailures: catastroState.failures,
      cartoLeft: cartoState.remaining,
      cartoFailures: cartoState.failures,
    });

    // Ghost purge, scoped to this source's prefix: registrations withdrawn
    // upstream must stop verifying licences and blocking submissions, but
    // another registry's mirror is never this run's to delete.
    const staleVut = [...existingVut.keys()].filter(
      (id) => id.startsWith(source.idPrefix) && !freshIds.has(id),
    );
    await deleteDocs('officialVut', staleVut, vutCounters);
    logger.info('Official mirror diff', { source: source.id, ...vutCounters });

    // Geohash cell mirror: the map reads these aggregated bubbles (and the
    // embedded pins at street zoom) instead of querying 60k individual docs.
    await rebuildCells(geohashFor);
    return { source: source.id, municipalities: source.municipalities.length, records: total };
  } finally {
    await releaseLock();
  }
}

/** Sync a single registry (the weekly per-source jobs). */
export async function runOfficialSync(
  sourceId: OfficialSourceId,
  fetchImplementation: typeof fetch,
  geohashFor: GeohashFn,
  geocodeApiKey = '',
): Promise<OfficialSyncSummary> {
  return runSource(
    buildSource(sourceId),
    fetchImplementation,
    geohashFor,
    createGeocodeState(geocodeApiKey),
  );
}

/** Sync every registry sequentially (admin panel), sharing one geocoding
 * budget so the manual run stays within the function timeout. */
export async function runAllOfficialSyncs(
  fetchImplementation: typeof fetch,
  geohashFor: GeohashFn,
  geocodeApiKey = '',
): Promise<OfficialSyncSummary[]> {
  const geocodeState = createGeocodeState(geocodeApiKey);
  const summaries: OfficialSyncSummary[] = [];
  for (const sourceId of ['rta', 'cat', 'gva', 'caib', 'nav', 'eus', 'mad'] as const) {
    summaries.push(
      await runSource(buildSource(sourceId), fetchImplementation, geohashFor, geocodeState),
    );
  }
  return summaries;
}
