import type {
  Aggregate,
  CreateListingInput,
  CreateListingResult,
  Listing,
  ListingsService,
  MapBounds,
  PendingPhoto,
  PhotoDecision,
  Unsubscribe,
  VisibleScope,
  VoteKind,
  VoteResult,
} from '../domain/types';
import { calculateImpact } from '../lib/impact';
import { distanceMeters, listingIsInBounds } from '../lib/geo';
import { DEMO_LISTINGS } from './demo-data';

type Listener = {
  scope: VisibleScope;
  onValue: (aggregate: Aggregate) => void;
};

const NEIGHBORHOOD_ALIASES: Record<string, string[]> = {
  russafa: ['ruzafa', 'russafa'],
  lavapies: ['lavapies', 'embajadores'],
  gracia: ['gracia'],
};

function normalize(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('es');
}

function scopeMatches(listing: Listing, scope: VisibleScope) {
  if (scope.scope === 'country') return true;
  if (listing.cityId !== scope.cityId) return false;
  if (scope.scope === 'city') return true;
  if (listing.neighborhoodId === scope.neighborhoodId) return true;
  const normalizedScope = normalize(`${scope.name} ${scope.neighborhoodId ?? ''}`);
  return Object.entries(NEIGHBORHOOD_ALIASES).some(
    ([listingNeighborhood, aliases]) =>
      listing.neighborhoodId === listingNeighborhood &&
      aliases.some((alias) => normalizedScope.includes(alias)),
  );
}

