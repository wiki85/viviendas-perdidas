import { geohashForLocation } from 'geofire-common';
import * as logger from 'firebase-functions/logger';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { onCall } from 'firebase-functions/v2/https';
import { REGION } from '../config.js';
import { requireModerator } from '../callables/common.js';
import { googleMapsServerApiKey } from '../secrets.js';
import { runAllOfficialSyncs, runOfficialSync } from '../services/official-sync.js';

// Cloud Scheduler is unavailable in europe-southwest1 (Madrid); the weekly
// jobs run from europe-west1 and reach Firestore cross-region (once-a-week
// batches, so the extra latency is irrelevant). Callables stay in REGION.
const SCHEDULER_REGION = 'europe-west1';

/** Weekly mirror of the Junta de Andalucía tourism registry (OpenRTA). */
export const syncOpenRta = onSchedule(
  {
    region: SCHEDULER_REGION,
    // Room for the paced Geocoding repair on top of the registry download.
    timeoutSeconds: 1500,
    memory: '512MiB',
    schedule: 'every monday 04:30',
    timeZone: 'Europe/Madrid',
    secrets: [googleMapsServerApiKey],
  },
  async () => {
    const summary = await runOfficialSync(
      'rta',
      fetch,
      geohashForLocation,
      googleMapsServerApiKey.value(),
    );
    logger.info('OpenRTA sync finished', summary);
  },
);

/** Weekly mirror of the Registre de Turisme de Catalunya (staggered a day
 * after the Andalusian job so both never contend for the sync lock). */
export const syncCatalunya = onSchedule(
  {
    region: SCHEDULER_REGION,
    timeoutSeconds: 1500,
    memory: '512MiB',
    schedule: 'every tuesday 04:30',
    timeZone: 'Europe/Madrid',
    secrets: [googleMapsServerApiKey],
  },
  async () => {
    const summary = await runOfficialSync(
      'cat',
      fetch,
      geohashForLocation,
      googleMapsServerApiKey.value(),
    );
    logger.info('Catalunya sync finished', summary);
  },
);

/** Weekly mirror of the Registre de Turisme de la Comunitat Valenciana
 * (staggered after the other two; the Catastro repair digests the initial
 * backlog across a few runs and then settles into deltas). */
export const syncValencia = onSchedule(
  {
    region: SCHEDULER_REGION,
    timeoutSeconds: 1500,
    // Seis municipios (~35k registros GVA) + cachés de geocodificación
    // desbordan los 512MiB desde la ampliación de agosto de 2026.
    memory: '1GiB',
    schedule: 'every wednesday 04:30',
    timeZone: 'Europe/Madrid',
    secrets: [googleMapsServerApiKey],
  },
  async () => {
    const summary = await runOfficialSync(
      'gva',
      fetch,
      geohashForLocation,
      googleMapsServerApiKey.value(),
    );
    logger.info('Valencia sync finished', summary);
  },
);

/** Weekly mirror of the Mallorca insular register (Consell de Mallorca). */
export const syncMallorca = onSchedule(
  {
    region: SCHEDULER_REGION,
    timeoutSeconds: 1500,
    memory: '512MiB',
    schedule: 'every thursday 04:30',
    timeZone: 'Europe/Madrid',
    secrets: [googleMapsServerApiKey],
  },
  async () => {
    const summary = await runOfficialSync(
      'caib',
      fetch,
      geohashForLocation,
      googleMapsServerApiKey.value(),
    );
    logger.info('Mallorca sync finished', summary);
  },
);

/** Weekly mirror of the Registro de Turismo de Navarra. */
export const syncNavarra = onSchedule(
  {
    region: SCHEDULER_REGION,
    timeoutSeconds: 1500,
    memory: '512MiB',
    schedule: 'every friday 04:30',
    timeZone: 'Europe/Madrid',
    secrets: [googleMapsServerApiKey],
  },
  async () => {
    const summary = await runOfficialSync(
      'nav',
      fetch,
      geohashForLocation,
      googleMapsServerApiKey.value(),
    );
    logger.info('Navarra sync finished', summary);
  },
);

/** Weekly mirror of the Basque REATE dwelling/rooms files. */
export const syncEuskadi = onSchedule(
  {
    region: SCHEDULER_REGION,
    timeoutSeconds: 1500,
    memory: '512MiB',
    schedule: 'every saturday 04:30',
    timeZone: 'Europe/Madrid',
    secrets: [googleMapsServerApiKey],
  },
  async () => {
    const summary = await runOfficialSync(
      'eus',
      fetch,
      geohashForLocation,
      googleMapsServerApiKey.value(),
    );
    logger.info('Euskadi sync finished', summary);
  },
);

/** Weekly mirror of the Comunidad de Madrid tourist-dwelling declarations. */
export const syncMadrid = onSchedule(
  {
    region: SCHEDULER_REGION,
    timeoutSeconds: 1500,
    memory: '512MiB',
    schedule: 'every sunday 04:30',
    timeZone: 'Europe/Madrid',
    secrets: [googleMapsServerApiKey],
  },
  async () => {
    const summary = await runOfficialSync(
      'mad',
      fetch,
      geohashForLocation,
      googleMapsServerApiKey.value(),
    );
    logger.info('Madrid sync finished', summary);
  },
);

export const syncCanarias = onSchedule(
  {
    region: SCHEDULER_REGION,
    timeoutSeconds: 1500,
    // ~72k filas de CSV en memoria al preparar la descarga completa.
    memory: '1GiB',
    schedule: 'every friday 05:30',
    timeZone: 'Europe/Madrid',
    secrets: [googleMapsServerApiKey],
  },
  async () => {
    const summary = await runOfficialSync(
      'can',
      fetch,
      geohashForLocation,
      googleMapsServerApiKey.value(),
    );
    logger.info('Canarias sync finished', summary);
  },
);

