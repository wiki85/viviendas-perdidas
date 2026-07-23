import type { DocumentSnapshot } from 'firebase-admin/firestore';
import type { DuplicateCandidate, ListingData } from './types.js';

export function serializeDuplicate(candidate: DuplicateCandidate): Record<string, unknown> {
  return {
    id: candidate.id,
    type: candidate.type,
    dwellingsCount: candidate.dwellingsCount,
    address: candidate.address,
    location: {
      lat: candidate.location.latitude,
      lng: candidate.location.longitude,
    },
    cityId: candidate.cityId,
    neighborhoodId: candidate.neighborhoodId,
    status: candidate.status,
    confirmations: candidate.confirmations ?? 0,
    reports: candidate.reports ?? 0,
  };
}

export function serializeListing(id: string, listing: ListingData): Record<string, unknown> {
  return {
    id,
    type: listing.type,
    dwellingsCount: listing.dwellingsCount,
    commercialUnitsCount: listing.commercialUnitsCount ?? 0,
    address: listing.address,
    location: { lat: listing.location.latitude, lng: listing.location.longitude },
    neighborhoodId: listing.neighborhoodId,
    cityId: listing.cityId,
    streetView: listing.streetView,
    evidence: listing.evidence,
    status: listing.status,
    confirmations: listing.confirmations,
    reports: listing.reports,
    officialMatch: listing.officialMatch ?? null,
    licenseVerified: listing.licenseVerified === true,
    photo: listing.photo?.url ? { url: listing.photo.url } : null,
    createdAt: listing.createdAt.toDate().toISOString(),
    updatedAt: listing.updatedAt.toDate().toISOString(),
  };
}

export function serializeListingSnapshot(
  snapshot: DocumentSnapshot,
): Record<string, unknown> | null {
  if (!snapshot.exists) return null;
  return serializeListing(snapshot.id, snapshot.data() as ListingData);
}

export function serializePublicListing(snapshot: DocumentSnapshot): Record<string, unknown> {
  const listing = snapshot.data() as ListingData;
  return {
    id: snapshot.id,
    type: listing.type,
    dwellingsCount: listing.dwellingsCount,
    address: listing.address,
    location: { lat: listing.location.latitude, lng: listing.location.longitude },
    neighborhoodId: listing.neighborhoodId,
    cityId: listing.cityId,
    streetView: listing.streetView,
    evidence: listing.evidence,
    confirmations: listing.confirmations,
    reports: listing.reports,
    createdAt: listing.createdAt.toDate().toISOString(),
    updatedAt: listing.updatedAt.toDate().toISOString(),
  };
}