function slugForLocality(locality: string) {
  return normalize(locality)
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function defaultAddress(input: CreateListingInput, locality: string): Listing['address'] {
  const formatted = input.address?.trim() || `Ubicación señalada, ${locality}`;
  return {
    formatted,
    street: input.address?.split(',')[0]?.trim() || 'Ubicación señalada',
    number: input.address?.match(/\b\d+[A-Za-z]?\b/)?.[0] ?? 's/n',
    postalCode: '',
    locality,
    province: locality,
  };
}

type DemoPendingPhoto = PendingPhoto & { imageDataUrl: string };

export class DemoListingsService implements ListingsService {
  readonly mode = 'demo' as const;
  private listings = DEMO_LISTINGS.map((listing) => structuredClone(listing));
  private listeners = new Set<Listener>();
  private votes = new Set<string>();
  private pendingPhotos: DemoPendingPhoto[] = [];

  async loadListings(bounds: MapBounds) {
    await Promise.resolve();
    return this.listings
      .filter(
        (listing) => listing.status !== 'removed' && listingIsInBounds(listing.location, bounds),
      )
      .slice(0, 500)
      .map((listing) => structuredClone(listing));
  }

  subscribeAggregate(
    scope: VisibleScope,
    onValue: (aggregate: Aggregate) => void,
    onError: (error: Error) => void,
  ): Unsubscribe {
    void onError;
    const listener = { scope, onValue };
    this.listeners.add(listener);
    queueMicrotask(() => onValue(this.aggregateFor(scope)));
    return () => this.listeners.delete(listener);
  }

  async createListing(input: CreateListingInput): Promise<CreateListingResult> {
    const location = input.location ?? { lat: 39.4623, lng: -0.3734 };
    const nearby = this.listings.filter(
      (listing) => listing.status !== 'removed' && distanceMeters(listing.location, location) <= 25,
    );
    const blocking = nearby.filter((listing) => listing.type === 'building');
    if (blocking.length > 0) {
      return {
        created: false,
        reason: 'possible_duplicate',
        canCreate: false,
        duplicates: blocking.map((listing) => structuredClone(listing)),
      };
    }
    if (nearby.length > 0 && !input.duplicateAcknowledged) {
      return {
        created: false,
        reason: 'possible_duplicate',
        canCreate: true,
        duplicates: nearby.map((listing) => structuredClone(listing)),
      };
    }

    const locality = location.lng < -1 ? 'Madrid' : location.lng > 1 ? 'Barcelona' : 'València';
    const cityId = slugForLocality(locality).replace('valencia', 'valencia');
    const neighborhoodId =
      cityId === 'madrid' ? 'lavapies' : cityId === 'barcelona' ? 'gracia' : 'russafa';
    const timestamp = new Date().toISOString();
    const created: Listing = {
      id: `demo-${crypto.randomUUID()}`,
      type: input.type,
      dwellingsCount: input.dwellingsCount,
      address: defaultAddress(input, locality),
      location,
      neighborhoodId,
      cityId,
      streetView: {
        available: false,
        panoId: null,
        heading: input.streetViewHeading ?? null,
      },
      evidence: {
        licenseNumber: input.evidence?.licenseNumber?.trim() || null,
        platform: input.evidence?.platform ?? null,
        note: input.evidence?.note?.trim() || null,
      },
      status: 'active',
      confirmations: 0,
      reports: 0,
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    this.listings.push(created);
    this.emit();
    return { created: true, listing: structuredClone(created), warnings: [] };
  }

  async voteListing(
    listingId: string,
    kind: VoteKind,
    deviceFingerprintHash: string,
  ): Promise<VoteResult> {
    const listing = this.listings.find((candidate) => candidate.id === listingId);
    if (!listing) throw new Error('Este registro ya no está disponible.');
    const voteKey = `${listingId}:${deviceFingerprintHash}`;
    if (this.votes.has(voteKey)) {
      return {
        created: false,
        alreadyVoted: true,
        kind,
        confirmations: listing.confirmations,
        reports: listing.reports,
        status: listing.status,
      };
    }
    this.votes.add(voteKey);
    if (kind === 'confirm') listing.confirmations += 1;
    else listing.reports += 1;
    if (listing.reports >= 15) listing.status = 'removed';
    else if (listing.reports >= 5 && listing.reports > listing.confirmations * 2) {
      listing.status = 'flagged';
    }
    listing.updatedAt = new Date().toISOString();
    this.emit();
    return {
      created: true,
      alreadyVoted: false,
      kind,
      confirmations: listing.confirmations,
      reports: listing.reports,
      status: listing.status,
    };
  }

  async exportPublicData() {
    const safeListings = this.listings
      .filter((listing) => listing.status === 'active')
      .map((listing) => ({
        id: listing.id,
        type: listing.type,
        dwellingsCount: listing.dwellingsCount,
        address: listing.address,
        location: listing.location,
        neighborhoodId: listing.neighborhoodId,
        cityId: listing.cityId,
        streetView: listing.streetView,
        evidence: listing.evidence,
        createdAt: listing.createdAt,
      }));
    return new Blob(
      [JSON.stringify({ exportedAt: new Date().toISOString(), listings: safeListings }, null, 2)],
      {
        type: 'application/json',
      },
    );
  }

  async submitListingPhoto(
    listingId: string,
    imageBase64: string,
    deviceFingerprintHash: string,
  ): Promise<void> {
    void deviceFingerprintHash;
    const listing = this.listings.find((candidate) => candidate.id === listingId);
    if (!listing) throw new Error('Este registro ya no está disponible.');
    this.pendingPhotos.push({
      id: `demo-photo-${crypto.randomUUID()}`,
      listingId,
      listingAddress: listing.address.formatted,
      createdAt: new Date().toISOString(),
      imageDataUrl: `data:image/jpeg;base64,${imageBase64}`,
    });
  }

  async adminSignIn(): Promise<{ email: string }> {
    return { email: 'moderacion@demo.local' };
  }

  async listPendingPhotos(): Promise<PendingPhoto[]> {
    return this.pendingPhotos.map(({ imageDataUrl, ...summary }) => {
      void imageDataUrl;
      return { ...summary };
    });
  }

  async getPendingPhotoImage(photoId: string): Promise<string> {
    const photo = this.pendingPhotos.find((candidate) => candidate.id === photoId);
    if (!photo) throw new Error('La foto no existe.');
    return photo.imageDataUrl;
  }

  async reviewListingPhoto(photoId: string, decision: PhotoDecision): Promise<void> {
    const photo = this.pendingPhotos.find((candidate) => candidate.id === photoId);
    if (!photo) throw new Error('La foto no existe.');
    this.pendingPhotos = this.pendingPhotos.filter((candidate) => candidate.id !== photoId);
    if (decision === 'approve') {
      const listing = this.listings.find((candidate) => candidate.id === photo.listingId);
      if (listing) {
        listing.photo = { url: photo.imageDataUrl };
        listing.updatedAt = new Date().toISOString();
        this.emit();
      }
    }
  }

  async adminListListings(): Promise<Listing[]> {
    return [...this.listings]
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .map((listing) => structuredClone(listing));
  }

  async adminUpdateListing(
    listingId: string,
    patch: { type: Listing['type']; dwellingsCount: number; commercialUnitsCount: number },
  ): Promise<void> {
    const listing = this.listings.find((candidate) => candidate.id === listingId);
    if (!listing) throw new Error('El registro no existe.');
    listing.type = patch.type;
    listing.dwellingsCount = patch.dwellingsCount;
    listing.commercialUnitsCount = patch.commercialUnitsCount;
    listing.updatedAt = new Date().toISOString();
    this.emit();
  }

  async adminDeleteListing(listingId: string): Promise<void> {
    const listing = this.listings.find((candidate) => candidate.id === listingId);
    if (!listing) throw new Error('El registro no existe.');
    listing.status = 'removed';
    listing.updatedAt = new Date().toISOString();
    this.emit();
  }

  async adminSetListingPhoto(listingId: string, imageBase64: string | null): Promise<void> {
    const listing = this.listings.find((candidate) => candidate.id === listingId);
    if (!listing) throw new Error('El registro no existe.');
    listing.photo = imageBase64 ? { url: `data:image/jpeg;base64,${imageBase64}` } : null;
    listing.updatedAt = new Date().toISOString();
    this.emit();
  }

  async adminListErrors() {
    return [];
  }

  private aggregateFor(scope: VisibleScope): Aggregate {
    const matching = this.listings.filter(
      (listing) => listing.status !== 'removed' && scopeMatches(listing, scope),
    );
    const residential = matching.filter((listing) => listing.type !== 'commercial');
    const lostDwellings = residential.reduce((sum, listing) => sum + listing.dwellingsCount, 0);
    const lostInhabitants = residential.reduce(
      (sum, listing) => sum + calculateImpact(listing.dwellingsCount).lostInhabitants,
      0,
    );
    const lostCommercial = matching.reduce(
      (sum, listing) =>
        sum +
        (listing.type === 'commercial'
          ? Math.max(1, listing.commercialUnitsCount ?? 1)
          : listing.type === 'building'
            ? (listing.commercialUnitsCount ?? 0)
            : 0),
      0,
    );
    return {
      ...scope,
      listingsCount: matching.length,
      lostDwellings,
      lostFamilies: lostDwellings,
      lostInhabitants,
      lostCommercial,
      updatedAt: new Date().toISOString(),
    };
  }

  private emit() {
    for (const listener of this.listeners) {
      listener.onValue(this.aggregateFor(listener.scope));
    }
  }
}
