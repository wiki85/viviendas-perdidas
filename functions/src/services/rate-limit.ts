import { Timestamp } from 'firebase-admin/firestore';
import { RATE_LIMIT_TTL_MS, RATE_LIMIT_WINDOW_MS } from '../config.js';
import { sha256 } from '../domain/crypto.js';
import { db } from '../firebase.js';

export class RateLimitExceededError extends Error {
  constructor(public readonly retryAfterSeconds: number) {
    super('Rate limit exceeded');
    this.name = 'RateLimitExceededError';
  }
}

export interface RateLimitOptions {
  action: string;
  subject: string;
  maximum: number;
  now?: Date;
}

export function appCheckTokenHash(rawToken: string): string {
  return sha256(rawToken);
}

export async function enforceRateLimit(options: RateLimitOptions): Promise<void> {
  const now = options.now ?? new Date();
  const bucketStart = Math.floor(now.getTime() / RATE_LIMIT_WINDOW_MS) * RATE_LIMIT_WINDOW_MS;
  const bucketEnd = bucketStart + RATE_LIMIT_WINDOW_MS;
  const subjectHash = sha256(options.subject);
  const bucketId = `${options.action}_${subjectHash}_${bucketStart}`;
  const reference = db.collection('rateLimits').doc(bucketId);

  await db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(reference);
    const current = snapshot.exists ? Number(snapshot.get('count')) : 0;
    if (!Number.isSafeInteger(current) || current < 0) {
      throw new Error(`Invalid rate-limit counter at ${reference.path}`);
    }
    if (current >= options.maximum) {
      throw new RateLimitExceededError(Math.max(1, Math.ceil((bucketEnd - now.getTime()) / 1_000)));
    }
    transaction.set(
      reference,
      {
        action: options.action,
        count: current + 1,
        windowStartedAt: Timestamp.fromMillis(bucketStart),
        expiresAt: Timestamp.fromMillis(bucketEnd + RATE_LIMIT_TTL_MS),
      },
      { merge: false },
    );
  });
}
