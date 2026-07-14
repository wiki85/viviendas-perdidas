import { distanceMeters } from '../domain/geo.js';
import type { Coordinates, ListingStreetView } from '../types.js';

// Beyond this distance the panorama belongs to another street (typical on
// pedestrian streets without coverage) and would show the wrong facade.
const MAX_PANORAMA_DISTANCE_METERS = 40;

interface StreetViewMetadataResponse {
  status?: unknown;
  pano_id?: unknown;
  location?: { lat?: unknown; lng?: unknown };
  error_message?: unknown;
}

export class StreetViewError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'StreetViewError';
  }
}

export function normalizeHeading(heading: number): number {
  return ((heading % 360) + 360) % 360;
}

function defaultHeading(from: Coordinates, to: Coordinates): number {
  const fromLatitude = (from.latitude * Math.PI) / 180;
  const toLatitude = (to.latitude * Math.PI) / 180;
  const longitudeDelta = ((to.longitude - from.longitude) * Math.PI) / 180;
  const y = Math.sin(longitudeDelta) * Math.cos(toLatitude);
  const x =
    Math.cos(fromLatitude) * Math.sin(toLatitude) -
    Math.sin(fromLatitude) * Math.cos(toLatitude) * Math.cos(longitudeDelta);
  return normalizeHeading((Math.atan2(y, x) * 180) / Math.PI);
}

export async function resolveStreetView(
  listingLocation: Coordinates,
  requestedHeading: number | null,
  apiKey: string,
  panoIdHint: string | null = null,
  fetchImplementation: typeof fetch = fetch,
): Promise<ListingStreetView> {
  const url = new URL('https://maps.googleapis.com/maps/api/streetview/metadata');
  if (panoIdHint !== null) {
    // The client already previewed this exact panorama; verifying it by id
    // guarantees the stored image matches what the user saw and framed.
    url.searchParams.set('pano', panoIdHint);
  } else {
    url.searchParams.set('location', `${listingLocation.latitude},${listingLocation.longitude}`);
    url.searchParams.set('radius', '50');
    url.searchParams.set('source', 'outdoor');
  }
  url.searchParams.set('key', apiKey);

  let response: Response;
  try {
    response = await fetchImplementation(url, { signal: AbortSignal.timeout(8_000) });
  } catch (error) {
    throw new StreetViewError(`No se pudo contactar con Street View: ${String(error)}`);
  }
  if (!response.ok) {
    throw new StreetViewError(`Street View metadata devolvió HTTP ${response.status}.`);
  }
  const payload = (await response.json()) as StreetViewMetadataResponse;
  if (payload.status === 'ZERO_RESULTS' || payload.status === 'NOT_FOUND') {
    if (panoIdHint !== null) {
      // Stale or invalid hint: fall back to the regular outdoor search.
      return resolveStreetView(listingLocation, requestedHeading, apiKey, null, fetchImplementation);
    }
    return { available: false, panoId: null, heading: null };
  }
  if (payload.status !== 'OK' || typeof payload.pano_id !== 'string') {
    const detail = typeof payload.error_message === 'string' ? ` ${payload.error_message}` : '';
    throw new StreetViewError(`Street View no pudo completar la solicitud.${detail}`);
  }

  const panoramaLatitude = Number(payload.location?.lat);
  const panoramaLongitude = Number(payload.location?.lng);
  const panoramaLocation =
    Number.isFinite(panoramaLatitude) && Number.isFinite(panoramaLongitude)
      ? { latitude: panoramaLatitude, longitude: panoramaLongitude }
      : null;
  if (panoramaLocation && distanceMeters(panoramaLocation, listingLocation) > MAX_PANORAMA_DISTANCE_METERS) {
    if (panoIdHint !== null) {
      return resolveStreetView(listingLocation, requestedHeading, apiKey, null, fetchImplementation);
    }
    return { available: false, panoId: null, heading: null };
  }
  const calculatedHeading = panoramaLocation
    ? defaultHeading(panoramaLocation, listingLocation)
    : 0;
  return {
    available: true,
    panoId: payload.pano_id,
    heading: normalizeHeading(requestedHeading ?? calculatedHeading),
  };
}
