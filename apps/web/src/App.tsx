import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { Sparkles, TriangleAlert, X } from 'lucide-react';
import type {
  Aggregate,
  CityDefinition,
  CreateListingInput,
  DuplicateSummary,
  LatLng,
  Listing,
  MapBounds,
  OfficialCell,
  OfficialPin,
  OfficialViewportStats,
  SearchPlace,
  SourceMode,
  VoteKind,
} from './domain/types';
import { CityImpactBanner } from './components/CityImpactBanner';
import { CookieNotice } from './components/CookieNotice';
import { DonateBanner } from './components/DonateBanner';
import { DonateSheet } from './components/DonateSheet';
import { ListingSheet } from './components/ListingSheet';
import { OfficialSheet } from './components/OfficialSheet';
import { OfficialStackSheet } from './components/OfficialStackSheet';
import { MapStage, type CameraCommand } from './components/map/MapStage';
import { BottomNav, type Section } from './components/hud/BottomNav';
import type { ImpactDetailsProps } from './components/hud/ImpactDetails';
import { ImpactSheet } from './components/hud/ImpactSheet';
import { ImpactStrip } from './components/hud/ImpactStrip';
import { MoreSheet } from './components/hud/MoreSheet';
import { SearchDock } from './components/hud/SearchDock';
import { SidePanel } from './components/hud/SidePanel';
import { DESKTOP_QUERY, useMediaQuery } from './hooks/use-media-query';

// Secondary surfaces load on demand: they were ~30 kB gzip of the startup
// chunk despite rendering only behind explicit navigation.
const AboutPage = lazy(() =>
  import('./components/AboutPage').then((module) => ({ default: module.AboutPage })),
);
const ContactPage = lazy(() =>
  import('./components/ContactPage').then((module) => ({ default: module.ContactPage })),
);
const StatsPage = lazy(() =>
  import('./components/StatsPage').then((module) => ({ default: module.StatsPage })),
);
const AdminPage = lazy(() =>
  import('./components/AdminPage').then((module) => ({ default: module.AdminPage })),
);
const NewsletterPage = lazy(() =>
  import('./components/NewsletterPage').then((module) => ({ default: module.NewsletterPage })),
);
const MethodologyPage = lazy(() =>
  import('./components/MethodologyPage').then((module) => ({ default: module.MethodologyPage })),
);
const RegisterWizard = lazy(() =>
  import('./components/RegisterWizard').then((module) => ({ default: module.RegisterWizard })),
);

function PageLoading() {
  return (
    <div className="map-loading" role="status">
      <span />
      Cargando…
    </div>
  );
}
import { useAggregate } from './hooks/use-aggregate';
import { useListingsInBounds } from './hooks/use-listings-in-bounds';
import { useVisibleScope } from './hooks/use-visible-scope';
import { appConfig, capabilityNotice } from './lib/config';
import {
  approximateBounds,
  distanceMeters,
  listingIsInBounds,
  loadCityManifest,
  loadNeighborhoods,
  neighborhoodCenter,
} from './lib/geo';
import { cityDisplayName, coveredCityForPosition } from './lib/communities';
import { getDeviceFingerprintHash } from './lib/device';
import { summarizeCityImpact, type CityImpactSummary } from './lib/city-impact';
import { calculateImpact } from './lib/impact';
import { municipalityFromGeocoderResult } from './lib/google-geocode';
import {
  enumeratePinCellIds,
  OFFICIAL_PIN_MIN_ZOOM,
  officialPrecisionForZoom,
  roomsInhabitantsForPlaces,
  sumCellsInBounds,
} from './lib/official-cells';
import { SPAIN_CENTER, SPAIN_ZOOM } from './lib/constants';
import { getListingsService } from './services';

type Toast = { kind: 'success' | 'error'; message: string };
/** Secciones a pantalla completa que sustituyen al mapa. */
type Page = 'about' | 'methodology' | 'stats' | 'newsletter' | 'contact' | null;

// Stable empty arrays: fresh `[]` per render would re-run the map layer
// effects (and tear down markers) even when there is nothing to draw.
const NO_LISTINGS: Listing[] = [];
const NO_OFFICIAL_CELLS: OfficialCell[] = [];
const NO_OFFICIAL_PINS: OfficialPin[] = [];
type PendingImpact = {
  scopeId: string;
  dwellings: number;
  expectedMinimum: number;
  createdAt: number;
};

function currentPathIsAbout() {
  return window.location.pathname.replace(/\/$/, '') === '/acerca';
}

function currentPathIsAdmin() {
  return window.location.pathname.replace(/\/$/, '') === '/admin';
}

function currentPathIsMethodology() {
  return window.location.pathname.replace(/\/$/, '') === '/metodologia';
}

function currentPathIsStats() {
  return window.location.pathname.replace(/\/$/, '') === '/estadisticas';
}

function currentPathIsNewsletter() {
  return window.location.pathname.replace(/\/$/, '') === '/boletin';
}

/** The magic link and the sign-in redirect land back on /boletin?ciudad=… */
function newsletterCityFromUrl(): string | null {
  const ciudad = new URLSearchParams(window.location.search).get('ciudad');
  return ciudad && /^[a-z0-9-]+$/u.test(ciudad) ? ciudad : null;
}

function sharedScopeFromUrl(): string | null {
  const scopeId = new URLSearchParams(window.location.search).get('scope');
  return scopeId && /^[a-z0-9-]+(?:__[a-z0-9-]+)?$/u.test(scopeId) ? scopeId : null;
}

