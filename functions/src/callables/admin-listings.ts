import { randomUUID } from 'node:crypto';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import * as logger from 'firebase-functions/logger';
import { HttpsError, onCall } from 'firebase-functions/v2/https';
import { REGION } from '../config.js';
import { photoRejectionReason } from '../domain/photos.js';
import { db, storageBucket } from '../firebase.js';
import {
  adminDeleteListingSchema,
  adminSetListingPhotoSchema,
  adminUpdateListingSchema,
} from '../schemas.js';
import { serializeListing } from '../serializers.js';
import type { ListingData } from '../types.js';
import { invalidPayload, requireModerator } from './common.js';

const ADMIN_LISTINGS_PAGE_SIZE = 100;

/** Best-effort removal of a previously published photo object. */
async function deletePublicPhoto(url: string | undefined | null): Promise<void> {
  if (!url) return;
  const match = /\/o\/([^?]+)/u.exec(url);
  if (!match?.[1]) return;
  const path = decodeURIComponent(match[1]);
  if (!path.startsWith('public/listings/')) return;
  await storageBucket
    .file(path)
    .delete({ ignoreNotFound: true })
    .catch(() => undefined);
}

export const adminListListings = onCall(
  { region: REGION, enforceAppCheck: true, timeoutSeconds: 30, maxInstances: 5 },
  async (request) => {
    requireModerator(request);
    const snapshot = await db
      .collection('listings')
      .orderBy('createdAt', 'desc')
      .limit(ADMIN_LISTINGS_PAGE_SIZE)
      .get();
    return {
      listings: snapshot.docs.map((doc) => serializeListing(doc.id, doc.data() as ListingData)),
    };
  },
);

export const adminListErrors = onCall(
  { region: REGION, enforceAppCheck: true, timeoutSeconds: 30, maxInstances: 5 },
  async (request) => {
    requireModerator(request);
    const snapshot = await db.collection('errorLogs').orderBy('createdAt', 'desc').limit(50).get();
    return {
      errors: snapshot.docs.map((doc) => ({
        id: doc.id,
        action: String(doc.get('action') ?? ''),
        kind: String(doc.get('kind') ?? ''),
        details: String(doc.get('details') ?? ''),
        createdAt: (doc.get('createdAt') as Timestamp).toDate().toISOString(),
      })),
    };
  },
);

export const adminUpdateListing = onCall(
  { region: REGION, enforceAppCheck: true, timeoutSeconds: 30, maxInstances: 5 },
  async (request) => {
    const moderator = requireModerator(request);
    const parsed = adminUpdateListingSchema.safeParse(request.data as unknown);
    if (!parsed.success) throw invalidPayload(parsed.error);
    const input = parsed.data;
    const reference = db.collection('listings').doc(input.listingId);
    await db.runTransaction(async (transaction) => {
      const snapshot = await transaction.get(reference);
      if (!snapshot.exists) throw new HttpsError('not-found', 'El registro no existe.');
      transaction.update(reference, {
        type: input.type,
        dwellingsCount: input.dwellingsCount,
        updatedAt: Timestamp.now(),
      });
    });
    logger.info('Admin updated listing', { listingId: input.listingId, moderator });
    return { updated: true };
  },
);

export const adminDeleteListing = onCall(
  { region: REGION, enforceAppCheck: true, timeoutSeconds: 30, maxInstances: 5 },
  async (request) => {
    const moderator = requireModerator(request);
    const parsed = adminDeleteListingSchema.safeParse(request.data as unknown);
    if (!parsed.success) throw invalidPayload(parsed.error);
    const reference = db.collection('listings').doc(parsed.data.listingId);
    await db.runTransaction(async (transaction) => {
      const snapshot = await transaction.get(reference);
      if (!snapshot.exists) throw new HttpsError('not-found', 'El registro no existe.');
      // Soft delete: `removed` keeps the audit trail, hides the listing from
      // clients (rules filter it) and lets onListingWrite revert aggregates.
      transaction.update(reference, { status: 'removed', updatedAt: Timestamp.now() });
    });
    logger.info('Admin removed listing', { listingId: parsed.data.listingId, moderator });
    return { removed: true };
  },
);

export const adminSetListingPhoto = onCall(
  {
    region: REGION,
    enforceAppCheck: true,
    timeoutSeconds: 60,
    memory: '512MiB',
    maxInstances: 5,
  },
  async (request) => {
    const moderator = requireModerator(request);
    const parsed = adminSetListingPhotoSchema.safeParse(request.data as unknown);
    if (!parsed.success) throw invalidPayload(parsed.error);
    const input = parsed.data;
    const reference = db.collection('listings').doc(input.listingId);
    const snapshot = await reference.get();
    if (!snapshot.exists) throw new HttpsError('not-found', 'El registro no existe.');
    const previousUrl = (snapshot.data() as ListingData).photo?.url ?? null;

    if (input.imageBase64 === null) {
      await reference.update({ photo: FieldValue.delete(), updatedAt: Timestamp.now() });
      await deletePublicPhoto(previousUrl);
      logger.info('Admin removed listing photo', { listingId: input.listingId, moderator });
      return { photo: null };
    }

    const bytes = Buffer.from(input.imageBase64, 'base64');
    if (photoRejectionReason(bytes) !== null) {
      throw new HttpsError('invalid-argument', 'La imagen no es un JPEG válido de menos de 4 MB.');
    }
    const publicPath = `public/listings/${input.listingId}/admin-${randomUUID()}.jpg`;
    await storageBucket.file(publicPath).save(bytes, {
      contentType: 'image/jpeg',
      resumable: false,
      metadata: { cacheControl: 'public, max-age=31536000, immutable' },
    });
    const url = `https://firebasestorage.googleapis.com/v0/b/${storageBucket.name}/o/${encodeURIComponent(publicPath)}?alt=media`;
    await reference.update({
      photo: { url, approvedAt: Timestamp.now() },
      updatedAt: Timestamp.now(),
    });
    await deletePublicPhoto(previousUrl);
    logger.info('Admin replaced listing photo', { listingId: input.listingId, moderator });
    return { photo: { url } };
  },
);
