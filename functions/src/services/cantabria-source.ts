import * as logger from 'firebase-functions/logger';
import {
  CANTABRIA_MUNICIPALITIES,
  parseCantabriaFeature,
  type CantabriaFeature,
} from '../domain/cantabria.js';
import type { OfficialVutRecord } from '../domain/openrta.js';
import { readBoundedJson } from './bounded-body.js';

/** Capa «Viviendas Turísticas» del servicio ArcGIS REST oficial de la
 * Dirección General de Turismo de Cantabria (INSPIRE). El servidor
 * reproyecta a WGS84 con `outSR=4326` y sirve las ~800 filas de una vez
 * (maxRecordCount 2000); la paginación por `resultOffset` cubre el
 * crecimiento futuro del registro. */
const CANTABRIA_QUERY_URL =
  'https://geoservicios.cantabria.es/inspire/rest/services/Turismo_Infraestructura_Turistica/MapServer/3/query';

/** El registro ronda las 800 viviendas (agosto de 2026, en crecimiento por
 * las regularizaciones del Decreto 50/2025); muchas menos delatan una
 * respuesta truncada o un filtro cambiado. */
const MIN_EXPECTED_CANTABRIA_FEATURES = 500;

/** Tope de páginas: 20 × 2000 = 40k filas, muy por encima de cualquier
 * escenario real; corta un bucle infinito si el servidor se comporta mal. */
const MAX_PAGES = 20;

export interface CantabriaFetcher {
  prepare: (fetchImplementation: typeof fetch) => Promise<void>;
  fetchMunicipality: (
    municipality: string,
    fetchImplementation: typeof fetch,
  ) => Promise<OfficialVutRecord[]>;
}

function pageUrl(offset: number): URL {
  const url = new URL(CANTABRIA_QUERY_URL);
  url.searchParams.set('where', '1=1');
  url.searchParams.set('outFields', '*');
  url.searchParams.set('outSR', '4326');
  url.searchParams.set('f', 'json');
  url.searchParams.set('resultOffset', String(offset));
  return url;
}

/** Registro cántabro: descarga paginada única, servida por municipio. */
export function createCantabriaFetcher(): CantabriaFetcher {
  let features: CantabriaFeature[] | null = null;

  return {
    async prepare(fetchImplementation) {
      const collected: CantabriaFeature[] = [];
      for (let page = 0; page < MAX_PAGES; page += 1) {
        const response = await fetchImplementation(pageUrl(collected.length), {
          signal: AbortSignal.timeout(120_000),
        });
        if (!response.ok) {
          throw new Error(`El servicio de Cantabria devolvió HTTP ${response.status}`);
        }
        const payload = (await readBoundedJson(response)) as {
          error?: unknown;
          features?: CantabriaFeature[];
          exceededTransferLimit?: boolean;
        };
        if (payload.error !== undefined) {
          throw new Error(
            `El servicio de Cantabria devolvió un error: ${JSON.stringify(payload.error)}`,
          );
        }
        const batch = Array.isArray(payload.features) ? payload.features : [];
        collected.push(...batch);
        if (payload.exceededTransferLimit !== true || batch.length === 0) break;
      }
      if (collected.length < MIN_EXPECTED_CANTABRIA_FEATURES) {
        throw new Error(
          `El servicio de Cantabria trajo solo ${collected.length} viviendas; sincronización abortada.`,
        );
      }
      features = collected;
      logger.info('Cantabria register loaded', { features: collected.length });
    },

    fetchMunicipality(municipality) {
      if (features === null) {
        return Promise.reject(new Error('prepare() no se ejecutó antes de la descarga.'));
      }
      const entry = CANTABRIA_MUNICIPALITIES.find((candidate) => candidate.name === municipality);
      if (entry === undefined) return Promise.resolve([]);
      const records = new Map<string, OfficialVutRecord>();
      for (const feature of features) {
        const record = parseCantabriaFeature(feature, entry);
        if (record !== null) records.set(record.id, record);
      }
      return Promise.resolve([...records.values()]);
    },
  };
}
