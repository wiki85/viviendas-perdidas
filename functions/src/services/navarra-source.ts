import * as logger from 'firebase-functions/logger';
import { parseNavarraRecord, NAVARRA_MUNICIPALITIES } from '../domain/navarra.js';
import type { OfficialVutRecord } from '../domain/openrta.js';

/** CKAN DataStore of the Registro de Turismo de Navarra (Gobierno de
 * Navarra, CC BY 4.0), updated daily. */
const NAVARRA_DATASTORE_URL =
  'https://datosabiertos.navarra.es/api/3/action/datastore_search?resource_id=5527debf-7e72-4f9e-8e12-b562f3027fc2';

const PAGE_SIZE = 5_000;

/** The register holds ~3k rows across every lodging type; far fewer means a
 * truncated response that would blank the mirrored cities for a week. */
const MIN_EXPECTED_NAVARRA_ROWS = 1_500;

export interface NavarraFetcher {
  prepare: (fetchImplementation: typeof fetch) => Promise<void>;
  fetchMunicipality: (
    municipality: string,
    fetchImplementation: typeof fetch,
  ) => Promise<OfficialVutRecord[]>;
}

/** Registro de Turismo de Navarra: one DataStore download, served per
 * municipality. */
export function createNavarraFetcher(): NavarraFetcher {
  let rows: Array<Record<string, unknown>> | null = null;

  return {
    async prepare(fetchImplementation) {
      const collected: Array<Record<string, unknown>> = [];
      for (let offset = 0; ; offset += PAGE_SIZE) {
        const response = await fetchImplementation(
          `${NAVARRA_DATASTORE_URL}&limit=${PAGE_SIZE}&offset=${offset}`,
          { signal: AbortSignal.timeout(120_000) },
        );
        if (!response.ok) {
          throw new Error(`El registro de Navarra devolvió HTTP ${response.status}`);
        }
        const payload = (await response.json()) as {
          result?: { records?: Array<Record<string, unknown>> };
        };
        const page = payload.result?.records ?? [];
        collected.push(...page);
        if (page.length < PAGE_SIZE) break;
      }
      if (collected.length < MIN_EXPECTED_NAVARRA_ROWS) {
        throw new Error(
          `El registro de Navarra trajo solo ${collected.length} filas; sincronización abortada.`,
        );
      }
      rows = collected;
      logger.info('Navarra register loaded', { rows: collected.length });
    },

    fetchMunicipality(municipality) {
      if (rows === null) {
        return Promise.reject(new Error('prepare() no se ejecutó antes de la descarga.'));
      }
      const config = NAVARRA_MUNICIPALITIES.find((entry) => entry.name === municipality);
      if (config === undefined) return Promise.resolve([]);
      const records = new Map<string, OfficialVutRecord>();
      for (const row of rows) {
        const record = parseNavarraRecord(row, config);
        if (record !== null) records.set(record.id, record);
      }
      return Promise.resolve([...records.values()]);
    },
  };
}
