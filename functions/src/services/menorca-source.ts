import * as logger from 'firebase-functions/logger';
import { MENORCA_MUNICIPALITIES, parseMenorcaFeature } from '../domain/menorca.js';
import type { OfficialVutRecord } from '../domain/openrta.js';
import { readBoundedJson } from './bounded-body.js';

/** GeoJSON del registro turístico insular de Menorca (Consell Insular de
 * Menorca, CC BY), publicado en el catálogo de datos abiertos del Govern. */
const MENORCA_GEOJSON_URL =
  'https://intranet.caib.es/opendatacataleg/files/dataset/estades_habitatges_turistics_menorca/estades_habitatges_turistics_menorca.geojson';

/** El registro ronda los 5,4k puntos; muchos menos delatan una descarga
 * truncada que dejaría en blanco los municipios espejados una semana. */
const MIN_EXPECTED_MENORCA_FEATURES = 3_000;

export interface MenorcaFetcher {
  prepare: (fetchImplementation: typeof fetch) => Promise<void>;
  fetchMunicipality: (
    municipality: string,
    fetchImplementation: typeof fetch,
  ) => Promise<OfficialVutRecord[]>;
}

/** Registro menorquín: una descarga, servida por municipio. */
export function createMenorcaFetcher(): MenorcaFetcher {
  let features: Array<Record<string, unknown>> | null = null;

  return {
    async prepare(fetchImplementation) {
      const response = await fetchImplementation(MENORCA_GEOJSON_URL, {
        signal: AbortSignal.timeout(180_000),
      });
      if (!response.ok) {
        throw new Error(`El registro de Menorca devolvió HTTP ${response.status}`);
      }
      const payload = (await readBoundedJson(response)) as {
        features?: Array<Record<string, unknown>>;
      };
      const parsed = Array.isArray(payload.features) ? payload.features : [];
      if (parsed.length < MIN_EXPECTED_MENORCA_FEATURES) {
        throw new Error(
          `El registro de Menorca trajo solo ${parsed.length} registros; sincronización abortada.`,
        );
      }
      features = parsed;
      logger.info('Menorca register loaded', { features: parsed.length });
    },

    fetchMunicipality(municipality) {
      if (features === null) {
        return Promise.reject(new Error('prepare() no se ejecutó antes de la descarga.'));
      }
      const entry = MENORCA_MUNICIPALITIES.find((candidate) => candidate.name === municipality);
      if (entry === undefined) return Promise.resolve([]);
      const records = new Map<string, OfficialVutRecord>();
      for (const feature of features) {
        const record = parseMenorcaFeature(feature, entry);
        if (record !== null) records.set(record.id, record);
      }
      return Promise.resolve([...records.values()]);
    },
  };
}
