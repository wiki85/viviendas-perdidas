import * as logger from 'firebase-functions/logger';
import { parseCsvRecords } from '../domain/csv.js';
import {
  EXTREMADURA_MUNICIPALITIES,
  normalizeExtremaduraMunicipality,
  parseExtremaduraRow,
} from '../domain/extremadura.js';
import type { OfficialVutRecord } from '../domain/openrta.js';
import { readBoundedBytes } from './bounded-body.js';

/** Listado de apartamentos turísticos de la Junta de Extremadura (CC BY 4.0,
 * Windows-1252, sin actualizar desde marzo de 2025). */
const EXTREMADURA_CSV_URL = 'https://www.juntaex.es/documents/77055/5801338/AptosTuristicos.csv';

/** El listado ronda las 800 filas; muchas menos delatan una descarga
 * truncada. */
const MIN_EXPECTED_EXTREMADURA_ROWS = 500;

export interface ExtremaduraFetcher {
  prepare: (fetchImplementation: typeof fetch) => Promise<void>;
  fetchMunicipality: (
    municipality: string,
    fetchImplementation: typeof fetch,
  ) => Promise<OfficialVutRecord[]>;
}

/** Listado extremeño: una descarga, servida por municipio. */
export function createExtremaduraFetcher(): ExtremaduraFetcher {
  let byMunicipality: Map<string, OfficialVutRecord[]> | null = null;

  return {
    async prepare(fetchImplementation) {
      const response = await fetchImplementation(EXTREMADURA_CSV_URL, {
        signal: AbortSignal.timeout(120_000),
      });
      if (!response.ok) {
        throw new Error(`El listado de Extremadura devolvió HTTP ${response.status}`);
      }
      const text = new TextDecoder('windows-1252').decode(await readBoundedBytes(response));
      const rows = parseCsvRecords(text, ',');
      if (rows.length < MIN_EXPECTED_EXTREMADURA_ROWS) {
        throw new Error(
          `El listado de Extremadura trajo solo ${rows.length} filas; sincronización abortada.`,
        );
      }
      const bySourceName = new Map(
        EXTREMADURA_MUNICIPALITIES.map((entry) => [entry.sourceName, entry]),
      );
      const grouped = new Map<string, Map<string, OfficialVutRecord>>();
      for (const row of rows) {
        const municipality = bySourceName.get(
          normalizeExtremaduraMunicipality(row.Municipio ?? ''),
        );
        if (municipality === undefined) continue;
        const record = parseExtremaduraRow(row, municipality);
        if (record === null) continue;
        const bucket = grouped.get(municipality.name);
        if (bucket === undefined) grouped.set(municipality.name, new Map([[record.id, record]]));
        else bucket.set(record.id, record);
      }
      byMunicipality = new Map(
        [...grouped.entries()].map(([name, records]) => [name, [...records.values()]]),
      );
      logger.info('Extremadura register loaded', {
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
