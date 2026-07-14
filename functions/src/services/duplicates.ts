import { geohashQueryBounds } from 'geofire-common';
import { DUPLICATE_RADIUS_METERS } from '../config.js';
import { classifyDuplicateCandidates } from '../domain/duplicates.js';
import { db } from '../firebase.js';
import type {
  Coordinates,
  DuplicateCandidate,
  ListingAddress,
  ListingLike,
  ListingStatus,
  ListingType,
} from '../types.js';

function asListingCandidate(
  id: string,
  value: FirebaseFirestore.DocumentData,
): DuplicateCandidate | null {
  const location = value.location as { latitude?: unknown; longitude?: unknown } | undefined;
  const address = value.address as Partial<ListingAddress> | undefined;
  const validType =
    value.type === 'unit' || value.type === 'building' || value.type === 'commercial';
  const validStatus =
    value.status === 'active' || value.status === 'flagged' || value.status === 'removed';
  if (
    !validType ||
    !validStatus ||
    typeof value.dwellingsCount !== 'number' ||
    location === undefined ||
    typeof location.latitude !== 'number' ||
    typeof location.longitude !== 'number' ||
    address === undefined ||
    typeof address.formatted !== 'string' ||
    typeof address.street !== 'string' ||
    typeof address.number !== 'string' ||
    typeof address.postalCode !== 'string' ||
    typeof address.locality !== 'string' ||
    typeof address.province !== 'string' ||
    typeof value.cityId !== 'string' ||
    !(typeof value.neighborhoodId === 'string' || value.neighborhoodId === null)
  ) {
    return null;
  }
  return {
    id,
    type: value.type as ListingType,
    status: value.status as ListingStatus,
    dwellingsCount: value.dwellingsCount,
    commercialUnitsCount:
      typeof value.commercialUnitsCount === 'number' ? value.commercialUnitsCount : 0,
    address: address as ListingAddress,
    location: { latitude: location.latitude, longitude: location.longitude },
    cityId: value.cityId,
    neighborhoodId: value.neighborhoodId,
    confirmations: typeof value.confirmations === 'number' ? value.confirmations : 0,
    reports: typeof value.reports === 'number' ? value.reports : 0,
  };
}

export async function findDuplicateCandidates(
  address: ListingAddress,
  location: Coordinates,
): Promise<ReturnType<typeof classifyDuplicateCandidates>> {
  const bounds = geohashQueryBounds(
    [location.latitude, location.longitude],
    DUPLICATE_RADIUS_METERS,
  );
  const snapshots = await Promise.all(
    bounds.map(([start, end]) =>
      db.collection('listings').orderBy('geohash').startAt(start).endAt(end).limit(100).get(),
    ),
  );
  const candidates = new Map<string, DuplicateCandidate>();
  for (const snapshot of snapshots) {
    for (const document of snapshot.docs) {
      if (candidates.has(document.id)) continue;
      const candidate = asListingCandidate(document.id, document.data());
      if (candidate !== null) candidates.set(candidate.id, candidate);
    }
  }
  return classifyDuplicateCandidates(address, location, [...candidates.values()]);
}

export function toListingLike(value: FirebaseFirestore.DocumentData): ListingLike | null {
  return asListingCandidate('snapshot', value);
}
