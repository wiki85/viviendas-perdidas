import type { Response } from 'express';
import * as logger from 'firebase-functions/logger';
import { onRequest } from 'firebase-functions/v2/https';
import { FieldPath } from 'firebase-admin/firestore';
import { REGION } from '../config.js';
import { db } from '../firebase.js';
import { escapeHtml, integer, PUBLIC_ORIGIN } from './html.js';
import {
  ALL_CITY_IDS,
  cityDisplayName,
  COMMUNITIES,
  cityIdsForScope,
} from '../domain/communities.js';
import { buildScopeSeries, type HistoryPoint } from '../domain/recuento.js';
import { officialEvolutionSection, SHARED_CSS } from './render-city.js';

/**
 * Embeddable figures: /embed/<ambito>/evolucion and /embed/<ambito>/cifras,
 * where <ambito> is 'todo', a community id or a city id. Served WITHOUT the
 * frame-ancestors lockdown the regular pages have — being iframed by other
 * sites is the whole point. Content is read-only official data with source
 * credit, so embedding is safe by construction.
 */

interface EmbedScope {
  slug: string;
  label: string;
  cityIds: readonly string[];
}

function resolveScope(slug: string): EmbedScope | null {
  if (slug === 'todo') {
    return { slug, label: 'España (ciudades cubiertas)', cityIds: ALL_CITY_IDS };
  }
  const community = COMMUNITIES.find((entry) => entry.id === slug);
  if (community) return { slug, label: community.name, cityIds: community.cityIds };
  const cityIds = cityIdsForScope(`city:${slug}`);
  if (cityIds.length > 0) return { slug, label: cityDisplayName(slug), cityIds };
  return null;
}

async function loadHistory(cityIds: readonly string[]): Promise<HistoryPoint[]> {
  if (cityIds.length > 3) {
    const snapshot = await db.collection('officialHistory').limit(9000).get();
    return snapshot.docs.map((document) => {
      const data = document.data();
      return {
        cityId: typeof data.cityId === 'string' ? data.cityId : '',
        date: typeof data.date === 'string' ? data.date : '',
        total: integer(data.total),
      };
    });
  }
  const points: HistoryPoint[] = [];
  for (const cityId of cityIds) {
    const snapshot = await db
      .collection('officialHistory')
      .orderBy(FieldPath.documentId())
      .startAt(`${cityId}_`)
      .endAt(`${cityId}_`)
      .limit(400)
      .get();
    for (const document of snapshot.docs) {
      const data = document.data();
      points.push({
        cityId,
        date: typeof data.date === 'string' ? data.date : '',
        total: integer(data.total),
      });
    }
  }
  return points;
}

const formatInt = (value: number) => value.toLocaleString('es-ES');

function embedShell(title: string, body: string): string {
  return `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex">
<title>${escapeHtml(title)}</title>
<style>${SHARED_CSS}
  body{padding:14px 16px;background:var(--card)}
  .embed-head{display:flex;justify-content:space-between;align-items:baseline;gap:10px;margin:0 0 8px}
  .embed-head strong{font-size:.95rem;letter-spacing:-.01em}
  .embed-brand{font-size:.75rem;color:var(--ink-3);white-space:nowrap}
  .embed-brand a{color:var(--moss-700);font-weight:700;text-decoration:none}
  .evo{margin:0}
</style>
</head>
<body>
${body}
</body>
</html>`;
}

function brandNote(): string {
  return `Datos: registros oficiales de turismo autonómicos ·
    <a href="${PUBLIC_ORIGIN}/estadisticas" target="_blank" rel="noopener noreferrer">Aquí Vivíamos</a>
    (<a href="${PUBLIC_ORIGIN}/metodologia" target="_blank" rel="noopener noreferrer">metodología</a>)`;
}

function brandLine(): string {
  return `<p class="evo-note">${brandNote()}</p>`;
}

function renderEvolutionEmbed(scope: EmbedScope, series: Array<{ date: string; total: number }>) {
  const body = `
  <div class="embed-head">
    <strong>Viviendas turísticas registradas — ${escapeHtml(scope.label)}</strong>
  </div>
  ${officialEvolutionSection(series, { heading: false, noteHtml: brandNote() })}`;
  return embedShell(`Evolución — ${scope.label}`, body);
}

function renderFiguresEmbed(scope: EmbedScope, series: Array<{ date: string; total: number }>) {
  const last = series[series.length - 1];
  const previous = series.length > 1 ? series[series.length - 2] : undefined;
  const first = series[0];
  if (last === undefined || first === undefined) return null;
  const deltaLast = previous === undefined ? null : last.total - previous.total;
  const deltaFirst = last.total - first.total;
  const signed = (value: number) =>
    value > 0 ? `+${formatInt(value)}` : value < 0 ? `−${formatInt(Math.abs(value))}` : '0';
  const tile = (value: string, label: string, accent = false) => `
    <div class="stat"><strong${accent ? '' : ' style="color:#1b2521"'}>${value}</strong><span>${escapeHtml(label)}</span></div>`;
  const body = `
  <div class="embed-head">
    <strong>Viviendas turísticas registradas — ${escapeHtml(scope.label)}</strong>
  </div>
  <div class="stats" style="margin:0 0 4px">
    ${tile(formatInt(last.total), 'registradas ahora mismo', true)}
    ${deltaLast === null ? '' : tile(signed(deltaLast), 'última sincronización')}
    ${series.length > 1 ? tile(signed(deltaFirst), `desde el ${first.date.slice(8, 10)}/${first.date.slice(5, 7)}/${first.date.slice(2, 4)}`) : ''}
  </div>
  ${brandLine()}`;
  return embedShell(`Cifras — ${scope.label}`, body);
}

const EMBED_HEADERS = {
  'Cache-Control': 'public, max-age=300, s-maxage=3600, stale-while-revalidate=86400',
  // Deliberately NO frame-ancestors: any site may iframe these figures.
  'Content-Security-Policy':
    "default-src 'none'; style-src 'unsafe-inline'; img-src 'self'; font-src 'self'; base-uri 'none'",
  'X-Content-Type-Options': 'nosniff',
} as const;

function sendNotFound(response: Response): void {
  response.set('Cache-Control', 'public, s-maxage=600').status(404).send('No encontrado');
}

/** Figuras incrustables para otras webs (iframe). */
export const embed = onRequest(
  { region: REGION, timeoutSeconds: 20, maxInstances: 5 },
  async (request, response) => {
    try {
      if (request.method !== 'GET') {
        sendNotFound(response);
        return;
      }
      const match = /^\/embed\/([a-z0-9-]+)\/(evolucion|cifras)$/u.exec(request.path);
      const scope = match ? resolveScope(match[1] ?? '') : null;
      if (!match || !scope) {
        sendNotFound(response);
        return;
      }
      const history = await loadHistory(scope.cityIds);
      const series = buildScopeSeries(history, scope.cityIds);
      if (series.length === 0) {
        sendNotFound(response);
        return;
      }
      const html =
        match[2] === 'evolucion'
          ? renderEvolutionEmbed(scope, series)
          : renderFiguresEmbed(scope, series);
      if (html === null) {
        sendNotFound(response);
        return;
      }
      response.set(EMBED_HEADERS).status(200).type('html').send(html);
    } catch (error) {
      logger.error('embed failed', {
        errorType: error instanceof Error ? error.name : typeof error,
      });
      response.set('Cache-Control', 'no-store').status(503).send('Temporalmente no disponible');
    }
  },
);
