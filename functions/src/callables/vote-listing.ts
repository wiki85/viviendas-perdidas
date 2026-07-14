import { Timestamp } from 'firebase-admin/firestore';
import * as logger from 'firebase-functions/logger';
import { HttpsError, onCall } from 'firebase-functions/v2/https';
import { REGION, VOTE_LIMIT_PER_HOUR } from '../config.js';
import { makeVoteId } from '../domain/crypto.js';
import { moderationStatus } from '../domain/moderation.js';
import { db } from '../firebase.js';
import { voteListingSchema } from '../schemas.js';
import { describeCaughtError, recordClientError } from '../services/error-log.js';
import { enforceRateLimit, RateLimitExceededError } from '../services/rate-limit.js';
import type { ListingData, VoteData } from '../types.js';
import { invalidPayload, requireAppCheckRateLimitSubject } from './common.js';

interface VoteResponse {
  created: boolean;
  alreadyVoted: boolean;
  kind: 'confirm' | 'report';
  confirmations: number;
  reports: number;
  status: 'active' | 'flagged' | 'removed';
}

class DifferentVoteAlreadyExistsError extends Error {
  constructor() {
    super('The device already cast a different vote for this listing.');
    this.name = 'DifferentVoteAlreadyExistsError';
  }
}

function nonnegativeCounter(value: unknown, field: string): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0) {
    throw new Error(`Listing has invalid ${field}`);
  }
  return value;
}

export const voteListing = onCall(
  {
    region: REGION,
    enforceAppCheck: true,
    timeoutSeconds: 15,
    maxInstances: 30,
  },
  async (request): Promise<VoteResponse> => {
    try {
      const parsed = voteListingSchema.safeParse(request.data as unknown);
      if (!parsed.success) throw invalidPayload(parsed.error);
      const input = parsed.data;
      const deviceHash = input.deviceFingerprintHash.toLowerCase();
      const appCheckSubject = requireAppCheckRateLimitSubject(request);

      await enforceRateLimit({
        action: 'voteListing',
        // The raw token is never persisted: common.ts hashes it first and the
        // bucket service hashes this combined, privacy-preserving subject again.
        subject: `${appCheckSubject}:${deviceHash}`,
        maximum: VOTE_LIMIT_PER_HOUR,
      });

      const listingReference = db.collection('listings').doc(input.listingId);
      const voteReference = db.collection('votes').doc(makeVoteId(input.listingId, deviceHash));
      return await db.runTransaction(async (transaction) => {
        const listingSnapshot = await transaction.get(listingReference);
        const voteSnapshot = await transaction.get(voteReference);
        if (!listingSnapshot.exists) {
          throw new HttpsError('not-found', 'El registro no existe.');
        }
        const listing = listingSnapshot.data() as ListingData;
        if (listing.status === 'removed') {
          throw new HttpsError('failed-precondition', 'El registro ya no admite votos.');
        }
        const confirmations = nonnegativeCounter(listing.confirmations, 'confirmations');
        const reports = nonnegativeCounter(listing.reports, 'reports');

        if (voteSnapshot.exists) {
          const previousKind = voteSnapshot.get('kind');
          if (previousKind !== input.kind) throw new DifferentVoteAlreadyExistsError();
          return {
            created: false,
            alreadyVoted: true,
            kind: input.kind,
            confirmations,
            reports,
            status: listing.status,
          };
        }

        const nextConfirmations = confirmations + (input.kind === 'confirm' ? 1 : 0);
        const nextReports = reports + (input.kind === 'report' ? 1 : 0);
        const status = moderationStatus(nextConfirmations, nextReports);
        const now = Timestamp.now();
        const vote: VoteData = { listingId: input.listingId, kind: input.kind, createdAt: now };
        transaction.create(voteReference, vote);
        transaction.update(listingReference, {
          confirmations: nextConfirmations,
          reports: nextReports,
          status,
          updatedAt: now,
        });
        return {
          created: true,
          alreadyVoted: false,
          kind: input.kind,
          confirmations: nextConfirmations,
          reports: nextReports,
          status,
        };
      });
    } catch (error) {
      if (error instanceof RateLimitExceededError) {
        throw new HttpsError('resource-exhausted', 'Has alcanzado el límite temporal de votos.', {
          retryAfterSeconds: error.retryAfterSeconds,
        });
      }
      const described = describeCaughtError(error, request.data);
      await recordClientError('voteListing', described.kind, described.details);
      if (error instanceof HttpsError) throw error;
      if (error instanceof DifferentVoteAlreadyExistsError) {
        throw new HttpsError(
          'already-exists',
          'Ya has emitido otro tipo de voto para este registro.',
        );
      }
      logger.error('voteListing failed', {
        errorType: error instanceof Error ? error.name : typeof error,
      });
      throw new HttpsError('internal', 'No se pudo registrar el voto.');
    }
  },
);
