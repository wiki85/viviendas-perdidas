import { normalizeStreet, normalizeStreetNumber } from './address.js';
import { normalizeLicenseKey, type OfficialVutRecord } from './openrta.js';

export interface EuskadiMunicipality {
  /** Exact Municipio value in the Open Data Euskadi files. */
  match: string;
  /** Canonical record spelling; needs a MUNICIPALITY_CENTERS entry. */
  name: string;
  cityId: string;
}

export const EUSKADI_MUNICIPALITIES: readonly EuskadiMunicipality[] = [
  { match: 'Donostia / San Sebastián', name: 'DONOSTIA / SAN SEBASTIÁN', cityId: 'donostia' },
  { match: 'Bilbao', name: 'BILBAO', cityId: 'bilbao' },
];

function asText(value: unknown): string {
  if (typeof value === 'number') return String(value);
  return typeof value === 'string' ? value.trim() : '';
}

/**
 * Maps a row of «Viviendas y habitaciones de vivienda particular para uso
 * turístico en Euskadi» (REATE, Open Data Euskadi, CC BY 4.0) to our record;
 * null when it is not a record of the given municipality. The dataset comes
 * in two files: whole dwellings (`entire` true) and rooms-only rentals
 * (`entire` false — they add displaced inhabitants, never households).
 * Neither publishes coordinates: every record enters the geocoding repair.
 */
export function parseEuskadiRecord(
  row: Record<string, unknown>,
  municipality: EuskadiMunicipality,
  entire: boolean,
): OfficialVutRecord | null {
  const code = asText(row.Nregistro);
  if (code.length === 0) return null;
  if (asText(row.Municipio) !== municipality.match) return null;

  // 'Bidebarrieta, 7, 1º DR (Bilbao)' → street / number / floor-door detail.
  const direccion = asText(row.Direccion).replace(/\s*\([^)]*\)\s*$/u, '');
  const parts = direccion.split(',').map((part) => part.trim());
  const street = parts[0] ?? '';
  const rawNumber = parts[1] ?? '';
  const numberMatch = /^(\d+[A-Za-z]?)\b/u.exec(rawNumber);
  const number = numberMatch?.[1] ?? '';
  const detail = [number.length > 0 ? rawNumber.slice(number.length).trim() : rawNumber]
    .concat(parts.slice(2))
    .filter((part) => part.length > 0)
    .join(', ');
  const addressText =
    `${street}${number.length > 0 ? `, ${number}` : ''}${detail.length > 0 ? ` (${detail})` : ''}`.trim();

  const places = Number(asText(row.Capacidad));
  return {
    id: `eus-${code.replace(/[^A-Za-z0-9_-]/gu, '-')}`,
    registrationCode: code,
    licenseKey: normalizeLicenseKey(code),
    name: asText(row.Nombrecomercial),
    addressText,
    street: normalizeStreet(street),
    number: normalizeStreetNumber(number),
    postalCode: asText(row.Codigopostal),
    municipality: municipality.name,
    cityId: municipality.cityId,
    entire,
    places: Number.isFinite(places) && places > 0 ? places : 0,
    latitude: null,
    longitude: null,
  };
}
