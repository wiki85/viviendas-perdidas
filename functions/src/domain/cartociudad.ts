/**
 * Response parsing for the CartoCiudad geocoder (IGN, free public service).
 * The `findJsonp` endpoint wraps its JSON in `callback(...)`; a match is only
 * trusted at `portal` precision — street or municipality centroids would
 * mislead, the Geocoding API can try those addresses instead.
 */
export function parseCartoCiudadResponse(
  body: string,
): { latitude: number; longitude: number; muni: string } | null {
  const match = /^\s*callback\((.*)\);?\s*$/su.exec(body);
  const raw = match?.[1] ?? body;
  let payload: unknown;
  try {
    payload = JSON.parse(raw);
  } catch {
    return null;
  }
  const candidate: unknown = Array.isArray(payload) ? (payload as unknown[])[0] : payload;
  if (candidate === null || typeof candidate !== 'object') return null;
  const result = candidate as { type?: unknown; lat?: unknown; lng?: unknown; muni?: unknown };
  if (result.type !== 'portal') return null;
  const latitude = Number(result.lat);
  const longitude = Number(result.lng);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  if (latitude < 27.4 || latitude > 44.2 || longitude < -18.5 || longitude > 4.5) return null;
  return { latitude, longitude, muni: typeof result.muni === 'string' ? result.muni : '' };
}

/** True when the geocoder's municipality is (part of) the record's one —
 * 'Donostia/San Sebastián' matches 'SAN SEBASTIÁN', 'Madrid' matches
 * 'MADRID'. A big-radius city (Madrid) must never accept a match that the
 * geocoder itself places in a neighbouring municipality. */
export function cartoCiudadMuniMatches(resultMuni: string, recordMunicipality: string): boolean {
  if (resultMuni.length === 0) return true;
  const normalize = (value: string) =>
    value
      .normalize('NFD')
      .replace(/\p{Diacritic}/gu, '')
      .toLocaleLowerCase('es')
      .replace(/[^a-z0-9]+/gu, ' ')
      .trim();
  const a = normalize(resultMuni);
  const b = normalize(recordMunicipality);
  return a.includes(b) || b.includes(a);
}

/** 'DONOSTIA / SAN SEBASTIÁN' → 'SAN SEBASTIÁN': CartoCiudad matches the
 * short municipality spelling better than the bilingual official one. */
export function cartoCiudadMunicipality(municipality: string): string {
  const segments = municipality.split('/');
  return (segments[segments.length - 1] ?? municipality).trim();
}
