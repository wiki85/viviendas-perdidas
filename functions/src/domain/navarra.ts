import { normalizeStreet, normalizeStreetNumber } from './address.js';
import { estimateApartmentUnits, normalizeLicenseKey, type OfficialVutRecord } from './openrta.js';

/**
 * Modalities of the Registro de Turismo de Navarra that are urban dwellings
 * ceded to tourists: viviendas y apartamentos sueltos, más los «Bloque
 * apartamentos turísticos» (edificios completos, distintos del
 * «Hotel-apartamento» y demás figuras hoteleras, que quedan fuera). Todas
 * ceden la vivienda completa — no hay modalidad por habitaciones.
 */
const NAVARRA_DWELLING_MODALITIES = new Set(['Apartamento Turístico', 'Vivienda Turística']);
/** Edificios de apartamentos: sin nº de apartamentos publicado, se estima
 * por capacidad. */
const NAVARRA_APARTMENT_MODALITY = 'Bloque apartamentos turísticos';

export interface NavarraMunicipality {
  /** Exact MUNICIPIO value in the DataStore ('Pamplona / Iruña'). */
  match: string;
  /** Canonical record spelling; needs a MUNICIPALITY_CENTERS entry. */
  name: string;
  cityId: string;
}

export const NAVARRA_MUNICIPALITIES: readonly NavarraMunicipality[] = [
  { match: 'Pamplona / Iruña', name: 'PAMPLONA', cityId: 'pamplona' },
];

function asText(value: unknown): string {
  if (typeof value === 'number') return String(value);
  return typeof value === 'string' ? value.trim() : '';
}

/**
 * Maps a DataStore row of the Registro de Turismo de Navarra (Gobierno de
 * Navarra, CC BY 4.0) to our record; null when it is not an urban dwelling
 * of the given municipality. The register publishes no coordinates: every
 * record enters the shared geocoding repair.
 */
export function parseNavarraRecord(
  row: Record<string, unknown>,
  municipality: NavarraMunicipality,
): OfficialVutRecord | null {
  const code = asText(row.COD_INSCRIPCION);
  if (code.length === 0) return null;
  const modality = asText(row.MODALIDAD);
  const isApartmentBuilding = modality === NAVARRA_APARTMENT_MODALITY;
  if (!isApartmentBuilding && !NAVARRA_DWELLING_MODALITIES.has(modality)) return null;
  if (asText(row.MUNICIPIO) !== municipality.match) return null;

  // 'Julio Ruiz de Alda 6 1ºC' → street / number / floor-door detail.
  const direccion = asText(row.DIRECCION);
  const match = /^(.*?)\s+(\d+[A-Za-z]?)(?:\s+(.*))?$/u.exec(direccion);
  const street = (match?.[1] ?? direccion).trim();
  const number = match?.[2] ?? '';
  const detail = (match?.[3] ?? '').trim();
  const addressText =
    `${street}${number.length > 0 ? `, ${number}` : ''}${detail.length > 0 ? ` (${detail})` : ''}`.trim();

  const places = Number(asText(row.PLAZAS));
  const safePlaces = Number.isFinite(places) && places > 0 ? places : 0;
  return {
    id: `nav-${code.replace(/[^A-Za-z0-9_-]/gu, '-')}`,
    registrationCode: code,
    licenseKey: normalizeLicenseKey(code),
    name: asText(row.NOMBRE),
    addressText,
    street: normalizeStreet(street),
    number: normalizeStreetNumber(number),
    postalCode: asText(row.CODIGO_POSTAL),
    municipality: municipality.name,
    cityId: municipality.cityId,
    entire: true,
    places: safePlaces,
    ...(isApartmentBuilding && estimateApartmentUnits(safePlaces) > 1
      ? { units: estimateApartmentUnits(safePlaces) }
      : {}),
    latitude: null,
    longitude: null,
  };
}
