import type { GeoPoint, Timestamp } from 'firebase-admin/firestore';

export type ListingType = 'unit' | 'building' | 'commercial';
export type ListingStatus = 'active' | 'flagged' | 'removed';
export type VoteKind = 'confirm' | 'report';
export type Platform = 'airbnb' | 'booking' | 'otra';

export interface Coordinates {
  latitude: number;
  longitude: number;
}

export interface ListingAddress {
  formatted: string;
  street: string;
  number: string;
  postalCode: string;
  locality: string;
  province: string;
}

export interface ListingEvidence {
  licenseNumber: string | null;
  platform: Platform | null;
  note: string | null;
}

export interface ListingStreetView {
  available: boolean;
  panoId: string | null;
  heading: number | null;
}

export interface ListingData {
  type: ListingType;
  dwellingsCount: number;
  /** Ground-floor premises wiped out by the conversion (buildings only). */
  commercialUnitsCount: number;
  address: ListingAddress;
  location: GeoPoint;
  geohash: string;
  neighborhoodId: string | null;
  cityId: string;
  streetView: ListingStreetView;
  evidence: ListingEvidence;
  status: ListingStatus;
  confirmations: number;
  reports: number;
  photo?: { url: string; approvedAt: Timestamp } | null;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface ListingLike {
  type: ListingType;
  dwellingsCount: number;
  commercialUnitsCount?: number;
  address: ListingAddress;
  location: Coordinates;
  neighborhoodId: string | null;
  cityId: string;
  status: ListingStatus;
  confirmations?: number;
  reports?: number;
}

export interface DuplicateCandidate extends ListingLike {
  id: string;
}

export interface AggregateData {
  scope: 'city' | 'neighborhood';
  cityId: string;
  neighborhoodId: string | null;
  name: string;
  listingsCount: number;
  lostDwellings: number;
  lostFamilies: number;
  lostInhabitants: number;
  /** Ground-floor commercial premises converted into tourist rentals. */
  lostCommercial: number;
  updatedAt: Timestamp;
}

export interface VoteData {
  listingId: string;
  kind: VoteKind;
  createdAt: Timestamp;
}

export type ListingPhotoStatus = 'pending' | 'approved' | 'rejected';

export interface ListingPhotoData {
  listingId: string;
  storagePath: string;
  status: ListingPhotoStatus;
  createdAt: Timestamp;
  reviewedAt: Timestamp | null;
  publicPath: string | null;
}
