import * as logger from 'firebase-functions/logger';
import { parseEuskadiRecord, EUSKADI_MUNICIPALITIES } from '../domain/euskadi.js';
import type { OfficialVutRecord } from '../domain/openrta.js';
import { readBoundedText } from './bounded-body.js';

/**
 * «Viviendas y habitaciones de vivienda particular para uso turístico en
 * Euskadi» (REATE, Open Data Euskadi, CC BY 4.0): two daily JSON files —
 * whole dwellings and rooms-only rentals.
 */
const EUSKADI_BASE =
  'https://opendata.euskadi.eus/contenidos/ds_recursos_turisticos/habitaciones_viviendas_turisti/opendata';
const VIVIENDAS_URL = `${EUSKADI_BASE}/viviendas.json`;
const HABITACIONES_URL = `${EUSKADI_BASE}/habitaciones.json`;

/** The register holds ~4.8k dwellings + ~750 rooms files; far fewer means a
 * truncated download that would blank the mirrored cities for a week. */
const MIN_EXPECTED_EUSKADI_ROWS = 2_500;

export interface EuskadiFetcher {
  prepare: (fetchImplementation: typeof fetch) => Promise<void>;
  fetchMunicipality: (
    municipality: string,
    fetchImplementation: typeof fetch,
  ) => Promise<OfficialVutRecord[]>;
}

async function fetchJsonWithBom(
  url: string,
  fetchImplementation: typeof fetch,
): Promise<Array<Record<string, unknown>>> {
  const response = await fetchImplementation(url, { signal: AbortSignal.timeout(120_000) });
  if (!response.ok) {
    throw new Error(`Open Data Euskadi devolvió HTTP ${response.status} para ${url}`);
  }
  // Historically the files shipped with a UTF-8 BOM that response.json()
  // rejects; today they arrive without it, but tolerating both stays safe.
  const payload: unknown = JSON.parse((await readBoundedText(response)).replace(/^\uFEFF/u, ''));
  return Array.isArray(payload) ? (payload as Array<Record<string, unknown>>) : [];
}

/** REATE dwellings + rooms, served per municipality. */
export function createEuskadiFetcher(): EuskadiFetcher {
  let dwellings: Array<Record<string, unknown>> | null = null;
  let rooms: Array<Record<string, unknown>> | null = null;

  return {
    async prepare(fetchImplementation) {
      const [dwellingRows, roomRows] = await Promise.all([
        fetchJsonWithBom(VIVIENDAS_URL, fetchImplementation),
        fetchJsonWithBom(HABITACIONES_URL, fetchImplementation),
      ]);
      if (dwellingRows.length + roomRows.length < MIN_EXPECTED_EUSKADI_ROWS) {
        throw new Error(
          `Open Data Euskadi trajo solo ${dwellingRows.length + roomRows.length} filas; sincronización abortada.`,
        );
      }
      dwellings = dwellingRows;
      rooms = roomRows;
      logger.info('Euskadi register loaded', {
        dwellings: dwellingRows.length,
        rooms: roomRows.length,
      });
    },

    fetchMunicipality(municipality) {
      if (dwellings === null || rooms === null) {
        return Promise.reject(new Error('prepare() no se ejecutó antes de la descarga.'));
      }
      const config = EUSKADI_MUNICIPALITIES.find((entry) => entry.name === municipality);
      if (config === undefined) return Promise.resolve([]);
      const records = new Map<string, OfficialVutRecord>();
      for (const row of dwellings) {
        const record = parseEuskadiRecord(row, config, true);
        if (record !== null) records.set(record.id, record);
      }
      for (const row of rooms) {
        const record = parseEuskadiRecord(row, config, false);
        if (record !== null) records.set(record.id, record);
      }
      return Promise.resolve([...records.values()]);
    },
  };
}
