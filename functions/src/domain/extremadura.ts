import { normalizeStreet, normalizeStreetNumber } from './address.js';
import { sha256 } from './crypto.js';
import { extractStreetNumber, sanitizePublicName, type OfficialVutRecord } from './openrta.js';

/**
 * Listado de apartamentos turísticos de la Junta de Extremadura (CC BY 4.0).
 * Extremadura no publica una figura separada de vivienda de uso turístico:
 * este CSV (estancado desde marzo de 2025) es lo único descargable. Sin
 * número de registro público ni coordenadas: clave sintética estable y
 * geocodificación por dirección.
 */

export interface ExtremaduraMunicipality {
  /** Valor exacto de `Municipio` en el CSV. */
  sourceName: string;
  /** Nombre para mostrar y para el radio de plausibilidad. */
  name: string;
  cityId: string;
}

export const EXTREMADURA_MUNICIPALITIES: readonly ExtremaduraMunicipality[] = [
  { sourceName: 'CACERES', name: 'CÁCERES', cityId: 'caceres' },
  { sourceName: 'MERIDA', name: 'MÉRIDA', cityId: 'merida' },
  { sourceName: 'BADAJOZ', name: 'BADAJOZ', cityId: 'badajoz' },
];

/** «CÁCERES»/«Cáceres»/«CACERES» → «CACERES»: el CSV no es consistente. */
export function normalizeExtremaduraMunicipality(value: string): string {
  return value
    .trim()
    .toLocaleUpperCase('es')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/gu, '');
}

/**
 * Fila del listado extremeño → registro del espejo; null si no es
 * utilizable. Sin número de registro publicado, la clave se deriva de los
 * campos estables de la ficha (municipio, nombre y dirección).
 */
export function parseExtremaduraRow(
  row: Record<string, string>,
  municipality: ExtremaduraMunicipality,
): OfficialVutRecord | null {
  const name = sanitizePublicName(row['Nombre establecimiento'] ?? '');
  const addressText = (row['Dirección'] ?? '').replace(/\s+/gu, ' ').trim();
  if (name.length === 0 && addressText.length === 0) return null;
  const places = Number((row['Total Nº Plazas'] ?? '').trim());
  const postal = (row['C. Postal'] ?? '').trim();
  return {
    id: `ext-${sha256(`${municipality.cityId}|${name}|${addressText}`.toLocaleLowerCase('es')).slice(0, 16)}`,
    registrationCode: '',
    licenseKey: '',
    name,
    addressText,
    street: normalizeStreet(addressText.split(',')[0] ?? addressText),
    number: normalizeStreetNumber(extractStreetNumber(addressText)),
    // El CSV pierde el cero inicial de los CP pacenses («6207» → «06207»).
    postalCode: /^\d{4,5}$/u.test(postal) ? postal.padStart(5, '0') : '',
    municipality: municipality.name,
    cityId: municipality.cityId,
    entire: true,
    places: Number.isFinite(places) && places > 0 ? places : 0,
    latitude: null,
    longitude: null,
  };
}
