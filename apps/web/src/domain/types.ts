import type { Feature, FeatureCollection, MultiPolygon, Polygon } from 'geojson';

export type LatLng = { lat: number; lng: number };

export type MapBounds = {
  north: number;
  south: number;
  east: number;
  west: number;
};

export type ListingType = 'unit' | 'building' | 'commercial';
export type ListingStatus = 'active' | 'flagged' | 'removed';
export type VoteKind = 'confirm' | 'report';

export type Address = {
  formatted: string;
  street: string;
  number: string;
  postalCode: string;
  locality: string;
  province: string;
};

export type Listing = {
  id: string;
  type: ListingType;
  dwellingsCount: number;
  /** Ground-floor premises wiped out by the conversion (buildings only). */
  commercialUnitsCount?: number;
  address: Address;
  location: LatLng;
  geohash?: string;
  neighborhoodId: string | null;
  cityId: string;
  streetView: {
    available: boolean;
    panoId: string | null;
    heading: number | null;
  };
  evidence: {
    licenseNumber: string | null;
    platform: 'airbnb' | 'booking' | 'otra' | null;
    note: string | null;
  };
  status: ListingStatus;
  confirmations: number;
  reports: number;
  /** Facade photo contributed by the community and approved by moderation. */
  photo?: { url: string } | null;
  /** Match against the official tourism registry (OpenRTA). */
  officialMatch?: {
    registrationCode: string;
    addressText?: string;
    reviewStatus: 'pending' | 'reviewed';
  } | null;
  /** The declared licence exists in the official registry. */
  licenseVerified?: boolean;
  createdAt: string;
  updatedAt: string;
};

export type OfficialPin = {
  id: string;
  location: LatLng;
  registrationCode: string;
  name: string;
  addressText: string;
  postalCode: string;
  municipality: string;
  /** Whole-home rental (group 'Completa') vs rooms-only. */
  entire: boolean;
  places: number;
};

/** Precomputed geohash-cell aggregate of the official registry (bubble). */
export type OfficialCell = {
  id: string;
  precision: number;
  /** Centroid of the member dwellings. */
  location: LatLng;
  count: number;
  entireCount: number;
};

/** Street-level cell carrying its individual pins. */
export type OfficialPinCell = {
  id: string;
  location: LatLng;
  pins: OfficialPin[];
};

/** Official registry figures for the area currently visible on the map. */
export type OfficialViewportStats = {
  total: number;
  entireHomes: number;
  roomsOnly: number;
};

export type SourceMode = 'citizens' | 'official' | 'both';

export type Aggregate = {
  scopeId: string;
  scope: 'city' | 'neighborhood' | 'country';
  cityId: string | null;
  neighborhoodId: string | null;
  name: string;
  listingsCount: number;
  lostDwellings: number;
  lostFamilies: number;
  lostInhabitants: number;
  lostCommercial: number;
  updatedAt: string | null;
};

export type VisibleScope = Pick<
  Aggregate,
  'scopeId' | 'scope' | 'cityId' | 'neighborhoodId' | 'name'
>;

export type NeighborhoodProperties = {
  id: string;
  name: string;
  cityId: string;
};

export type NeighborhoodFeature = Feature<Polygon | MultiPolygon, NeighborhoodProperties>;
export type NeighborhoodCollection = FeatureCollection<
  Polygon | MultiPolygon,
  NeighborhoodProperties
>;

export type CityDefinition = {
  id: string;
  name: string;
  center: LatLng;
  bounds: MapBounds;
  geoJsonUrl: string;
};

export type ResolvedScope = {
  scope: VisibleScope;
  city: CityDefinition | null;
  neighborhoods: NeighborhoodCollection | null;
  activeNeighborhood: NeighborhoodFeature | null;
};

export type SearchPlace = {
  id: string;
  primary: string;
  secondary: string;
  position: LatLng;
  bounds?: MapBounds;
  zoom: number;
  cityId?: string;
  cityName?: string;
  placeId?: string;
  source: 'local' | 'google';
};

export type EvidenceInput = {
  licenseNumber?: string;
  platform?: 'airbnb' | 'booking' | 'otra';
  note?: string;
};

export type CreateListingInput = {
  type: ListingType;
  dwellingsCount: number;
  commercialUnitsCount?: number;
  location?: LatLng;
  address?: string;
  placeId?: string;
  evidence?: EvidenceInput;
  streetViewHeading?: number | null;
  /** Panorama previewed by the user, so the server stores exactly what they saw. */
  streetViewPanoId?: string;
  duplicateAcknowledged?: boolean;
  officialMatchAcknowledged?: boolean;
};

export type OfficialMatchSummary = {
  registrationCode: string;
  addressText: string;
  places: number;
  entire: boolean;
};

export type DuplicateSummary = Partial<Listing> & {
  id: string;
  type: ListingType;
  dwellingsCount: number;
  address?: Address;
};

export type CreateListingResult =
  | {
      created: true;
      listing: Listing;
      warnings?: DuplicateSummary[];
    }
  | {
      created: false;
      reason: 'possible_duplicate';
      canCreate: boolean;
      duplicates: DuplicateSummary[];
    }
  | {
      created: false;
      reason: 'official_match';
      canCreate: boolean;
      official: OfficialMatchSummary;
    };

export type VoteResult = {
  created: boolean;
  alreadyVoted: boolean;
  kind: VoteKind;
  confirmations: number;
  reports: number;
  status: ListingStatus;
};

export type Unsubscribe = () => void;

export type PendingPhoto = {
  id: string;
  listingId: string;
  listingAddress: string;
  createdAt: string;
};

export type PhotoDecision = 'approve' | 'reject';

export type ErrorLogEntry = {
  id: string;
  action: string;
  kind: string;
  details: string;
  createdAt: string;
};

export interface ListingsService {
  readonly mode: 'firebase' | 'demo';
  loadListings(bounds: MapBounds): Promise<Listing[]>;
  subscribeAggregate(
    scope: VisibleScope,
    onValue: (aggregate: Aggregate) => void,
    onError: (error: Error) => void,
  ): Unsubscribe;
  createListing(input: CreateListingInput): Promise<CreateListingResult>;
  voteListing(
    listingId: string,
    kind: VoteKind,
    deviceFingerprintHash: string,
  ): Promise<VoteResult>;
  exportPublicData(): Promise<Blob>;
  submitListingPhoto(
    listingId: string,
    imageBase64: string,
    deviceFingerprintHash: string,
  ): Promise<void>;
  listOfficialCells(bounds: MapBounds, precision: number): Promise<OfficialCell[]>;
  listOfficialPinCells(cellIds: string[]): Promise<OfficialPinCell[]>;
  adminSignIn(): Promise<{ email: string; moderator: boolean }>;
  adminResolveOfficialMatch(listingId: string): Promise<void>;
  adminSyncOfficialData(): Promise<{ municipalities: number; records: number }>;
  listPendingPhotos(): Promise<PendingPhoto[]>;
  getPendingPhotoImage(photoId: string): Promise<string>;
  reviewListingPhoto(photoId: string, decision: PhotoDecision): Promise<void>;
  adminListListings(): Promise<Listing[]>;
  adminUpdateListing(
    listingId: string,
    patch: { type: ListingType; dwellingsCount: number; commercialUnitsCount: number },
  ): Promise<void>;
  adminDeleteListing(listingId: string): Promise<void>;
  adminSetListingPhoto(listingId: string, imageBase64: string | null): Promise<void>;
  adminListErrors(): Promise<ErrorLogEntry[]>;
}
