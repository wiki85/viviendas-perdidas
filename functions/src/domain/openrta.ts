import proj4 from 'proj4';
import { normalizeStreet, normalizeStreetNumber, slugifyCity } from './address.js';
import { distanceMeters } from './geo.js';

/** ETRS89 / UTM zone 30N, the SRID OpenRTA publishes coordinates in. */
const EPSG_25830 = '+proj=utm +zone=30 +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +units=m +no_defs';

export interface OfficialVutRecord {
  /** Mirror document id, prefixed by source ('rta-1234', 'cat-HUTB-000001'). */
  id: string;
  /** Numeric id in the RTA API; absent for other registries. Kept as a stored
   * field so pre-multi-source Andalusian docs keep their contentHash. */
  rtaId?: number;
  registrationCode: string;
  licenseKey: string;
  name: string;
  addressText: string;
  street: string;
  number: string;
  postalCode: string;
  municipality: string;
  cityId: string;
  entire: boolean;
  places: number;
  /** Cadastral reference (GVA rows): lets the sync resolve coordinates
   * against the Catastro instead of paying the Geocoding API. */
  cadastralRef?: string;
  latitude: number | null;
  longitude: number | null;
}

/**
 * Normalizes an RTA registration code for lookups: uppercase, no spaces and
 * no leading zeros in the numeric part ('vut/se/015513 ' → 'VUT/SE/15513'),
 * so citizen-typed licences match regardless of zero padding.
 */
export function normalizeLicenseKey(value: string): string {
  return value
    .toLocaleUpperCase('es')
    .replace(/\s+/gu, '')
    .split('/')
    .map((part) => (/^\d+$/u.test(part) ? String(Number(part)) : part))
    .join('/');
}

/** Extracts the street number from 'CALLE Manzanares Nº 8 Plta/Piso 9 …'. */
export function extractStreetNumber(addressText: string): string {
  const match = /N[ºo°]?\s*\.?\s*(\d+)/iu.exec(addressText);
  if (match?.[1] !== undefined) return match[1];
  // Fallback for RTA rows without the Nº marker ('CALLE FERIA 106'): the
  // last standalone 1-4 digit token once floor/door qualifiers are cut off.
  // Without this, those records can never match a community submission.
  const trimmed = cleanAddressForGeocoding(addressText);
  const numbers = [...trimmed.matchAll(/(?:^|[\s,])(\d{1,4})(?=[\s,.]|$)/gu)];
  return numbers.at(-1)?.[1] ?? '';
}

/**
 * 'CALLE X Nº 8 Plta/Piso 2 Pta/Letra G' → 'CALLE X Nº 8'. Floor and door
 * noise degrades Geocoding API answers to locality level; block and portal
 * are kept because they help locate the building.
 */
export function cleanAddressForGeocoding(addressText: string): string {
  return (
    addressText
      .replace(/\s+(?:Plta(?:\/Piso)?|Piso|Pta(?:\/Letra)?|Letra|Esc(?:alera)?\.?)\b.*$/iu, '')
      // Floor/door detail appended in parentheses (Catalan registry rows).
      .replace(/\s*\([^)]*\)\s*$/u, '')
      .trim()
  );
}

/**
 * City centers and a generous municipal radius for the mirrored
 * municipalities. Some RTA records carry coordinates typed by the operator
 * that fall hundreds of km away (Madrid, Cantabria…); anything beyond the
 * radius is treated as not geolocated so it can be repaired by address.
 */
export const MUNICIPALITY_CENTERS: Record<
  string,
  { latitude: number; longitude: number; radiusKm: number }
> = {
  SEVILLA: { latitude: 37.3891, longitude: -5.9845, radiusKm: 30 },
  MÁLAGA: { latitude: 36.7213, longitude: -4.4214, radiusKm: 30 },
  GRANADA: { latitude: 37.1773, longitude: -3.5986, radiusKm: 25 },
  CÓRDOBA: { latitude: 37.8882, longitude: -4.7794, radiusKm: 45 },
  CÁDIZ: { latitude: 36.5297, longitude: -6.2927, radiusKm: 20 },
  HUELVA: { latitude: 37.2614, longitude: -6.9447, radiusKm: 25 },
  JAÉN: { latitude: 37.7796, longitude: -3.7849, radiusKm: 30 },
  ALMERÍA: { latitude: 36.834, longitude: -2.4637, radiusKm: 35 },
  'JEREZ DE LA FRONTERA': { latitude: 36.6866, longitude: -6.1372, radiusKm: 45 },
  MARBELLA: { latitude: 36.5101, longitude: -4.8825, radiusKm: 30 },
  BARCELONA: { latitude: 41.3874, longitude: 2.1686, radiusKm: 20 },
  VALÈNCIA: { latitude: 39.4699, longitude: -0.3763, radiusKm: 22 },
  ALICANTE: { latitude: 38.3452, longitude: -0.481, radiusKm: 22 },
  BENIDORM: { latitude: 38.5382, longitude: -0.131, radiusKm: 12 },
  PALMA: { latitude: 39.5696, longitude: 2.6502, radiusKm: 22 },
  PAMPLONA: { latitude: 42.8125, longitude: -1.644, radiusKm: 12 },
  BILBAO: { latitude: 43.263, longitude: -2.935, radiusKm: 12 },
  'DONOSTIA / SAN SEBASTIÁN': { latitude: 43.3183, longitude: -1.9812, radiusKm: 12 },
  MADRID: { latitude: 40.4168, longitude: -3.7038, radiusKm: 25 },
  TORREVIEJA: { latitude: 37.9787, longitude: -0.6822, radiusKm: 15 },
  CALP: { latitude: 38.6446, longitude: 0.0453, radiusKm: 10 },
  DÉNIA: { latitude: 38.8408, longitude: 0.1057, radiusKm: 15 },
  CALVIÀ: { latitude: 39.5657, longitude: 2.5062, radiusKm: 18 },
  ALCÚDIA: { latitude: 39.8499, longitude: 3.124, radiusKm: 12 },
  GIRONA: { latitude: 41.9794, longitude: 2.8214, radiusKm: 12 },
  TARRAGONA: { latitude: 41.1189, longitude: 1.2445, radiusKm: 15 },
};

