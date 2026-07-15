import { GeoPoint, Timestamp } from 'firebase-admin/firestore';
import { geohashForLocation } from 'geofire-common';
import * as logger from 'firebase-functions/logger';
import { HttpsError, onCall } from 'firebase-functions/v2/https';
import { CREATE_LISTING_LIMIT_PER_HOUR, REGION } from '../config.js';
import { normalizeStreet, normalizeStreetNumber, slugifyCity } from '../domain/address.js';
import { makePortalLockId } from '../domain/crypto.js';
import { distanceMeters, isInsideSpainBoundingBox } from '../domain/geo.js';
import { normalizeOptionalText } from '../domain/sanitize.js';
import { db } from '../firebase.js';
import { createListingSchema, type CreateListingInput } from '../schemas.js';
import { googleMapsServerApiKey } from '../secrets.js';
import { serializeDuplicate, serializeListing } from '../serializers.js';
import { findDuplicateCandidates } from '../services/duplicates.js';
import { GeocodingError, geocodeInSpain, type GeocodingInput } from '../services/geocoding.js';
import { resolveNeighborhood } from '../services/geo.js';
import { describeCaughtError, recordClientError } from '../services/error-log.js';
import { enforceRateLimit, RateLimitExceededError } from '../services/rate-limit.js';
import { resolveStreetView, StreetViewError } from '../services/street-view.js';
import type { DuplicateCandidate, ListingData, ListingEvidence } from '../types.js';
import { invalidPayload, requireAppCheckRateLimitSubject } from './common.js';

interface DuplicateResponse {
  created: false;
  reason: 'possible_duplicate';
  canCreate: boolean;
  duplicates: Record<string, unknown>[];
}

interface CreatedResponse {
  created: true;
  listing: Record<string, unknown>;
  warnings: Record<string, unknown>[];
}

type CreateListingResponse = DuplicateResponse | CreatedResponse;

class PortalAlreadyHasBuildingError extends Error {
  constructor(public readonly listingId: string) {
    super('A non-removed building listing already owns this portal lock.');
    this.name = 'PortalAlreadyHasBuildingError';
  }
}

function geocodingInput(input: CreateListingInput): GeocodingInput {
  // Prefer the named source (placeId/address) so the stored address text is
  // the one the user searched; explicit coordinates then refine the pin.
  if (input.placeId !== undefined) return { kind: 'placeId', placeId: input.placeId };
  if (input.address !== undefined) return { kind: 'address', address: input.address };
  if (input.location !== undefined) {
    return { kind: 'location', latitude: input.location.lat, longitude: input.location.lng };
  }
  throw new HttpsError('invalid-argument', 'Falta la ubicación.');
}

function normalizedEvidence(input: CreateListingInput): ListingEvidence {
  return {
    licenseNumber:
      normalizeOptionalText(input.evidence?.licenseNumber)?.toLocaleUpperCase('es') ?? null,
    platform: input.evidence?.platform ?? null,
    note: normalizeOptionalText(input.evidence?.note),
  };
}

function duplicateResponse(
  candidates: readonly DuplicateCandidate[],
  canCreate: boolean,
): DuplicateResponse {
  return {
    created: false,
    reason: 'possible_duplicate',
    canCreate,
    duplicates: candidates.map(serializeDuplicate),
  };
}

async function loadDuplicateById(listingId: string): Promise<DuplicateCandidate | null> {
  const snapshot = await db.collection('listings').doc(listingId).get();
  if (!snapshot.exists) return null;
  const value = snapshot.data() as ListingData;
  return {
    id: snapshot.id,
    type: value.type,
    dwellingsCount: value.dwellingsCount,
    address: value.address,
    location: { latitude: value.location.latitude, longitude: value.location.longitude },
    neighborhoodId: value.neighborhoodId,
    cityId: value.cityId,
    status: value.status,
    confirmations: value.confirmations,
    reports: value.reports,
  };
}

function mapCreateError(error: unknown): never {
  if (error instanceof HttpsError) throw error;
  if (error instanceof RateLimitExceededError) {
    throw new HttpsError('resource-exhausted', 'Has alcanzado el límite temporal de registros.', {
      retryAfterSeconds: error.retryAfterSeconds,
    });
  }
  if (error instanceof GeocodingError) {
    const clientError =
      error.reason === 'not-found' ||
      error.reason === 'outside-spain' ||
      error.reason === 'imprecise';
    throw new HttpsError(clientError ? 'invalid-argument' : 'unavailable', error.message);
  }
  if (error instanceof StreetViewError) {
    throw new HttpsError('unavailable', 'No se pudo comprobar Street View. Inténtalo de nuevo.');
  }
  logger.error('createListing failed', {
    errorType: error instanceof Error ? error.name : typeof error,
  });
  throw new HttpsError('internal', 'No se pudo crear el registro.');
}

