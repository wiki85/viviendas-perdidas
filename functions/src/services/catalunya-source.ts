import * as logger from 'firebase-functions/logger';
import {
  buildBarcelonaCityIndex,
  parseCatRecord,
  CAT_APARTMENT_TYPE,
  CAT_ENTIRE_TYPE,
  CAT_SHARED_TYPE,
  type CatCityEntry,
} from '../domain/catalunya.js';
import type { OfficialVutRecord } from '../domain/openrta.js';
import { readBoundedJson, readBoundedText } from './bounded-body.js';

const SOCRATA_URL = 'https://analisi.transparenciacatalunya.cat/resource/t2h3-cgys.json';
const PAGE_SIZE = 25_000;

/**
 * Weekly export «Habitatges d'ús turístic de la ciutat de Barcelona» from the
 * Ajuntament de Barcelona (CC BY 4.0): the Generalitat registry publishes no
 * coordinates, the city hall does — joined by registry code.
 */
const BARCELONA_COORDS_URL =
  'https://opendata-ajuntament.barcelona.cat/data/dataset/c748799e-1079-44b1-9e60-88d936a3fe70/resource/b32fa7f6-d464-403b-8a02-0292a64883bf/download';

/** A truncated city-hall file would blank most coordinates for a week. */
const MIN_EXPECTED_BARCELONA_COORDS = 1_000;

function escapeSoql(value: string): string {
  return value.replace(/'/gu, "''");
}

export interface CatalunyaFetcher {
  prepare: (fetchImplementation: typeof fetch) => Promise<void>;
  fetchMunicipality: (
    municipality: string,
    fetchImplementation: typeof fetch,
  ) => Promise<OfficialVutRecord[]>;
}

/** Registre de Turisme de Catalunya (Socrata) + city-hall coordinates. */
export function createCatalunyaFetcher(): CatalunyaFetcher {
  let coordinates: Map<string, CatCityEntry> | null = null;

  return {
    async prepare(fetchImplementation) {
      const response = await fetchImplementation(BARCELONA_COORDS_URL, {
        signal: AbortSignal.timeout(120_000),
      });
      if (!response.ok) {
        throw new Error(
          `El dataset de coordenadas del Ajuntament devolvió HTTP ${response.status}`,
        );
      }
      const parsed = buildBarcelonaCityIndex(await readBoundedText(response));
      if (parsed.size < MIN_EXPECTED_BARCELONA_COORDS) {
        throw new Error(
          `El dataset de coordenadas del Ajuntament trajo solo ${parsed.size} filas; sincronización abortada.`,
        );
      }
      coordinates = parsed;
      logger.info('Catalunya city-hall coordinates loaded', { entries: parsed.size });
    },

    async fetchMunicipality(municipality, fetchImplementation) {
      if (coordinates === null) throw new Error('prepare() no se ejecutó antes de la descarga.');
      const where =
        `municipi='${escapeSoql(municipality)}' AND estat='Alta' AND ` +
        `tipus_establiment in('${escapeSoql(CAT_ENTIRE_TYPE)}','${escapeSoql(CAT_SHARED_TYPE)}','${escapeSoql(CAT_APARTMENT_TYPE)}')`;
      const rows = new Map<string, OfficialVutRecord>();
      for (let offset = 0; ; offset += PAGE_SIZE) {
        const url = new URL(SOCRATA_URL);
        url.searchParams.set(
          '$select',
          'n_mero_inscripci,tipus_establiment,r_tol,tipus_de_via,nom_de_la_via,numero,pis,porta,codi_postal,municipi,total_places',
        );
        url.searchParams.set('$where', where);
        url.searchParams.set('$order', 'n_mero_inscripci');
        url.searchParams.set('$limit', String(PAGE_SIZE));
        url.searchParams.set('$offset', String(offset));
        const response = await fetchImplementation(url, { signal: AbortSignal.timeout(120_000) });
        if (!response.ok) {
          throw new Error(
            `El Registre de Turisme devolvió HTTP ${response.status} para ${municipality}`,
          );
        }
        const page = (await readBoundedJson(response)) as Array<Record<string, unknown>>;
        for (const raw of page) {
          const record = parseCatRecord(raw, coordinates);
          if (record !== null) rows.set(record.id, record);
        }
        if (page.length < PAGE_SIZE) break;
      }
      return [...rows.values()];
    },
  };
}
