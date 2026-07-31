import type { Response } from 'express';
import * as logger from 'firebase-functions/logger';
import { onRequest } from 'firebase-functions/v2/https';
import { FieldPath, Timestamp } from 'firebase-admin/firestore';
import { REGION } from '../config.js';
import { db } from '../firebase.js';
import { integer, titleCaseSpanish } from './html.js';
import {
  renderCitiesIndex,
  renderCityPage,
  renderSitemap,
  type CityIndexEntry,
  type CityStats,
  type NeighborhoodStats,
  type OfficialCityStats,
  type OfficialHistoryPoint,
} from './render-city.js';

const CITY_ID_PATTERN = /^[a-z0-9-]+$/u;

const PAGE_HEADERS = {
  // CDN keeps pages for an hour and refreshes in the background: fresh
  // enough for slowly-moving aggregates, cheap enough to survive crawlers.
  'Cache-Control': 'public, max-age=300, s-maxage=3600, stale-while-revalidate=86400',
  // Inline script allowed: the share button enhancement lives in the page.
  'Content-Security-Policy':
    "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src 'self'; base-uri 'none'; frame-ancestors 'none'",
  'X-Content-Type-Options': 'nosniff',
} as const;

function toDate(value: unknown): Date | null {
  return value instanceof Timestamp ? value.toDate() : null;
}

/** Crawler noise (invalid city ids) must not re-invoke the function. */
function sendNotFound(response: Response): void {
  response.set('Cache-Control', 'public, s-maxage=600').status(404).send('No encontrado');
}

/** Friendly 503 for visitors landing from shared/indexed links. */
function sendUnavailable(response: Response): void {
  response
    .set('Cache-Control', 'no-store')
    .status(503)
    .type('html')
    .send(
      `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Vuelve en un momento</title><style>body{font:16px system-ui;margin:0;display:grid;place-items:center;min-height:100vh;background:#f7f3eb;color:#1e2b27;text-align:center;padding:20px}a{color:#315d4c;font-weight:700}</style></head><body><div><p>No hemos podido cargar esta página ahora mismo.</p><p><a href="/">Ir al mapa</a> o vuelve a intentarlo en un momento.</p></div></body></html>`,
    );
}

function cityFromDoc(id: string, data: FirebaseFirestore.DocumentData): CityStats {
  return {
    id,
    name: typeof data.name === 'string' && data.name.length > 0 ? data.name : id,
    listingsCount: integer(data.listingsCount),
    lostDwellings: integer(data.lostDwellings),
    lostFamilies: integer(data.lostFamilies),
    lostInhabitants: integer(data.lostInhabitants),
    lostCommercial: integer(data.lostCommercial),
    updatedAt: toDate(data.updatedAt),
  };
}

function officialFromDoc(data: FirebaseFirestore.DocumentData): OfficialCityStats {
  return {
    total: integer(data.total),
    entireHomes: integer(data.entireHomes),
    roomsOnly: integer(data.roomsOnly),
    roomsInhabitants: integer(data.roomsInhabitants),
    places: integer(data.places),
    source: typeof data.source === 'string' ? data.source : 'openrta',
    updatedAt: toDate(data.updatedAt),
  };
}

function emptyCity(id: string, name: string): CityStats {
  return {
    id,
    name,
    listingsCount: 0,
    lostDwellings: 0,
    lostFamilies: 0,
    lostInhabitants: 0,
    lostCommercial: 0,
    updatedAt: null,
  };
}

/**
 * Cities with community listings plus RTA-mirrored cities that only have
 * official data yet — those deserve a page (and a sitemap entry) too.
 */
async function listCities(): Promise<CityIndexEntry[]> {
  const [aggregatesSnapshot, officialSnapshot] = await Promise.all([
    db.collection('aggregates').where('scope', '==', 'city').get(),
    db.collection('officialStats').get(),
  ]);
  const merged = new Map<string, CityIndexEntry>();
  for (const doc of aggregatesSnapshot.docs) {
    const city = cityFromDoc(doc.id, doc.data());
    if (city.listingsCount > 0) merged.set(doc.id, { ...city, officialTotal: 0 });
  }
  for (const doc of officialSnapshot.docs) {
    const data = doc.data();
    const total = integer(data.total);
    if (total === 0) continue;
    const existing = merged.get(doc.id);
    if (existing) {
      existing.officialTotal = total;
      continue;
    }
    const municipality = typeof data.municipality === 'string' ? data.municipality : doc.id;
    merged.set(doc.id, {
      ...emptyCity(doc.id, titleCaseSpanish(municipality)),
      updatedAt: toDate(data.updatedAt),
      officialTotal: total,
    });
  }
  return [...merged.values()].sort(
    (a, b) =>
      b.lostDwellings + (b.officialTotal ?? 0) - (a.lostDwellings + (a.officialTotal ?? 0)) ||
      a.name.localeCompare(b.name, 'es'),
  );
}

/** Weekly snapshots for the evolution figure; doc-id range (`city_YYYY-MM-DD`)
 * keeps the query index-free. */
