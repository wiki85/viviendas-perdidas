import * as logger from 'firebase-functions/logger';
import { MURCIA_MUNICIPALITIES, murciaBaseLocality, parseMurciaRow } from '../domain/murcia.js';
import type { OfficialVutRecord } from '../domain/openrta.js';
import { readBoundedBytes } from './bounded-body.js';

/** Listado público de viviendas vacacionales del ITREM (Región de Murcia).
 * Tabla HTML servida como .xls, ISO-8859-1, ~12k filas. */
const MURCIA_EXPORT_URL =
  'https://www.turismoregiondemurcia.es/es/etudoc.parser/?vtip=6&documento=xls';

/** Listado de apartamentos turísticos (misma tabla, vtip=2). El ITREM
 * inscribe cada apartamento como fila propia (signatura `A.MU.###-n`), así
 * que cada fila ya es una vivienda: no hace falta estimar por capacidad. */
const MURCIA_APARTMENTS_URL =
  'https://www.turismoregiondemurcia.es/es/etudoc.parser/?vtip=2&documento=xls';

/** El registro de viviendas ronda las 12k filas; muchas menos delatan una
 * descarga truncada que dejaría en blanco los municipios espejados una semana. */
const MIN_EXPECTED_MURCIA_ROWS = 8_000;

/** Cabeceras de la tabla del ITREM que necesitamos, por texto exacto. */
const HEADER_SIGNATURA = 'SIGNATURA';
const HEADER_DIRECCION = 'DIRECCIÓN';
const HEADER_LOCALIDAD = 'LOCALIDAD';
const HEADER_POSTAL = 'C.POSTAL';
const HEADER_PLAZAS = 'PLAZAS';
const HEADER_CATASTRAL = 'REF. CATASTRAL';
const HEADER_NOMBRE = 'N. COMERCIAL';

function stripTags(cell: string): string {
  return cell
    .replace(/<[^>]+>/gu, '')
    .replace(/&nbsp;/gu, ' ')
    .replace(/&amp;/gu, '&')
    .replace(/&lt;/gu, '<')
    .replace(/&gt;/gu, '>')
    .replace(/&#?\w+;/gu, ' ')
    .replace(/\s+/gu, ' ')
    .trim();
}

/** Filas de la tabla HTML como celdas de texto plano. */
export function parseHtmlTableRows(html: string): string[][] {
  const rows: string[][] = [];
  for (const rowMatch of html.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gu)) {
    const cells = [...(rowMatch[1] ?? '').matchAll(/<t[hd][^>]*>([\s\S]*?)<\/t[hd]>/gu)].map(
      (cell) => stripTags(cell[1] ?? ''),
    );
    if (cells.length > 0) rows.push(cells);
  }
  return rows;
}

export interface MurciaFetcher {
  prepare: (fetchImplementation: typeof fetch) => Promise<void>;
  fetchMunicipality: (
    municipality: string,
    fetchImplementation: typeof fetch,
  ) => Promise<OfficialVutRecord[]>;
}

export type MurciaBuckets = Map<string, Map<string, OfficialVutRecord>>;

/**
 * Parsea una tabla del ITREM (viviendas o apartamentos) y vuelca sus filas en
 * los buckets por municipio. Devuelve cuántas filas de datos trajo. Busca las
 * columnas por nombre de cabecera, así que una tabla con otra estructura cae a
 * filas vacías (nunca a datos erróneos). Lanza solo si falta la cabecera.
 */
export function ingestMurciaTable(
  html: string,
  bySourceName: ReadonlyMap<string, (typeof MURCIA_MUNICIPALITIES)[number]>,
  buckets: MurciaBuckets,
): number {
  const rows = parseHtmlTableRows(html);
  const headerIndex = rows.findIndex((row) => row.includes(HEADER_SIGNATURA));
  if (headerIndex === -1) {
    throw new Error('El listado de Murcia no trae la cabecera esperada.');
  }
  const header = rows[headerIndex] ?? [];
  const column = (title: string): number => header.indexOf(title);
  const dataRows = rows.slice(headerIndex + 1).filter((row) => row.length === header.length);
  for (const row of dataRows) {
    const cell = (title: string): string => row[column(title)] ?? '';
    const municipality = bySourceName.get(murciaBaseLocality(cell(HEADER_LOCALIDAD)));
    if (municipality === undefined) continue;
    const record = parseMurciaRow(
      {
        signatura: cell(HEADER_SIGNATURA),
        direccion: cell(HEADER_DIRECCION),
        localidad: cell(HEADER_LOCALIDAD),
        codigoPostal: cell(HEADER_POSTAL),
        plazas: cell(HEADER_PLAZAS),
        referenciaCatastral: cell(HEADER_CATASTRAL),
        nombreComercial: cell(HEADER_NOMBRE),
      },
      municipality,
    );
    if (record === null) continue;
    const bucket = buckets.get(municipality.name);
    if (bucket === undefined) buckets.set(municipality.name, new Map([[record.id, record]]));
    else bucket.set(record.id, record);
  }
  return dataRows.length;
}

/** Registro murciano: una descarga, servida por municipio. El teléfono y el
 * email del titular que trae el listado se descartan aquí: nunca se espejan. */
export function createMurciaFetcher(): MurciaFetcher {
  let byMunicipality: Map<string, OfficialVutRecord[]> | null = null;

  return {
    async prepare(fetchImplementation) {
      const download = async (url: string): Promise<string> => {
        const response = await fetchImplementation(url, { signal: AbortSignal.timeout(180_000) });
        if (!response.ok) {
          throw new Error(`El registro de Murcia devolvió HTTP ${response.status}`);
        }
        return new TextDecoder('iso-8859-1').decode(await readBoundedBytes(response));
      };
      const bySourceName = new Map(MURCIA_MUNICIPALITIES.map((entry) => [entry.sourceName, entry]));
      const grouped: MurciaBuckets = new Map();

      // Las viviendas vacacionales son obligatorias: si fallan, se aborta.
      const vviendasRows = ingestMurciaTable(
        await download(MURCIA_EXPORT_URL),
        bySourceName,
        grouped,
      );
      if (vviendasRows < MIN_EXPECTED_MURCIA_ROWS) {
        throw new Error(
          `El registro de Murcia trajo solo ${vviendasRows} filas; sincronización abortada.`,
        );
      }

      // Los apartamentos turísticos (edificios completos, una fila por
      // apartamento) son best-effort: el ITREM cae a menudo, y no queremos que
      // su caída borre las viviendas ya obtenidas. Sus ids A.MU.* no colisionan
      // con las viviendas VV.MU.*.
      let apartmentRows = 0;
      try {
        apartmentRows = ingestMurciaTable(
          await download(MURCIA_APARTMENTS_URL),
          bySourceName,
          grouped,
        );
      } catch (error) {
        logger.warn('Murcia apartamentos no disponibles esta pasada', {
          message: error instanceof Error ? error.message : String(error),
        });
      }

      byMunicipality = new Map(
        [...grouped.entries()].map(([name, records]) => [name, [...records.values()]]),
      );
      logger.info('Murcia register loaded', {
        viviendas: vviendasRows,
        apartamentos: apartmentRows,
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
