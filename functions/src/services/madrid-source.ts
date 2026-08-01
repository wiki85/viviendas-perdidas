import { unzipSync } from 'fflate';
import * as logger from 'firebase-functions/logger';
import { parseCsvRecords } from '../domain/csv.js';
import { parseMadridRow } from '../domain/madrid.js';
import type { OfficialVutRecord } from '../domain/openrta.js';

/**
 * «Declaraciones responsables de actividad de viviendas de uso turístico»
 * (Comunidad de Madrid, CC BY 4.0): a running monthly log since 2025 — the
 * current-period CSV plus a historical ZIP of monthly CSVs (latin-1, two
 * schema generations). No bajas are published: the mirror reflects the
 * accumulated unique declared dwellings.
 */
const DATASET_BASE =
  'https://datos.comunidad.madrid/dataset/914c95d2-455e-4797-893f-97b1e2b2426e/resource';
const CURRENT_CSV_URL = `${DATASET_BASE}/41072914-3b76-46b2-bfff-4afdd48ed3cc/download/declaraciones_actividad_viviendas_uso_turistico.csv`;
const HISTORY_ZIP_URL = `${DATASET_BASE}/11fb61a4-99a8-405a-bc36-7631d8bc306b/download/declaraciones_actividad_viviendas_uso_turistico_historico.zip`;

/** Far fewer unique dwellings than this means a truncated download. */
const MIN_EXPECTED_MADRID_RECORDS = 3_000;

export interface MadridFetcher {
  prepare: (fetchImplementation: typeof fetch) => Promise<void>;
  fetchMunicipality: (
    municipality: string,
    fetchImplementation: typeof fetch,
  ) => Promise<OfficialVutRecord[]>;
}

async function fetchLatin1(url: string, fetchImplementation: typeof fetch): Promise<Uint8Array> {
  const response = await fetchImplementation(url, { signal: AbortSignal.timeout(180_000) });
  if (!response.ok) {
    throw new Error(`La Comunidad de Madrid devolvió HTTP ${response.status} para ${url}`);
  }
  return new Uint8Array(await response.arrayBuffer());
}

function decodeCsv(bytes: Uint8Array): string {
  // The portal mixes encodings across files; latin-1 decodes both safely
  // (it never throws) and the UTF-8 files survive because the parser only
  // needs the ASCII separators — names keep their accents via detection.
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    return new TextDecoder('latin1').decode(bytes);
  }
}

/** Comunidad de Madrid declarations: current CSV + historical ZIP, deduped
 * by synthetic address id. */
export function createMadridFetcher(): MadridFetcher {
  let records: Map<string, OfficialVutRecord> | null = null;

  return {
    async prepare(fetchImplementation) {
      const [currentBytes, zipBytes] = await Promise.all([
        fetchLatin1(CURRENT_CSV_URL, fetchImplementation),
        fetchLatin1(HISTORY_ZIP_URL, fetchImplementation),
      ]);
      const csvTexts: string[] = [decodeCsv(currentBytes)];
      const entries = unzipSync(zipBytes);
      for (const [name, bytes] of Object.entries(entries)) {
        if (name.toLowerCase().endsWith('.csv')) csvTexts.push(decodeCsv(bytes));
      }
      const parsed = new Map<string, OfficialVutRecord>();
      let rows = 0;
      for (const text of csvTexts) {
        for (const row of parseCsvRecords(text, ';')) {
          rows += 1;
          const record = parseMadridRow(row);
          if (record !== null) parsed.set(record.id, record);
        }
      }
      if (parsed.size < MIN_EXPECTED_MADRID_RECORDS) {
        throw new Error(
          `Madrid trajo solo ${parsed.size} viviendas únicas; sincronización abortada.`,
        );
      }
      records = parsed;
      logger.info('Madrid declarations loaded', {
        files: csvTexts.length,
        rows,
        unique: parsed.size,
      });
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