/** Weekly mirror of the Región de Murcia register (ITREM). Staggered two
 * hours after the Andalusian job: the shared lock frees in between. */
export const syncMurcia = onSchedule(
  {
    region: SCHEDULER_REGION,
    timeoutSeconds: 1500,
    memory: '512MiB',
    schedule: 'every monday 06:30',
    timeZone: 'Europe/Madrid',
    secrets: [googleMapsServerApiKey],
  },
  async () => {
    const summary = await runOfficialSync(
      'mur',
      fetch,
      geohashForLocation,
      googleMapsServerApiKey.value(),
    );
    logger.info('Murcia sync finished', summary);
  },
);

/** Weekly mirror of the Menorca insular register (Consell de Menorca). */
export const syncMenorca = onSchedule(
  {
    region: SCHEDULER_REGION,
    timeoutSeconds: 1500,
    memory: '512MiB',
    schedule: 'every tuesday 06:30',
    timeZone: 'Europe/Madrid',
    secrets: [googleMapsServerApiKey],
  },
  async () => {
    const summary = await runOfficialSync(
      'men',
      fetch,
      geohashForLocation,
      googleMapsServerApiKey.value(),
    );
    logger.info('Menorca sync finished', summary);
  },
);

/** Weekly mirror of the Galician REAT directory. */
export const syncGalicia = onSchedule(
  {
    region: SCHEDULER_REGION,
    timeoutSeconds: 1500,
    // ~32k filas de directorio en memoria al preparar la descarga completa.
    memory: '1GiB',
    schedule: 'every wednesday 06:30',
    timeZone: 'Europe/Madrid',
    secrets: [googleMapsServerApiKey],
  },
  async () => {
    const summary = await runOfficialSync(
      'gal',
      fetch,
      geohashForLocation,
      googleMapsServerApiKey.value(),
    );
    logger.info('Galicia sync finished', summary);
  },
);

/** Weekly mirror of the Castilla y León tourism register. */
export const syncCastillaLeon = onSchedule(
  {
    region: SCHEDULER_REGION,
    timeoutSeconds: 1500,
    memory: '512MiB',
    schedule: 'every thursday 06:30',
    timeZone: 'Europe/Madrid',
    secrets: [googleMapsServerApiKey],
  },
  async () => {
    const summary = await runOfficialSync(
      'cyl',
      fetch,
      geohashForLocation,
      googleMapsServerApiKey.value(),
    );
    logger.info('Castilla y León sync finished', summary);
  },
);

/** Weekly mirror of the Aragonese VUT export. */
export const syncAragon = onSchedule(
  {
    region: SCHEDULER_REGION,
    timeoutSeconds: 1500,
    memory: '512MiB',
    schedule: 'every saturday 06:30',
    timeZone: 'Europe/Madrid',
    secrets: [googleMapsServerApiKey],
  },
  async () => {
    const summary = await runOfficialSync(
      'ara',
      fetch,
      geohashForLocation,
      googleMapsServerApiKey.value(),
    );
    logger.info('Aragón sync finished', summary);
  },
);

/** Weekly mirror of the Castilla-La Mancha listing (semi-annual upstream,
 * the weekly pass keeps geocoding the backlog). */
export const syncCastillaLaMancha = onSchedule(
  {
    region: SCHEDULER_REGION,
    timeoutSeconds: 1500,
    memory: '512MiB',
    schedule: 'every sunday 06:30',
    timeZone: 'Europe/Madrid',
    secrets: [googleMapsServerApiKey],
  },
  async () => {
    const summary = await runOfficialSync(
      'clm',
      fetch,
      geohashForLocation,
      googleMapsServerApiKey.value(),
    );
    logger.info('Castilla-La Mancha sync finished', summary);
  },
);

/** Weekly mirror of the Extremaduran listing (frozen upstream since
 * March 2025; the weekly pass keeps geocoding the backlog). */
export const syncExtremadura = onSchedule(
  {
    region: SCHEDULER_REGION,
    timeoutSeconds: 1500,
    memory: '512MiB',
    schedule: 'every sunday 07:30',
    timeZone: 'Europe/Madrid',
    secrets: [googleMapsServerApiKey],
  },
  async () => {
    const summary = await runOfficialSync(
      'ext',
      fetch,
      geohashForLocation,
      googleMapsServerApiKey.value(),
    );
    logger.info('Extremadura sync finished', summary);
  },
);

/** Manual trigger from the admin panel: every registry, one shared budget. */
export const adminSyncOfficialData = onCall(
  {
    region: REGION,
    timeoutSeconds: 1500,
    // Quince registros en secuencia: los volcados grandes (Canarias,
    // Galicia, Murcia) desbordarían los 512MiB.
    memory: '1GiB',
    enforceAppCheck: true,
    maxInstances: 1,
    secrets: [googleMapsServerApiKey],
  },
  async (request) => {
    const moderator = requireModerator(request);
    const summaries = await runAllOfficialSyncs(
      fetch,
      geohashForLocation,
      googleMapsServerApiKey.value(),
    );
    logger.info('Official sync (manual) finished', { summaries, moderator });
    return {
      municipalities: summaries.reduce((sum, summary) => sum + summary.municipalities, 0),
      records: summaries.reduce((sum, summary) => sum + summary.records, 0),
      sources: summaries,
    };
  },
);
