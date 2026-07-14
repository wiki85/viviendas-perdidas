import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import * as logger from 'firebase-functions/logger';
import { onDocumentWritten } from 'firebase-functions/v2/firestore';
import { FUNCTION_EVENT_TTL_MS, REGION } from '../config.js';
import { aggregateDeltas } from '../domain/aggregates.js';
import { sha256 } from '../domain/crypto.js';
import { db } from '../firebase.js';
import { toListingLike } from '../services/duplicates.js';
import { cityDisplayName, neighborhoodDisplayName } from '../services/geo.js';
import type { ListingLike } from '../types.js';

function listingFromSnapshot(
  snapshot: FirebaseFirestore.DocumentSnapshot | undefined,
): ListingLike | null {
  if (snapshot === undefined || !snapshot.exists) return null;
  const listing = toListingLike(snapshot.data() ?? {});
  if (listing === null) throw new Error(`Malformed listing snapshot ${snapshot.ref.path}`);
  return listing;
}

export const onListingWrite = onDocumentWritten(
  { document: 'listings/{listingId}', region: REGION, retry: true },
  async (event) => {
    if (event.data === undefined) return;
    const before = listingFromSnapshot(event.data.before);
    const after = listingFromSnapshot(event.data.after);
    const deltas = aggregateDeltas(before, after);
    const processedReference = db.collection('processedListingEvents').doc(sha256(event.id));
    const now = Timestamp.now();

    await db.runTransaction(async (transaction) => {
      const processedSnapshot = await transaction.get(processedReference);
      if (processedSnapshot.exists) return;

      for (const delta of deltas) {
        const name =
          delta.scope === 'city'
            ? cityDisplayName(delta.cityId)
            : neighborhoodDisplayName(delta.cityId, delta.neighborhoodId ?? '');
        transaction.set(
          db.collection('aggregates').doc(delta.scopeId),
          {
            scope: delta.scope,
            cityId: delta.cityId,
            neighborhoodId: delta.neighborhoodId,
            name,
            listingsCount: FieldValue.increment(delta.listingsCount),
            lostDwellings: FieldValue.increment(delta.lostDwellings),
            lostFamilies: FieldValue.increment(delta.lostFamilies),
            lostInhabitants: FieldValue.increment(delta.lostInhabitants),
            lostCommercial: FieldValue.increment(delta.lostCommercial),
            updatedAt: now,
          },
          { merge: true },
        );
      }
      transaction.create(processedReference, {
        eventId: event.id,
        processedAt: now,
        expiresAt: Timestamp.fromMillis(now.toMillis() + FUNCTION_EVENT_TTL_MS),
      });
    });
    logger.debug('Listing aggregate event processed', {
      eventId: event.id,
      deltaCount: deltas.length,
    });
  },
);
