import { normalizeStreet, normalizeStreetNumber } from './address.js';
import {
  coordinatesPlausibleForMunicipality,
  estimateApartmentUnits,
  extractStreetNumber,
  normalizeLicenseKey,
  sanitizePublicName,
  type OfficialVutRecord,
} from './openrta.js';

/**
 * Directorio de alojamientos del REAT (Xunta de Galicia, Área de Estudos e
 * Investigación, CC BY-SA 4.0). CSV mensual con todo el registro de
 * alojamientos; se espejan las figuras de vivienda («VIVIENDAS USO
 * TURÍSTICO» y «VIVIENDAS TURÍSTICAS»), con número de registro
 * (`VUT-CO-003589`), dirección con número y plazas. Solo un puñado de filas
 * trae coordenadas: el resto se resuelve por dirección en pasadas.
 */

export interface GaliciaMunicipality {
  /** Valor exacto de `municipio` en el CSV (grafía oficial gallega). */
  sourceName: string;
  /** Nombre para mostrar y para el radio de plausibilidad. */
  name: string;
  cityId: string;
}

export const GALICIA_MUNICIPALITIES: readonly GaliciaMunicipality[] = [
  { sourceName: 'VIGO', name: 'VIGO', cityId: 'vigo' },
  { sourceName: 'A CORUÑA', name: 'A CORUÑA', cityId: 'a-coruna' },
  {
    sourceName: 'SANTIAGO DE COMPOSTELA',
    name: 'SANTIAGO DE COMPOSTELA',
    cityId: 'santiago-de-compostela',
  },
  { sourceName: 'SANXENXO', name: 'SANXENXO', cityId: 'sanxenxo' },
  { sourceName: 'O GROVE', name: 'O GROVE', cityId: 'o-grove' },
];

/** Figuras del REAT que son viviendas cedidas al turista (completas ambas). */
const GALICIA_DWELLING_TYPES = new Set(['VIVIENDAS USO TURÍSTICO', 'VIVIENDAS TURÍSTICAS']);

/** «APARTAMENTOS» son edificios/complejos completos de apartamentos
 * turísticos (separados de HOTELES en el directorio). El nº de apartamentos
 * no se publica; se estima por capacidad. */
const GALICIA_APARTMENT_TYPE = 'APARTAMENTOS';

export function isGaliciaDwellingType(tipo: string): boolean {
  const value = tipo.trim();
  return GALICIA_DWELLING_TYPES.has(value) || value === GALICIA_APARTMENT_TYPE;
}

/** «-8,07089» → -8.07089 (el CSV usa coma decimal); null si no es número. */
function parseGalicianCoordinate(value: string): number | null {
  const parsed = Number(value.trim().replace(',', '.'));
  return Number.isFinite(parsed) && parsed !== 0 ? parsed : null;
}

/**
 * Fila del directorio REAT → registro del espejo; null si no es utilizable.
 * El teléfono y el correo del anuncio se descartan aquí: nunca se espejan.
 */
export function parseGaliciaRow(
  row: Record<string, string>,
  municipality: GaliciaMunicipality,
): OfficialVutRecord | null {
  const signatura = (row.signatura ?? '').trim();
  if (signatura.length === 0) return null;
  if (!isGaliciaDwellingType(row.tipo ?? '')) return null;

  const direccion = (row.direccion ?? '').trim();
  const lugar = (row.lugar ?? '').trim();
  const parroquia = (row.parroquia ?? '').trim();
  // Las fichas rurales vienen sin calle: el lugar y la parroquia orientan al
  // geocodificador igual que orientarían a un cartero.
  const addressText =
    direccion.length > 0
      ? direccion
      : [lugar, parroquia].filter((part) => part.length > 0).join(', ');

  const latitude = parseGalicianCoordinate(row.latitud ?? '');
  const longitude = parseGalicianCoordinate(row.longitud ?? '');
  const plausible =
    latitude !== null &&
    longitude !== null &&
    coordinatesPlausibleForMunicipality(municipality.name, latitude, longitude);

  const places = Number((row.plazas ?? '').trim());
  const safePlaces = Number.isFinite(places) && places > 0 ? places : 0;
  const isApartmentBuilding = (row.tipo ?? '').trim() === GALICIA_APARTMENT_TYPE;
  return {
    id: `gal-${signatura.replace(/[^A-Za-z0-9-]/gu, '-')}`,
    registrationCode: signatura,
    licenseKey: normalizeLicenseKey(signatura),
    name: sanitizePublicName(row.denominacion ?? ''),
    addressText,
    street: normalizeStreet(addressText.split(',')[0] ?? addressText),
    number: normalizeStreetNumber(extractStreetNumber(addressText)),
    // Alguna ficha llega con un teléfono en la columna del CP: solo 5 dígitos.
    postalCode: /^\d{5}$/u.test((row.codigo_postal ?? '').trim())
      ? (row.codigo_postal ?? '').trim()
      : '',
    municipality: municipality.name,
    cityId: municipality.cityId,
    entire: true,
    places: safePlaces,
    // Un complejo de apartamentos cuenta sus apartamentos, estimados por su
    // capacidad; las viviendas sueltas siguen contando 1.
    ...(isApartmentBuilding && estimateApartmentUnits(safePlaces) > 1
      ? { units: estimateApartmentUnits(safePlaces) }
      : {}),
    latitude: plausible ? latitude : null,
    longitude: plausible ? longitude : null,
  };
}
