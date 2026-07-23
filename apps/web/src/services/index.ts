import type {
  CreateListingInput,
  ListingsService,
  ListingType,
  MapBounds,
  PhotoDecision,
  VisibleScope,
  VoteKind,
} from '../domain/types';
import { appConfig } from '../lib/config';
import { DemoListingsService } from './demo-service';

class LazyFirebaseListingsService implements ListingsService {
  readonly mode = 'firebase' as const;
  private instance: Promise<ListingsService> | null = null;

  private load() {
    this.instance ??= import('./firebase-service').then(
      ({ FirebaseListingsService }) => new FirebaseListingsService(),
    );
    return this.instance;
  }

  loadListings(bounds: MapBounds) {
    return this.load().then((service) => service.loadListings(bounds));
  }

  subscribeAggregate(
    scope: VisibleScope,
    onValue: Parameters<ListingsService['subscribeAggregate']>[1],
    onError: Parameters<ListingsService['subscribeAggregate']>[2],
  ) {
    let disposed = false;
    let unsubscribe: () => void = () => undefined;
    void this.load()
      .then((service) => {
        if (!disposed) unsubscribe = service.subscribeAggregate(scope, onValue, onError);
      })
      .catch((error: unknown) =>
        onError(error instanceof Error ? error : new Error('Firebase no disponible.')),
      );
    return () => {
      disposed = true;
      unsubscribe();
    };
  }

  createListing(input: CreateListingInput) {
    return this.load().then((service) => service.createListing(input));
  }

  voteListing(listingId: string, kind: VoteKind, deviceFingerprintHash: string) {
    return this.load().then((service) =>
      service.voteListing(listingId, kind, deviceFingerprintHash),
    );
  }

  exportPublicData() {
    return this.load().then((service) => service.exportPublicData());
  }

  submitListingPhoto(listingId: string, imageBase64: string, deviceFingerprintHash: string) {
    return this.load().then((service) =>
      service.submitListingPhoto(listingId, imageBase64, deviceFingerprintHash),
    );
  }

  adminSignIn() {
    return this.load().then((service) => service.adminSignIn());
  }

  listOfficialCells(bounds: MapBounds, precision: number) {
    return this.load().then((service) => service.listOfficialCells(bounds, precision));
  }

  listOfficialPinCells(cellIds: string[]) {
    return this.load().then((service) => service.listOfficialPinCells(cellIds));
  }

  adminResolveOfficialMatch(listingId: string) {
    return this.load().then((service) => service.adminResolveOfficialMatch(listingId));
  }

  adminSyncOfficialData() {
    return this.load().then((service) => service.adminSyncOfficialData());
  }

  listPendingPhotos() {
    return this.load().then((service) => service.listPendingPhotos());
  }

  getPendingPhotoImage(photoId: string) {
    return this.load().then((service) => service.getPendingPhotoImage(photoId));
  }

  reviewListingPhoto(photoId: string, decision: PhotoDecision) {
    return this.load().then((service) => service.reviewListingPhoto(photoId, decision));
  }

  adminListListings() {
    return this.load().then((service) => service.adminListListings());
  }

  adminUpdateListing(
    listingId: string,
    patch: { type: ListingType; dwellingsCount: number; commercialUnitsCount: number },
  ) {
    return this.load().then((service) => service.adminUpdateListing(listingId, patch));
  }

  adminDeleteListing(listingId: string) {
    return this.load().then((service) => service.adminDeleteListing(listingId));
  }

  adminSetListingPhoto(listingId: string, imageBase64: string | null) {
    return this.load().then((service) => service.adminSetListingPhoto(listingId, imageBase64));
  }

  adminListErrors() {
    return this.load().then((service) => service.adminListErrors());
  }
}

let singleton: ListingsService | null = null;

export function getListingsService(): ListingsService {
  singleton ??= appConfig.demoMode ? new DemoListingsService() : new LazyFirebaseListingsService();
  return singleton;
}
