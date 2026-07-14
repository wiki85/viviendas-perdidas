import { SPAIN_BOUNDS } from '../config.js';
import type { Coordinates } from '../types.js';

const EARTH_RADIUS_METERS = 6_371_008.8;

function degreesToRadians(value: number): number {
  return (value * Math.PI) / 180;
}

export function isInsideSpainBoundingBox(point: Coordinates): boolean {
  return (
    Number.isFinite(point.latitude) &&
    Number.isFinite(point.longitude) &&
    point.latitude >= SPAIN_BOUNDS.minLatitude &&
    point.latitude <= SPAIN_BOUNDS.maxLatitude &&
    point.longitude >= SPAIN_BOUNDS.minLongitude &&
    point.longitude <= SPAIN_BOUNDS.maxLongitude
  );
}

export function distanceMeters(a: Coordinates, b: Coordinates): number {
  const latitudeDelta = degreesToRadians(b.latitude - a.latitude);
  const longitudeDelta = degreesToRadians(b.longitude - a.longitude);
  const latitudeA = degreesToRadians(a.latitude);
  const latitudeB = degreesToRadians(b.latitude);

  const haversine =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(latitudeA) * Math.cos(latitudeB) * Math.sin(longitudeDelta / 2) ** 2;
  return 2 * EARTH_RADIUS_METERS * Math.asin(Math.sqrt(haversine));
}
