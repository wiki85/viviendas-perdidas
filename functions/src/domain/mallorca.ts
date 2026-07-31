import { normalizeStreet, normalizeStreetNumber, slugifyCity } from './address.js';
import {
  coordinatesPlausibleForMunicipality,
  normalizeLicenseKey,
  type OfficialVutRecord,
} from './openrta.js';

/**
 * Groups of the Mallorca insular register that are dwellings ceded to
 * tourists. The register also lists marketing companies («Comercialitzador
 * d'estades», «Empresari d'habitatge») — operators, not homes, excluded.
 * Every mirrored group is a whole dwelling: the Balearic ETV figure requires
 * ceding the complete home, so there is no rooms-only bucket.
 */
const MALLORCA_DWELLING_GROUPS = new Set([
  'Estada turística en habitatge (ETV)',
  'Estada turística en habitatge (ETVPL)',
  'Estada turística en habitatge (ETV60)',
  'Habitatge turístic de vacances',
]);

interface GeoJsonFeature {
  properties?: Record<string, unknown> | null;
  geometry?: { coordinates?: unknown } | null;
}

function asText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

/**
 * Maps a feature of the «Registre d'Habitatges Turístics i Estades
 * Turístiques en Habitatge de Mallorca» (Consell de Mallorca, CC BY) to our
 * record; null when it is not an active dwelling of the given municipality.
 * Around half the features come without geometry — those fall through to the
 * shared geocoding repair.
 */
export function parseMallorcaFeature(
  feature: GeoJsonFeature,
  municipality: string,
): OfficialVutRecord | null {
  const properties = feature.properties ?? {};
  const signatura = asText(properties.Signatura);
  const group = asText(properties.Grup);
  if (signatura.length === 0) return null;
  if (asText(properties.Estat) !== 'Alta') return null;
  if (!MALLORCA_DWELLING_GROUPS.has(group)) return null;
  if (asText(properties.Municipi).toLocaleUpperCase('es') !== municipality) return null;

  // 'BORDOY, 4  planta 1 porta B. 07012 PALMA, Mallorca' →
  // street 'BORDOY', number '4', detail 'planta 1 porta B', CP '07012'.
  const direccio = asText(properties['Direcció']);
  const headMatch = /^(.*?)\.\s*(\d{5})\b/u.exec(direccio);
  const head = (headMatch?.[1] ?? direccio).trim();
  const postalCode = headMatch?.[2] ?? '';
  const commaIndex = head.indexOf(',');
  const street = (commaIndex === -1 ? head : head.slice(0, commaIndex)).trim();
  const afterComma = commaIndex === -1 ? '' : head.slice(commaIndex + 1).trim();
  const numberMatch = /^(\d+[A-Za-z]?)\b/u.exec(afterComma);
  const number = numberMatch?.[1] ?? '';
  const detail = afterComma.slice(number.length).trim();
  const addressText =
    `${street}${number.length > 0 ? `, ${number}` : ''}${detail.length > 0 ? ` (${detail})` : ''}`.trim();

  const rawCoordinates = feature.geometry?.coordinates;
  let latitude: number | null = null;
  let longitude: number | null = null;
  if (Array.isArray(rawCoordinates)) {
    const lng = Number(rawCoordinates[0]);
    const lat = Number(rawCoordinates[1]);
    if (
      Number.isFinite(lat) &&
      Number.isFinite(lng) &&
      lat >= 27.4 &&
      lat <= 44.2 &&
      lng >= -18.5 &&
      lng <= 4.5 &&
      coordinatesPlausibleForMunicipality(municipality, lat, lng)
    ) {
      latitude = lat;
      longitude = lng;
    }
  }

  const places = Number(asText(properties.Places));
  const name = asText(properties['Denominació comercial']);
  return {
    // Signatures carry slashes ('ETV/11326'): illegal in Firestore doc ids.
    id: `caib-${signatura.replace(/[^A-Za-z0-9_-]/gu, '-')}`,
    registrationCode: signatura,
    licenseKey: normalizeLicenseKey(signatura),
    name,
    addressText,
    street: normalizeStreet(street),
    number: normalizeStreetNumber(number),
    postalCode,
    municipality,
    cityId: slugifyCity(municipality),
    entire: true,
    places: Number.isFinite(places) && places > 0 ? places : 0,
    latitude,
    longitude,
  };
}
