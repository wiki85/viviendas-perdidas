import { onRequest } from 'firebase-functions/v2/https';
import { Timestamp } from 'firebase-admin/firestore';
import { REGION } from '../config.js';
import { db } from '../firebase.js';
import { integer } from './html.js';
import {
  renderCitiesIndex,
  renderCityPage,
  renderSitemap,
  type CityStats,
  type NeighborhoodStats,
} from './render-city.js';

const CITY_ID_PATTERN = /^[a-z0-9-]+$/u;

const PAGE_HEADERS = {
  // CDN keeps pages for an hour and refreshes in the background: fresh
  // enough for slowly-moving aggregates, cheap enough to survive crawlers.
  'Cache-Control': 'public, max-age=300, s-maxage=3600, stale-while-revalidate=86400',
  'Content-Security-Policy':
    "default-src 'none'; style-src 'unsafe-inline'; img-src 'self'; base-uri 'none'; frame-ancestors 'none'",
  'X-Content-Type-Options': 'nosniff',
} as const;

function toDate(value: unknown): Date | null {
  return value instanceof Timestamp ? value.toDate() : null;
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

async function listCities(): Promise<CityStats[]> {
  const snapshot = await db.collection('aggregates').where('scope', '==', 'city').get();
  return snapshot.docs
    .map((doc) => cityFromDoc(doc.id, doc.data()))
    .filter((city) => city.listingsCount > 0)
    .sort((a, b) => b.lostDwellings - a.lostDwellings || a.name.localeCompare(b.name, 'es'));
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
    if (request.method !== 'GET') {
      response.status(404).send('No encontrado');
      return;
    }
    const segments = request.path.split('/').filter(Boolean);

    if (segments[0] === 'ciudades') {
      const cities = await listCities();
      response.set(PAGE_HEADERS).status(200).type('html').send(renderCitiesIndex(cities));
      return;
    }

    const cityId = segments[1] ?? '';
    if (segments[0] !== 'ciudad' || !CITY_ID_PATTERN.test(cityId)) {
      response.status(404).send('No encontrado');
      return;
    }
    const snapshot = await db.collection('aggregates').doc(cityId).get();
    const data = snapshot.data();
    if (!snapshot.exists || data?.scope !== 'city') {
      response.status(404).send('No encontrado');
      return;
    }
    const city = cityFromDoc(snapshot.id, data ?? {});
    if (city.listingsCount === 0) {
      // A city whose listings were all removed would be an empty page:
      // better out of the index than indexed as thin content.
      response.status(404).send('No encontrado');
      return;
    }
    const neighborhoods = await listNeighborhoods(city.id);
    response.set(PAGE_HEADERS).status(200).type('html').send(renderCityPage(city, neighborhoods));
  },
);

export const sitemap = onRequest(
  { region: REGION, timeoutSeconds: 15, maxInstances: 5 },
  async (request, response) => {
    if (request.method !== 'GET') {
      response.status(404).send('No encontrado');
      return;
    }
    const cities = await listCities();
    response
      .set('Cache-Control', 'public, max-age=300, s-maxage=3600, stale-while-revalidate=86400')
      .set('X-Content-Type-Options', 'nosniff')
      .status(200)
      .type('application/xml')
      .send(renderSitemap(cities));
  },
);
