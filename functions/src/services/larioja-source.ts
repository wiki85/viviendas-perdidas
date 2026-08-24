import * as logger from 'firebase-functions/logger';
import {
  extractRiojaListings,
  LARIOJA_MUNICIPALITIES,
  riojaListingToRecord,
  type RiojaListing,
  type RiojaTextItem,
} from '../domain/larioja.js';
import type { OfficialVutRecord } from '../domain/openrta.js';
import { readBoundedBytes } from './bounded-body.js';

/**
 * Página del trámite de VUT de La Rioja: el «Listado de Viviendas
 * autorizadas» (PDF mensual) cuelga de aquí con una URL cifrada que ROTA en
 * cada edición — hay que descubrir el enlace en cada sincronización, nunca
 * fijarlo. El WAF del portal rechaza clientes sin User-Agent de navegador;
 * el fetch de Node (HTTP/1.1) pasa con la cabecera de abajo.
 */
const LARIOJA_TRAMITE_URL = 'https://web.larioja.org/oficina-electronica/tramite?n=24269';

/** User-Agent de navegador corriente: sin él, el WAF de larioja.org
 * responde 403 a cualquier cliente automatizado. */
const BROWSER_USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36';

/** El listado ronda las 1,8k viviendas (agosto de 2026); muchas menos
 * delatan un PDF truncado o un cambio de maquetación que rompió el parser. */
const MIN_EXPECTED_RIOJA_LISTINGS = 900;

/** Ancla del PDF dentro de la página del trámite. */
const LISTADO_ANCHOR_PATTERN = /<a\s+href="([^"]+)"[^>]*>\s*Listado de Viviendas autorizadas/iu;

export interface RiojaFetcher {
  prepare: (fetchImplementation: typeof fetch) => Promise<void>;
  fetchMunicipality: (
    municipality: string,
    fetchImplementation: typeof fetch,
  ) => Promise<OfficialVutRecord[]>;
}

/** href del ancla (con las entidades del atributo decodificadas) → URL
 * absoluta del PDF. Exportado para su test. */
export function discoverListadoUrl(html: string): string | null {
  const match = LISTADO_ANCHOR_PATTERN.exec(html);
  const href = match?.[1];
  if (href === undefined) return null;
  const decoded = href.replace(/&amp;/gu, '&');
  try {
    return new URL(decoded, LARIOJA_TRAMITE_URL).toString();
  } catch {
    return null;
  }
}

/** Extrae los items de texto posicionados de cada página del PDF. El módulo
 * pdfjs se importa perezosamente: solo esta fuente lo necesita y así no
 * paga su coste el arranque en frío del resto de funciones. */
async function extractPdfTextItems(bytes: Uint8Array): Promise<RiojaTextItem[][]> {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const loadingTask = pdfjs.getDocument({ data: bytes, useSystemFonts: true });
  const document = await loadingTask.promise;
  const pages: RiojaTextItem[][] = [];
  try {
    for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
      const page = await document.getPage(pageNumber);
      const content = await page.getTextContent();
      const items: RiojaTextItem[] = [];
      for (const item of content.items) {
        if (!('str' in item) || typeof item.str !== 'string') continue;
        const transform: unknown = item.transform;
        if (!Array.isArray(transform) || transform.length < 6) continue;
        const x = Number(transform[4]);
        const y = Number(transform[5]);
        if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
        items.push({ text: item.str, x, y });
      }
      pages.push(items);
    }
  } finally {
    await loadingTask.destroy();
  }
  return pages;
}

/** Registro riojano: descubrimiento del enlace + PDF mensual, servido por
 * municipio. */
export function createRiojaFetcher(): RiojaFetcher {
  let listings: RiojaListing[] | null = null;

  return {
    async prepare(fetchImplementation) {
      const tramite = await fetchImplementation(LARIOJA_TRAMITE_URL, {
        signal: AbortSignal.timeout(60_000),
        headers: { 'User-Agent': BROWSER_USER_AGENT },
      });
      if (!tramite.ok) {
        throw new Error(`La página del trámite de La Rioja devolvió HTTP ${tramite.status}`);
      }
      const pdfUrl = discoverListadoUrl(await tramite.text());
      if (pdfUrl === null) {
        throw new Error(
          'La página del trámite de La Rioja ya no enlaza el «Listado de Viviendas autorizadas».',
        );
      }
      const response = await fetchImplementation(pdfUrl, {
        signal: AbortSignal.timeout(120_000),
        headers: { 'User-Agent': BROWSER_USER_AGENT },
      });
      if (!response.ok) {
        throw new Error(`El listado de La Rioja devolvió HTTP ${response.status}`);
      }
      const pages = await extractPdfTextItems(await readBoundedBytes(response));
      const parsed = extractRiojaListings(pages);
      if (parsed.length < MIN_EXPECTED_RIOJA_LISTINGS) {
        throw new Error(
          `El listado de La Rioja trajo solo ${parsed.length} viviendas; sincronización abortada.`,
        );
      }
      listings = parsed;
      logger.info('La Rioja register loaded', { listings: parsed.length, pages: pages.length });
    },

    fetchMunicipality(municipality) {
      if (listings === null) {
        return Promise.reject(new Error('prepare() no se ejecutó antes de la descarga.'));
      }
      const entry = LARIOJA_MUNICIPALITIES.find((candidate) => candidate.name === municipality);
      if (entry === undefined) return Promise.resolve([]);
      const records = new Map<string, OfficialVutRecord>();
      for (const listing of listings) {
        const record = riojaListingToRecord(listing, entry);
        if (record !== null) records.set(record.id, record);
      }
      return Promise.resolve([...records.values()]);
    },
  };
}
