import { normalizeStreet, normalizeStreetNumber } from './address.js';
import {
  extractStreetNumber,
  normalizeLicenseKey,
  sanitizePublicName,
  type OfficialVutRecord,
} from './openrta.js';

/**
 * Viviendas de uso turístico de Aragón (Gobierno de Aragón, buscador público
 * wturpub). El export XLSX trae número de registro (`VU-HU-22-100`),
 * dirección, localidad y CP — pero NI plazas NI coordenadas: la capacidad
 * queda a cero y la ubicación se resuelve por dirección en pasadas. La
 * columna Localidad es núcleo, no municipio INE: Formigal cuenta como
 * Sallent de Gállego.
 */

export interface AragonMunicipality {
  /** Valores de `Localidad` (normalizados sin tildes) que suman al municipio. */
  sourceNames: readonly string[];
  /** Nombre para mostrar y para el radio de plausibilidad. */
  name: string;
  cityId: string;
}

export const ARAGON_MUNICIPALITIES: readonly AragonMunicipality[] = [
  { sourceNames: ['ZARAGOZA'], name: 'ZARAGOZA', cityId: 'zaragoza' },
  { sourceNames: ['BENASQUE', 'CERLER'], name: 'BENASQUE', cityId: 'benasque' },
  { sourceNames: ['JACA'], name: 'JACA', cityId: 'jaca' },
  {
    sourceNames: ['SALLENT DE GALLEGO', 'FORMIGAL', 'EL FORMIGAL', 'LANUZA'],
    name: 'SALLENT DE GÁLLEGO',
    cityId: 'sallent-de-gallego',
  },
  { sourceNames: ['PANTICOSA'], name: 'PANTICOSA', cityId: 'panticosa' },
  { sourceNames: ['TERUEL'], name: 'TERUEL', cityId: 'teruel' },
];

/** «Sallent de Gállego » → «SALLENT DE GALLEGO» (mayúsculas sin tildes). */
export function normalizeAragonLocality(value: string): string {
  return value
    .trim()
    .toLocaleUpperCase('es')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/gu, '');
}

export interface AragonRow {
  vivienda: string;
  localidad: string;
  direccion: string;
  codigoPostal: string;
  signatura: string;
}

/**
 * Fila del export aragonés → registro del espejo; null si no es utilizable.
 * La VUT aragonesa se cede completa (Decreto 80/2015), sin modalidad por
 * habitaciones. El teléfono, el email y la web del titular se descartan en
 * el servicio: nunca se espejan.
 */
export function parseAragonRow(
  row: AragonRow,
  municipality: AragonMunicipality,
): OfficialVutRecord | null {
  const signatura = row.signatura.trim();
  if (signatura.length === 0) return null;
  const addressText = row.direccion.replace(/\s+/gu, ' ').trim();
  return {
    id: `ara-${signatura.replace(/[^A-Za-z0-9-]/gu, '-')}`,
    registrationCode: signatura,
    licenseKey: normalizeLicenseKey(signatura),
    name: sanitizePublicName(row.vivienda),
    addressText,
    street: normalizeStreet(addressText.split(',')[0] ?? addressText),
    number: normalizeStreetNumber(extractStreetNumber(addressText)),
    postalCode: row.codigoPostal.trim(),
    municipality: municipality.name,
    cityId: municipality.cityId,
    entire: true,
    places: 0,
    latitude: null,
    longitude: null,
  };
}
