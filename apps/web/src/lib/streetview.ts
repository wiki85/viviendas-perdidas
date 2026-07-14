import type { LatLng } from '../domain/types';

export type StreetViewMetadata = {
  available: boolean;
  panoId: string | null;
  location: LatLng | null;
  date?: string;
};

export async function fetchStreetViewMetadata(
  position: LatLng,
  apiKey: string,
  signal?: AbortSignal,
): Promise<StreetViewMetadata> {
  const params = new URLSearchParams({
    location: `${position.lat},${position.lng}`,
    key: apiKey,
    source: 'outdoor',
  });
  const response = await fetch(
    `https://maps.googleapis.com/maps/api/streetview/metadata?${params}`,
    {
      signal,
    },
  );
  if (!response.ok) throw new Error('No se pudo comprobar Street View.');
  const payload = (await response.json()) as {
    status?: string;
    pano_id?: string;
    location?: { lat?: number; lng?: number };
    date?: string;
  };
  const lat = payload.location?.lat;
  const lng = payload.location?.lng;
  return {
    available: payload.status === 'OK' && typeof payload.pano_id === 'string',
    panoId: payload.pano_id ?? null,
    location: typeof lat === 'number' && typeof lng === 'number' ? { lat, lng } : null,
    date: payload.date,
  };
}

export function bearingBetween(from: LatLng, to: LatLng) {
  const radians = (degrees: number) => (degrees * Math.PI) / 180;
  const degrees = (value: number) => (value * 180) / Math.PI;
  const longitudeDelta = radians(to.lng - from.lng);
  const fromLatitude = radians(from.lat);
  const toLatitude = radians(to.lat);
  const y = Math.sin(longitudeDelta) * Math.cos(toLatitude);
  const x =
    Math.cos(fromLatitude) * Math.sin(toLatitude) -
    Math.sin(fromLatitude) * Math.cos(toLatitude) * Math.cos(longitudeDelta);
  return Math.round((degrees(Math.atan2(y, x)) + 360) % 360);
}

export function buildStreetViewUrl(
  apiKey: string,
  panoId: string,
  heading: number,
  width = 400,
  height = 300,
) {
  const params = new URLSearchParams({
    size: `${width}x${height}`,
    pano: panoId,
    heading: String(Math.round((heading + 360) % 360)),
    pitch: '0',
    fov: '90',
    key: apiKey,
    return_error_code: 'true',
  });
  return `https://maps.googleapis.com/maps/api/streetview?${params}`;
}
