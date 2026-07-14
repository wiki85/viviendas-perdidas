import { HttpsError } from 'firebase-functions/v2/https';
import type { CallableRequest } from 'firebase-functions/v2/https';
import type { ZodError } from 'zod';
import { isAdminEmail } from '../params.js';
import { appCheckTokenHash } from '../services/rate-limit.js';

export function invalidPayload(error: ZodError): HttpsError {
  return new HttpsError('invalid-argument', 'Los datos enviados no son válidos.', {
    issues: error.issues.map((issue) => ({ path: issue.path.join('.'), message: issue.message })),
  });
}

export function requireAppCheckRateLimitSubject(request: CallableRequest<unknown>): string {
  const token = request.rawRequest.get('X-Firebase-AppCheck');
  if (token === undefined || token.length === 0) {
    throw new HttpsError('failed-precondition', 'No se pudo identificar el token de App Check.');
  }
  return appCheckTokenHash(token);
}

export function requireModerator(request: CallableRequest<unknown>): string {
  const token = request.auth?.token;
  const email = typeof token?.email === 'string' ? token.email : null;
  if (!email || token?.email_verified !== true) {
    throw new HttpsError('unauthenticated', 'Inicia sesión para moderar.');
  }
  if (!isAdminEmail(email)) {
    throw new HttpsError('permission-denied', 'Esta cuenta no tiene permisos de moderación.');
  }
  return email;
}
