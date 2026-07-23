import { useCallback, useEffect, useMemo, useState } from 'react';
import { Plus, Sparkles, TriangleAlert, X } from 'lucide-react';
import type {
  Aggregate,
  CityDefinition,
  CreateListingInput,
  DuplicateSummary,
  LatLng,
  Listing,
  MapBounds,
  OfficialPin,
  OfficialStats,
  SearchPlace,
  SourceMode,
  VoteKind,
} from './domain/types';
import { AboutPage } from './components/AboutPage';
import { AdminPage } from './components/AdminPage';
import { MethodologyPage } from './components/MethodologyPage';
import { CookieNotice } from './components/CookieNotice';
import { DonateSheet } from './components/DonateSheet';
import { ListingSheet } from './components/ListingSheet';
import { OfficialSheet } from './components/OfficialSheet';
import { MapStage } from './components/map/MapStage';
import { RegisterWizard } from './components/RegisterWizard';
import { TopBar } from './components/TopBar';
import { useAggregate } from './hooks/use-aggregate';
import { useListingsInBounds } from './hooks/use-listings-in-bounds';
import { useVisibleScope } from './hooks/use-visible-scope';
import { appConfig, capabilityNotice } from './lib/config';
import {
  approximateBounds,
  listingIsInBounds,
  loadCityManifest,
  loadNeighborhoods,
  neighborhoodCenter,
} from './lib/geo';
import { getDeviceFingerprintHash } from './lib/device';
import { calculateImpact } from './lib/impact';
import { municipalityFromGeocoderResult } from './lib/google-geocode';
import { SPAIN_CENTER, SPAIN_ZOOM } from './lib/constants';
import { getListingsService } from './services';

type Toast = { kind: 'success' | 'error'; message: string };
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

