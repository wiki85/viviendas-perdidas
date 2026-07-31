import * as logger from 'firebase-functions/logger';
import { parseMallorcaFeature } from '../domain/mallorca.js';
import type { OfficialVutRecord } from '../domain/openrta.js';

/** GeoJSON of the Mallorca insular register (Consell de Mallorca, CC BY),
 * published in the Govern de les Illes Balears open-data catalog. */
const MALLORCA_GEOJSON_URL =
  'https://intranet.caib.es/opendatacataleg/files/dataset/habitatges_turistics_mallorca/habitatges_turistics_mallorca.geojson';

/** The island register holds ~17k features; far fewer means a truncated
 * download that would blank the mirrored municipalities for a week. */
const MIN_EXPECTED_MALLORCA_FEATURES = 8_000;

export interface MallorcaFetcher {
  prepare: (fetchImplementation: typeof fetch) => Promise<void>;
  fetchMunicipality: (
    municipality: string,
    fetchImplementation: typeof fetch,
  ) => Promise<OfficialVutRecord[]>;
}

/** Registre d'Habitatges Turístics de Mallorca: one download, served per
 * municipality. */
export function createMallorcaFetcher(): MallorcaFetcher {
  let features: Array<Record<string, unknown>> | null = null;

  return {
    async prepare(fetchImplementation) {
      const response = await fetchImplementation(MALLORCA_GEOJSON_URL, {
        signal: AbortSignal.timeout(180_000),
      });
      if (!response.ok) {
        throw new Error(`El registro de Mallorca devolvió HTTP ${response.status}`);
      }
      const payload = (await response.json()) as { features?: Array<Record<string, unknown>> };
      const parsed = Array.isArray(payload.features) ? payload.features : [];
      if (parsed.length < MIN_EXPECTED_MALLORCA_FEATURES) {
        throw new Error(
          `El registro de Mallorca trajo solo ${parsed.length} registros; sincronización abortada.`,
        );
      }
      features = parsed;
      logger.info('Mallorca register loaded', { features: parsed.length });
    },

    fetchMunicipality(municipality) {
      if (features === null) {
        return Promise.reject(new Error('prepare() no se ejecutó antes de la descarga.'));
      }
      const records = new Map<string, OfficialVutRecord>();
      for (const feature of features) {
        const record = parseMallorcaFeature(feature, municipality);
        if (record !== null) records.set(record.id, record);
      }
      return Promise.resolve([...records.values()]);
    },
  };
}
