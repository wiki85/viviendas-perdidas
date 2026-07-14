import { onRequest } from 'firebase-functions/v2/https';
import { REGION } from '../config.js';
import { db } from '../firebase.js';

const SCOPE_ID_PATTERN = /^[a-z0-9-]+(?:__[a-z0-9-]+)?$/u;

function escapeHtml(value: string): string {
  return value
    .replace(/&/gu, '&amp;')
    .replace(/</gu, '&lt;')
    .replace(/>/gu, '&gt;')
    .replace(/"/gu, '&quot;')
    .replace(/'/gu, '&#39;');
}

function integer(value: unknown): number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 ? value : 0;
}

function jsonForInlineScript(value: string): string {
  return JSON.stringify(value).replace(/</gu, '\\u003c');
}

function queryNumber(value: unknown): number | null {
  const candidate = Array.isArray(value) ? value[0] : value;
  if (typeof candidate !== 'string' || candidate.trim().length === 0) return null;
  const parsed = Number(candidate);
  return Number.isFinite(parsed) ? parsed : null;
}

export const shareScope = onRequest(
  { region: REGION, timeoutSeconds: 15, maxInstances: 10 },
  async (request, response) => {
    const scopeId = request.path.split('/').filter(Boolean).at(-1) ?? '';
    if (request.method !== 'GET' || !SCOPE_ID_PATTERN.test(scopeId)) {
      response.status(404).send('No encontrado');
      return;
    }

    const snapshot = await db.collection('aggregates').doc(scopeId).get();
    if (!snapshot.exists) {
      response.status(404).send('No encontrado');
      return;
    }

    const data = snapshot.data() ?? {};
    const name = typeof data.name === 'string' && data.name.length > 0 ? data.name : scopeId;
    const families = integer(data.lostFamilies);
    const dwellings = integer(data.lostDwellings);
    const inhabitants = integer(data.lostInhabitants);
    const formatter = new Intl.NumberFormat('es-ES');
    const title = `${name} ha perdido ${formatter.format(families)} familias`;
    const description = `${formatter.format(dwellings)} viviendas y unos ${formatter.format(inhabitants)} habitantes desplazados. Datos colaborativos y no oficiales.`;
    const origin = `${request.protocol}://${request.get('host') ?? ''}`;
    const mapParams = new URLSearchParams({ scope: scopeId });
    const latitude = queryNumber(request.query.lat);
    const longitude = queryNumber(request.query.lng);
    const zoom = queryNumber(request.query.zoom);
    if (
      latitude !== null &&
      longitude !== null &&
      zoom !== null &&
      latitude >= 27.4 &&
      latitude <= 44.2 &&
      longitude >= -18.5 &&
      longitude <= 4.5 &&
      zoom >= 5 &&
      zoom <= 19
    ) {
      mapParams.set('lat', latitude.toFixed(6));
      mapParams.set('lng', longitude.toFixed(6));
      mapParams.set('zoom', String(Math.round(zoom)));
    }
    const mapUrl = `${origin}/?${mapParams.toString()}`;
    const shareParams = new URLSearchParams(mapParams);
    shareParams.delete('scope');
    const shareQuery = shareParams.size > 0 ? `?${shareParams.toString()}` : '';
    const canonicalShareUrl = `${origin}/compartir/${scopeId}${shareQuery}`;

    response
      .set('Cache-Control', 'public, max-age=300, s-maxage=300, stale-while-revalidate=3600')
      .set(
        'Content-Security-Policy',
        "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; base-uri 'none'; frame-ancestors 'none'",
      )
      .set('X-Content-Type-Options', 'nosniff')
      .status(200)
      .type('html').send(`<!doctype html>
<html lang="es">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width,initial-scale=1">
    <meta name="description" content="${escapeHtml(description)}">
    <meta property="og:type" content="website">
    <meta property="og:locale" content="es_ES">
    <meta property="og:title" content="${escapeHtml(title)}">
    <meta property="og:description" content="${escapeHtml(description)}">
    <meta property="og:url" content="${escapeHtml(canonicalShareUrl)}">
    <title>${escapeHtml(title)} | Viviendas Perdidas</title>
    <style>body{font:16px system-ui;margin:0;display:grid;place-items:center;min-height:100vh;background:#f7f3eb;color:#1e2b27}a{color:#315d4c;font-weight:700}</style>
  </head>
  <body>
    <p>Abriendo <a href="${escapeHtml(mapUrl)}">Viviendas Perdidas</a>…</p>
    <script>location.replace(${jsonForInlineScript(mapUrl)})</script>
  </body>
</html>`);
  },
);