export const createListing = onCall(
  {
    region: REGION,
    enforceAppCheck: true,
    secrets: [googleMapsServerApiKey],
    timeoutSeconds: 30,
    maxInstances: 20,
  },
  async (request): Promise<CreateListingResponse> => {
    try {
      const parsed = createListingSchema.safeParse(request.data as unknown);
      if (!parsed.success) throw invalidPayload(parsed.error);
      const input = parsed.data;

      const rateLimitSubject = requireAppCheckRateLimitSubject(request);
      await enforceRateLimit({
        action: 'createListing',
        subject: rateLimitSubject,
        maximum: CREATE_LISTING_LIMIT_PER_HOUR,
      });

      const locationInput = geocodingInput(input);
      if (
        locationInput.kind === 'location' &&
        !isInsideSpainBoundingBox({
          latitude: locationInput.latitude,
          longitude: locationInput.longitude,
        })
      ) {
        throw new HttpsError('invalid-argument', 'La ubicación está fuera del ámbito de España.');
      }

      const apiKey = googleMapsServerApiKey.value();
      if (apiKey.length === 0) throw new Error('GOOGLE_MAPS_SERVER_API_KEY is empty');
      const geocoded = await geocodeInSpain(locationInput, apiKey);
      let location = { latitude: geocoded.latitude, longitude: geocoded.longitude };
      if (input.location !== undefined && locationInput.kind !== 'location') {
        const pinned = { latitude: input.location.lat, longitude: input.location.lng };
        if (distanceMeters(pinned, location) > 150) {
          throw new HttpsError(
            'invalid-argument',
            'La chincheta está demasiado lejos de la dirección indicada.',
          );
        }
        location = pinned;
      }
      const cityId = slugifyCity(geocoded.address.locality);
      if (cityId.length === 0) {
        throw new HttpsError('invalid-argument', 'No se pudo identificar el municipio.');
      }
      const neighborhood = resolveNeighborhood(cityId, location);
      const duplicates = await findDuplicateCandidates(geocoded.address, location);
      if (duplicates.blocking.length > 0) {
        return duplicateResponse(duplicates.blocking, false);
      }
      if (duplicates.possible.length > 0 && input.duplicateAcknowledged !== true) {
        return duplicateResponse(duplicates.possible, true);
      }

      const streetView = await resolveStreetView(
        location,
        input.streetViewHeading ?? null,
        apiKey,
        input.streetViewPanoId ?? null,
      );
      const now = Timestamp.now();
      const listingReference = db.collection('listings').doc();
      const portalLockReference = db
        .collection('portalLocks')
        .doc(
          makePortalLockId(
            cityId,
            normalizeStreet(geocoded.address.street),
            normalizeStreetNumber(geocoded.address.number),
          ),
        );
      const listing: ListingData = {
        type: input.type,
        dwellingsCount: input.dwellingsCount,
        commercialUnitsCount:
          input.type === 'building'
            ? (input.commercialUnitsCount ?? 0)
            : input.type === 'commercial'
              ? (input.commercialUnitsCount ?? 1)
              : 0,
        address: geocoded.address,
        location: new GeoPoint(location.latitude, location.longitude),
        geohash: geohashForLocation([location.latitude, location.longitude]),
        neighborhoodId: neighborhood?.id ?? null,
        cityId,
        streetView,
        evidence: normalizedEvidence(input),
        status: 'active',
        confirmations: 0,
        reports: 0,
        createdAt: now,
        updatedAt: now,
      };

      try {
        await db.runTransaction(async (transaction) => {
          const lockSnapshot = await transaction.get(portalLockReference);
          const lockedListingId = lockSnapshot.exists
            ? String(lockSnapshot.get('buildingListingId') ?? '')
            : '';
          const lockedListingSnapshot =
            lockedListingId.length > 0
              ? await transaction.get(db.collection('listings').doc(lockedListingId))
              : null;
          if (
            lockedListingSnapshot?.exists === true &&
            lockedListingSnapshot.get('status') !== 'removed'
          ) {
            throw new PortalAlreadyHasBuildingError(lockedListingId);
          }

          if (lockSnapshot.exists && input.type !== 'building') {
            transaction.delete(portalLockReference);
          }
          if (input.type === 'building') {
            transaction.set(portalLockReference, {
              buildingListingId: listingReference.id,
              updatedAt: now,
            });
          }
          transaction.create(listingReference, listing);
        });
      } catch (error) {
        if (error instanceof PortalAlreadyHasBuildingError) {
          const candidate = await loadDuplicateById(error.listingId);
          return duplicateResponse(candidate === null ? [] : [candidate], false);
        }
        throw error;
      }

      return {
        created: true,
        listing: serializeListing(listingReference.id, listing),
        warnings: duplicates.possible.map(serializeDuplicate),
      };
    } catch (error) {
      if (!(error instanceof RateLimitExceededError)) {
        const described = describeCaughtError(error, request.data);
        await recordClientError('createListing', described.kind, described.details);
      }
      return mapCreateError(error);
    }
  },
);
