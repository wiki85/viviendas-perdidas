import * as logger from 'firebase-functions/logger';
import { AVILES_MUNICIPALITY, parseAvilesRow, type AvilesRow } from '../domain/aviles.js';
import type { OfficialVutRecord } from '../domain/openrta.js';
import { readBoundedJson } from './bounded-body.js';

/** Datastore CKAN del dataset «Alojamientos turísticos» del Ayuntamiento de
 * Avilés (CC BY): extracto municipal del REAT asturiano. El portal responde
 * 403 «Scraping not allowed» a los clientes sin User-Agent de navegador. */
const AVILES_DATASTORE_URL =
  'https://datos.aviles.es/api/3/action/datastore_search?resource_id=18dbf57e-71a0-4ea9-9402-8b7e727d434c&limit=1000';

const BROWSER_USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36';

/** El dataset ronda las ~190 filas (~170 de vivienda); muchas menos delatan
 * un recurso vaciado o un cambio de esquema. */
const MIN_EXPECTED_AVILES_ROWS = 100;

export interface AvilesFetcher {
  prepare: (fetchImplementation: typeof fetch) => Promise<void>;
  fetchMunicipality: (
    municipality: string,
    fetchImplementation: typeof fetch,
  ) => Promise<OfficialVutRecord[]>;
}

/** Datastore avilesino: una descarga, un municipio. */
export function createAvilesFetcher(): AvilesFetcher {
  let rows: AvilesRow[] | null = null;

  return {
    async prepare(fetchImplementation) {
      const response = await fetchImplementation(AVILES_DATASTORE_URL, {
        signal: AbortSignal.timeout(60_000),
        headers: { 'User-Agent': BROWSER_USER_AGENT },
      });
      if (!response.ok) {
        throw new Error(`El datastore de Avilés devolvió HTTP ${response.status}`);
      }
      const payload = (await readBoundedJson(response)) as {
        success?: boolean;
        result?: { records?: AvilesRow[] };
      };
      if (payload.success !== true) {
        throw new Error('El datastore de Avilés respondió sin success=true.');
      }
      const parsed = Array.isArray(payload.result?.records) ? payload.result.records : [];
      if (parsed.length < MIN_EXPECTED_AVILES_ROWS) {
        throw new Error(
          `El datastore de Avilés trajo solo ${parsed.length} filas; sincronización abortada.`,
        );
      }
      rows = parsed;
      logger.info('Avilés register loaded', { rows: parsed.length });
    },

    fetchMunicipality(municipality) {
      if (rows === null) {
        return Promise.reject(new Error('prepare() no se ejecutó antes de la descarga.'));
      }
      if (municipality !== AVILES_MUNICIPALITY.name) return Promise.resolve([]);
      const records = new Map<string, OfficialVutRecord>();
      for (const row of rows) {
        const record = parseAvilesRow(row);
        if (record !== null) records.set(record.id, record);
      }
      return Promise.resolve([...records.values()]);
    },
  };
}