function sharedScopeFromUrl(): string | null {
  const scopeId = new URLSearchParams(window.location.search).get('scope');
  return scopeId && /^[a-z0-9-]+(?:__[a-z0-9-]+)?$/u.test(scopeId) ? scopeId : null;
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
  const [aboutOpen, setAboutOpen] = useState(currentPathIsAbout);
  const [adminOpen, setAdminOpen] = useState(currentPathIsAdmin);
  const [methodologyOpen, setMethodologyOpen] = useState(currentPathIsMethodology);
  const [donateOpen, setDonateOpen] = useState(false);
  const [toast, setToast] = useState<Toast | null>(null);
  const [pendingImpact, setPendingImpact] = useState<PendingImpact | null>(null);
  const [sourceMode, setSourceMode] = useState<SourceMode>('citizens');
  const [officialStatsList, setOfficialStatsList] = useState<OfficialStats[] | null>(null);
  const [officialPins, setOfficialPins] = useState<OfficialPin[]>([]);
  const [selectedOfficial, setSelectedOfficial] = useState<OfficialPin | null>(null);
  const resolvedScope = useVisibleScope(center, zoom, cityHint);
  const {
    aggregate,
    loading: aggregateLoading,
    error: aggregateError,
  } = useAggregate(service, resolvedScope.scope);
  const listingState = useListingsInBounds(service, bounds, service.mode === 'demo' || zoom >= 8);

  // Official registry data (OpenRTA mirror) loads lazily, on first opt-in.
  useEffect(() => {
    if (sourceMode === 'citizens' || officialStatsList !== null || service.mode !== 'firebase') {
      return;
    }
    let active = true;
    service
      .listOfficialStats()
      .then((stats) => {
        if (active) setOfficialStatsList(stats);
      })
      .catch(() => {
        if (active) setOfficialStatsList([]);
      });
    return () => {
      active = false;
    };
  }, [officialStatsList, service, sourceMode]);

  useEffect(() => {
    if (sourceMode === 'citizens' || zoom < 14 || service.mode !== 'firebase') {
      setOfficialPins([]);
      return;
    }
    let active = true;
    const timeout = window.setTimeout(() => {
      service
        .listOfficialInBounds(bounds)
        .then((pins) => {
          if (active) setOfficialPins(pins);
        })
        .catch(() => undefined);
    }, 350);
    return () => {
      active = false;
      window.clearTimeout(timeout);
    };
  }, [bounds, service, sourceMode, zoom]);
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
  const officialScopeStats = useMemo<OfficialStats | null>(() => {
    if (!officialStatsList || officialStatsList.length === 0) return null;
    const cityId = resolvedScope.scope.cityId;
    if (cityId) return officialStatsList.find((stats) => stats.cityId === cityId) ?? null;
    // Country view: aggregate every mirrored municipality.
    return officialStatsList.reduce<OfficialStats>(
      (accumulator, stats) => ({
        ...accumulator,
        total: accumulator.total + stats.total,
        entireHomes: accumulator.entireHomes + stats.entireHomes,
        roomsOnly: accumulator.roomsOnly + stats.roomsOnly,
        places: accumulator.places + stats.places,
      }),
      {
        cityId: 'andalucia',
        municipality: 'Andalucía',
        total: 0,
        entireHomes: 0,
        roomsOnly: 0,
        places: 0,
        updatedAt: null,
      },
    );
  }, [officialStatsList, resolvedScope.scope.cityId]);

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

  // Counters shown in the header. Official dwellings (whole homes from the
  // RTA, municipality granularity) replace the community figures in
  // 'official' mode and add to them in 'both'; inhabitants use the same
  // INE household-size formula so both sources stay comparable.
  const metricsAggregate = useMemo<Aggregate>(() => {
    if (sourceMode === 'citizens' || !officialScopeStats) return displayedAggregate;
    const officialImpact = calculateImpact(officialScopeStats.entireHomes);
    if (sourceMode === 'official') {
      return {
        ...displayedAggregate,
        listingsCount: officialScopeStats.total,
        lostDwellings: officialImpact.lostDwellings,
        lostFamilies: officialImpact.lostFamilies,
        lostInhabitants: officialImpact.lostInhabitants,
        lostCommercial: 0,
      };
    }
    return {
      ...displayedAggregate,
      lostDwellings: displayedAggregate.lostDwellings + officialImpact.lostDwellings,
      lostFamilies: displayedAggregate.lostFamilies + officialImpact.lostFamilies,
      lostInhabitants: displayedAggregate.lostInhabitants + officialImpact.lostInhabitants,
    };
  }, [displayedAggregate, officialScopeStats, sourceMode]);

  useEffect(() => {
    const popState = () => {
      setAboutOpen(currentPathIsAbout());
      setAdminOpen(currentPathIsAdmin());
      setMethodologyOpen(currentPathIsMethodology());
    };
    window.addEventListener('popstate', popState);
    return () => window.removeEventListener('popstate', popState);
  }, []);

  useEffect(() => {
    if (sharedScopeId || !navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        const next = { lat: coords.latitude, lng: coords.longitude };
        setCenter(next);
        setZoom(14);
        setBounds(approximateBounds(next, 14));
      },
      () => undefined,
      { enableHighAccuracy: false, timeout: 5_000, maximumAge: 300_000 },
    );
  }, [sharedScopeId]);

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
      setCenter(nextCenter);
      setZoom(nextZoom);
      setBounds(approximateBounds(nextCenter, nextZoom));
      setCityHint(city);
      window.history.replaceState({}, '', '/');
    });
    return () => {
      active = false;
    };
  }, [sharedLocation, sharedScopeId]);

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
    const scoped = displayedAggregate.scope !== 'country';
    const title = scoped
      ? `${displayedAggregate.name} ha perdido ${displayedAggregate.lostFamilies.toLocaleString('es-ES')} familias | Viviendas Perdidas`
      : 'Viviendas Perdidas — mapa colaborativo';
    const description = scoped
      ? `${displayedAggregate.lostDwellings.toLocaleString('es-ES')} viviendas y unos ${displayedAggregate.lostInhabitants.toLocaleString('es-ES')} habitantes desplazados en ${displayedAggregate.name}. Datos colaborativos.`
      : 'Descubre cuántas viviendas, familias y habitantes ha perdido cada barrio por los apartamentos turísticos.';
    document.title = title;
    updateMeta('description', 'name', description);
    updateMeta('og:title', 'property', title);
    updateMeta('og:description', 'property', description);
  }, [displayedAggregate]);

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
  const closeRegistration = useCallback(() => {
    setRegistrationOpen(false);
    setPlacementMode(false);
    setPickedPosition(null);
  }, []);

  const selectPlace = (place: SearchPlace) => {
    setCenter(place.position);
    setZoom(place.zoom);
    setBounds(place.bounds ?? approximateBounds(place.position, place.zoom));
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
    const fullListing = listingState.listings.find((listing) => listing.id === duplicate.id);
    const listing = fullListing ?? listingFromDuplicate(duplicate, center);
    setRegistrationOpen(false);
    setPlacementMode(false);
    setPickedPosition(null);
    setSelectedFallback(listing);
    listingState.insertOptimistic(listing);
    setSelectedId(listing.id);
    setCenter(listing.location);
    setZoom(17);
    setBounds(approximateBounds(listing.location, 17));
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

  const openAbout = () => {
    window.history.pushState({}, '', '/acerca');
    setAboutOpen(true);
  };

  const closeAbout = () => {
    window.history.pushState({}, '', '/');
    setAboutOpen(false);
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
    const url =
      displayedAggregate.scope === 'country'
        ? window.location.origin
        : `${window.location.origin}/compartir/${encodeURIComponent(displayedAggregate.scopeId)}?lat=${center.lat.toFixed(6)}&lng=${center.lng.toFixed(6)}&zoom=${zoom}`;
    const shareData = {
      title: document.title,
      text: `${displayedAggregate.name}: ${displayedAggregate.lostFamilies.toLocaleString('es-ES')} familias y ${displayedAggregate.lostInhabitants.toLocaleString('es-ES')} habitantes estimados.`,
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

  if (adminOpen) {
    return (
      <AdminPage
        service={service}
        onClose={() => {
          window.history.pushState({}, '', '/');
          setAdminOpen(false);
        }}
      />
    );
  }

  if (methodologyOpen) {
    return (
      <MethodologyPage
        onClose={() => {
          window.history.pushState({}, '', '/');
          setMethodologyOpen(false);
        }}
      />
    );
  }

  if (aboutOpen) {
    return (
      <>
        <AboutPage
          onClose={closeAbout}
          onExport={exportData}
          onOpenMethodology={() => {
            window.history.pushState({}, '', '/metodologia');
            setAboutOpen(false);
            setMethodologyOpen(true);
          }}
        />
        {toast && <ToastMessage toast={toast} onClose={() => setToast(null)} />}
      </>
    );
  }

  return (
    <main className="app-shell">
      <TopBar
        aggregate={metricsAggregate}
        viewportMode={Boolean(viewportAggregate)}
        loading={
          viewportAggregate
            ? listingState.loading || resolvedScope.loading
            : aggregateLoading || resolvedScope.loading
        }
        mapsEnabled={Boolean(appConfig.googleMapsApiKey)}
        sourceMode={sourceMode}
        onSourceModeChange={setSourceMode}
        officialStats={officialScopeStats}
        sourceToggleAvailable={service.mode === 'firebase'}
        onSelectPlace={selectPlace}
        onOpenAbout={openAbout}
        onOpenDonate={() => setDonateOpen(true)}
        onShare={() => void shareVisibleScope()}
      />
      <section className="map-region" aria-label="Mapa de viviendas turísticas registradas">
        <MapStage
          center={center}
          zoom={zoom}
          bounds={bounds}
          listings={sourceMode === 'official' ? [] : listingState.listings}
          officialPins={sourceMode === 'citizens' ? [] : officialPins}
          selectedId={selectedId}
          activeNeighborhood={resolvedScope.activeNeighborhood}
          placementMode={placementMode}
          placementPosition={pickedPosition}
          onViewportChange={updateViewport}
          onSelectListing={(listing) => {
            setSelectedFallback(null);
            setSelectedOfficial(null);
            setSelectedId(listing.id);
          }}
          onSelectOfficial={(pin) => {
            setSelectedId(null);
            setSelectedFallback(null);
            setSelectedOfficial(pin);
          }}
          onPickLocation={(position) => {
            setPickedPosition(position);
            setPlacementMode(false);
          }}
        />
        {(capabilityNotice || aggregateError || listingState.error) && (
          <div className="mode-notice" role="status">
            {aggregateError || listingState.error ? (
              <TriangleAlert size={15} />
            ) : (
              <Sparkles size={15} />
            )}
            <span>{aggregateError ?? listingState.error ?? capabilityNotice}</span>
          </div>
        )}
        {listingState.loading && (
          <div className="map-busy" role="status">
            <span /> Actualizando registros…
          </div>
        )}
        {!registrationOpen && !selectedListing && (
          <button
            className="register-fab"
            type="button"
            onClick={() => {
              setPickedPosition(null);
              setRegistrationOpen(true);
            }}
          >
            <Plus size={23} /> <span>Registrar</span>
          </button>
        )}
      </section>

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
      {registrationOpen && (
        <RegisterWizard
          center={center}
          pickedPosition={pickedPosition}
          mapsEnabled={Boolean(appConfig.googleMapsApiKey)}
          onPlacementModeChange={setPlacementMode}
          onPreviewLocation={(position) => {
            setCenter(position);
            setZoom(17);
            setBounds(approximateBounds(position, 17));
            // Drop the draggable pin so the user can fine-tune the exact portal.
            setPickedPosition(position);
          }}
          onClose={closeRegistration}
          onCreate={createListing}
          onSelectDuplicate={selectDuplicate}
        />
      )}
      {donateOpen && <DonateSheet onClose={() => setDonateOpen(false)} />}
      <CookieNotice />
      {toast && <ToastMessage toast={toast} onClose={() => setToast(null)} />}
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
