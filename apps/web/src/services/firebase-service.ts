import { initializeApp, type FirebaseApp } from 'firebase/app';
import { ReCaptchaV3Provider, initializeAppCheck } from 'firebase/app-check';
import {
  collection,
  connectFirestoreEmulator,
  doc,
  documentId,
  getDoc,
  getDocs,
  getFirestore,
  initializeFirestore,
  limit,
  onSnapshot,
  orderBy,
  persistentLocalCache,
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
  CityImpactSources,
  CreateListingInput,
  CreateListingResult,
  ErrorLogEntry,
  Listing,
  ListingsService,
  MapBounds,
  OfficialCell,
  OfficialPin,
  OfficialPinCell,
  PendingPhoto,
  PhotoDecision,
  Unsubscribe,
  VisibleScope,
  VoteKind,
  VoteResult,
  ContactMessage,
  ContactMessageInput,
  NewsletterPreferences,
  NewsletterSubscriber,
  OfficialHistoryEntry,
} from '../domain/types';
import { appConfig } from '../lib/config';
import { boundsWithin, distanceMeters, expandBounds, listingIsInBounds } from '../lib/geo';
import { MAX_LISTINGS_PER_VIEW } from '../lib/constants';
import { CELL_DEGREES } from '../lib/official-cells';

const LISTINGS_CACHE_TTL_MS = 60_000;
const CELL_BAND_CACHE_TTL_MS = 10 * 60_000;
const CELL_BANDS_PER_PRECISION = 3;

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
    officialMatch:
      raw.officialMatch &&
      typeof (raw.officialMatch as { registrationCode?: unknown }).registrationCode === 'string'
        ? {
            registrationCode: (raw.officialMatch as { registrationCode: string }).registrationCode,
            addressText:
              typeof (raw.officialMatch as { addressText?: unknown }).addressText === 'string'
                ? (raw.officialMatch as { addressText: string }).addressText
                : undefined,
            reviewStatus:
              (raw.officialMatch as { reviewStatus?: unknown }).reviewStatus === 'reviewed'
                ? 'reviewed'
                : 'pending',
          }
        : null,
    licenseVerified: raw.licenseVerified === true,
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