async function listCityHistory(cityId: string): Promise<OfficialHistoryPoint[]> {
  const snapshot = await db
    .collection('officialHistory')
    .orderBy(FieldPath.documentId())
    .startAt(`${cityId}_`)
    .endAt(`${cityId}_\uf8ff`)
    .limit(160)
    .get();
  return snapshot.docs
    .map((document) => {
      const data = document.data();
      return {
        date: typeof data.date === 'string' ? data.date : '',
        total: integer(data.total),
      };
    })
    .filter((point) => point.date.length > 0)
    .sort((a, b) => a.date.localeCompare(b.date));
}

async function listNeighborhoods(cityId: string): Promise<NeighborhoodStats[]> {
  const snapshot = await db
    .collection('aggregates')
    .where('scope', '==', 'neighborhood')
    .where('cityId', '==', cityId)
    .get();
  return snapshot.docs
    .map((doc) => {
      const data = doc.data();
      return {
        name: typeof data.name === 'string' && data.name.length > 0 ? data.name : doc.id,
        lostDwellings: integer(data.lostDwellings),
        lostFamilies: integer(data.lostFamilies),
        lostCommercial: integer(data.lostCommercial),
        listingsCount: integer(data.listingsCount),
      };
    })
    .filter((entry) => entry.listingsCount > 0)
    .sort((a, b) => b.lostDwellings - a.lostDwellings || a.name.localeCompare(b.name, 'es'))
    .slice(0, 40);
}

export const cityPage = onRequest(
  { region: REGION, timeoutSeconds: 15, maxInstances: 10 },
  async (request, response) => {
    try {
      if (request.method !== 'GET') {
        sendNotFound(response);
        return;
      }
      const segments = request.path.split('/').filter(Boolean);

      if (segments[0] === 'ciudades') {
        const cities = await listCities();
        response.set(PAGE_HEADERS).status(200).type('html').send(renderCitiesIndex(cities));
        return;
      }

      let rawCityId = segments[1] ?? '';
      try {
        rawCityId = decodeURIComponent(rawCityId);
      } catch {
        // Malformed percent-encoding: leave as-is, the pattern check 404s it.
      }
      // Spanish keyboards autocomplete accents ('málaga'): normalize to the
      // canonical slug and redirect instead of answering 404.
      const cityId = rawCityId
        .normalize('NFD')
        .replace(/\p{Diacritic}/gu, '')
        .toLocaleLowerCase('es');
      if (segments[0] !== 'ciudad' || !CITY_ID_PATTERN.test(cityId) || cityId.length > 120) {
        sendNotFound(response);
        return;
      }
      if (cityId !== rawCityId) {
        response
          .set('Cache-Control', 'public, s-maxage=3600')
          .redirect(301, `/ciudad/${encodeURIComponent(cityId)}`);
        return;
      }
      const [snapshot, officialSnapshot] = await Promise.all([
        db.collection('aggregates').doc(cityId).get(),
        db.collection('officialStats').doc(cityId).get(),
      ]);
      const data = snapshot.data();
      const officialData = officialSnapshot.data();
      const official =
        officialSnapshot.exists && officialData !== undefined && integer(officialData.total) > 0
          ? officialFromDoc(officialData)
          : null;
      const hasCommunity =
        snapshot.exists && data?.scope === 'city' && integer(data?.listingsCount) > 0;
      if (!hasCommunity && official === null) {
        // A city without community listings nor official registry data would
        // be an empty page: better out of the index than indexed as thin content.
        sendNotFound(response);
        return;
      }
      const city = hasCommunity
        ? cityFromDoc(snapshot.id, data ?? {})
        : emptyCity(
            cityId,
            typeof officialData?.municipality === 'string'
              ? titleCaseSpanish(officialData.municipality)
              : cityId,
          );
      const [neighborhoods, history] = await Promise.all([
        listNeighborhoods(city.id),
        official !== null ? listCityHistory(city.id) : Promise.resolve([]),
      ]);
      response
        .set(PAGE_HEADERS)
        .status(200)
        .type('html')
        .send(renderCityPage(city, neighborhoods, official, history));
    } catch (error) {
      logger.error('cityPage failed', {
        errorType: error instanceof Error ? error.name : typeof error,
      });
      sendUnavailable(response);
    }
  },
);

export const sitemap = onRequest(
  { region: REGION, timeoutSeconds: 15, maxInstances: 5 },
  async (request, response) => {
    try {
      if (request.method !== 'GET') {
        sendNotFound(response);
        return;
      }
      const cities = await listCities();
      response
        .set('Cache-Control', 'public, max-age=300, s-maxage=3600, stale-while-revalidate=86400')
        .set('X-Content-Type-Options', 'nosniff')
        .status(200)
        .type('application/xml')
        .send(renderSitemap(cities));
    } catch (error) {
      logger.error('sitemap failed', {
        errorType: error instanceof Error ? error.name : typeof error,
      });
      response.set('Cache-Control', 'no-store').status(503).send('Temporalmente no disponible');
    }
  },
);