/** Shared links restore the data source the sender was looking at. */
function sharedSourceFromUrl(): SourceMode | null {
  const fuente = new URLSearchParams(window.location.search).get('fuente');
  if (fuente === 'oficial') return 'official';
  if (fuente === 'ambas') return 'both';
  if (fuente === 'vecinal') return 'citizens';
  return null;
}

function sharedLocationFromUrl(): { center: LatLng; zoom: number } | null {
  const params = new URLSearchParams(window.location.search);
  const lat = Number(params.get('lat'));
  const lng = Number(params.get('lng'));
  const sharedZoom = Number(params.get('zoom'));
  if (
    !Number.isFinite(lat) ||
    !Number.isFinite(lng) ||
    !Number.isFinite(sharedZoom) ||
    lat < 27.4 ||
    lat > 44.2 ||
    lng < -18.5 ||
    lng > 4.5
  ) {
    return null;
  }
  return { center: { lat, lng }, zoom: Math.max(5, Math.min(19, Math.round(sharedZoom))) };
}

function updateMeta(name: string, property: 'name' | 'property', content: string) {
  let element = document.head.querySelector<HTMLMetaElement>(`meta[${property}="${name}"]`);
  if (!element) {
    element = document.createElement('meta');
    element.setAttribute(property, name);
    document.head.appendChild(element);
  }
  element.content = content;
}

function syntheticCityDefinition(
  id: string,
  name: string,
  center: LatLng,
  knownBounds?: MapBounds,
): CityDefinition {
  return {
    id,
    name,
    center,
    bounds: knownBounds ?? {
      north: center.lat + 0.16,
      south: center.lat - 0.16,
      east: center.lng + 0.2,
      west: center.lng - 0.2,
    },
    geoJsonUrl: `/geo/${id}/neighborhoods.geojson`,
  };
}

function listingFromDuplicate(duplicate: DuplicateSummary, fallbackLocation: LatLng): Listing {
  const now = new Date().toISOString();
  return {
    id: duplicate.id,
    type: duplicate.type,
    dwellingsCount: duplicate.dwellingsCount,
    address: duplicate.address ?? {
      formatted: 'Dirección del registro existente',
      street: '',
      number: '',
      postalCode: '',
      locality: '',
      province: '',
    },
    location: duplicate.location ?? fallbackLocation,
    neighborhoodId: duplicate.neighborhoodId ?? null,
    cityId: duplicate.cityId ?? '',
    streetView: duplicate.streetView ?? { available: false, panoId: null, heading: null },
    evidence: duplicate.evidence ?? { licenseNumber: null, platform: null, note: null },
    status: duplicate.status === 'flagged' ? 'flagged' : 'active',
    confirmations: duplicate.confirmations ?? 0,
    reports: duplicate.reports ?? 0,
    createdAt: duplicate.createdAt ?? now,
    updatedAt: duplicate.updatedAt ?? now,
  };
}

