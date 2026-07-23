import { geohashForLocation } from 'geofire-common';
import * as logger from 'firebase-functions/logger';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { onCall } from 'firebase-functions/v2/https';
import { REGION } from '../config.js';
import { requireModerator } from '../callables/common.js';
import { runOpenRtaSync } from '../services/openrta-sync.js';

// Cloud Scheduler is unavailable in europe-southwest1 (Madrid); the weekly
// job runs from europe-west1 and reaches Firestore cross-region (a once-a-week
// batch, so the extra latency is irrelevant). Callables stay in REGION.
const SCHEDULER_REGION = 'europe-west1';

/** Weekly mirror of the Junta de Andalucía tourism registry (OpenRTA). */
export const syncOpenRta = onSchedule(
  {
    region: SCHEDULER_REGION,
    timeoutSeconds: 540,
    memory: '512MiB',
    schedule: 'every monday 04:30',
    timeZone: 'Europe/Madrid',
  },
  async () => {
    const summary = await runOpenRtaSync(fetch, geohashForLocation);
    logger.info('OpenRTA sync finished', summary);
  },
);

/** Manual trigger from the admin panel. */
export const adminSyncOfficialData = onCall(
  { region: REGION, timeoutSeconds: 540, memory: '512MiB', enforceAppCheck: true, maxInstances: 1 },
  async (request) => {
    const moderator = requireModerator(request);
    const summary = await runOpenRtaSync(fetch, geohashForLocation);
    logger.info('OpenRTA sync (manual) finished', { ...summary, moderator });
    return summary;
  },
);
