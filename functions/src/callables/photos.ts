import { Timestamp } from 'firebase-admin/firestore';
import * as logger from 'firebase-functions/logger';
import { HttpsError, onCall } from 'firebase-functions/v2/https';
import {
  MAX_PENDING_PHOTOS_PER_LISTING,
  PENDING_PHOTOS_PAGE_SIZE,
  PHOTO_SUBMIT_LIMIT_PER_HOUR,
  REGION,
} from '../config.js';
import { photoRejectionReason } from '../domain/photos.js';
import { db, storageBucket } from '../firebase.js';
import { adminEmails } from '../params.js';
import {
  pendingPhotoSchema,
  reviewListingPhotoSchema,
  submitListingPhotoSchema,
} from '../schemas.js';
import { describeCaughtError, recordClientError } from '../services/error-log.js';
import { enforceRateLimit, RateLimitExceededError } from '../services/rate-limit.js';
import type { ListingData, ListingPhotoData } from '../types.js';
import { invalidPayload, requireAppCheckRateLimitSubject, requireModerator } from './common.js';

const PHOTO_REJECTION_MESSAGES: Record<string, string> = {
  empty: 'La imagen llegó vacía.',
  too_small: 'La imagen es demasiado pequeña.',
  too_large: 'La imagen supera el tamaño máximo de 4 MB.',
  not_jpeg: 'Solo se admiten fotos JPEG generadas desde la aplicación.',
};

function photoDocument(snapshot: FirebaseFirestore.DocumentSnapshot): ListingPhotoData {
  const data = snapshot.data();
  if (
    !data ||
    typeof data.listingId !== 'string' ||
    typeof data.storagePath !== 'string' ||
    (data.status !== 'pending' && data.status !== 'approved' && data.status !== 'rejected')
  ) {
    throw new HttpsError('internal', 'El documento de la foto está corrupto.');
  }
  return data as ListingPhotoData;
}

export const submitListingPhoto = onCall(
  {
    region: REGION,
    enforceAppCheck: true,
    timeoutSeconds: 30,
    memory: '512MiB',
    maxInstances: 10,
  },
  async (request) => {
    try {
      const parsed = submitListingPhotoSchema.safeParse(request.data as unknown);
      if (!parsed.success) throw invalidPayload(parsed.error);
      const input = parsed.data;
      const appCheckSubject = requireAppCheckRateLimitSubject(request);
      await enforceRateLimit({
        action: 'submitPhoto',
        subject: `${appCheckSubject}:${input.deviceFingerprintHash.toLowerCase()}`,
        maximum: PHOTO_SUBMIT_LIMIT_PER_HOUR,
      });

      const bytes = Buffer.from(input.imageBase64, 'base64');
      const rejection = photoRejectionReason(bytes);
      if (rejection !== null) {
        throw new HttpsError(
          'invalid-argument',
          PHOTO_REJECTION_MESSAGES[rejection] ?? 'La imagen no es válida.',
        );
      }

      const listingSnapshot = await db.collection('listings').doc(input.listingId).get();
      if (!listingSnapshot.exists) throw new HttpsError('not-found', 'El registro no existe.');
      if ((listingSnapshot.data() as ListingData).status === 'removed') {
        throw new HttpsError('failed-precondition', 'El registro ya no admite fotos.');
      }

      const pendingCount = await db
        .collection('listingPhotos')
        .where('listingId', '==', input.listingId)
        .where('status', '==', 'pending')
        .count()
        .get();
      if (pendingCount.data().count >= MAX_PENDING_PHOTOS_PER_LISTING) {
        throw new HttpsError(
          'resource-exhausted',
          'Este registro ya tiene fotos pendientes de revisión. Inténtalo más adelante.',
        );
      }

      const photoReference = db.collection('listingPhotos').doc();
      const storagePath = `pending/${input.listingId}/${photoReference.id}.jpg`;
      await storageBucket.file(storagePath).save(bytes, {
        contentType: 'image/jpeg',
        resumable: false,
        metadata: { cacheControl: 'private, max-age=0' },
      });
      const photo: ListingPhotoData = {
        listingId: input.listingId,
        storagePath,
        status: 'pending',
        createdAt: Timestamp.now(),
        reviewedAt: null,
        publicPath: null,
      };
      await photoReference.create(photo);
      return { queued: true };
    } catch (error) {
      if (error instanceof RateLimitExceededError) {
        throw new HttpsError('resource-exhausted', 'Has alcanzado el límite temporal de fotos.', {
          retryAfterSeconds: error.retryAfterSeconds,
        });
      }
      const described = describeCaughtError(error, {
        listingId: (request.data as { listingId?: unknown })?.listingId ?? null,
        imageBytes:
          typeof (request.data as { imageBase64?: unknown })?.imageBase64 === 'string'
            ? Math.round(((request.data as { imageBase64: string }).imageBase64.length * 3) / 4)
            : null,
      });
      await recordClientError('submitListingPhoto', described.kind, described.details);
      if (error instanceof HttpsError) throw error;
      logger.error('submitListingPhoto failed', {
        errorType: error instanceof Error ? error.name : typeof error,
      });
      throw new HttpsError('internal', 'No se pudo guardar la foto.');
    }
  },
);

