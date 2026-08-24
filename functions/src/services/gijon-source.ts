import * as logger from 'firebase-functions/logger';
import { GIJON_MUNICIPALITY, parseGijonFeature, type GijonFeature } from '../domain/gijon.js';
import type { OfficialVutRecord } from '../domain/openrta.js';
import { readBoundedText } from './bounded-body.js';

/** Capa de VUT con licencia del visor municipal de Gijón (Urbanismo/PGO):
 * GeoJSON embebido en un fichero JS de qgis2web («var json_… = {…};»).
 * OJO: la ruta puede cambiar si el Ayuntamiento regenera el visor — el
 * umbral y el fallo de parseo lo delatarían en el primer job. */
const GIJON_LAYER_URL =
  'https://documentos.gijon.es/doc/Urbanismo/PGO/Interactivo_vuts/layers/Vutsconcedidas_3.js';

/** La capa ronda las 2,7k viviendas; muchas menos delatan una descarga
 * truncada o un visor regenerado con otra estructura. */
const MIN_EXPECTED_GIJON_FEATURES = 1_500;

export interface GijonFetcher {
  prepare: (fetchImplementation: typeof fetch) => Promise<void>;
  fetchMunicipality: (
    municipality: string,
    fetchImplementation: typeof fetch,
  ) => Promise<OfficialVutRecord[]>;
}

/** «var json_X = {…};» → objeto GeoJSON. Exportado para su test. */
export function parseLayerJs(source: string): { features?: GijonFeature[] } {
  const start = source.indexOf('{');
  if (start === -1) {
    throw new Error('El fichero de la capa de Gijón no contiene JSON.');
  }
  const payload = source.slice(start).trim().replace(/;$/u, '');
  return JSON.parse(payload) as { features?: GijonFeature[] };
}

/** Capa gijonesa: una descarga, un municipio. */
export function createGijonFetcher(): GijonFetcher {
  let features: GijonFeature[] | null = null;

  return {
    async prepare(fetchImplementation) {
      const response = await fetchImplementation(GIJON_LAYER_URL, {
        signal: AbortSignal.timeout(120_000),
      });
      if (!response.ok) {
        throw new Error(`El visor de Gijón devolvió HTTP ${response.status}`);
      }
      const payload = parseLayerJs(await readBoundedText(response));
      const parsed = Array.isArray(payload.features) ? payload.features : [];
      if (parsed.length < MIN_EXPECTED_GIJON_FEATURES) {
        throw new Error(
          `El visor de Gijón trajo solo ${parsed.length} viviendas; sincronización abortada.`,
        );
      }
      features = parsed;
      logger.info('Gijón register loaded', { features: parsed.length });
    },

    fetchMunicipality(municipality) {
      if (features === null) {
        return Promise.reject(new Error('prepare() no se ejecutó antes de la descarga.'));
      }
      if (municipality !== GIJON_MUNICIPALITY.name) return Promise.resolve([]);
      const records = new Map<string, OfficialVutRecord>();
      for (const feature of features) {
        const record = parseGijonFeature(feature);
        if (record !== null) records.set(record.id, record);
      }
      return Promise.resolve([...records.values()]);
    },
  };
}
