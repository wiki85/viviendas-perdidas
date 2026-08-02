import type { Response } from 'express';
import * as logger from 'firebase-functions/logger';
import { onRequest } from 'firebase-functions/v2/https';
import { FieldPath } from 'firebase-admin/firestore';
import { REGION } from '../config.js';
import { db } from '../firebase.js';
import { integer } from './html.js';
import { ALL_CITY_IDS, cityIdsForScope, scopeDisplayName } from '../domain/communities.js';
import { buildFeedItems, renderFeedXml, type HistoryPoint } from '../domain/recuento.js';

const SITE_URL = 'https://www.aquiviviamos.com';
const FEED_PATTERN = /^[a-z0-9-]+$/u;

function sendNotFound(response: Response): void {
  response.set('Cache-Control', 'public, s-maxage=600').status(404).send('No encontrado');
}

async function loadHistory(cityIds: readonly string[]): Promise<HistoryPoint[]> {
  // Whole-collection read for the global feed; doc-id ranges per city
  // otherwise. The collection is small (cities × days with syncs).
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

/** RSS del boletín: /feeds/todo.xml, /feeds/{ciudad}.xml (El Recuento). */
export const feeds = onRequest(
  { region: REGION, timeoutSeconds: 20, maxInstances: 5 },
  async (request, response) => {
    try {
      if (request.method !== 'GET') {
        sendNotFound(response);
        return;
      }
      const match = /^\/feeds\/([a-z0-9-]+)\.xml$/u.exec(request.path);
      const slug = match?.[1] ?? '';
      if (!FEED_PATTERN.test(slug)) {
        sendNotFound(response);
        return;
      }
      const scope = slug === 'todo' ? 'all' : `city:${slug}`;
      const cityIds = cityIdsForScope(scope);
      if (cityIds.length === 0) {
        sendNotFound(response);
        return;
      }
      const label = slug === 'todo' ? 'España' : scopeDisplayName(scope);
      const history = await loadHistory(slug === 'todo' ? ALL_CITY_IDS : cityIds);
      const items = buildFeedItems(history, cityIds, slug, SITE_URL, label);
      response
        .set('Cache-Control', 'public, max-age=300, s-maxage=3600, stale-while-revalidate=86400')
        .set('X-Content-Type-Options', 'nosniff')
        .status(200)
        .type('application/rss+xml')
        .send(renderFeedXml(label, `/feeds/${slug}.xml`, SITE_URL, items));
    } catch (error) {
      logger.error('feeds failed', {
        errorType: error instanceof Error ? error.name : typeof error,
      });
      response.set('Cache-Control', 'no-store').status(503).send('Temporalmente no disponible');
    }
  },
);
