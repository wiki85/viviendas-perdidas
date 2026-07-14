import { readFileSync } from 'node:fs';
import booleanPointInPolygon from '@turf/boolean-point-in-polygon';
import { point } from '@turf/helpers';
import type { Feature, FeatureCollection, MultiPolygon, Polygon } from 'geojson';
import type { Coordinates } from '../types.js';

interface NeighborhoodProperties {
  id: string;
  name: string;
  cityId: string;
}

type NeighborhoodCollection = FeatureCollection<Polygon | MultiPolygon, NeighborhoodProperties>;

interface ManifestCity {
  id: string;
  name: string;
  geoJsonUrl: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readJson(relativePath: string): unknown {
  return JSON.parse(
    readFileSync(new URL(`../../geo/${relativePath}`, import.meta.url), 'utf8'),
  ) as unknown;
}

function loadManifest(): ManifestCity[] {
  const raw = readJson('manifest.json');
  if (!isRecord(raw) || !Array.isArray(raw.cities)) {
    throw new Error('The packaged geodata manifest is invalid.');
  }
  return raw.cities.map((city) => {
    if (
      !isRecord(city) ||
      typeof city.id !== 'string' ||
      typeof city.name !== 'string' ||
      typeof city.geoJsonUrl !== 'string' ||
      !city.geoJsonUrl.startsWith('/geo/') ||
      city.geoJsonUrl.includes('..')
    ) {
      throw new Error('The packaged geodata manifest contains an invalid city.');
    }
    return { id: city.id, name: city.name, geoJsonUrl: city.geoJsonUrl };
  });
}

function loadCollection(city: ManifestCity): NeighborhoodCollection {
  const raw = readJson(city.geoJsonUrl.slice('/geo/'.length));
  if (!isRecord(raw) || raw.type !== 'FeatureCollection' || !Array.isArray(raw.features)) {
    throw new Error(`The packaged GeoJSON for ${city.id} is invalid.`);
  }
  const features = raw.features.map(
    (feature): Feature<Polygon | MultiPolygon, NeighborhoodProperties> => {
      if (!isRecord(feature) || feature.type !== 'Feature' || !isRecord(feature.geometry)) {
        throw new Error(`The packaged GeoJSON for ${city.id} contains an invalid feature.`);
      }
      if (feature.geometry.type !== 'Polygon' && feature.geometry.type !== 'MultiPolygon') {
        throw new Error(`The packaged GeoJSON for ${city.id} contains a non-polygon feature.`);
      }
      if (!isRecord(feature.properties)) {
        throw new Error(`The packaged GeoJSON for ${city.id} contains invalid properties.`);
      }
      const { id, name, cityId } = feature.properties;
      if (typeof id !== 'string' || typeof name !== 'string' || cityId !== city.id) {
        throw new Error(`The packaged GeoJSON for ${city.id} has non-normalized properties.`);
      }
      return feature as unknown as Feature<Polygon | MultiPolygon, NeighborhoodProperties>;
    },
  );
  return { type: 'FeatureCollection', features };
}

const MANIFEST = loadManifest();
const CITY_NAMES = Object.fromEntries(MANIFEST.map((city) => [city.id, city.name]));
const NEIGHBORHOODS = Object.fromEntries(
  MANIFEST.map((city) => [city.id, loadCollection(city)]),
) as Readonly<Record<string, NeighborhoodCollection>>;

export interface ResolvedNeighborhood {
  id: string;
  name: string;
}

export function resolveNeighborhood(
  cityId: string,
  coordinates: Coordinates,
): ResolvedNeighborhood | null {
  const collection = NEIGHBORHOODS[cityId];
  if (collection === undefined) return null;
  const coordinatePoint = point([coordinates.longitude, coordinates.latitude]);
  for (const feature of collection.features) {
    if (booleanPointInPolygon(coordinatePoint, feature)) {
      return { id: feature.properties.id, name: feature.properties.name };
    }
  }
  return null;
}

export function cityDisplayName(cityId: string): string {
  return (
    CITY_NAMES[cityId] ??
    cityId.replace(/-/gu, ' ').replace(/\b\p{L}/gu, (letter) => letter.toLocaleUpperCase('es'))
  );
}

export function neighborhoodDisplayName(cityId: string, neighborhoodId: string): string {
  const collection = NEIGHBORHOODS[cityId];
  return (
    collection?.features.find((feature) => feature.properties.id === neighborhoodId)?.properties
      .name ?? neighborhoodId
  );
}