/** True when the point is inside the municipality's plausible radius (or the
 * municipality is unknown to us, in which case we cannot judge). */
export function coordinatesPlausibleForMunicipality(
  municipality: string,
  latitude: number,
  longitude: number,
): boolean {
  const center = MUNICIPALITY_CENTERS[municipality.toLocaleUpperCase('es')];
  if (center === undefined) return true;
  return (
    distanceMeters(
      { latitude, longitude },
      { latitude: center.latitude, longitude: center.longitude },
    ) <=
    center.radiusKm * 1000
  );
}

export function utmToWgs84(x: number, y: number): { latitude: number; longitude: number } | null {
  if (!Number.isFinite(x) || !Number.isFinite(y) || x === 0 || y === 0) return null;
  const [longitude, latitude] = proj4(EPSG_25830, proj4.WGS84, [x, y]);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  // Sanity: must fall inside the Spanish bounding box.
  if (latitude < 27.4 || latitude > 44.2 || longitude < -18.5 || longitude > 4.5) return null;
  return { latitude, longitude };
}

function parseSpanishDecimal(value: unknown): number {
  if (typeof value === 'number') return value;
  if (typeof value !== 'string') return NaN;
  return Number(value.replace(/\./gu, '').replace(',', '.'));
}

/** Maps a raw OpenRTA result row to our record; null if unusable. */
export function parseRtaRecord(raw: Record<string, unknown>): OfficialVutRecord | null {
  const rtaId = typeof raw.id === 'number' ? raw.id : Number(raw.id);
  const registrationCode = typeof raw.registration_code === 'string' ? raw.registration_code : '';
  const municipality = typeof raw.municipalities === 'string' ? raw.municipalities : '';
  if (!Number.isFinite(rtaId) || registrationCode.length === 0 || municipality.length === 0) {
    return null;
  }
  if (raw.ind_pub_open_rta !== 'S') return null;
  const addressText =
    typeof raw.establishment_address === 'string' ? raw.establishment_address : '';
  const roadName = typeof raw.road_name === 'string' ? raw.road_name : '';
  const sridValue = raw.srid;
  const srid =
    typeof sridValue === 'string'
      ? sridValue
      : typeof sridValue === 'number'
        ? String(sridValue)
        : '';
  const projected =
    srid === '25830'
      ? utmToWgs84(parseSpanishDecimal(raw.coord_x), parseSpanishDecimal(raw.coord_y))
      : null;
  // Some source rows carry coordinates typed hundreds of km away from their
  // own municipality; drop them so the sync can repair them by address.
  const coordinates =
    projected !== null &&
    coordinatesPlausibleForMunicipality(municipality, projected.latitude, projected.longitude)
      ? projected
      : null;
  return {
    id: `rta-${rtaId}`,
    rtaId,
    registrationCode,
    licenseKey: normalizeLicenseKey(registrationCode),
    name: typeof raw.name === 'string' ? raw.name : '',
    addressText,
    street: normalizeStreet(roadName.length > 0 ? roadName : addressText),
    number: normalizeStreetNumber(extractStreetNumber(addressText)),
    postalCode: typeof raw.postal_code === 'string' ? raw.postal_code : '',
    municipality,
    cityId: slugifyCity(municipality),
    entire: raw.group === 'Completa',
    places: typeof raw.tot_gen_places === 'number' ? raw.tot_gen_places : 0,
    latitude: coordinates?.latitude ?? null,
    longitude: coordinates?.longitude ?? null,
  };
}

/** Street-type words and connectors that don't identify the road itself.
 * Includes the Catalan road types so a community submission typed as
 * «Calle Marina» matches the registry's «Carrer Marina». */
const STREET_STOPWORDS = new Set([
  'calle',
  'avenida',
  'paseo',
  'plaza',
  'ronda',
  'camino',
  'carretera',
  'travesia',
  'urbanizacion',
  'conjunto',
  'barriada',
  'pasaje',
  'glorieta',
  'carrer',
  'avinguda',
  'passeig',
  'placa',
  'rambla',
  'travessera',
  'passatge',
  'cami',
  'dels',
  'les',
  'de',
  'del',
  'la',
  'las',
  'los',
  'el',
  'y',
]);

function significantStreetTokens(street: string): string[] {
  return street.split(' ').filter((token) => token.length > 0 && !STREET_STOPWORDS.has(token));
}

/**
 * True when both normalized streets plausibly name the same road. Compares
 * whole significant words: raw substring matching produced false positives
 * ('calle sol' ⊂ 'calle soledad') that mislabelled community submissions.
 */
export function streetsLooselyMatch(a: string, b: string): boolean {
  if (a.length === 0 || b.length === 0) return false;
  if (a === b) return true;
  const tokensA = significantStreetTokens(a);
  const tokensB = significantStreetTokens(b);
  if (tokensA.length === 0 || tokensB.length === 0) return false;
  const [shorter, longer] =
    tokensA.length <= tokensB.length ? [tokensA, tokensB] : [tokensB, tokensA];
  return shorter.every((token) => longer.includes(token));
}
