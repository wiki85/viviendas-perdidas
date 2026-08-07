import * as logger from 'firebase-functions/logger';
import {
  ARAGON_MUNICIPALITIES,
  normalizeAragonLocality,
  parseAragonRow,
} from '../domain/aragon.js';
import { parseXlsxRows } from '../domain/xlsx.js';
import type { OfficialVutRecord } from '../domain/openrta.js';

/** Export XLSX del buscador público de VUT del Gobierno de Aragón. */
const ARAGON_XLSX_URL =
  'https://aplicaciones.aragon.es/wturpub/informes/exportarActividadesTuristicasExcel?tipoExportacion=exportarVUT';

/** El export ronda las 4,2k filas; muchas menos delatan una descarga
 * truncada. */
const MIN_EXPECTED_ARAGON_ROWS = 2_500;

export interface AragonFetcher {
  prepare: (fetchImplementation: typeof fetch) => Promise<void>;
  fetchMunicipality: (
    municipality: string,
    fetchImplementation: typeof fetch,
  ) => Promise<OfficialVutRecord[]>;
}

/** Registro aragonés: una descarga, servida por municipio. */
export function createAragonFetcher(): AragonFetcher {
  let byMunicipality: Map<string, OfficialVutRecord[]> | null = null;

  return {
    async prepare(fetchImplementation) {
      const response = await fetchImplementation(ARAGON_XLSX_URL, {
        signal: AbortSignal.timeout(180_000),
      });
      if (!response.ok) {
        throw new Error(`El registro de Aragón devolvió HTTP ${response.status}`);
      }
      const rows = parseXlsxRows(Buffer.from(await response.arrayBuffer()));
      const header = rows[0] ?? [];
      const column = (title: string): number => header.indexOf(title);
      if (column('Signatura') === -1 || column('Localidad') === -1) {
        throw new Error('El export de Aragón no trae las columnas esperadas.');
      }
      const dataRows = rows.slice(1).filter((row) => row.some((cell) => cell.length > 0));
      if (dataRows.length < MIN_EXPECTED_ARAGON_ROWS) {
        throw new Error(
          `El registro de Aragón trajo solo ${dataRows.length} filas; sincronización abortada.`,
        );
      }
      const bySourceName = new Map(
        ARAGON_MUNICIPALITIES.flatMap((entry) =>
          entry.sourceNames.map((sourceName) => [sourceName, entry] as const),
        ),
      );
      const grouped = new Map<string, Map<string, OfficialVutRecord>>();
      for (const row of dataRows) {
        const cell = (title: string): string => row[column(title)] ?? '';
        const municipality = bySourceName.get(normalizeAragonLocality(cell('Localidad')));
        if (municipality === undefined) continue;
        const record = parseAragonRow(
          {
            vivienda: cell('Vivienda'),
            localidad: cell('Localidad'),
            direccion: cell('Dirección'),
            codigoPostal: cell('C.P.'),
            signatura: cell('Signatura'),
          },
          municipality,
        );
        if (record === null) continue;
        const bucket = grouped.get(municipality.name);
        if (bucket === undefined) grouped.set(municipality.name, new Map([[record.id, record]]));
        else bucket.set(record.id, record);
      }
      byMunicipality = new Map(
        [...grouped.entries()].map(([name, records]) => [name, [...records.values()]]),
      );
      logger.info('Aragón register loaded', {
        rows: dataRows.length,
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