function filterCellsByLongitude(
  cells: OfficialCell[],
  bounds: MapBounds,
  lngPad: number,
): OfficialCell[] {
  const west = bounds.west - lngPad;
  const east = bounds.east + lngPad;
  return cells.filter((cell) => cell.location.lng >= west && cell.location.lng <= east);
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

  // Persistent local cache: repeat visits and flaky connections serve
  // listings/cells from IndexedDB instead of an empty map. Falls back to
  // the in-memory cache when unavailable (private mode, second tab race).
  let db: Firestore;
  try {
    db = initializeFirestore(app, { localCache: persistentLocalCache() });
  } catch {
    db = getFirestore(app);
  }
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
  // Containment cache: each settled pan used to re-download every visible
  // listing even when the viewport barely moved. Fetches cover an expanded
  // region so small pans and zoom-ins resolve without touching Firestore.
  private listingsCache: {
    bounds: MapBounds;
    listings: Listing[];
    truncated: boolean;
    at: number;
  } | null = null;

  private cellBandCache = new Map<
    number,
    Array<{ south: number; north: number; cells: OfficialCell[]; at: number }>
  >();

  constructor() {
    const clients = initializeFirebase();
    this.app = clients.app;
    this.db = clients.db;
    this.functions = clients.functions;
  }

  /** Local mutations must not be masked by the read cache. */
  private invalidateListings() {
    this.listingsCache = null;
  }

  async loadListings(bounds: MapBounds) {
    const cached = this.listingsCache;
    if (
      cached !== null &&
      !cached.truncated &&
      Date.now() - cached.at < LISTINGS_CACHE_TTL_MS &&
      boundsWithin(bounds, cached.bounds)
    ) {
      return cached.listings.filter((listing) => listingIsInBounds(listing.location, bounds));
    }
    const fetchBounds = expandBounds(bounds, 0.3);
    const center = {
      lat: (fetchBounds.north + fetchBounds.south) / 2,
      lng: (fetchBounds.east + fetchBounds.west) / 2,
    };
    const corner = { lat: fetchBounds.north, lng: fetchBounds.east };
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
        if (listing.status !== 'removed' && listingIsInBounds(listing.location, fetchBounds)) {
          merged.set(listing.id, listing);
        }
      }
    }
    const listings = Array.from(merged.values()).slice(0, MAX_LISTINGS_PER_VIEW);
    this.listingsCache = {
      bounds: fetchBounds,
      listings,
      truncated: listings.length >= MAX_LISTINGS_PER_VIEW,
      at: Date.now(),
    };
    return listings.filter((listing) => listingIsInBounds(listing.location, bounds));
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
      this.invalidateListings();
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
    this.invalidateListings();
    return response.data;
  }

  async exportPublicData() {
    // Same-origin route through the Hosting rewrite: the CDN cache absorbs
    // repeated downloads instead of billing a Firestore export per request.
    const url = appConfig.publicExportUrl ?? '/datos/export';
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

  async listOfficialCells(bounds: MapBounds, precision: number): Promise<OfficialCell[]> {
    // One latitude band per query (any-SDK-safe single inequality); longitude
    // is filtered client side. Bands cache per session: cells only change
    // with the weekly sync, so panning inside a cached band costs no reads.
    const pad = CELL_DEGREES[precision] ?? CELL_DEGREES[7];
    const south = bounds.south - pad.lat;
    const north = bounds.north + pad.lat;
    const entries = this.cellBandCache.get(precision) ?? [];
    const hit = entries.find(
      (entry) =>
        entry.south <= south &&
        entry.north >= north &&
        Date.now() - entry.at < CELL_BAND_CACHE_TTL_MS,
    );
    if (hit) return filterCellsByLongitude(hit.cells, bounds, pad.lng);

    // Fetch a taller band than requested so vertical pans stay cached too.
    const margin = (north - south) * 0.6;
    const fetchSouth = south - margin;
    const fetchNorth = north + margin;
    const snapshot = await getDocs(
      query(
        collection(this.db, 'officialCells'),
        where('precision', '==', precision),
        where('lat', '>=', fetchSouth),
        where('lat', '<=', fetchNorth),
        orderBy('lat'),
        limit(2000),
      ),
    );
    const bandCells: OfficialCell[] = [];
    for (const document of snapshot.docs) {
      const data = document.data();
      if (typeof data.lat !== 'number' || typeof data.lng !== 'number') continue;
      bandCells.push({
        id: document.id,
        precision,
        location: { lat: data.lat, lng: data.lng },
        count: typeof data.count === 'number' ? data.count : 0,
        entireCount: typeof data.entireCount === 'number' ? data.entireCount : 0,
        roomsInhabitants: typeof data.roomsInhabitants === 'number' ? data.roomsInhabitants : 0,
      });
    }
    // A band cut off by the query limit is incomplete: serve it, don't cache it.
    if (snapshot.size < 2000) {
      const next = [
        { south: fetchSouth, north: fetchNorth, cells: bandCells, at: Date.now() },
        ...entries,
      ].slice(0, CELL_BANDS_PER_PRECISION);
      this.cellBandCache.set(precision, next);
    }
    return filterCellsByLongitude(bandCells, bounds, pad.lng);
  }

  async listOfficialPinCells(cellIds: string[]): Promise<OfficialPinCell[]> {
    if (cellIds.length === 0) return [];
    const chunks: string[][] = [];
    for (let index = 0; index < cellIds.length; index += 30) {
      chunks.push(cellIds.slice(index, index + 30));
    }
    const snapshots = await Promise.all(
      chunks.map((chunk) =>
        getDocs(query(collection(this.db, 'officialCellPins'), where(documentId(), 'in', chunk))),
      ),
    );
    const cells: OfficialPinCell[] = [];
    for (const snapshot of snapshots) {
      for (const document of snapshot.docs) {
        const data = document.data();
        if (typeof data.lat !== 'number' || typeof data.lng !== 'number') continue;
        const rawPins = Array.isArray(data.pins) ? data.pins : [];
        const pins: OfficialPin[] = [];
        for (const raw of rawPins) {
          if (!raw || typeof raw !== 'object') continue;
          const pin = raw as Record<string, unknown>;
          if (typeof pin.lat !== 'number' || typeof pin.lng !== 'number') continue;
          pins.push({
            id: typeof pin.id === 'string' ? pin.id : `${document.id}-${pins.length}`,
            location: { lat: pin.lat, lng: pin.lng },
            registrationCode: typeof pin.registrationCode === 'string' ? pin.registrationCode : '',
            name: typeof pin.name === 'string' ? pin.name : '',
            addressText: typeof pin.addressText === 'string' ? pin.addressText : '',
            postalCode: typeof pin.postalCode === 'string' ? pin.postalCode : '',
            municipality: typeof pin.municipality === 'string' ? pin.municipality : '',
            entire: pin.entire === true,
            places: typeof pin.places === 'number' ? pin.places : 0,
            ...(typeof pin.units === 'number' && pin.units > 1 ? { units: pin.units } : {}),
          });
        }
        cells.push({ id: document.id, location: { lat: data.lat, lng: data.lng }, pins });
      }
    }
    return cells;
  }

  async getCityImpactSources(cityId: string): Promise<CityImpactSources> {
    const [aggregateSnapshot, officialSnapshot] = await Promise.all([
      getDoc(doc(this.db, 'aggregates', cityId)),
      getDoc(doc(this.db, 'officialStats', cityId)),
    ]);
    const aggregate = aggregateSnapshot.exists() ? aggregateSnapshot.data() : null;
    const official = officialSnapshot.exists() ? officialSnapshot.data() : null;
    const communityValid =
      aggregate !== null &&
      aggregate.scope === 'city' &&
      typeof aggregate.listingsCount === 'number' &&
      aggregate.listingsCount > 0;
    return {
      community: communityValid
        ? {
            lostDwellings:
              typeof aggregate.lostDwellings === 'number' ? aggregate.lostDwellings : 0,
            lostFamilies: typeof aggregate.lostFamilies === 'number' ? aggregate.lostFamilies : 0,
            lostInhabitants:
              typeof aggregate.lostInhabitants === 'number' ? aggregate.lostInhabitants : 0,
            listingsCount: aggregate.listingsCount,
            lostCommercial:
              typeof aggregate.lostCommercial === 'number' ? aggregate.lostCommercial : 0,
          }
        : null,
      official:
        official !== null && typeof official.total === 'number' && official.total > 0
          ? {
              total: official.total,
              entireHomes: typeof official.entireHomes === 'number' ? official.entireHomes : 0,
              roomsOnly: typeof official.roomsOnly === 'number' ? official.roomsOnly : 0,
              roomsInhabitants:
                typeof official.roomsInhabitants === 'number' ? official.roomsInhabitants : 0,
              places: typeof official.places === 'number' ? official.places : 0,
            }
          : null,
    };
  }

  async adminResolveOfficialMatch(listingId: string): Promise<void> {
    const callable = httpsCallable(this.functions, 'adminResolveOfficialMatch');
    await callable({ listingId });
  }

  async adminSyncOfficialData(): Promise<{ municipalities: number; records: number }> {
    const callable = httpsCallable<
      Record<string, never>,
      { municipalities: number; records: number }
    >(this.functions, 'adminSyncOfficialData');
    const response = await callable({});
    return response.data;
  }

  async listOfficialHistory(): Promise<OfficialHistoryEntry[]> {
    const { collection, getDocs, query, orderBy, limit } = await import('firebase/firestore');
    const snapshot = await getDocs(
      query(collection(this.db, 'officialHistory'), orderBy('date', 'asc'), limit(5000)),
    );
    return snapshot.docs.map((doc) => {
      const data = doc.data();
      const integer = (value: unknown) =>
        typeof value === 'number' && Number.isFinite(value) ? Math.round(value) : 0;
      return {
        cityId: typeof data.cityId === 'string' ? data.cityId : '',
        date: typeof data.date === 'string' ? data.date : '',
        source: typeof data.source === 'string' ? data.source : '',
        total: integer(data.total),
        entireHomes: integer(data.entireHomes),
        roomsOnly: integer(data.roomsOnly),
        roomsInhabitants: integer(data.roomsInhabitants),
        places: integer(data.places),
        withLocation: integer(data.withLocation),
      };
    });
  }

  async submitContactMessage(input: ContactMessageInput): Promise<void> {
    const callable = httpsCallable(this.functions, 'submitContactMessage');
    await callable(input);
  }

  async adminListContactMessages(): Promise<ContactMessage[]> {
    const callable = httpsCallable<Record<string, never>, { messages: ContactMessage[] }>(
      this.functions,
      'adminListContactMessages',
    );
    const response = await callable({});
    return response.data.messages;
  }

  async adminDeleteContactMessage(id: string): Promise<void> {
    const callable = httpsCallable(this.functions, 'adminDeleteContactMessage');
    await callable({ id });
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

  async newsletterSignIn(): Promise<{ email: string }> {
    const { getAuth, GoogleAuthProvider, signInWithPopup } = await import('firebase/auth');
    const auth = getAuth(this.app);
    let email = auth.currentUser?.email ?? null;
    if (!email) {
      const credential = await signInWithPopup(auth, new GoogleAuthProvider());
      email = credential.user.email;
    }
    if (!email) throw new Error('La cuenta no tiene email visible.');
    return { email };
  }

  async getNewsletterPreferences(): Promise<NewsletterPreferences> {
    const callable = httpsCallable<Record<string, never>, NewsletterPreferences>(
      this.functions,
      'getNewsletterPreferences',
    );
    const response = await callable({});
    return response.data;
  }

  async saveNewsletterPreferences(preferences: {
    scopes: string[];
    weekly: boolean;
    monthly: boolean;
  }): Promise<void> {
    const callable = httpsCallable(this.functions, 'saveNewsletterPreferences');
    await callable(preferences);
  }

  async unsubscribeNewsletter(): Promise<void> {
    const callable = httpsCallable(this.functions, 'unsubscribeNewsletter');
    await callable({});
  }

  async adminListNewsletterSubscribers(): Promise<NewsletterSubscriber[]> {
    const callable = httpsCallable<Record<string, never>, { subscribers: NewsletterSubscriber[] }>(
      this.functions,
      'adminListNewsletterSubscribers',
    );
    const response = await callable({});
    return response.data.subscribers;
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
    this.invalidateListings();
  }

  async adminDeleteListing(listingId: string): Promise<void> {
    const callable = httpsCallable(this.functions, 'adminDeleteListing');
    await callable({ listingId });
    this.invalidateListings();
  }

  async adminSetListingPhoto(listingId: string, imageBase64: string | null): Promise<void> {
    const callable = httpsCallable(this.functions, 'adminSetListingPhoto');
    await callable({ listingId, imageBase64 });
    this.invalidateListings();
  }

  async adminListErrors(): Promise<ErrorLogEntry[]> {
    const callable = httpsCallable<Record<string, never>, { errors: ErrorLogEntry[] }>(
      this.functions,
      'adminListErrors',
    );
    const response = await callable({});
    return response.data.errors;
  }

  async adminAcknowledgeError(target: { id: string } | { all: true }): Promise<void> {
    const callable = httpsCallable(this.functions, 'adminAcknowledgeError');
    await callable(target);
  }

  private requireAppCheck() {
    if (!appConfig.recaptchaSiteKey && !appConfig.useFirebaseEmulators) {
      throw new Error(
        'La colaboración está temporalmente en modo lectura porque App Check no está configurado.',
      );
    }
  }
}
