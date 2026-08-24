import * as logger from 'firebase-functions/logger';
import { EIVISSA_MUNICIPALITIES, parseEivissaRow, type EivissaRow } from '../domain/eivissa.js';
import type { OfficialVutRecord } from '../domain/openrta.js';
import { readBoundedBytes } from './bounded-body.js';
import { parseHtmlTableRows } from './html-table.js';

/** Export vivo de habitatges turístics del Portal de Registres Turístics del
 * Consell Insular d'Eivissa: tabla HTML servida como .xls, ISO-8859-1,
 * generada en cada petición desde la base del registro. */
const EIVISSA_EXPORT_URL = 'https://registreturistic.conselldeivissa.es/export_xls.asp?ETT_id=14';

/** El export ronda las 2,4k filas; muchas menos delatan una descarga
 * truncada que dejaría en blanco los municipios espejados una semana. */
const MIN_EXPECTED_EIVISSA_ROWS = 1_500;

/** Cabeceras de la tabla del Consell que necesitamos, por texto exacto. */
const HEADER_SUBTIPUS = 'Sub-tipus';
const HEADER_NUMERO = 'Número Inscripció';
const HEADER_NOM = 'Nom Comercial';
const HEADER_PLACES = 'Total Places';
const HEADER_CATASTRAL = 'Referència cadastral';
const HEADER_DIRECCIO = 'Direcció';
const HEADER_MUNICIPI = 'Municipi';

/** Columnas imprescindibles: si cualquiera desaparece se aborta la pasada
 * en vez de importar miles de filas con campos en blanco. */
const REQUIRED_HEADERS = [
  HEADER_SUBTIPUS,
  HEADER_NUMERO,
  HEADER_NOM,
  HEADER_PLACES,
  HEADER_CATASTRAL,
  HEADER_DIRECCIO,
  HEADER_MUNICIPI,
] as const;

export interface EivissaFetcher {
  prepare: (fetchImplementation: typeof fetch) => Promise<void>;
  fetchMunicipality: (
    municipality: string,
    fetchImplementation: typeof fetch,
  ) => Promise<OfficialVutRecord[]>;
}

/** Tabla HTML del export → filas tipadas del parser de dominio. Exportado
 * para el test con la tabla real de fixture. */
export function ingestEivissaTable(html: string): EivissaRow[] {
  const rows = parseHtmlTableRows(html);
  const headerIndex = rows.findIndex((row) => row.includes(HEADER_NUMERO));
  if (headerIndex === -1) {
    throw new Error('El export de Eivissa no trae la cabecera esperada.');
  }
  const header = rows[headerIndex] ?? [];
  const missing = REQUIRED_HEADERS.filter((title) => !header.includes(title));
  if (missing.length > 0) {
    throw new Error(`Al export de Eivissa le faltan cabeceras: ${missing.join(', ')}.`);
  }
  const column = (title: string): number => header.indexOf(title);
  return rows
    .slice(headerIndex + 1)
    .filter((row) => row.length === header.length)
    .map((row) => {
      const cell = (title: string): string => row[column(title)] ?? '';
      return {
        subTipus: cell(HEADER_SUBTIPUS),
        numeroInscripcio: cell(HEADER_NUMERO),
        nomComercial: cell(HEADER_NOM),
        totalPlaces: cell(HEADER_PLACES),
        referenciaCadastral: cell(HEADER_CATASTRAL),
        direccio: cell(HEADER_DIRECCIO),
        municipi: cell(HEADER_MUNICIPI),
      };
    });
}

/** Registro ibicenco: una descarga, servida por municipio. El titular (con
 * NIF), el teléfono y el email del export se descartan aquí: jamás se
 * espejan. */
export function createEivissaFetcher(): EivissaFetcher {
  let rows: EivissaRow[] | null = null;

  return {
    async prepare(fetchImplementation) {
      const response = await fetchImplementation(EIVISSA_EXPORT_URL, {
        signal: AbortSignal.timeout(180_000),
      });
      if (!response.ok) {
        throw new Error(`El registro de Eivissa devolvió HTTP ${response.status}`);
      }
      const html = new TextDecoder('iso-8859-1').decode(await readBoundedBytes(response));
      const parsed = ingestEivissaTable(html);
      if (parsed.length < MIN_EXPECTED_EIVISSA_ROWS) {
        throw new Error(
          `El registro de Eivissa trajo solo ${parsed.length} filas; sincronización abortada.`,
        );
      }
      rows = parsed;
      logger.info('Eivissa register loaded', { rows: parsed.length });
    },

    fetchMunicipality(municipality) {
      if (rows === null) {
        return Promise.reject(new Error('prepare() no se ejecutó antes de la descarga.'));
      }
      const entry = EIVISSA_MUNICIPALITIES.find((candidate) => candidate.name === municipality);
      if (entry === undefined) return Promise.resolve([]);
      const records = new Map<string, OfficialVutRecord>();
      for (const row of rows) {
        const record = parseEivissaRow(row, entry);
        if (record !== null) records.set(record.id, record);
      }
      return Promise.resolve([...records.values()]);
    },
  };
}