export default function App() {
  const service = useMemo(() => getListingsService(), []);
  const sharedScopeId = useMemo(sharedScopeFromUrl, []);
  const sharedLocation = useMemo(sharedLocationFromUrl, []);
  const [center, setCenter] = useState<LatLng>(SPAIN_CENTER);
  const [zoom, setZoom] = useState(SPAIN_ZOOM);
  const [bounds, setBounds] = useState<MapBounds>(() =>
    approximateBounds(SPAIN_CENTER, SPAIN_ZOOM),
  );
  const [cityHint, setCityHint] = useState<CityDefinition | null>(null);
  const municipalityCache = useMemo(() => new Map<string, CityDefinition>(), []);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedFallback, setSelectedFallback] = useState<Listing | null>(null);
  const [registrationOpen, setRegistrationOpen] = useState(false);
  const [placementMode, setPlacementMode] = useState(false);
  const [pickedPosition, setPickedPosition] = useState<LatLng | null>(null);
  const [selectedStack, setSelectedStack] = useState<OfficialPin[] | null>(null);
  const [aboutOpen, setAboutOpen] = useState(currentPathIsAbout);
  const [adminOpen, setAdminOpen] = useState(currentPathIsAdmin);
  const [methodologyOpen, setMethodologyOpen] = useState(currentPathIsMethodology);
  const [statsOpen, setStatsOpen] = useState(currentPathIsStats);
  const [newsletterOpen, setNewsletterOpen] = useState(currentPathIsNewsletter);
  const [newsletterCityHint, setNewsletterCityHint] = useState<string | null>(() =>
    currentPathIsNewsletter() ? newsletterCityFromUrl() : null,
  );
  // Sin ruta propia a propósito: la página de contacto no debe ser rastreable.
  const [contactOpen, setContactOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [impactOpen, setImpactOpen] = useState(false);
  const desktop = useMediaQuery(DESKTOP_QUERY);
  // Una sola sección abierta a la vez; cambiar de sección cierra el resto.
  const showPage = useCallback((page: Page, path?: string) => {
    if (path !== undefined) window.history.pushState({}, '', path);
    setAdminOpen(false);
    setAboutOpen(page === 'about');
    setMethodologyOpen(page === 'methodology');
    setStatsOpen(page === 'stats');
    setNewsletterOpen(page === 'newsletter');
    setContactOpen(page === 'contact');
    if (page !== 'newsletter') setNewsletterCityHint(null);
    setMoreOpen(false);
    setImpactOpen(false);
  }, []);
  const openNewsletter = useCallback(
    (cityId?: string) => {
      // The city rides in the URL so it survives a sign-in redirect round trip.
      window.history.pushState({}, '', cityId ? `/boletin?ciudad=${cityId}` : '/boletin');
      setNewsletterCityHint(cityId ?? null);
      showPage('newsletter');
    },
    [showPage],
  );
  const [donateOpen, setDonateOpen] = useState(false);
  const [toast, setToast] = useState<Toast | null>(null);
  const [pendingImpact, setPendingImpact] = useState<PendingImpact | null>(null);
  const [sourceMode, setSourceMode] = useState<SourceMode>(() => sharedSourceFromUrl() ?? 'both');
  const [officialData, setOfficialData] = useState<
    { kind: 'cells'; cells: OfficialCell[] } | { kind: 'pins'; pins: OfficialPin[] } | null
  >(null);
  const [officialError, setOfficialError] = useState(false);
  // Content signature of the published official layer: identical fetch
  // results (common while panning inside cached cells) must not re-publish
  // a fresh array and ripple a no-op update through the map layers.
  const officialSignatureRef = useRef('');
  // Street cells already downloaded this session (id → pins, [] when empty),
  // so panning at street zoom only fetches the cells that enter the view.
  const pinCellCache = useRef(new Map<string, OfficialPin[]>());
  const userNavigatedRef = useRef(false);
  const [selectedOfficial, setSelectedOfficial] = useState<OfficialPin | null>(null);
  // Programmatic camera moves (search, GPS, shared links, previews). The
  // real map is uncontrolled, so these travel as explicit commands; the
  // state mirror keeps data effects and the demo map in sync.
  const cameraCommandId = useRef(0);
  const [cameraCommand, setCameraCommand] = useState<CameraCommand | null>(null);
  const flyTo = useCallback((nextCenter: LatLng, nextZoom: number, nextBounds?: MapBounds) => {
    setCenter(nextCenter);
    setZoom(nextZoom);
    setBounds(nextBounds ?? approximateBounds(nextCenter, nextZoom));
    cameraCommandId.current += 1;
    setCameraCommand({ center: nextCenter, zoom: nextZoom, id: cameraCommandId.current });
  }, []);
  // City impact report: powers the ephemeral banner and the header link.
  const [cityReport, setCityReport] = useState<{
    id: string;
    name: string;
    summary: CityImpactSummary;
  } | null>(null);
  const [bannerVisible, setBannerVisible] = useState(false);
  const cityImpactCache = useRef(new Map<string, CityImpactSummary | null>());
  const resolvedScope = useVisibleScope(center, zoom, cityHint);
  const {
    aggregate,
    loading: aggregateLoading,
    error: aggregateError,
  } = useAggregate(service, resolvedScope.scope);
  const listingState = useListingsInBounds(service, bounds, service.mode === 'demo' || zoom >= 8);

  // Official registry layer (OpenRTA mirror): aggregated bubbles per zoom
  // band, or the exact pins at street zoom. Refetched on every pan/zoom so
  // the layer always covers the visible area.
  useEffect(() => {
    if (sourceMode === 'citizens' || service.mode !== 'firebase') {
      setOfficialData(null);
      setOfficialError(false);
      officialSignatureRef.current = '';
      return;
    }
    let active = true;
    const timeout = window.setTimeout(() => {
      const load = async () => {
        if (zoom >= OFFICIAL_PIN_MIN_ZOOM) {
          const ids = enumeratePinCellIds(bounds);
          const cache = pinCellCache.current;
          // Prune BEFORE computing what's missing, and only the oldest half
          // (Map preserves insertion order): a full clear would also evict
          // the cells around the current view and force refetching them.
          if (cache.size > 1500) {
            let toDrop = Math.floor(cache.size / 2);
            for (const key of cache.keys()) {
              if (toDrop <= 0) break;
              cache.delete(key);
              toDrop -= 1;
            }
          }
          const missing = ids.filter((id) => !cache.has(id));
          if (missing.length > 0) {
            const fetched = await service.listOfficialPinCells(missing);
            for (const id of missing) cache.set(id, []);
            for (const cell of fetched) cache.set(cell.id, cell.pins);
          }
          if (!active) return;
          const pins = ids.flatMap((id) => cache.get(id) ?? []);
          const signature = `pins:${pins.map((pin) => pin.id).join('|')}`;
          if (signature !== officialSignatureRef.current) {
            officialSignatureRef.current = signature;
            setOfficialData({ kind: 'pins', pins });
          }
          setOfficialError(false);
          return;
        }
        const cells = await service.listOfficialCells(bounds, officialPrecisionForZoom(zoom));
        if (active) {
          const signature = `cells:${cells.map((cell) => cell.id).join('|')}`;
          if (signature !== officialSignatureRef.current) {
            officialSignatureRef.current = signature;
            setOfficialData({ kind: 'cells', cells });
          }
          setOfficialError(false);
        }
      };
      load().catch(() => {
        // A network hiccup must read as an error, never as "no official
        // dwellings here": the header switches to an explicit failure state.
        if (active) setOfficialError(true);
      });
    }, 300);
    return () => {
      active = false;
      window.clearTimeout(timeout);
    };
  }, [bounds, service, sourceMode, zoom]);
  // When the map settles on a city with data, load its report figures once
  // (cached per session) and show the ephemeral banner the first time.
  // The geo manifest only knows the cities with neighbourhood polygons, so
  // manual panning over e.g. Sevilla resolves no scope. The covered-city
  // fallback (center + municipal radius, zero API calls) keeps the report
  // button visible over every mirrored city.
  const nearbyCityId = useMemo(
    () => coveredCityForPosition(center, zoom, distanceMeters),
    [center, zoom],
  );
  const resolvedCityId = resolvedScope.scope.cityId ?? nearbyCityId;
  // cityDisplayName capitaliza y castellaniza; el scope crudo puede llegar
  // en minúsculas ('arona') desde una URL compartida.
  const resolvedCityName = resolvedCityId ? cityDisplayName(resolvedCityId) : '';
  useEffect(() => {
    // Reset first: the previous city's report (and its floating button)
    // must never linger over a different city while the new one resolves.
    setCityReport(null);
    setBannerVisible(false);
    if (!resolvedCityId) return;
    let active = true;
    const apply = (summary: CityImpactSummary | null) => {
      if (!active) return;
      if (summary === null) return;
      setCityReport({ id: resolvedCityId, name: resolvedCityName, summary });
      const seenKey = `vp-impact-banner-${resolvedCityId}`;
      let alreadySeen = false;
      try {
        alreadySeen = window.sessionStorage.getItem(seenKey) === '1';
        if (!alreadySeen) window.sessionStorage.setItem(seenKey, '1');
      } catch {
        // Storage unavailable (private mode): the banner just shows again.
      }
      if (!alreadySeen) setBannerVisible(true);
    };
    const cached = cityImpactCache.current.get(resolvedCityId);
    if (cached !== undefined) {
      apply(cached);
      return;
    }
    service
      .getCityImpactSources(resolvedCityId)
      .then((sources) => {
        const summary = summarizeCityImpact(resolvedCityId, sources);
        cityImpactCache.current.set(resolvedCityId, summary);
        apply(summary);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [resolvedCityId, resolvedCityName, service]);
  const closeBanner = useCallback(() => setBannerVisible(false), []);

  const selectedListing =
    listingState.listings.find((listing) => listing.id === selectedId) ??
    (selectedFallback?.id === selectedId ? selectedFallback : null);
  // Con los registros del viewport cargados, los contadores reflejan lo que se
  // ve en el mapa; el agregado de Firestore queda para vistas alejadas.
  const viewportMode = service.mode === 'demo' || zoom >= 8;
  const viewportAggregate = useMemo<Aggregate | null>(() => {
    if (!viewportMode || listingState.error) return null;
    let listingsCount = 0;
    let lostDwellings = 0;
    let lostInhabitants = 0;
    let lostCommercial = 0;
    for (const listing of listingState.listings) {
      if (listing.status === 'removed' || !listingIsInBounds(listing.location, bounds)) continue;
      listingsCount += 1;
      if (listing.type === 'commercial') {
        // Legacy commercial listings stored 0 locales but always counted as 1.
        lostCommercial += Math.max(1, listing.commercialUnitsCount ?? 1);
        continue;
      }
      if (listing.type === 'building') lostCommercial += listing.commercialUnitsCount ?? 0;
      lostDwellings += listing.dwellingsCount;
      lostInhabitants += calculateImpact(listing.dwellingsCount).lostInhabitants;
    }
    const scope = resolvedScope.scope;
    return {
      ...scope,
      name: scope.scope === 'country' ? 'Zona visible' : scope.name,
      listingsCount,
      lostDwellings,
      lostFamilies: lostDwellings,
      lostInhabitants,
      lostCommercial,
      updatedAt: null,
    };
  }, [bounds, listingState.error, listingState.listings, resolvedScope.scope, viewportMode]);
  // Official registry figures for exactly what the map shows: cell sums at
  // bubble zooms, per-pin counts at street zoom. Searching a city, a
  // neighbourhood or a postal code fits the viewport to that area, so these
  // figures follow the search too.
  const officialViewport = useMemo<OfficialViewportStats | null>(() => {
    if (sourceMode === 'citizens' || !officialData) return null;
    if (officialData.kind === 'pins') {
      let total = 0;
      let entireHomes = 0;
      let roomsInhabitants = 0;
      for (const pin of officialData.pins) {
        if (!listingIsInBounds(pin.location, bounds)) continue;
        total += 1;
        if (pin.entire) entireHomes += 1;
        else roomsInhabitants += roomsInhabitantsForPlaces(pin.places);
      }
      return { total, entireHomes, roomsOnly: total - entireHomes, roomsInhabitants };
    }
    return sumCellsInBounds(officialData.cells, bounds);
  }, [bounds, officialData, sourceMode]);

  const displayedAggregate = useMemo(() => {
    if (viewportAggregate) return viewportAggregate;
    if (
      !pendingImpact ||
      aggregate.scopeId !== pendingImpact.scopeId ||
      aggregate.lostDwellings >= pendingImpact.expectedMinimum
    )
      return aggregate;
    const impact = calculateImpact(pendingImpact.dwellings);
    return {
      ...aggregate,
      listingsCount: aggregate.listingsCount + 1,
      lostDwellings: aggregate.lostDwellings + impact.lostDwellings,
      lostFamilies: aggregate.lostFamilies + impact.lostFamilies,
      lostInhabitants: aggregate.lostInhabitants + impact.lostInhabitants,
    };
  }, [aggregate, pendingImpact, viewportAggregate]);

  // 'ready' when data (or the citizens mode) is in place; TopBar shows the
  // loading/error states instead of a misleading "no official homes here".
  const officialStatus: 'ready' | 'loading' | 'error' =
    sourceMode === 'citizens' || officialViewport !== null
      ? 'ready'
      : officialError
        ? 'error'
        : 'loading';

  // Counters shown in the header. Official whole homes visible on the map
  // replace the community figures in 'official' mode and add to them in
  // 'both'; inhabitants use the same INE household-size formula so both
  // sources stay comparable. Rooms-only rentals never count as a lost home.
  const metricsAggregate = useMemo<Aggregate>(() => {
    if (sourceMode === 'citizens') return displayedAggregate;
    if (!officialViewport) {
      // Official figures still loading (or failed). In pure official mode a
      // zeroed board beats presenting community numbers as official ones;
      // in 'both' the community subset alone is an honest partial value.
      if (sourceMode === 'official') {
        return {
          ...displayedAggregate,
          listingsCount: 0,
          lostDwellings: 0,
          lostFamilies: 0,
          lostInhabitants: 0,
          lostCommercial: 0,
        };
      }
      return displayedAggregate;
    }
    const officialImpact = calculateImpact(officialViewport.entireHomes);
    // Rooms-only rentals don't displace a household, but each rented room
    // is one long-term room tenant fewer: they add inhabitants only.
    const officialInhabitants = officialImpact.lostInhabitants + officialViewport.roomsInhabitants;
    if (sourceMode === 'official') {
      return {
        ...displayedAggregate,
        listingsCount: officialViewport.total,
        lostDwellings: officialImpact.lostDwellings,
        lostFamilies: officialImpact.lostFamilies,
        lostInhabitants: officialInhabitants,
        lostCommercial: 0,
      };
    }
    return {
      ...displayedAggregate,
      lostDwellings: displayedAggregate.lostDwellings + officialImpact.lostDwellings,
      lostFamilies: displayedAggregate.lostFamilies + officialImpact.lostFamilies,
      lostInhabitants: displayedAggregate.lostInhabitants + officialInhabitants,
    };
  }, [displayedAggregate, officialViewport, sourceMode]);

  useEffect(() => {
    const popState = () => {
      setAboutOpen(currentPathIsAbout());
      setAdminOpen(currentPathIsAdmin());
      setMethodologyOpen(currentPathIsMethodology());
      setStatsOpen(currentPathIsStats());
      setNewsletterOpen(currentPathIsNewsletter());
    };
    window.addEventListener('popstate', popState);
    return () => window.removeEventListener('popstate', popState);
  }, []);

  useEffect(() => {
    // Links that only carry the data source (no scope) keep a clean URL.
    if (!sharedScopeId && sharedSourceFromUrl() !== null) {
      window.history.replaceState({}, '', '/');
    }
  }, [sharedScopeId]);

  useEffect(() => {
    if (sharedScopeId || !navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        // A late GPS fix must not hijack the map from a user who already
        // searched or navigated somewhere meanwhile.
        if (userNavigatedRef.current) return;
        flyTo({ lat: coords.latitude, lng: coords.longitude }, 14);
      },
      () => undefined,
      { enableHighAccuracy: false, timeout: 5_000, maximumAge: 300_000 },
    );
  }, [flyTo, sharedScopeId]);

  useEffect(() => {
    if (!sharedScopeId) return;
    let active = true;
    void loadCityManifest().then(async (cities) => {
      const [cityId, neighborhoodId] = sharedScopeId.split('__');
      const knownCity = cities.find((candidate) => candidate.id === cityId);
      const city =
        knownCity ??
        (sharedLocation
          ? syntheticCityDefinition(
              cityId ?? '',
              (cityId ?? '').replace(/-/gu, ' '),
              sharedLocation.center,
            )
          : null);
      if (!city || !active) return;
      let nextCenter = city.center;
      let nextZoom = sharedLocation?.zoom ?? 12;
      if (neighborhoodId && knownCity) {
        const neighborhoods = await loadNeighborhoods(city);
        const feature = neighborhoods?.features.find(
          (candidate) => candidate.properties.id === neighborhoodId,
        );
        if (feature) {
          nextCenter = neighborhoodCenter(feature);
          nextZoom = 15;
        }
      }
      if (!active) return;
      flyTo(nextCenter, nextZoom);
      setCityHint(city);
      window.history.replaceState({}, '', '/');
    });
    return () => {
      active = false;
    };
  }, [flyTo, sharedLocation, sharedScopeId]);

  useEffect(() => {
    if (!toast) return;
    const timeout = window.setTimeout(() => setToast(null), 5_000);
    return () => window.clearTimeout(timeout);
  }, [toast]);

  useEffect(() => {
    if (!pendingImpact) return;
    if (
      aggregate.scopeId === pendingImpact.scopeId &&
      aggregate.lostDwellings >= pendingImpact.expectedMinimum
    ) {
      setPendingImpact(null);
      return;
    }
    const remaining = Math.max(0, 12_000 - (Date.now() - pendingImpact.createdAt));
    const timeout = window.setTimeout(() => setPendingImpact(null), remaining);
    return () => window.clearTimeout(timeout);
  }, [aggregate.lostDwellings, aggregate.scopeId, pendingImpact]);

  useEffect(() => {
    const scoped = metricsAggregate.scope !== 'country';
    const sourceNote =
      sourceMode === 'official'
        ? 'Registro oficial de turismo.'
        : sourceMode === 'both'
          ? 'Datos colaborativos + registro oficial.'
          : 'Datos colaborativos.';
    const title = scoped
      ? `${metricsAggregate.name} ha perdido ${metricsAggregate.lostFamilies.toLocaleString('es-ES')} familias | Viviendas Perdidas`
      : 'Viviendas Perdidas — mapa colaborativo';
    const description = scoped
      ? `${metricsAggregate.lostDwellings.toLocaleString('es-ES')} viviendas y unos ${metricsAggregate.lostInhabitants.toLocaleString('es-ES')} habitantes desplazados en ${metricsAggregate.name}. ${sourceNote}`
      : 'Descubre cuántas viviendas, familias y habitantes ha perdido cada barrio por los apartamentos turísticos.';
    document.title = title;
    updateMeta('description', 'name', description);
    updateMeta('og:title', 'property', title);
    updateMeta('og:description', 'property', description);
  }, [metricsAggregate, sourceMode]);

  useEffect(() => {
    if (
      !appConfig.googleMapsApiKey ||
      zoom < 10 ||
      resolvedScope.scope.scope !== 'country' ||
      !window.google?.maps
    ) {
      return;
    }
    const cacheKey = `${center.lat.toFixed(2)}:${center.lng.toFixed(2)}`;
    const cached = municipalityCache.get(cacheKey);
    if (cached) {
      setCityHint(cached);
      return;
    }
    let active = true;
    const timeout = window.setTimeout(() => {
      void new google.maps.Geocoder()
        .geocode({ location: center })
        .then(({ results }) => {
          const municipality = results[0] ? municipalityFromGeocoderResult(results[0]) : null;
          if (!active || !municipality) return;
          const hint = syntheticCityDefinition(municipality.id, municipality.name, center);
          municipalityCache.set(cacheKey, hint);
          setCityHint(hint);
        })
        .catch(() => undefined);
    }, 650);
    return () => {
      active = false;
      window.clearTimeout(timeout);
    };
  }, [center, municipalityCache, resolvedScope.scope.scope, zoom]);

  const updateViewport = useCallback(
    (nextCenter: LatLng, nextZoom: number, nextBounds: MapBounds) => {
      setCenter(nextCenter);
      setZoom(nextZoom);
      setBounds(nextBounds);
    },
    [],
  );

  const closeListing = useCallback(() => {
    setSelectedId(null);
    setSelectedFallback(null);
  }, []);
  // Stable identities: inline handlers would tear down and rebuild every
  // map marker layer on each render (60×/s during a drag gesture).
  const selectListing = useCallback((listing: Listing) => {
    setSelectedFallback(null);
    setSelectedOfficial(null);
    setSelectedId(listing.id);
  }, []);
  const selectOfficialPin = useCallback((pin: OfficialPin) => {
    setSelectedId(null);
    setSelectedFallback(null);
    setSelectedStack(null);
    setSelectedOfficial(pin);
  }, []);
  const selectOfficialStack = useCallback((pins: OfficialPin[]) => {
    setSelectedId(null);
    setSelectedFallback(null);
    setSelectedOfficial(null);
    setSelectedStack(pins);
  }, []);
  const pickLocation = useCallback((position: LatLng) => {
    setPickedPosition(position);
    setPlacementMode(false);
  }, []);
  const closeRegistration = useCallback(() => {
    setRegistrationOpen(false);
    setPlacementMode(false);
    setPickedPosition(null);
  }, []);

  const selectPlace = (place: SearchPlace) => {
    userNavigatedRef.current = true;
    flyTo(place.position, place.zoom, place.bounds);
    setCityHint(
      place.cityId
        ? syntheticCityDefinition(
            place.cityId,
            place.cityName ?? place.cityId,
            place.position,
            place.zoom <= 12 ? place.bounds : undefined,
          )
        : null,
    );
    setSelectedId(null);
    setSelectedFallback(null);
  };

  const createListing = async (input: CreateListingInput, photoBase64: string | null = null) => {
    const baselineDwellings = aggregate.lostDwellings;
    const result = await service.createListing(input);
    if (result.created) {
      let photoNote = '';
      if (photoBase64) {
        try {
          const deviceHash = await getDeviceFingerprintHash();
          await service.submitListingPhoto(result.listing.id, photoBase64, deviceHash);
          photoNote = ' Tu foto se publicará tras la revisión.';
        } catch {
          photoNote = ' La foto no se pudo enviar; puedes reintentarlo más tarde.';
        }
      }
      const contributesToVisibleScope =
        resolvedScope.scope.scope === 'country' ||
        (result.listing.cityId === resolvedScope.scope.cityId &&
          (resolvedScope.scope.scope === 'city' ||
            result.listing.neighborhoodId === resolvedScope.scope.neighborhoodId));
      if (
        service.mode === 'firebase' &&
        contributesToVisibleScope &&
        result.listing.type !== 'commercial'
      ) {
        setPendingImpact({
          scopeId: resolvedScope.scope.scopeId,
          dwellings: result.listing.dwellingsCount,
          expectedMinimum: baselineDwellings + result.listing.dwellingsCount,
          createdAt: Date.now(),
        });
      }
      listingState.insertOptimistic(result.listing);
      setSelectedFallback(result.listing);
      setSelectedId(result.listing.id);
      setRegistrationOpen(false);
      setPlacementMode(false);
      setPickedPosition(null);
      setToast({
        kind: 'success',
        message:
          (result.warnings && result.warnings.length > 0
            ? 'Registro añadido. Ya había otras viviendas señaladas en este portal.'
            : result.listing.type === 'commercial'
              ? 'Registro añadido: +1 local comercial convertido en alojamiento turístico.'
              : `Registro añadido: +${result.listing.dwellingsCount} ${result.listing.dwellingsCount === 1 ? 'vivienda' : 'viviendas'} al barrio.`) +
          photoNote,
      });
      window.setTimeout(listingState.reload, 700);
    }
    return result;
  };

  const selectDuplicate = (duplicate: DuplicateSummary) => {
    userNavigatedRef.current = true;
    const fullListing = listingState.listings.find((listing) => listing.id === duplicate.id);
    const listing = fullListing ?? listingFromDuplicate(duplicate, center);
    setRegistrationOpen(false);
    setPlacementMode(false);
    setPickedPosition(null);
    setSelectedFallback(listing);
    listingState.insertOptimistic(listing);
    setSelectedId(listing.id);
    flyTo(listing.location, 17);
    if (listing.cityId) {
      setCityHint(
        syntheticCityDefinition(
          listing.cityId,
          listing.address.locality || listing.cityId,
          listing.location,
        ),
      );
    }
  };

  const vote = async (listing: Listing, kind: VoteKind) => {
    const deviceHash = await getDeviceFingerprintHash();
    const result = await service.voteListing(listing.id, kind, deviceHash);
    listingState.updateListing(listing.id, {
      confirmations: result.confirmations,
      reports: result.reports,
      status: result.status,
    });
    setSelectedFallback((current) =>
      current?.id === listing.id
        ? {
            ...current,
            confirmations: result.confirmations,
            reports: result.reports,
            status: result.status,
          }
        : current,
    );
    if (result.status === 'removed') setSelectedId(null);
  };

  const exportData = async () => {
    try {
      const blob = await service.exportPublicData();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `viviendas-perdidas-${new Date().toISOString().slice(0, 10)}.json`;
      anchor.click();
      URL.revokeObjectURL(url);
      setToast({ kind: 'success', message: 'Exportación preparada.' });
    } catch (error) {
      setToast({
        kind: 'error',
        message: error instanceof Error ? error.message : 'No se pudo exportar.',
      });
    }
  };

  const shareVisibleScope = async () => {
    // The link carries the active data source so the recipient (and the
    // social card) sees the same figures, official registry included.
    const fuenteParam =
      sourceMode === 'official' ? 'oficial' : sourceMode === 'both' ? 'ambas' : 'vecinal';
    const url =
      metricsAggregate.scope === 'country'
        ? `${window.location.origin}${fuenteParam ? `/?fuente=${fuenteParam}` : ''}`
        : `${window.location.origin}/compartir/${encodeURIComponent(metricsAggregate.scopeId)}?lat=${center.lat.toFixed(6)}&lng=${center.lng.toFixed(6)}&zoom=${zoom}${fuenteParam ? `&fuente=${fuenteParam}` : ''}`;
    const shareData = {
      title: document.title,
      text: `${metricsAggregate.name}: ${metricsAggregate.lostFamilies.toLocaleString('es-ES')} familias y ${metricsAggregate.lostInhabitants.toLocaleString('es-ES')} habitantes estimados.`,
      url,
    };
    try {
      if (navigator.share) {
        await navigator.share(shareData);
        return;
      }
      await navigator.clipboard.writeText(url);
      setToast({ kind: 'success', message: 'Enlace copiado.' });
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return;
      setToast({ kind: 'error', message: 'No se ha podido compartir el enlace.' });
    }
  };

  const section: Section = aboutOpen
    ? 'about'
    : methodologyOpen
      ? 'methodology'
      : statsOpen
        ? 'stats'
        : newsletterOpen
          ? 'newsletter'
          : contactOpen
            ? 'contact'
            : 'map';
  const cityReportLink = cityReport ? { id: cityReport.id, name: cityReport.name } : null;
  const goMap = () => showPage(null, '/');
  const openAbout = () => showPage('about', '/acerca');
  const openMethodology = () => showPage('methodology', '/metodologia');
  const openStats = () => showPage('stats', '/estadisticas');
  const openContact = () => showPage('contact');
  const openRegistration = () => {
    if (section !== 'map') goMap();
    setSelectedId(null);
    setSelectedFallback(null);
    setSelectedOfficial(null);
    setSelectedStack(null);
    setPickedPosition(null);
    setRegistrationOpen(true);
  };
  const share = () => void shareVisibleScope();
  // Con una ficha abierta, el banner de la ciudad quedaría medio tapado.
  const detailOpen = Boolean(selectedListing || selectedOfficial || selectedStack);

  const impactProps: ImpactDetailsProps = {
    aggregate: metricsAggregate,
    viewportMode: Boolean(viewportAggregate),
    loading: viewportAggregate
      ? listingState.loading || resolvedScope.loading
      : aggregateLoading || resolvedScope.loading,
    sourceMode,
    onSourceModeChange: setSourceMode,
    official: officialViewport,
    officialStatus,
    sourceToggleAvailable: service.mode === 'firebase',
    cityReport: cityReportLink,
    onOpenNewsletter: openNewsletter,
    onShare: share,
    onOpenMethodology: openMethodology,
  };

  const dock = (
    <BottomNav
      section={section}
      moreOpen={moreOpen}
      onMap={goMap}
      onStats={openStats}
      onRegister={openRegistration}
      onNewsletter={() => openNewsletter(cityReport?.id)}
      onMore={() => setMoreOpen((open) => !open)}
    />
  );
  const overlays = (
    <>
      {moreOpen && (
        <MoreSheet
          cityReport={cityReportLink}
          onOpenAbout={openAbout}
          onOpenMethodology={openMethodology}
          onOpenContact={openContact}
          onOpenDonate={() => setDonateOpen(true)}
          onOpenNewsletter={openNewsletter}
          onShare={share}
          onClose={() => setMoreOpen(false)}
        />
      )}
      {donateOpen && <DonateSheet onClose={() => setDonateOpen(false)} />}
      {toast && <ToastMessage toast={toast} onClose={() => setToast(null)} />}
    </>
  );

  if (adminOpen) {
    return (
      <Suspense fallback={<PageLoading />}>
        <AdminPage service={service} onClose={goMap} />
      </Suspense>
    );
  }

  let page: ReactNode = null;
  if (methodologyOpen) {
    page = <MethodologyPage onClose={goMap} />;
  } else if (statsOpen) {
    page = (
      <StatsPage
        onClose={goMap}
        loadHistory={() => service.listOfficialHistory()}
        onOpenNewsletter={() => openNewsletter()}
      />
    );
  } else if (newsletterOpen) {
    page = (
      <NewsletterPage
        onClose={goMap}
        preselectCityId={newsletterCityHint}
        prepareAuth={() => service.prepareAuth()}
        signIn={() => service.newsletterSignIn()}
        signOut={() => service.signOutUser()}
        sendLoginLink={(email) => service.sendNewsletterLoginLink(email, newsletterCityHint)}
        completeEmailLink={(email) => service.completeNewsletterEmailLink(email)}
        loadPreferences={() => service.getNewsletterPreferences()}
        savePreferences={(preferences) => service.saveNewsletterPreferences(preferences)}
        unsubscribe={() => service.unsubscribeNewsletter()}
      />
    );
  } else if (contactOpen) {
    page = (
      <ContactPage onClose={goMap} onSubmit={(input) => service.submitContactMessage(input)} />
    );
  } else if (aboutOpen) {
    page = <AboutPage onClose={goMap} onExport={exportData} onOpenMethodology={openMethodology} />;
  }

  if (page) {
    return (
      <>
        <Suspense fallback={<PageLoading />}>{page}</Suspense>
        {dock}
        {overlays}
      </>
    );
  }

  return (
    <main className="app-shell">
      <section className="map-region" aria-label="Mapa de viviendas turísticas registradas">
        <MapStage
          center={center}
          zoom={zoom}
          bounds={bounds}
          cameraCommand={cameraCommand}
          listings={sourceMode === 'official' ? NO_LISTINGS : listingState.listings}
          officialCells={officialData?.kind === 'cells' ? officialData.cells : NO_OFFICIAL_CELLS}
          officialPins={officialData?.kind === 'pins' ? officialData.pins : NO_OFFICIAL_PINS}
          selectedId={selectedId}
          activeNeighborhood={resolvedScope.activeNeighborhood}
          placementMode={placementMode}
          placementPosition={pickedPosition}
          onViewportChange={updateViewport}
          onSelectListing={selectListing}
          onSelectOfficial={selectOfficialPin}
          onSelectOfficialStack={selectOfficialStack}
          onPickLocation={pickLocation}
        />
        {!registrationOpen &&
          (desktop ? (
            <SidePanel
              mapsEnabled={Boolean(appConfig.googleMapsApiKey)}
              onSelectPlace={selectPlace}
              onOpenDonate={() => setDonateOpen(true)}
              {...impactProps}
            />
          ) : (
            <SearchDock
              mapsEnabled={Boolean(appConfig.googleMapsApiKey)}
              onSelectPlace={selectPlace}
              onOpenAbout={openAbout}
              onOpenDonate={() => setDonateOpen(true)}
            />
          ))}
        {(capabilityNotice || aggregateError || listingState.error) && (
          <div className="mode-notice" role="status">
            {aggregateError || listingState.error ? (
              <TriangleAlert size={15} aria-hidden="true" />
            ) : (
              <Sparkles size={15} aria-hidden="true" />
            )}
            <span>{aggregateError ?? listingState.error ?? capabilityNotice}</span>
          </div>
        )}
        {listingState.loading && (
          <div className="map-busy" role="status">
            <span /> Actualizando registros…
          </div>
        )}
        {cityReport && bannerVisible && !registrationOpen && !detailOpen && (
          <CityImpactBanner
            key={cityReport.id}
            cityId={cityReport.id}
            cityName={cityReport.name}
            summary={cityReport.summary}
            onClose={closeBanner}
          />
        )}
        {!registrationOpen && !desktop && (
          <ImpactStrip
            aggregate={metricsAggregate}
            viewportMode={impactProps.viewportMode}
            loading={impactProps.loading}
            cityReport={cityReportLink}
            expanded={impactOpen}
            onOpen={() => setImpactOpen(true)}
          />
        )}
      </section>
      {!registrationOpen && dock}
      {impactOpen && !desktop && (
        <ImpactSheet {...impactProps} onClose={() => setImpactOpen(false)} />
      )}
      {selectedListing && (
        <ListingSheet
          listing={selectedListing}
          onClose={closeListing}
          onVote={(kind) => vote(selectedListing, kind)}
        />
      )}
      {selectedOfficial && !selectedListing && (
        <OfficialSheet pin={selectedOfficial} onClose={() => setSelectedOfficial(null)} />
      )}
      {selectedStack && !selectedOfficial && !selectedListing && (
        <OfficialStackSheet
          pins={selectedStack}
          onPick={selectOfficialPin}
          onClose={() => setSelectedStack(null)}
        />
      )}
      {registrationOpen && (
        <Suspense fallback={null}>
          <RegisterWizard
            center={center}
            pickedPosition={pickedPosition}
            mapsEnabled={Boolean(appConfig.googleMapsApiKey)}
            onPlacementModeChange={setPlacementMode}
            onPreviewLocation={(position) => {
              flyTo(position, 17);
              // Drop the draggable pin so the user can fine-tune the exact portal.
              setPickedPosition(position);
            }}
            onClose={closeRegistration}
            onCreate={createListing}
            onSelectDuplicate={selectDuplicate}
          />
        </Suspense>
      )}
      {overlays}
      <CookieNotice />
      <DonateBanner onOpen={() => setDonateOpen(true)} />
      <span className="sr-only" aria-live="polite">
        {displayedAggregate.name}: {displayedAggregate.lostFamilies} familias y{' '}
        {displayedAggregate.lostInhabitants} habitantes estimados.
      </span>
    </main>
  );
}

function ToastMessage({ toast, onClose }: { toast: Toast; onClose: () => void }) {
  return (
    <div
      className={`toast toast--${toast.kind}`}
      role={toast.kind === 'error' ? 'alert' : 'status'}
    >
      {toast.kind === 'success' ? <Sparkles size={19} /> : <TriangleAlert size={19} />}
      <span>{toast.message}</span>
      <button type="button" onClick={onClose} aria-label="Cerrar aviso">
        <X size={17} />
      </button>
    </div>
  );
}
