import * as logger from 'firebase-functions/logger';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { db } from '../firebase.js';
import { integer } from '../http/html.js';
import { cityIdsForScope, scopeDisplayName } from '../domain/communities.js';
import {
  computeCityDeltas,
  editionSubject,
  renderEditionHtml,
  type EditionInput,
  type HistoryPoint,
} from '../domain/recuento.js';

/**
 * «El Recuento» — weekly and monthly senders. The weekly edition only goes
 * out to subscribers whose scopes actually changed (silence is respect);
 * the monthly digest goes to every active monthly subscriber. Delivery uses
 * Brevo's transactional API; without BREVO_API_KEY in the environment the
 * jobs compute everything and log what WOULD be sent, so the pipeline can
 * be verified before the provider account exists.
 */

const SITE_URL = 'https://www.aquiviviamos.com';
const SENDER = { name: 'El Recuento — Aquí Vivíamos', email: 'boletin@aquiviviamos.com' };

async function loadAllHistory(): Promise<HistoryPoint[]> {
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

function isoDaysAgo(days: number): string {
  return new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10);
}

async function sendViaBrevo(
  to: string,
  subject: string,
  html: string,
  fetchImplementation: typeof fetch,
): Promise<boolean> {
  const apiKey = process.env.BREVO_API_KEY ?? '';
  if (apiKey.length === 0) {
    logger.info('El Recuento (sin proveedor): edición lista pero no enviada', { subject });
    return false;
  }
  const response = await fetchImplementation('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: { 'api-key': apiKey, 'content-type': 'application/json' },
    body: JSON.stringify({ sender: SENDER, to: [{ email: to }], subject, htmlContent: html }),
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) {
    logger.error('Brevo rechazó el envío', { status: response.status });
    return false;
  }
  return true;
}

async function runEdition(edition: 'semanal' | 'mensual', sinceDays: number): Promise<void> {
  const [history, subscribers] = await Promise.all([
    loadAllHistory(),
    db.collection('newsletterSubscribers').where('unsubscribedAt', '==', null).get(),
  ]);
  const sinceDate = isoDaysAgo(sinceDays);
  const dateLabel = new Intl.DateTimeFormat('es-ES', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date());
  let sent = 0;
  let skipped = 0;
  for (const doc of subscribers.docs) {
    const data = doc.data();
    const wants = edition === 'semanal' ? data.weekly !== false : data.monthly !== false;
    const email = typeof data.email === 'string' ? data.email : '';
    const scopes: string[] = Array.isArray(data.scopes)
      ? data.scopes.filter((scope): scope is string => typeof scope === 'string')
      : [];
    const token = typeof data.unsubscribeToken === 'string' ? data.unsubscribeToken : '';
    if (!wants || email.length === 0 || scopes.length === 0) {
      skipped += 1;
      continue;
    }
    const scopeBlocks = scopes
      .map((scope) => ({
        scopeLabel: scopeDisplayName(scope),
        deltas: computeCityDeltas(history, cityIdsForScope(scope), sinceDate),
      }))
      .filter((block) => block.deltas.length > 0);
    const anyChange = scopeBlocks.some((block) => block.deltas.some((delta) => delta.delta !== 0));
    if (edition === 'semanal' && !anyChange) {
      // La regla de oro del boletín: sin cambios, sin correo.
      skipped += 1;
      continue;
    }
    const input: EditionInput = {
      edition,
      dateLabel,
      scopes: scopeBlocks,
      siteUrl: SITE_URL,
      unsubscribeUrl: `${SITE_URL}/boletin/baja?t=${token}`,
      preferencesUrl: `${SITE_URL}/boletin`,
    };
    const ok = await sendViaBrevo(email, editionSubject(input), renderEditionHtml(input), fetch);
    if (ok) sent += 1;
    else skipped += 1;
  }
  logger.info('El Recuento procesado', { edition, sent, skipped, subscribers: subscribers.size });
}

/** Semanal: lunes a las 09:00, tras la ronda de sincronizaciones. */
export const sendRecuentoSemanal = onSchedule(
  {
    region: 'europe-west1',
    timeoutSeconds: 540,
    memory: '256MiB',
    schedule: 'every monday 09:00',
    timeZone: 'Europe/Madrid',
  },
  async () => runEdition('semanal', 8),
);

/** Mensual: día 1 a las 09:30. */
export const sendRecuentoMensual = onSchedule(
  {
    region: 'europe-west1',
    timeoutSeconds: 540,
    memory: '256MiB',
    schedule: '30 9 1 * *',
    timeZone: 'Europe/Madrid',
  },
  async () => runEdition('mensual', 32),
);
