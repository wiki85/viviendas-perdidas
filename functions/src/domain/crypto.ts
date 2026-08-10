import { createHash } from 'node:crypto';

export function sha256(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}

/**
 * Idempotencia del voto: una aportación por (registro, identidad de votante).
 * La identidad DEBE derivarse de una señal del servidor (el hash del token de
 * App Check), nunca de un valor elegido por el cliente: si no, el atacante
 * varía ese valor y cuenta N votos, o borra un registro con 15 «report»
 * falsos. Ver auditoría VP-01.
 */
export function makeVoteId(listingId: string, voterSubject: string): string {
  return sha256(`${listingId}\u0000${voterSubject.toLowerCase()}`);
}

export function makePortalLockId(cityId: string, street: string, number: string): string {
  return sha256(`${cityId}\u0000${street}\u0000${number}`);
}
