import { createHash } from 'node:crypto';

export function sha256(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}

export function makeVoteId(listingId: string, deviceFingerprintHash: string): string {
  return sha256(`${listingId}\u0000${deviceFingerprintHash.toLowerCase()}`);
}

export function makePortalLockId(cityId: string, street: string, number: string): string {
  return sha256(`${cityId}\u0000${street}\u0000${number}`);
}
