import * as logger from 'firebase-functions/logger';
import {
  MURCIA_MUNICIPALITIES,
  murciaBaseLocality,
  parseMurciaRow,
  type MurciaRow,
} from '../domain/murcia.js';
import type { OfficialVutRecord } from '../domain/openrta.js';

/** Listado público de viviendas vacacionales del ITREM (Región de Murcia).
 * Tabla HTML servida como .xls, ISO-8859-1, ~12k filas. */
const MURCIA_EXPORT_URL =
  'https://www.turismoregiondemurcia.es/es/etudoc.parser/?vtip=6&documento=xls';

/** El registro ronda las 12k filas; muchas menos delatan una descarga
 * truncada que dejaría en blanco los municipios espejados una semana. */
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

/** Registro murciano: una descarga, servida por municipio. El teléfono y el
 * email del titular que trae el listado se descartan aquí: nunca se espejan. */
export function createMurciaFetcher(): MurciaFetcher {
  let byMunicipality: Map<string, OfficialVutRecord[]> | null = null;

  return {
    async prepare(fetchImplementation) {
      const response = await fetchImplementation(MURCIA_EXPORT_URL, {
        signal: AbortSignal.timeout(180_000),
      });
      if (!response.ok) {
        throw new Error(`El registro de Murcia devolvió HTTP ${response.status}`);
      }
      const html = new TextDecoder('iso-8859-1').decode(await response.arrayBuffer());
      const rows = parseHtmlTableRows(html);
      const headerIndex = rows.findIndex((row) => row.includes(HEADER_SIGNATURA));
      if (headerIndex === -1) {
        throw new Error('El listado de Murcia no trae la cabecera esperada.');
      }
      const header = rows[headerIndex] ?? [];
      const column = (title: string): number => header.indexOf(title);
      const dataRows = rows.slice(headerIndex + 1).filter((row) => row.length === header.length);
      if (dataRows.length < MIN_EXPECTED_MURCIA_ROWS) {
        throw new Error(
          `El registro de Murcia trajo solo ${dataRows.length} filas; sincronización abortada.`,
        );
      }
      const bySourceName = new Map(MURCIA_MUNICIPALITIES.map((entry) => [entry.sourceName, entry]));
      const grouped = new Map<string, Map<string, OfficialVutRecord>>();
      for (const row of dataRows) {
        const cell = (title: string): string => row[column(title)] ?? '';
        const municipality = bySourceName.get(murciaBaseLocality(cell(HEADER_LOCALIDAD)));
        if (municipality === undefined) continue;
        const parsedRow: MurciaRow = {
          signatura: cell(HEADER_SIGNATURA),
          direccion: cell(HEADER_DIRECCION),
          localidad: cell(HEADER_LOCALIDAD),
          codigoPostal: cell(HEADER_POSTAL),
          plazas: cell(HEADER_PLAZAS),
          referenciaCatastral: cell(HEADER_CATASTRAL),
          nombreComercial: cell(HEADER_NOMBRE),
        };
        const record = parseMurciaRow(parsedRow, municipality);
        if (record === null) continue;
        const bucket = grouped.get(municipality.name);
        if (bucket === undefined) grouped.set(municipality.name, new Map([[record.id, record]]));
        else bucket.set(record.id, record);
      }
      byMunicipality = new Map(
        [...grouped.entries()].map(([name, records]) => [name, [...records.values()]]),
      );
      logger.info('Murcia register loaded', {
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
