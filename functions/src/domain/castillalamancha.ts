import { normalizeStreet, normalizeStreetNumber } from './address.js';
import { sha256 } from './crypto.js';
import { extractStreetNumber, sanitizePublicName, type OfficialVutRecord } from './openrta.js';

/**
 * Apartamentos turísticos y viviendas de uso turístico de Castilla-La Mancha
 * (datosabiertos.castillalamancha.es, CC BY-SA, refresco semestral). El CSV
 * no publica número de registro: la clave se deriva de los campos estables
 * de la ficha. Sin coordenadas: todo se resuelve por dirección en pasadas.
 */

export interface CastillaLaManchaMunicipality {
  /** Valor de `Municipio` en el CSV (mayúsculas sin normalizar). */
  sourceName: string;
  /** Nombre para mostrar y para el radio de plausibilidad. */
  name: string;
  cityId: string;
}

export const CASTILLA_LA_MANCHA_MUNICIPALITIES: readonly CastillaLaManchaMunicipality[] = [
  { sourceName: 'TOLEDO', name: 'TOLEDO', cityId: 'toledo' },
  { sourceName: 'CUENCA', name: 'CUENCA', cityId: 'cuenca' },
  { sourceName: 'ALBACETE', name: 'ALBACETE', cityId: 'albacete' },
];

/**
 * Fila del CSV manchego → registro del espejo; null si no es utilizable.
 * Se espejan los tres subepígrafes (V.U.T., apartamento turístico y
 * vivienda vacacional): todos son alojamiento completo. El email y el
 * teléfono del titular se descartan aquí: nunca se espejan.
 */
export function parseCastillaLaManchaRow(
  row: Record<string, string>,
  municipality: CastillaLaManchaMunicipality,
): OfficialVutRecord | null {
  const name = sanitizePublicName(row['Nombre Establecimiento'] ?? '');
  const addressText = (row['Dirección Establecimiento'] ?? '').replace(/\s+/gu, ' ').trim();
  if (name.length === 0 && addressText.length === 0) return null;
  // La columna de plazas llega con espacio final en la cabecera.
  const placesKey = Object.keys(row).find((key) => key.trim() === 'Total de plazas');
  const places = Number((placesKey !== undefined ? row[placesKey] : '')?.trim());
  return {
    id: `clm-${sha256(`${municipality.cityId}|${name}|${addressText}`.toLocaleLowerCase('es')).slice(0, 16)}`,
    registrationCode: '',
    licenseKey: '',
    name,
    addressText,
    street: normalizeStreet(addressText.split(',')[0] ?? addressText),
    number: normalizeStreetNumber(extractStreetNumber(addressText)),
    postalCode: (row['Código Postal Establecimiento'] ?? '').trim(),
    municipality: municipality.name,
    cityId: municipality.cityId,
    entire: true,
    places: Number.isFinite(places) && places > 0 ? places : 0,
    latitude: null,
    longitude: null,
  };
}