export const listPendingPhotos = onCall(
  { region: REGION, enforceAppCheck: true, timeoutSeconds: 30, maxInstances: 5 },
  async (request) => {
    requireModerator(request);
    const snapshot = await db
      .collection('listingPhotos')
      .where('status', '==', 'pending')
      .orderBy('createdAt', 'asc')
      .limit(PENDING_PHOTOS_PAGE_SIZE)
      .get();
    const listingIds = [...new Set(snapshot.docs.map((doc) => doc.get('listingId') as string))];
    const listingSnapshots =
      listingIds.length > 0
        ? await db.getAll(...listingIds.map((id) => db.collection('listings').doc(id)))
        : [];
    const addressByListing = new Map(
      listingSnapshots.map((listing) => [
        listing.id,
        listing.exists
          ? ((listing.data() as ListingData).address?.formatted ?? 'Dirección no disponible')
          : 'Registro eliminado',
      ]),
    );
    return {
      photos: snapshot.docs.map((doc) => ({
        id: doc.id,
        listingId: doc.get('listingId') as string,
        listingAddress: addressByListing.get(doc.get('listingId') as string) ?? '',
        createdAt: (doc.get('createdAt') as Timestamp).toDate().toISOString(),
      })),
    };
  },
);

export const getPendingPhoto = onCall(
  { region: REGION, enforceAppCheck: true, timeoutSeconds: 30, memory: '512MiB', maxInstances: 5 },
  async (request) => {
    requireModerator(request);
    const parsed = pendingPhotoSchema.safeParse(request.data as unknown);
    if (!parsed.success) throw invalidPayload(parsed.error);
    const snapshot = await db.collection('listingPhotos').doc(parsed.data.photoId).get();
    if (!snapshot.exists) throw new HttpsError('not-found', 'La foto no existe.');
    const photo = photoDocument(snapshot);
    if (photo.status !== 'pending') {
      throw new HttpsError('failed-precondition', 'La foto ya fue revisada.');
    }
    const [bytes] = await storageBucket.file(photo.storagePath).download();
    return { imageDataUrl: `data:image/jpeg;base64,${bytes.toString('base64')}` };
  },
);

export const reviewListingPhoto = onCall(
  {
    region: REGION,
    enforceAppCheck: true,
    timeoutSeconds: 60,
    memory: '512MiB',
    maxInstances: 5,
  },
  async (request) => {
    const moderator = requireModerator(request);
    const parsed = reviewListingPhotoSchema.safeParse(request.data as unknown);
    if (!parsed.success) throw invalidPayload(parsed.error);
    const input = parsed.data;
    const photoReference = db.collection('listingPhotos').doc(input.photoId);
    const snapshot = await photoReference.get();
    if (!snapshot.exists) throw new HttpsError('not-found', 'La foto no existe.');
    const photo = photoDocument(snapshot);
    if (photo.status !== 'pending') {
      throw new HttpsError('failed-precondition', 'La foto ya fue revisada.');
    }
    const now = Timestamp.now();

    if (input.decision === 'reject') {
      await photoReference.update({ status: 'rejected', reviewedAt: now });
      await storageBucket.file(photo.storagePath).delete({ ignoreNotFound: true });
      logger.info('Photo rejected', { photoId: input.photoId, moderator });
      return { decision: 'reject' };
    }

    const publicPath = `public/listings/${photo.listingId}/${input.photoId}.jpg`;
    await storageBucket.file(photo.storagePath).copy(storageBucket.file(publicPath));
    await storageBucket.file(publicPath).setMetadata({
      contentType: 'image/jpeg',
      cacheControl: 'public, max-age=31536000, immutable',
    });
    const url = `https://firebasestorage.googleapis.com/v0/b/${storageBucket.name}/o/${encodeURIComponent(publicPath)}?alt=media`;
    await db.runTransaction(async (transaction) => {
      const listingReference = db.collection('listings').doc(photo.listingId);
      const listingSnapshot = await transaction.get(listingReference);
      if (!listingSnapshot.exists) {
        throw new HttpsError('failed-precondition', 'El registro asociado ya no existe.');
      }
      transaction.update(listingReference, {
        photo: { url, approvedAt: now },
        updatedAt: now,
      });
      transaction.update(photoReference, { status: 'approved', reviewedAt: now, publicPath });
    });
    await storageBucket.file(photo.storagePath).delete({ ignoreNotFound: true });
    logger.info('Photo approved', { photoId: input.photoId, moderator });
    return { decision: 'approve', url };
  },
);

// Ensures the ADMIN_EMAILS param is registered with the CLI even if tree-shaken.
void adminEmails;
