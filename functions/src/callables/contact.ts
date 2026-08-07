import { Timestamp } from 'firebase-admin/firestore';
import * as logger from 'firebase-functions/logger';
import { HttpsError, onCall } from 'firebase-functions/v2/https';
import { CONTACT_LIMIT_PER_HOUR, REGION } from '../config.js';
import { db } from '../firebase.js';
import { submitContactSchema } from '../schemas.js';
import { enforceRateLimit, RateLimitExceededError } from '../services/rate-limit.js';
import { notifyModerators } from '../services/moderation-notify.js';
import { invalidPayload, requireAppCheckRateLimitSubject, requireModerator } from './common.js';

/** Below this, the form was filled faster than any human reads it. */
const MIN_HUMAN_ELAPSED_MS = 4_000;

const CONTROL_CHARACTER_PATTERN = /(?![\t\n\r])\p{Cc}/gu;

function cleanText(value: string): string {
  return value.replace(CONTROL_CHARACTER_PATTERN, '').trim();
}

/**
 * Contact-form submission. Bot layers on top of App Check (already enforced):
 * a honeypot field, a minimum fill time and a per-device rate limit. Bot
 * submissions are answered with a normal success so the countermeasures stay
 * invisible; nothing is stored.
 */
export const submitContactMessage = onCall(
  {
    region: REGION,
    enforceAppCheck: true,
    timeoutSeconds: 30,
    maxInstances: 10,
    secrets: ['RESEND_API_KEY'],
  },
  async (request): Promise<{ ok: true }> => {
    const parsed = submitContactSchema.safeParse(request.data as unknown);
    if (!parsed.success) throw invalidPayload(parsed.error);
    const input = parsed.data;
    const appCheckSubject = requireAppCheckRateLimitSubject(request);
    try {
      await enforceRateLimit({
        action: 'submitContact',
        subject: appCheckSubject,
        maximum: CONTACT_LIMIT_PER_HOUR,
      });
    } catch (error) {
      if (error instanceof RateLimitExceededError) {
        throw new HttpsError(
          'resource-exhausted',
          `Has enviado varios mensajes seguidos. Inténtalo de nuevo en ${Math.ceil(error.retryAfterSeconds / 60)} min.`,
        );
      }
      throw error;
    }
    if (input.website.length > 0 || input.elapsedMs < MIN_HUMAN_ELAPSED_MS) {
      logger.info('Contact submission dropped as bot-like', {
        honeypot: input.website.length > 0,
        elapsedMs: input.elapsedMs,
      });
      return { ok: true };
    }
    const fullName = cleanText(input.fullName);
    const message = cleanText(input.message);
    await db.collection('contactMessages').add({
      fullName,
      email: input.email,
      message,
      createdAt: Timestamp.now(),
    });
    logger.info('Contact message stored');
    await notifyModerators({
      subject: `Nuevo mensaje de ${fullName || 'contacto'} — Viviendas Perdidas`,
      title: 'Nuevo mensaje de contacto',
      fields: [
        { label: 'De', value: fullName || '(sin nombre)' },
        { label: 'Correo', value: input.email },
        { label: 'Mensaje', value: message },
      ],
    });
    return { ok: true };
  },
);

/** Latest contact messages for the admin panel. */
export const adminListContactMessages = onCall(
  { region: REGION, enforceAppCheck: true, timeoutSeconds: 15, maxInstances: 5 },
  async (request) => {
    requireModerator(request);
    const snapshot = await db
      .collection('contactMessages')
      .orderBy('createdAt', 'desc')
      .limit(100)
      .get();
    return {
      messages: snapshot.docs.map((document) => {
        const data = document.data();
        const createdAt: unknown = data.createdAt;
        return {
          id: document.id,
          fullName: typeof data.fullName === 'string' ? data.fullName : '',
          email: typeof data.email === 'string' ? data.email : '',
          message: typeof data.message === 'string' ? data.message : '',
          createdAt: createdAt instanceof Timestamp ? createdAt.toDate().toISOString() : null,
        };
      }),
    };
  },
);

/** Removes a handled message. */
export const adminDeleteContactMessage = onCall(
  { region: REGION, enforceAppCheck: true, timeoutSeconds: 15, maxInstances: 5 },
  async (request) => {
    const moderator = requireModerator(request);
    const id =
      typeof (request.data as { id?: unknown })?.id === 'string'
        ? (request.data as { id: string }).id
        : '';
    if (!/^[A-Za-z0-9_-]{1,128}$/u.test(id)) {
      throw new HttpsError('invalid-argument', 'Identificador inválido.');
    }
    await db.collection('contactMessages').doc(id).delete();
    logger.info('Contact message deleted', { id, moderator });
    return { ok: true };
  },
);
