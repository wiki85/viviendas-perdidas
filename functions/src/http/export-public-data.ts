import * as logger from 'firebase-functions/logger';
import { onRequest } from 'firebase-functions/v2/https';
import { PUBLIC_EXPORT_LIMIT, REGION } from '../config.js';
import { db } from '../firebase.js';
import { serializePublicListing } from '../serializers.js';

// Instance-level cache: the export costs up to PUBLIC_EXPORT_LIMIT+1 reads,
// is fully public and changes slowly. Behind the Hosting rewrite the CDN
// honours s-maxage, and this cache shields the direct Cloud Run URL too.
const CACHE_TTL_MS = 5 * 60 * 1000;
let cachedBody: string | null = null;
let cachedAt = 0;

export const exportPublicData = onRequest(
  { region: REGION, cors: true, timeoutSeconds: 60, memory: '512MiB', maxInstances: 2 },
  async (request, response) => {
    if (request.method !== 'GET') {
      response.set('Allow', 'GET, OPTIONS').status(405).json({ error: 'method_not_allowed' });
      return;
    }
    try {
      if (cachedBody === null || Date.now() - cachedAt > CACHE_TTL_MS) {
        const snapshot = await db
          .collection('listings')
          .where('status', '==', 'active')
          .limit(PUBLIC_EXPORT_LIMIT + 1)
          .get();
        const truncated = snapshot.size > PUBLIC_EXPORT_LIMIT;
        const documents = snapshot.docs.slice(0, PUBLIC_EXPORT_LIMIT);
        cachedBody = JSON.stringify({
          generatedAt: new Date().toISOString(),
          count: documents.length,
          truncated,
          listings: documents.map(serializePublicListing),
        });
        cachedAt = Date.now();
      }
      response
        .set('Cache-Control', 'public, max-age=300, s-maxage=3600, stale-while-revalidate=86400')
        .set('X-Content-Type-Options', 'nosniff')
        .status(200)
        .type('application/json')
        .send(cachedBody);
    } catch (error) {
      logger.error('Public data export failed', {
        errorType: error instanceof Error ? error.name : typeof error,
      });
      response.set('Cache-Control', 'no-store').status(503).json({ error: 'export_unavailable' });
    }
  },
);
