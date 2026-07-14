import { isInsideSpainBoundingBox } from '../domain/geo.js';
import type { ListingAddress } from '../types.js';

export type GeocodingInput =
  | { kind: 'location'; latitude: number; longitude: number }
  | { kind: 'address'; address: string }
  | { kind: 'placeId'; placeId: string };

export interface GeocodedLocation {
  address: ListingAddress;
  latitude: number;
  longitude: number;
}

interface GoogleAddressComponent {
  long_name?: unknown;
  short_name?: unknown;
  types?: unknown;
}

interface GoogleGeocodingResult {
  formatted_address?: unknown;
  address_components?: unknown;
  geometry?: { location?: { lat?: unknown; lng?: unknown } };
}

interface GoogleGeocodingResponse {
  status?: unknown;
  error_message?: unknown;
  results?: unknown;
}

export class GeocodingError extends Error {
  constructor(
    public readonly reason: 'not-found' | 'outside-spain' | 'imprecise' | 'upstream',
    message: string,
  ) {
    super(message);
    this.name = 'GeocodingError';
  }
}

function component(
  components: readonly GoogleAddressComponent[],
  expectedTypes: readonly string[],
  short = false,
): string {
  const match = components.find((candidate) => {
    const types = Array.isArray(candidate.types) ? candidate.types : [];
    return expectedTypes.some((type) => types.includes(type));
  });
  const value = short ? match?.short_name : match?.long_name;
  return typeof value === 'string' ? value.normalize('NFC').trim() : '';
}

function parseResult(result: GoogleGeocodingResult, input: GeocodingInput): GeocodedLocation {
  const rawComponents = Array.isArray(result.address_components) ? result.address_components : [];
  const components = rawComponents.filter(
    (candidate): candidate is GoogleAddressComponent =>
      typeof candidate === 'object' && candidate !== null,
  );
  const country = component(components, ['country'], true).toUpperCase();
  if (country !== 'ES') {
    throw new GeocodingError('outside-spain', 'La dirección geocodificada no está en España.');
  }

  const street = component(components, ['route']);
  const number = component(components, ['street_number']);
  const locality = component(components, [
    'locality',
    'postal_town',
    'administrative_area_level_3',
  ]);
  const province = component(components, ['administrative_area_level_2']);
  const postalCode = component(components, ['postal_code']);
  const formatted =
    typeof result.formatted_address === 'string'
      ? result.formatted_address.normalize('NFC').trim()
      : '';

  if (
    street.length === 0 ||
    number.length === 0 ||
    locality.length === 0 ||
    province.length === 0
  ) {
    throw new GeocodingError(
      'imprecise',
      'No se pudo resolver una dirección completa con calle, número, municipio y provincia.',
    );
  }

  const latitude =
    input.kind === 'location' ? input.latitude : Number(result.geometry?.location?.lat);
  const longitude =
    input.kind === 'location' ? input.longitude : Number(result.geometry?.location?.lng);
  if (!isInsideSpainBoundingBox({ latitude, longitude })) {
    throw new GeocodingError('outside-spain', 'Las coordenadas están fuera del ámbito de España.');
  }

  return {
    address: { formatted, street, number, postalCode, locality, province },
    latitude,
    longitude,
  };
}

export async function geocodeInSpain(
  input: GeocodingInput,
  apiKey: string,
  fetchImplementation: typeof fetch = fetch,
): Promise<GeocodedLocation> {
  const url = new URL('https://maps.googleapis.com/maps/api/geocode/json');
  if (input.kind === 'location') {
    url.searchParams.set('latlng', `${input.latitude},${input.longitude}`);
  } else if (input.kind === 'address') {
    url.searchParams.set('address', input.address);
    url.searchParams.set('components', 'country:ES');
  } else {
    url.searchParams.set('place_id', input.placeId);
  }
  url.searchParams.set('language', 'es');
  url.searchParams.set('region', 'es');
  url.searchParams.set('key', apiKey);

  let response: Response;
  try {
    response = await fetchImplementation(url, { signal: AbortSignal.timeout(8_000) });
  } catch (error) {
    throw new GeocodingError(
      'upstream',
      `No se pudo contactar con Geocoding API: ${String(error)}`,
    );
  }
  if (!response.ok) {
    throw new GeocodingError('upstream', `Geocoding API devolvió HTTP ${response.status}.`);
  }

  const payload = (await response.json()) as GoogleGeocodingResponse;
  if (payload.status === 'ZERO_RESULTS') {
    throw new GeocodingError('not-found', 'No se encontró esa dirección.');
  }
  if (payload.status !== 'OK' || !Array.isArray(payload.results) || payload.results.length === 0) {
    const detail = typeof payload.error_message === 'string' ? ` ${payload.error_message}` : '';
    throw new GeocodingError('upstream', `Geocoding API no pudo completar la solicitud.${detail}`);
  }
  const result = payload.results[0];
  if (typeof result !== 'object' || result === null) {
    throw new GeocodingError('upstream', 'Geocoding API devolvió una respuesta inválida.');
  }
  return parseResult(result as GoogleGeocodingResult, input);
}
