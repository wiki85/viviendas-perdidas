import { Timestamp } from 'firebase-admin/firestore';
import * as logger from 'firebase-functions/logger';
import { HttpsError, onCall } from 'firebase-functions/v2/https';
import { onRequest } from 'firebase-functions/v2/https';
import { randomBytes } from 'node:crypto';
import { REGION } from '../config.js';
import { db } from '../firebase.js';
import { cityIdsForScope, scopeDisplayName } from '../domain/communities.js';
import { requireModerator } from './common.js';

/**
 * «El Recuento» subscriptions. Preferences live under the Firebase Auth uid
 * (Google sign-in gives us a verified email); the unsubscribe link works
 * WITHOUT auth via a per-subscriber random token, so the one-click promise
 * in every email footer holds even logged out.
 */

const MAX_SCOPES = 12;

interface Preferences {
  scopes: string[];
  weekly: boolean;
  monthly: boolean;
}

function validScope(scope: unknown): scope is string {
  return typeof scope === 'string' && scope.length <= 60 && cityIdsForScope(scope).length > 0;
}

function requireUser(
  auth: { uid?: string; token?: { email?: unknown; email_verified?: unknown } } | undefined,
): {
  uid: string;
  email: string;
} {
  const uid = auth?.uid;
  const email = auth?.token?.email;
  if (typeof uid !== 'string' || typeof email !== 'string' || email.length === 0) {
    throw new HttpsError('unauthenticated', 'Inicia sesión para gestionar tu suscripción.');
  }
  // Igual que requireModerator: un claim ausente NO cuenta como verificado.
  if (auth?.token?.email_verified !== true) {
    throw new HttpsError('failed-precondition', 'Tu correo aún no está verificado.');
  }
  return { uid, email: email.toLocaleLowerCase('es') };
}

export const getNewsletterPreferences = onCall(
  { region: REGION, enforceAppCheck: true, timeoutSeconds: 15, maxInstances: 10 },
  async (request) => {
    const { uid, email } = requireUser(request.auth);
    const snapshot = await db.collection('newsletterSubscribers').doc(uid).get();
    if (!snapshot.exists) {
      return { email, subscribed: false, scopes: [], weekly: true, monthly: true };
    }
    const data = snapshot.data() ?? {};
    return {
      email,
      subscribed: data.unsubscribedAt === null || data.unsubscribedAt === undefined,
      scopes: Array.isArray(data.scopes) ? data.scopes.filter(validScope) : [],
      weekly: data.weekly !== false,
      monthly: data.monthly !== false,
    };
  },
);

export const saveNewsletterPreferences = onCall(
  { region: REGION, enforceAppCheck: true, timeoutSeconds: 15, maxInstances: 10 },
  async (request) => {
    const { uid, email } = requireUser(request.auth);
    const raw = request.data as Partial<Preferences> | undefined;
    const scopes = Array.isArray(raw?.scopes)
      ? raw.scopes.filter(validScope).slice(0, MAX_SCOPES)
      : [];
    const weekly = raw?.weekly === true;
    const monthly = raw?.monthly === true;
    if (scopes.length === 0 || (!weekly && !monthly)) {
      throw new HttpsError(
        'invalid-argument',
        'Elige al menos una zona y una frecuencia (semanal o mensual).',
      );
    }
    const reference = db.collection('newsletterSubscribers').doc(uid);
    const existing = await reference.get();
    const unsubscribeToken =
      (existing.exists && typeof existing.get('unsubscribeToken') === 'string'
        ? (existing.get('unsubscribeToken') as string)
        : null) ?? randomBytes(24).toString('hex');
    await reference.set({
      email,
      scopes,
      weekly,
      monthly,
      unsubscribeToken,
      unsubscribedAt: null,
      updatedAt: Timestamp.now(),
      ...(existing.exists ? {} : { createdAt: Timestamp.now() }),
    });
    logger.info('Newsletter preferences saved', { scopes: scopes.length, weekly, monthly });
    return { ok: true };
  },
);

export const unsubscribeNewsletter = onCall(
  { region: REGION, enforceAppCheck: true, timeoutSeconds: 15, maxInstances: 10 },
  async (request) => {
    const { uid } = requireUser(request.auth);
    await db
      .collection('newsletterSubscribers')
      .doc(uid)
      .set({ unsubscribedAt: Timestamp.now() }, { merge: true });
    return { ok: true };
  },
);

/** Panel de administración: quién está suscrito y a qué. Solo moderación. */
export const adminListNewsletterSubscribers = onCall(
  { region: REGION, enforceAppCheck: true, timeoutSeconds: 30, maxInstances: 5 },
  async (request) => {
    requireModerator(request);
    const snapshot = await db.collection('newsletterSubscribers').limit(2000).get();
    const subscribers = snapshot.docs
      .map((doc) => {
        const data = doc.data();
        const scopes: string[] = Array.isArray(data.scopes)
          ? data.scopes.filter((scope): scope is string => typeof scope === 'string')
          : [];
        return {
          email: typeof data.email === 'string' ? data.email : '',
          scopeLabels: scopes.map(scopeDisplayName),
          weekly: data.weekly !== false,
          monthly: data.monthly !== false,
          active: data.unsubscribedAt === null || data.unsubscribedAt === undefined,
          createdAt:
            data.createdAt instanceof Timestamp ? data.createdAt.toDate().toISOString() : null,
        };
      })
      .sort((a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? ''));
    return { subscribers };
  },
);

/** Baja en un clic desde el email, sin sesión: /boletin/baja?t=<token>. */
export const bajaBoletin = onRequest(
  { region: REGION, timeoutSeconds: 15, maxInstances: 5 },
  async (request, response) => {
    const token = typeof request.query.t === 'string' ? request.query.t : '';
    const page = (title: string, body: string) =>
      `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title><style>body{font:16px/1.6 system-ui;margin:0;display:grid;place-items:center;min-height:100vh;background:#f7f3eb;color:#1e2b27;text-align:center;padding:20px}a{color:#315d4c;font-weight:700}</style></head><body><div><h1 style="font-family:Georgia,serif">${title}</h1><p>${body}</p><p><a href="/">Volver al mapa</a></p></div></body></html>`;
    if (!/^[a-f0-9]{48}$/u.test(token)) {
      response
        .status(400)
        .type('html')
        .send(page('Enlace no válido', 'El enlace de baja está incompleto o caducado.'));
      return;
    }
    const snapshot = await db
      .collection('newsletterSubscribers')
      .where('unsubscribeToken', '==', token)
      .limit(1)
      .get();
    const doc = snapshot.docs[0];
    if (doc === undefined) {
      response
        .status(404)
        .type('html')
        .send(page('Suscripción no encontrada', 'Puede que ya te hubieras dado de baja.'));
      return;
    }
    await doc.ref.set({ unsubscribedAt: Timestamp.now() }, { merge: true });
    response
      .set('Cache-Control', 'no-store')
      .status(200)
      .type('html')
      .send(
        page(
          'Baja completada',
          'No volverás a recibir El Recuento. Puedes reactivarlo cuando quieras desde aquiviviamos.com/boletin.',
        ),
      );
  },
);
