import * as logger from 'firebase-functions/logger';
import { parseCsvRecords } from '../domain/csv.js';
import {
  CASTILLA_LA_MANCHA_MUNICIPALITIES,
  parseCastillaLaManchaRow,
} from '../domain/castillalamancha.js';
import type { OfficialVutRecord } from '../domain/openrta.js';
import { readBoundedBytes } from './bounded-body.js';

/** CSV semestral de apartamentos turísticos y VUT de Castilla-La Mancha
 * (datosabiertos.castillalamancha.es, CC BY-SA, ISO-8859-1). */
const CASTILLA_LA_MANCHA_CSV_URL =
  'https://datosabiertos.castillalamancha.es/sites/datosabiertos.castillalamancha.es/files/Apartamentos%20y%20VUT.csv';

/** El listado ronda las 2,3k filas; muchas menos delatan una descarga
 * truncada. */
const MIN_EXPECTED_CLM_ROWS = 1_200;

export interface CastillaLaManchaFetcher {
  prepare: (fetchImplementation: typeof fetch) => Promise<void>;
  fetchMunicipality: (
    municipality: string,
    fetchImplementation: typeof fetch,
  ) => Promise<OfficialVutRecord[]>;
}

/** Listado manchego: una descarga, servida por municipio. */
export function createCastillaLaManchaFetcher(): CastillaLaManchaFetcher {
  let byMunicipality: Map<string, OfficialVutRecord[]> | null = null;

  return {
    async prepare(fetchImplementation) {
      const response = await fetchImplementation(CASTILLA_LA_MANCHA_CSV_URL, {
        signal: AbortSignal.timeout(120_000),
      });
      if (!response.ok) {
        throw new Error(`El listado de Castilla-La Mancha devolvió HTTP ${response.status}`);
      }
      const text = new TextDecoder('iso-8859-1').decode(await readBoundedBytes(response));
      const rows = parseCsvRecords(text, ';');
      if (rows.length < MIN_EXPECTED_CLM_ROWS) {
        throw new Error(
          `El listado de Castilla-La Mancha trajo solo ${rows.length} filas; sincronización abortada.`,
        );
      }
      const bySourceName = new Map(
        CASTILLA_LA_MANCHA_MUNICIPALITIES.map((entry) => [entry.sourceName, entry]),
      );
      const grouped = new Map<string, Map<string, OfficialVutRecord>>();
      for (const row of rows) {
        const municipality = bySourceName.get((row.Municipio ?? '').trim().toLocaleUpperCase('es'));
        if (municipality === undefined) continue;
        const record = parseCastillaLaManchaRow(row, municipality);
        if (record === null) continue;
        const bucket = grouped.get(municipality.name);
        if (bucket === undefined) grouped.set(municipality.name, new Map([[record.id, record]]));
        else bucket.set(record.id, record);
      }
      byMunicipality = new Map(
        [...grouped.entries()].map(([name, records]) => [name, [...records.values()]]),
      );
      logger.info('Castilla-La Mancha register loaded', {
        rows: rows.length,
        mirrored: [...byMunicipality.entries()].map(
          ([name, records]) => `${name}:${records.length}`,
        ),
      });
    },

    fetchMunicipality(municipality) {
      if (byMunicipality === null) {
        return Promise.reject(new Error('prepare() no se ejecutó antes de la descarga.'));
      }
      return Promise.resolve(byMunicipality.get(municipality) ?? []);
    },
  };
}
