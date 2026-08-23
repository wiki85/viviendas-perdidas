import * as logger from 'firebase-functions/logger';
import { parseCsvRecords } from '../domain/csv.js';
import { parseGvaRow, GVA_MUNICIPALITIES } from '../domain/gva.js';
import type { OfficialVutRecord } from '../domain/openrta.js';
import { readBoundedText } from './bounded-body.js';

/** Daily dump of the Registre de Turisme de la Comunitat Valenciana (GVA,
 * CC BY 4.0). Full download — the portal offers no query API. */
const GVA_CSV_URL =
  'https://dadesobertes.gva.es/dataset/758f8f8e-c5af-4622-b268-a6c591710a51/resource/b1bdc28e-9813-422a-ab7a-63c21290493d/download/lista-de-viviendas-turisticas.csv';

/** The full register holds ~90k rows; far fewer means a truncated download
 * that would blank the mirrored cities for a week. */
const MIN_EXPECTED_GVA_ROWS = 40_000;

export interface ValenciaFetcher {
  prepare: (fetchImplementation: typeof fetch) => Promise<void>;
  fetchMunicipality: (
    municipality: string,
    fetchImplementation: typeof fetch,
  ) => Promise<OfficialVutRecord[]>;
}

/** Registre de Turisme CV: one CSV download, served per municipality. */
export function createValenciaFetcher(): ValenciaFetcher {
  let byMunicipality: Map<string, OfficialVutRecord[]> | null = null;

  return {
    async prepare(fetchImplementation) {
      const response = await fetchImplementation(GVA_CSV_URL, {
        signal: AbortSignal.timeout(180_000),
      });
      if (!response.ok) {
        throw new Error(`El registro de la GVA devolvió HTTP ${response.status}`);
      }
      const rows = parseCsvRecords(await readBoundedText(response), ';');
      if (rows.length < MIN_EXPECTED_GVA_ROWS) {
        throw new Error(
          `El registro de la GVA trajo solo ${rows.length} filas; sincronización abortada.`,
        );
      }
      const grouped = new Map<string, OfficialVutRecord[]>();
      const byCode = new Map(
        GVA_MUNICIPALITIES.map((entry) => [`${entry.codProvincia}/${entry.codMunicipio}`, entry]),
      );
      for (const row of rows) {
        const municipality = byCode.get(`${row.cod_provincia}/${row.cod_municipio}`);
        if (municipality === undefined) continue;
        const record = parseGvaRow(row, municipality);
        if (record === null) continue;
        const bucket = grouped.get(municipality.name);
        if (bucket === undefined) grouped.set(municipality.name, [record]);
        else bucket.push(record);
      }
      // Dedupe by signatura inside each municipality (defensive).
      for (const [name, records] of grouped) {
        grouped.set(name, [...new Map(records.map((record) => [record.id, record])).values()]);
      }
      byMunicipality = grouped;
      logger.info('GVA register loaded', {
        rows: rows.length,
        mirrored: [...grouped.entries()].map(([name, records]) => `${name}:${records.length}`),
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
