import { onRequest } from 'firebase-functions/v2/https';
import { REGION } from '../config.js';
import { db } from '../firebase.js';
import { inhabitantsForDwellings } from '../domain/aggregates.js';
import { escapeHtml, integer, jsonForInlineScript, requestOrigin } from './html.js';

const SCOPE_ID_PATTERN = /^[a-z0-9-]+(?:__[a-z0-9-]+)?$/u;
const LOWERCASE_CONNECTORS = new Set(['de', 'del', 'la', 'las', 'los', 'el', 'y']);

function queryNumber(value: unknown): number | null {
  const candidate: unknown = Array.isArray(value) ? value[0] : value;
  if (typeof candidate !== 'string' || candidate.trim().length === 0) return null;
  const parsed = Number(candidate);
  return Number.isFinite(parsed) ? parsed : null;
}

function queryText(value: unknown): string | null {
  const candidate: unknown = Array.isArray(value) ? value[0] : value;
  return typeof candidate === 'string' ? candidate : null;
}

/** 'JEREZ DE LA FRONTERA' → 'Jerez de la Frontera' for card titles. */
function titleCaseMunicipality(value: string): string {
  return value
    .toLocaleLowerCase('es')
    .split(/\s+/u)
    .map((word, index) =>
      index > 0 && LOWERCASE_CONNECTORS.has(word)
        ? word
        : word.charAt(0).toLocaleUpperCase('es') + word.slice(1),
    )
    .join(' ');
}

export const shareScope = onRequest(
  { region: REGION, timeoutSeconds: 15, maxInstances: 10 },
  async (request, response) => {
    const scopeId = request.path.split('/').filter(Boolean).at(-1) ?? '';
    if (request.method !== 'GET' || !SCOPE_ID_PATTERN.test(scopeId)) {
      response.status(404).send('No encontrado');
      return;
    }

    const fuenteRaw = queryText(request.query.fuente);
    const fuente = fuenteRaw === 'oficial' || fuenteRaw === 'ambas' ? fuenteRaw : null;
    const cityId = scopeId.split('__')[0] ?? scopeId;
    const cityLevelScope = !scopeId.includes('__');

    const [snapshot, officialSnapshot] = await Promise.all([
      db.collection('aggregates').doc(scopeId).get(),
      // Official figures exist per municipality; sub-city scopes keep the
      // community card (the map still opens with the official layer on).
      fuente !== null && cityLevelScope
        ? db.collection('officialStats').doc(cityId).get()
        : Promise.resolve(null),
    ]);
    const official =
      officialSnapshot?.exists === true
        ? {
            total: integer(officialSnapshot.data()?.total),
            entireHomes: integer(officialSnapshot.data()?.entireHomes),
            municipality:
              typeof officialSnapshot.data()?.municipality === 'string'
                ? (officialSnapshot.data()?.municipality as string)
                : '',
          }
        : null;
    if (!snapshot.exists && official === null) {
      response.status(404).send('No encontrado');
      return;
    }

    const data = snapshot.data() ?? {};
    const name =
      typeof data.name === 'string' && data.name.length > 0
        ? data.name
        : official !== null && official.municipality.length > 0
          ? titleCaseMunicipality(official.municipality)
          : scopeId;
    let families = integer(data.lostFamilies);
    let dwellings = integer(data.lostDwellings);
    let inhabitants = integer(data.lostInhabitants);
    const formatter = new Intl.NumberFormat('es-ES');
    let sourceNote = 'Datos colaborativos y no oficiales.';
    if (fuente !== null && official !== null) {
      const officialInhabitants = inhabitantsForDwellings(official.entireHomes, cityId);
      if (fuente === 'oficial') {
        families = official.entireHomes;
        dwellings = official.entireHomes;
        inhabitants = officialInhabitants;
        sourceNote = `Fuente: Registro de Turismo de Andalucía (${formatter.format(official.total)} viviendas turísticas), datos adaptados · CC BY 4.0. Sin respaldo oficial.`;
      } else {
        families += official.entireHomes;
        dwellings += official.entireHomes;
        inhabitants += officialInhabitants;
        sourceNote =
          'Datos colaborativos + Registro de Turismo de Andalucía (CC BY 4.0). Sin respaldo oficial.';
      }
    } else if (fuente !== null) {
      sourceNote = 'Datos colaborativos; el mapa se abre con el registro oficial activado.';
    }
    const title = `${name} ha perdido ${formatter.format(families)} familias`;
    const description = `${formatter.format(dwellings)} viviendas y unos ${formatter.format(inhabitants)} habitantes desplazados. ${sourceNote}`;
    const origin = requestOrigin(request);
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
    if (fuente !== null) mapParams.set('fuente', fuente);
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
    <meta property="og:site_name" content="Viviendas Perdidas">
    <meta property="og:image" content="${escapeHtml(`${origin}/og.png`)}">
    <meta property="og:image:width" content="1200">
    <meta property="og:image:height" content="630">
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:title" content="${escapeHtml(title)}">
    <meta name="twitter:description" content="${escapeHtml(description)}">
    <meta name="twitter:image" content="${escapeHtml(`${origin}/og.png`)}">
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
