import * as logger from 'firebase-functions/logger';
import { parseCsvRecords } from '../domain/csv.js';
import { CANARIAS_MUNICIPALITIES, parseCanariasRow } from '../domain/canarias.js';
import type { OfficialVutRecord } from '../domain/openrta.js';

/** Volcado diario del Registro General Turístico de Canarias (viviendas
 * vacacionales, Gobierno de Canarias). Descarga completa (~14 MB). */
const CANARIAS_CSV_URL =
  'https://datos.canarias.es/catalogos/general/dataset/9f4355a2-d086-4384-ba72-d8c99aa2d544/resource/8ff8cc43-c00b-4513-8f42-a5b961c579e1/download/establecimientos-extrahoteleros-de-tipologia-vivienda-vacacional-inscritos-en-el-registro-genera.csv';

/** El registro ronda las 72k filas; muchas menos delatan una descarga
 * truncada que dejaría en blanco los municipios espejados una semana. */
const MIN_EXPECTED_CANARIAS_ROWS = 40_000;

export interface CanariasFetcher {
  prepare: (fetchImplementation: typeof fetch) => Promise<void>;
  fetchMunicipality: (
    municipality: string,
    fetchImplementation: typeof fetch,
  ) => Promise<OfficialVutRecord[]>;
}

/** Registro canario: una descarga, servida por municipio. */
export function createCanariasFetcher(): CanariasFetcher {
  let byMunicipality: Map<string, OfficialVutRecord[]> | null = null;

  return {
    async prepare(fetchImplementation) {
      const response = await fetchImplementation(CANARIAS_CSV_URL, {
        signal: AbortSignal.timeout(180_000),
      });
      if (!response.ok) {
        throw new Error(`El registro de Canarias devolvió HTTP ${response.status}`);
      }
      const rows = parseCsvRecords(await response.text(), ';');
      if (rows.length < MIN_EXPECTED_CANARIAS_ROWS) {
        throw new Error(
          `El registro de Canarias trajo solo ${rows.length} filas; sincronización abortada.`,
        );
      }
      const bySourceName = new Map(
        CANARIAS_MUNICIPALITIES.map((entry) => [entry.sourceName, entry]),
      );
      const grouped = new Map<string, Map<string, OfficialVutRecord>>();
      for (const row of rows) {
        const municipality = bySourceName.get((row.direccion_municipio_nombre ?? '').trim());
        if (municipality === undefined) continue;
        const record = parseCanariasRow(row, municipality);
        if (record === null) continue;
        // Algunas signaturas aparecen duplicadas en el volcado: gana la última.
        const bucket = grouped.get(municipality.name);
        if (bucket === undefined) grouped.set(municipality.name, new Map([[record.id, record]]));
        else bucket.set(record.id, record);
      }
      byMunicipality = new Map(
        [...grouped.entries()].map(([name, records]) => [name, [...records.values()]]),
      );
      logger.info('Canarias register loaded', {
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
