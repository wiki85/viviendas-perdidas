import * as logger from 'firebase-functions/logger';
import { parseCsvRecords } from '../domain/csv.js';
import { CASTILLA_LEON_MUNICIPALITIES, parseCastillaLeonRow } from '../domain/castillaleon.js';
import type { OfficialVutRecord } from '../domain/openrta.js';

/** Export diario del Registro de Turismo de Castilla y León (Opendatasoft,
 * CC BY 4.0), filtrado a las viviendas turísticas Y a los apartamentos
 * turísticos (edificios completos). Ambas figuras son alojamiento residencial
 * convertido en turístico; los hoteles y albergues quedan fuera del filtro. */
const CASTILLA_LEON_CSV_URL =
  'https://analisis.datosabiertos.jcyl.es/api/explore/v2.1/catalog/datasets/registro-de-turismo-de-castilla-y-leon/exports/csv?where=establecimiento%3D%22Vivienda%20tur%C3%ADstica%22%20OR%20establecimiento%3D%22Apartamentos%20Tur%C3%ADsticos%22&limit=-1';

/** El filtro de viviendas ronda las 5,6k filas; muchas menos delatan una
 * descarga truncada. */
const MIN_EXPECTED_CASTILLA_LEON_ROWS = 3_000;

export interface CastillaLeonFetcher {
  prepare: (fetchImplementation: typeof fetch) => Promise<void>;
  fetchMunicipality: (
    municipality: string,
    fetchImplementation: typeof fetch,
  ) => Promise<OfficialVutRecord[]>;
}

/** Registro castellanoleonés: una descarga, servida por municipio. */
export function createCastillaLeonFetcher(): CastillaLeonFetcher {
  let byMunicipality: Map<string, OfficialVutRecord[]> | null = null;

  return {
    async prepare(fetchImplementation) {
      const response = await fetchImplementation(CASTILLA_LEON_CSV_URL, {
        signal: AbortSignal.timeout(180_000),
      });
      if (!response.ok) {
        throw new Error(`El registro de Castilla y León devolvió HTTP ${response.status}`);
      }
      const rows = parseCsvRecords(await response.text(), ';');
      if (rows.length < MIN_EXPECTED_CASTILLA_LEON_ROWS) {
        throw new Error(
          `El registro de Castilla y León trajo solo ${rows.length} filas; sincronización abortada.`,
        );
      }
      const bySourceName = new Map(
        CASTILLA_LEON_MUNICIPALITIES.map((entry) => [entry.sourceName, entry]),
      );
      const grouped = new Map<string, Map<string, OfficialVutRecord>>();
      for (const row of rows) {
        const municipality = bySourceName.get((row.municipio ?? '').trim());
        if (municipality === undefined) continue;
        const record = parseCastillaLeonRow(row, municipality);
        if (record === null) continue;
        const bucket = grouped.get(municipality.name);
        if (bucket === undefined) grouped.set(municipality.name, new Map([[record.id, record]]));
        else bucket.set(record.id, record);
      }
      byMunicipality = new Map(
        [...grouped.entries()].map(([name, records]) => [name, [...records.values()]]),
      );
      logger.info('Castilla y León register loaded', {
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
