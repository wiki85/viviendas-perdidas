import * as logger from 'firebase-functions/logger';
import { onRequest } from 'firebase-functions/v2/https';
import { PUBLIC_EXPORT_LIMIT, REGION } from '../config.js';
import { db } from '../firebase.js';
import { serializePublicListing } from '../serializers.js';

export const exportPublicData = onRequest(
  { region: REGION, cors: true, timeoutSeconds: 60, memory: '512MiB', maxInstances: 10 },
  async (request, response) => {
    if (request.method !== 'GET') {
      response.set('Allow', 'GET, OPTIONS').status(405).json({ error: 'method_not_allowed' });
      return;
    }
    try {
      const snapshot = await db
        .collection('listings')
        .where('status', '==', 'active')
        .limit(PUBLIC_EXPORT_LIMIT + 1)
        .get();
      const truncated = snapshot.size > PUBLIC_EXPORT_LIMIT;
      const documents = snapshot.docs.slice(0, PUBLIC_EXPORT_LIMIT);
      response
        .set('Cache-Control', 'public, max-age=300, s-maxage=300, stale-while-revalidate=3600')
        .set('X-Content-Type-Options', 'nosniff')
        .status(200)
        .json({
          generatedAt: new Date().toISOString(),
          count: documents.length,
          truncated,
          listings: documents.map(serializePublicListing),
        });
    } catch (error) {
      logger.error('Public data export failed', {
        errorType: error instanceof Error ? error.name : typeof error,
      });
      response.status(503).json({ error: 'export_unavailable' });
    }
  },
);
