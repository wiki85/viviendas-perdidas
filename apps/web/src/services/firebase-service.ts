import { initializeApp, type FirebaseApp } from 'firebase/app';
import { ReCaptchaV3Provider, initializeAppCheck } from 'firebase/app-check';
import {
  collection,
  connectFirestoreEmulator,
  doc,
  getDocs,
  getFirestore,
  limit,
  onSnapshot,
  orderBy,
  query,
  startAt,
  endAt,
  where,
  type DocumentData,
  type Firestore,
  type GeoPoint,
  type Timestamp,
} from 'firebase/firestore';
import {
  connectFunctionsEmulator,
  getFunctions,
  httpsCallable,
  type Functions,
} from 'firebase/functions';
import { geohashQueryBounds } from 'geofire-common';
import type {
  Address,
  Aggregate,
  CreateListingInput,
  CreateListingResult,
  ErrorLogEntry,
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
import { appConfig } from '../lib/config';
import { distanceMeters, listingIsInBounds } from '../lib/geo';
import { MAX_LISTINGS_PER_VIEW } from '../lib/constants';

function toIsoString(value: unknown) {
  if (value && typeof value === 'object' && 'toDate' in value) {
    return (value as Timestamp).toDate().toISOString();
  }
  if (typeof value === 'string') return value;
  if (value instanceof Date) return value.toISOString();
  return new Date().toISOString();
}

function normalizeAddress(value: unknown): Address {
  const address = (value ?? {}) as Partial<Address>;
  return {
    formatted: address.formatted ?? 'Dirección no disponible',
    street: address.street ?? '',
    number: address.number ?? '',
    postalCode: address.postalCode ?? '',
    locality: address.locality ?? '',
    province: address.province ?? '',
  };
}

function normalizeLocation(value: unknown): Listing['location'] {
  if (value && typeof value === 'object') {
    const candidate = value as Partial<GeoPoint> & { lat?: number; lng?: number };
    const lat = typeof candidate.latitude === 'number' ? candidate.latitude : candidate.lat;
    const lng = typeof candidate.longitude === 'number' ? candidate.longitude : candidate.lng;
    if (typeof lat === 'number' && typeof lng === 'number') return { lat, lng };
  }
  return { lat: 0, lng: 0 };
}

export function normalizeListing(id: string, raw: DocumentData): Listing {
  const streetView = (raw.streetView ?? {}) as Partial<Listing['streetView']>;
  const evidence = (raw.evidence ?? {}) as Partial<Listing['evidence']>;
  return {
    id,
    type: raw.type === 'building' || raw.type === 'commercial' ? raw.type : 'unit',
    dwellingsCount: typeof raw.dwellingsCount === 'number' ? raw.dwellingsCount : 1,
    commercialUnitsCount:
      typeof raw.commercialUnitsCount === 'number' ? raw.commercialUnitsCount : 0,
    address: normalizeAddress(raw.address),
    location: normalizeLocation(raw.location),
    geohash: typeof raw.geohash === 'string' ? raw.geohash : undefined,
    neighborhoodId: typeof raw.neighborhoodId === 'string' ? raw.neighborhoodId : null,
    cityId: typeof raw.cityId === 'string' ? raw.cityId : '',
    streetView: {
      available: streetView.available === true,
      panoId: typeof streetView.panoId === 'string' ? streetView.panoId : null,
      heading: typeof streetView.heading === 'number' ? streetView.heading : null,
    },
    evidence: {
      licenseNumber: typeof evidence.licenseNumber === 'string' ? evidence.licenseNumber : null,
      platform:
        evidence.platform === 'airbnb' ||
        evidence.platform === 'booking' ||
        evidence.platform === 'otra'
          ? evidence.platform
          : null,
      note: typeof evidence.note === 'string' ? evidence.note : null,
    },
    status: raw.status === 'flagged' || raw.status === 'removed' ? raw.status : 'active',
    confirmations: typeof raw.confirmations === 'number' ? raw.confirmations : 0,
    reports: typeof raw.reports === 'number' ? raw.reports : 0,
    photo:
      raw.photo && typeof (raw.photo as { url?: unknown }).url === 'string'
        ? { url: (raw.photo as { url: string }).url }
        : null,
    createdAt: toIsoString(raw.createdAt),
    updatedAt: toIsoString(raw.updatedAt),
  };
}

function normalizeAggregate(scope: VisibleScope, raw?: DocumentData): Aggregate {
  return {
    ...scope,
    name: typeof raw?.name === 'string' ? raw.name : scope.name,
    listingsCount: typeof raw?.listingsCount === 'number' ? raw.listingsCount : 0,
    lostDwellings: typeof raw?.lostDwellings === 'number' ? raw.lostDwellings : 0,
    lostFamilies: typeof raw?.lostFamilies === 'number' ? raw.lostFamilies : 0,
    lostInhabitants: typeof raw?.lostInhabitants === 'number' ? raw.lostInhabitants : 0,
    lostCommercial: typeof raw?.lostCommercial === 'number' ? raw.lostCommercial : 0,
    updatedAt: raw?.updatedAt ? toIsoString(raw.updatedAt) : null,
  };
}

function initializeFirebase(): { app: FirebaseApp; db: Firestore; functions: Functions } {
  if (!appConfig.firebase) throw new Error('Firebase no está configurado.');
  const app = initializeApp(appConfig.firebase);

  if (appConfig.recaptchaSiteKey) {
    if (appConfig.useFirebaseEmulators) window.FIREBASE_APPCHECK_DEBUG_TOKEN = true;
    initializeAppCheck(app, {
      provider: new ReCaptchaV3Provider(appConfig.recaptchaSiteKey),
      isTokenAutoRefreshEnabled: true,
    });
  }

  const db = getFirestore(app);
  const functions = getFunctions(app, appConfig.firebaseRegion);
  if (appConfig.useFirebaseEmulators) {
    connectFirestoreEmulator(db, '127.0.0.1', 8080);
    connectFunctionsEmulator(functions, '127.0.0.1', 5001);
  }
  return { app, db, functions };
}

export class FirebaseListingsService implements ListingsService {
  readonly mode = 'firebase' as const;
  private readonly app: FirebaseApp;
  private readonly db: Firestore;
  private readonly functions: Functions;

  constructor() {
    const clients = initializeFirebase();
    this.app = clients.app;
    this.db = clients.db;
    this.functions = clients.functions;
  }

  async loadListings(bounds: MapBounds) {
    const center = {
      lat: (bounds.north + bounds.south) / 2,
      lng: (bounds.east + bounds.west) / 2,
    };
    const corner = { lat: bounds.north, lng: bounds.east };
    const radius = Math.max(100, distanceMeters(center, corner));
    const ranges = geohashQueryBounds([center.lat, center.lng], radius);
    const perRange = Math.max(25, Math.ceil(MAX_LISTINGS_PER_VIEW / Math.max(1, ranges.length)));
    const snapshots = await Promise.all(
      ranges.map(([start, end]) =>
        getDocs(
          query(
            collection(this.db, 'listings'),
            where('status', 'in', ['active', 'flagged']),
            orderBy('geohash'),
            startAt(start),
            endAt(end),
            limit(perRange),
          ),
        ),
      ),
    );
    const merged = new Map<string, Listing>();
    for (const snapshot of snapshots) {
      for (const document of snapshot.docs) {
        const listing = normalizeListing(document.id, document.data());
        if (listing.status !== 'removed' && listingIsInBounds(listing.location, bounds)) {
          merged.set(listing.id, listing);
        }
      }
    }
    return Array.from(merged.values()).slice(0, MAX_LISTINGS_PER_VIEW);
  }

  subscribeAggregate(
    scope: VisibleScope,
    onValue: (aggregate: Aggregate) => void,
    onError: (error: Error) => void,
  ): Unsubscribe {
    if (scope.scope === 'country') {
      queueMicrotask(() => onValue(normalizeAggregate(scope)));
      return () => undefined;
    }
    return onSnapshot(
      doc(this.db, 'aggregates', scope.scopeId),
      (snapshot) =>
        onValue(normalizeAggregate(scope, snapshot.exists() ? snapshot.data() : undefined)),
      (error) => onError(error),
    );
  }

  async createListing(input: CreateListingInput): Promise<CreateListingResult> {
    this.requireAppCheck();
    const callable = httpsCallable<CreateListingInput, CreateListingResult>(
      this.functions,
      'createListing',
    );
    const response = await callable(input);
    if (response.data.created) {
      return {
        created: true,
        listing: normalizeListing(response.data.listing.id, response.data.listing),
        warnings: response.data.warnings ?? [],
      };
    }
    return response.data;
  }

  async voteListing(
    listingId: string,
    kind: VoteKind,
    deviceFingerprintHash: string,
  ): Promise<VoteResult> {
    this.requireAppCheck();
    const callable = httpsCallable<
      { listingId: string; kind: VoteKind; deviceFingerprintHash: string },
      VoteResult
    >(this.functions, 'voteListing');
    const response = await callable({ listingId, kind, deviceFingerprintHash });
    return response.data;
  }

  async exportPublicData() {
    const projectId = appConfig.firebase?.projectId;
    const fallbackUrl = projectId
      ? `https://${appConfig.firebaseRegion}-${projectId}.cloudfunctions.net/exportPublicData`
      : null;
    const url = appConfig.publicExportUrl ?? fallbackUrl;
    if (!url) throw new Error('La exportación pública aún no está configurada.');
    const response = await fetch(url);
    if (!response.ok) throw new Error('No se pudo preparar la descarga de datos.');
    return response.blob();
  }

  async submitListingPhoto(
    listingId: string,
    imageBase64: string,
    deviceFingerprintHash: string,
  ): Promise<void> {
    this.requireAppCheck();
    const callable = httpsCallable<
      { listingId: string; imageBase64: string; deviceFingerprintHash: string },
      { queued: boolean }
    >(this.functions, 'submitListingPhoto');
    await callable({ listingId, imageBase64, deviceFingerprintHash });
  }

  async adminSignIn(): Promise<{ email: string; moderator: boolean }> {
    const { getAuth, GoogleAuthProvider, signInWithPopup } = await import('firebase/auth');
    const auth = getAuth(this.app);
    let email = auth.currentUser?.email ?? null;
    if (!email) {
      const credential = await signInWithPopup(auth, new GoogleAuthProvider());
      email = credential.user.email;
    }
    if (!email) throw new Error('La cuenta no tiene email visible.');
    try {
      // Server-side probe: only allowlisted moderators pass. Anyone else is
      // signed out immediately so no session lingers behind the admin gate.
      await httpsCallable(this.functions, 'adminWhoAmI')({});
      return { email, moderator: true };
    } catch (cause) {
      const code = (cause as { code?: string }).code ?? '';
      if (code.includes('permission-denied')) {
        await auth.signOut().catch(() => undefined);
        return { email, moderator: false };
      }
      throw cause;
    }
  }

  async listPendingPhotos(): Promise<PendingPhoto[]> {
    const callable = httpsCallable<Record<string, never>, { photos: PendingPhoto[] }>(
      this.functions,
      'listPendingPhotos',
    );
    const response = await callable({});
    return response.data.photos;
  }

  async getPendingPhotoImage(photoId: string): Promise<string> {
    const callable = httpsCallable<{ photoId: string }, { imageDataUrl: string }>(
      this.functions,
      'getPendingPhoto',
    );
    const response = await callable({ photoId });
    return response.data.imageDataUrl;
  }

  async reviewListingPhoto(photoId: string, decision: PhotoDecision): Promise<void> {
    const callable = httpsCallable<
      { photoId: string; decision: PhotoDecision },
      { decision: PhotoDecision }
    >(this.functions, 'reviewListingPhoto');
    await callable({ photoId, decision });
  }

  async adminListListings(): Promise<Listing[]> {
    const callable = httpsCallable<
      Record<string, never>,
      { listings: Array<DocumentData & { id: string }> }
    >(this.functions, 'adminListListings');
    const response = await callable({});
    return response.data.listings.map((listing) => normalizeListing(listing.id, listing));
  }

  async adminUpdateListing(
    listingId: string,
    patch: { type: Listing['type']; dwellingsCount: number; commercialUnitsCount: number },
  ): Promise<void> {
    const callable = httpsCallable(this.functions, 'adminUpdateListing');
    await callable({ listingId, ...patch });
  }

  async adminDeleteListing(listingId: string): Promise<void> {
    const callable = httpsCallable(this.functions, 'adminDeleteListing');
    await callable({ listingId });
  }

  async adminSetListingPhoto(listingId: string, imageBase64: string | null): Promise<void> {
    const callable = httpsCallable(this.functions, 'adminSetListingPhoto');
    await callable({ listingId, imageBase64 });
  }

  async adminListErrors(): Promise<ErrorLogEntry[]> {
    const callable = httpsCallable<Record<string, never>, { errors: ErrorLogEntry[] }>(
      this.functions,
      'adminListErrors',
    );
    const response = await callable({});
    return response.data.errors;
  }

  private requireAppCheck() {
    if (!appConfig.recaptchaSiteKey && !appConfig.useFirebaseEmulators) {
      throw new Error(
        'La colaboración está temporalmente en modo lectura porque App Check no está configurado.',
      );
    }
  }
}
