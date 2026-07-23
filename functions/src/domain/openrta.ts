import proj4 from 'proj4';
import { normalizeStreet, normalizeStreetNumber, slugifyCity } from './address.js';

/** ETRS89 / UTM zone 30N, the SRID OpenRTA publishes coordinates in. */
const EPSG_25830 = '+proj=utm +zone=30 +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +units=m +no_defs';

export interface OfficialVutRecord {
  rtaId: number;
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
  return match?.[1] ?? '';
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
  const coordinates =
    srid === '25830'
      ? utmToWgs84(parseSpanishDecimal(raw.coord_x), parseSpanishDecimal(raw.coord_y))
      : null;
  return {
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

/** True when both normalized streets plausibly name the same road. */
export function streetsLooselyMatch(a: string, b: string): boolean {
  if (a.length === 0 || b.length === 0) return false;
  if (a === b) return true;
  return a.includes(b) || b.includes(a);
}
