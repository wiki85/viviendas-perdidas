import * as logger from 'firebase-functions/logger';
import { parseCsvRecords } from '../domain/csv.js';
import { GALICIA_MUNICIPALITIES, parseGaliciaRow } from '../domain/galicia.js';
import type { OfficialVutRecord } from '../domain/openrta.js';

/** Directorio mensual de alojamientos del REAT (Xunta de Galicia, CC BY-SA
 * 4.0). Descarga completa (~6 MB) con todas las figuras de alojamiento. */
const GALICIA_CSV_URL =
  'https://descargascdn.xunta.gal/interno/smarxa/reat_directorio-alojamientos_esp.csv';

/** El directorio ronda las 32k filas (28k de viviendas); muchas menos
 * delatan una descarga truncada. */
const MIN_EXPECTED_GALICIA_ROWS = 20_000;

export interface GaliciaFetcher {
  prepare: (fetchImplementation: typeof fetch) => Promise<void>;
  fetchMunicipality: (
    municipality: string,
    fetchImplementation: typeof fetch,
  ) => Promise<OfficialVutRecord[]>;
}

/** Directorio gallego: una descarga, servida por municipio. */
export function createGaliciaFetcher(): GaliciaFetcher {
  let byMunicipality: Map<string, OfficialVutRecord[]> | null = null;

  return {
    async prepare(fetchImplementation) {
      const response = await fetchImplementation(GALICIA_CSV_URL, {
        signal: AbortSignal.timeout(180_000),
      });
      if (!response.ok) {
        throw new Error(`El directorio del REAT devolvió HTTP ${response.status}`);
      }
      const raw = await response.text();
      // El fichero abre con unas líneas de título y fecha antes de la
      // cabecera real; se salta hasta la fila de columnas.
      const headerIndex = raw.indexOf('"signatura"');
      if (headerIndex === -1) {
        throw new Error('El directorio del REAT no trae la cabecera esperada.');
      }
      const rows = parseCsvRecords(raw.slice(headerIndex), ';');
      if (rows.length < MIN_EXPECTED_GALICIA_ROWS) {
        throw new Error(
          `El directorio del REAT trajo solo ${rows.length} filas; sincronización abortada.`,
        );
      }
      const bySourceName = new Map(
        GALICIA_MUNICIPALITIES.map((entry) => [entry.sourceName, entry]),
      );
      const grouped = new Map<string, Map<string, OfficialVutRecord>>();
      for (const row of rows) {
        const municipality = bySourceName.get((row.municipio ?? '').trim());
        if (municipality === undefined) continue;
        const record = parseGaliciaRow(row, municipality);
        if (record === null) continue;
        const bucket = grouped.get(municipality.name);
        if (bucket === undefined) grouped.set(municipality.name, new Map([[record.id, record]]));
        else bucket.set(record.id, record);
      }
      byMunicipality = new Map(
        [...grouped.entries()].map(([name, records]) => [name, [...records.values()]]),
      );
      logger.info('Galicia register loaded', {
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
