import * as logger from 'firebase-functions/logger';
import { parseCsvRecords } from '../domain/csv.js';
import { parseMadridRow } from '../domain/madrid.js';
import type { OfficialVutRecord } from '../domain/openrta.js';

/**
 * «Declaraciones responsables de actividad de viviendas de uso turístico»
 * (Comunidad de Madrid, CC BY 4.0). El CSV corriente es una instantánea del
 * listado VIGENTE (~1.200 viviendas en Madrid capital) que el portal
 * refresca semanalmente: las altas aparecen y las bajas desaparecen, así
 * que la purga de fantasmas del runner mantiene el espejo fiel sin ningún
 * histórico adicional.
 */
const CURRENT_CSV_URL =
  'https://datos.comunidad.madrid/dataset/914c95d2-455e-4797-893f-97b1e2b2426e/resource/41072914-3b76-46b2-bfff-4afdd48ed3cc/download/declaraciones_actividad_viviendas_uso_turistico.csv';

/** Far fewer dwellings than this means a truncated download that would
 * blank Madrid for a week. */
const MIN_EXPECTED_MADRID_RECORDS = 700;

export interface MadridFetcher {
  prepare: (fetchImplementation: typeof fetch) => Promise<void>;
  fetchMunicipality: (
    municipality: string,
    fetchImplementation: typeof fetch,
  ) => Promise<OfficialVutRecord[]>;
}

function decodeCsv(bytes: Uint8Array): string {
  // The portal has shipped both encodings across schema generations;
  // latin-1 never throws and UTF-8 is detected first.
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    return new TextDecoder('latin1').decode(bytes);
  }
}

/** Comunidad de Madrid current declarations snapshot, deduped by synthetic
 * address id. */
export function createMadridFetcher(): MadridFetcher {
  let records: Map<string, OfficialVutRecord> | null = null;

  return {
    async prepare(fetchImplementation) {
      const response = await fetchImplementation(CURRENT_CSV_URL, {
        signal: AbortSignal.timeout(180_000),
      });
      if (!response.ok) {
        throw new Error(`La Comunidad de Madrid devolvió HTTP ${response.status}`);
      }
      const text = decodeCsv(new Uint8Array(await response.arrayBuffer()));
      const parsed = new Map<string, OfficialVutRecord>();
      let rows = 0;
      for (const row of parseCsvRecords(text, ';')) {
        rows += 1;
        const record = parseMadridRow(row);
        if (record !== null) parsed.set(record.id, record);
      }
      if (parsed.size < MIN_EXPECTED_MADRID_RECORDS) {
        throw new Error(
          `Madrid trajo solo ${parsed.size} viviendas únicas; sincronización abortada.`,
        );
      }
      records = parsed;
      logger.info('Madrid declarations loaded', { rows, unique: parsed.size });
    },

    fetchMunicipality(municipality) {
      if (records === null) {
        return Promise.reject(new Error('prepare() no se ejecutó antes de la descarga.'));
      }
      if (municipality !== 'MADRID') return Promise.resolve([]);
      return Promise.resolve([...records.values()]);
    },
  };
}
