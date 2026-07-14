import booleanPointInPolygon from '@turf/boolean-point-in-polygon';
import { point } from '@turf/helpers';
import type { FeatureCollection, GeoJsonProperties, Geometry } from 'geojson';
import type {
  CityDefinition,
  LatLng,
  MapBounds,
  NeighborhoodCollection,
  NeighborhoodFeature,
  ResolvedScope,
} from '../domain/types';
import { EMPTY_SCOPE, FALLBACK_CITIES, NEIGHBORHOOD_ZOOM } from './constants';

let citiesPromise: Promise<CityDefinition[]> | null = null;
const neighborhoodPromises = new Map<string, Promise<NeighborhoodCollection | null>>();

function number(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function parseCenter(value: unknown): LatLng | null {
  if (Array.isArray(value) && value.length >= 2) {
    const lng = number(value[0]);
    const lat = number(value[1]);
    return lat === null || lng === null ? null : { lat, lng };
  }
  if (value && typeof value === 'object') {
    const candidate = value as Record<string, unknown>;
    const lat = number(candidate.lat ?? candidate.latitude);
    const lng = number(candidate.lng ?? candidate.lon ?? candidate.longitude);
    return lat === null || lng === null ? null : { lat, lng };
  }
  return null;
}

function parseBounds(value: unknown): MapBounds | null {
  if (Array.isArray(value) && value.length >= 4) {
    const west = number(value[0]);
    const south = number(value[1]);
    const east = number(value[2]);
    const north = number(value[3]);
    return [west, south, east, north].some((entry) => entry === null)
      ? null
      : { west: west!, south: south!, east: east!, north: north! };
  }
  if (value && typeof value === 'object') {
    const candidate = value as Record<string, unknown>;
    const north = number(candidate.north);
    const south = number(candidate.south);
    const east = number(candidate.east);
    const west = number(candidate.west);
    return [north, south, east, west].some((entry) => entry === null)
      ? null
      : { north: north!, south: south!, east: east!, west: west! };
  }
  return null;
}

function normalizeManifest(raw: unknown): CityDefinition[] {
  const rows = Array.isArray(raw)
    ? raw
    : raw && typeof raw === 'object' && Array.isArray((raw as { cities?: unknown }).cities)
      ? ((raw as { cities: unknown[] }).cities ?? [])
      : [];

  const parsed = rows.flatMap((row): CityDefinition[] => {
    if (!row || typeof row !== 'object') return [];
    const value = row as Record<string, unknown>;
    const id = typeof value.id === 'string' ? value.id : typeof value.cityId === 'string' ? value.cityId : '';
    const fallback = FALLBACK_CITIES.find((city) => city.id === id);
    const center = parseCenter(value.center) ?? fallback?.center ?? null;
    const manifestBounds = parseBounds(value.bounds ?? value.bbox);
    const bounds =
      manifestBounds && fallback
        ? {
            north: Math.max(manifestBounds.north, fallback.bounds.north),
            south: Math.min(manifestBounds.south, fallback.bounds.south),
            east: Math.max(manifestBounds.east, fallback.bounds.east),
            west: Math.min(manifestBounds.west, fallback.bounds.west),
          }
        : manifestBounds ?? fallback?.bounds ?? null;
    if (!id || !center || !bounds) return [];
    const geoJsonUrlValue =
      value.geoJsonUrl ?? value.geojson ?? value.neighborhoods ?? value.path ?? value.file;
    const geoJsonUrl =
      typeof geoJsonUrlValue === 'string'
        ? geoJsonUrlValue.startsWith('/')
          ? geoJsonUrlValue
          : `/geo/${geoJsonUrlValue}`
        : fallback?.geoJsonUrl ?? `/geo/${id}/neighborhoods.geojson`;
    return [
      {
        id,
        name: typeof value.name === 'string' ? value.name : fallback?.name ?? id,
        center,
        bounds,
        geoJsonUrl,
      },
    ];
  });

  return parsed.length > 0 ? parsed : FALLBACK_CITIES;
}

export function loadCityManifest(): Promise<CityDefinition[]> {
  citiesPromise ??= fetch('/geo/manifest.json', { cache: 'force-cache' })
    .then((response) => {
      if (!response.ok) throw new Error('No se pudo cargar el manifiesto geográfico.');
      return response.json() as Promise<unknown>;
    })
    .then(normalizeManifest)
    .catch(() => FALLBACK_CITIES);
  return citiesPromise;
}

function normalizeNeighborhoods(
  raw: FeatureCollection<Geometry, GeoJsonProperties>,
  city: CityDefinition,
): NeighborhoodCollection {
  const features = raw.features.flatMap((feature): NeighborhoodFeature[] => {
    if (feature.geometry.type !== 'Polygon' && feature.geometry.type !== 'MultiPolygon') return [];
    const properties = feature.properties ?? {};
    const idValue = properties.id ?? properties.neighborhoodId ?? properties.barri_id ?? properties.COD_BAR;
    const nameValue = properties.name ?? properties.neighborhoodName ?? properties.nom ?? properties.NOMBRE;
    const id = idValue === undefined || idValue === null ? '' : String(idValue);
    if (!id) return [];
    return [
      {
        ...feature,
        properties: {
          id,
          name: typeof nameValue === 'string' ? nameValue : id,
          cityId: typeof properties.cityId === 'string' ? properties.cityId : city.id,
        },
      } as NeighborhoodFeature,
    ];
  });
  return { type: 'FeatureCollection', features };
}

export function loadNeighborhoods(city: CityDefinition): Promise<NeighborhoodCollection | null> {
  const cached = neighborhoodPromises.get(city.id);
  if (cached) return cached;

  const stableFallback = `/geo/${city.id}/neighborhoods.geojson`;
  const fetchCollection = async (url: string) => {
    const response = await fetch(url, { cache: 'force-cache' });
    if (!response.ok) throw new Error(`GeoJSON no disponible para ${city.name}.`);
    return normalizeNeighborhoods(
      (await response.json()) as FeatureCollection<Geometry, GeoJsonProperties>,
      city,
    );
  };

  const promise = fetchCollection(city.geoJsonUrl)
    .catch(() => (city.geoJsonUrl === stableFallback ? null : fetchCollection(stableFallback)))
    .catch(() => null);
  neighborhoodPromises.set(city.id, promise);
  return promise;
}

export function containsPoint(bounds: MapBounds, position: LatLng) {
  return (
    position.lat <= bounds.north &&
    position.lat >= bounds.south &&
    position.lng <= bounds.east &&
    position.lng >= bounds.west
  );
}

export function boundsContain(bounds: MapBounds, position: LatLng) {
  const longitudeInside =
    bounds.west <= bounds.east
      ? position.lng >= bounds.west && position.lng <= bounds.east
      : position.lng >= bounds.west || position.lng <= bounds.east;
  return position.lat >= bounds.south && position.lat <= bounds.north && longitudeInside;
}

export function listingIsInBounds(location: LatLng, bounds: MapBounds) {
  return boundsContain(bounds, location);
}

export function neighborhoodCenter(feature: NeighborhoodFeature): LatLng {
  const polygons =
    feature.geometry.type === 'Polygon'
      ? [feature.geometry.coordinates]
      : feature.geometry.coordinates;
  let north = -Infinity;
  let south = Infinity;
  let east = -Infinity;
  let west = Infinity;
  for (const polygon of polygons) {
    for (const ring of polygon) {
      for (const [longitude, latitude] of ring) {
        north = Math.max(north, latitude);
        south = Math.min(south, latitude);
        east = Math.max(east, longitude);
        west = Math.min(west, longitude);
      }
    }
  }
  return { lat: (north + south) / 2, lng: (east + west) / 2 };
}

export async function resolveVisibleScope(
  position: LatLng,
  zoom: number,
  cityHint?: CityDefinition | null,
): Promise<ResolvedScope> {
  const cities = await loadCityManifest();
  const hinted = cityHint ? (cities.find((city) => city.id === cityHint.id) ?? cityHint) : null;
  const city = cities.find((candidate) => containsPoint(candidate.bounds, position)) ??
    (hinted && containsPoint(hinted.bounds, position) ? hinted : null);

  if (!city) {
    return { scope: EMPTY_SCOPE, city: null, neighborhoods: null, activeNeighborhood: null };
  }

  const cityScope = {
    scopeId: city.id,
    scope: 'city' as const,
    cityId: city.id,
    neighborhoodId: null,
    name: city.name,
  };
  if (zoom < NEIGHBORHOOD_ZOOM) {
    return { scope: cityScope, city, neighborhoods: null, activeNeighborhood: null };
  }

  const neighborhoods = await loadNeighborhoods(city);
  const activeNeighborhood =
    neighborhoods?.features.find((feature) =>
      booleanPointInPolygon(point([position.lng, position.lat]), feature),
    ) ?? null;
  if (!activeNeighborhood) {
    return { scope: cityScope, city, neighborhoods, activeNeighborhood: null };
  }

  const { id, name } = activeNeighborhood.properties;
  return {
    scope: {
      scopeId: `${city.id}__${id}`,
      scope: 'neighborhood',
      cityId: city.id,
      neighborhoodId: id,
      name,
    },
    city,
    neighborhoods,
    activeNeighborhood,
  };
}

export function approximateBounds(center: LatLng, zoom: number): MapBounds {
  const longitudeSpan = 360 / 2 ** Math.max(1, zoom - 1);
  const latitudeSpan = longitudeSpan * 0.62;
  return {
    north: Math.min(90, center.lat + latitudeSpan / 2),
    south: Math.max(-90, center.lat - latitudeSpan / 2),
    east: center.lng + longitudeSpan / 2,
    west: center.lng - longitudeSpan / 2,
  };
}

export function distanceMeters(first: LatLng, second: LatLng) {
  const earthRadius = 6_371_000;
  const radians = (degrees: number) => (degrees * Math.PI) / 180;
  const latitudeDelta = radians(second.lat - first.lat);
  const longitudeDelta = radians(second.lng - first.lng);
  const latitude1 = radians(first.lat);
  const latitude2 = radians(second.lat);
  const a =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(latitude1) * Math.cos(latitude2) * Math.sin(longitudeDelta / 2) ** 2;
  return earthRadius * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
