import { normalizeStreet, normalizeStreetNumber } from './address.js';
import {
  coordinatesPlausibleForMunicipality,
  extractStreetNumber,
  normalizeLicenseKey,
  type OfficialVutRecord,
} from './openrta.js';

/**
 * Registro General Turístico de Canarias — «viviendas vacacionales»
 * (Gobierno de Canarias, datos.canarias.es). El CSV diario publica las
 * ~72k VV con coordenadas WGS84 en el 100% de filas, signatura estable
 * (`A-38-4-0000685`), dirección, municipio, dormitorios y plazas. El
 * marcador `_U` significa «no consta».
 */

export interface CanariasMunicipality {
  /** Valor EXACTO de `direccion_municipio_nombre` en el CSV (ojo:
   * «Santa Cruz Tenerife» viene sin «De» y «San Bartolome» sin tilde). */
  sourceName: string;
  /** Nombre para mostrar y para el radio de plausibilidad. */
  name: string;
  cityId: string;
}

export const CANARIAS_MUNICIPALITIES: readonly CanariasMunicipality[] = [
  { sourceName: 'Arona', name: 'ARONA', cityId: 'arona' },
  { sourceName: 'Adeje', name: 'ADEJE', cityId: 'adeje' },
  { sourceName: 'La Oliva', name: 'LA OLIVA', cityId: 'la-oliva' },
  {
    sourceName: 'Las Palmas De Gran Canaria',
    name: 'LAS PALMAS DE GRAN CANARIA',
    cityId: 'las-palmas-de-gran-canaria',
  },
  {
    sourceName: 'San Bartolome De Tirajana',
    name: 'SAN BARTOLOMÉ DE TIRAJANA',
    cityId: 'san-bartolome-de-tirajana',
  },
  { sourceName: 'Mogan', name: 'MOGÁN', cityId: 'mogan' },
  { sourceName: 'Yaiza', name: 'YAIZA', cityId: 'yaiza' },
  { sourceName: 'Tias', name: 'TÍAS', cityId: 'tias' },
  {
    sourceName: 'Santa Cruz Tenerife',
    name: 'SANTA CRUZ DE TENERIFE',
    cityId: 'santa-cruz-de-tenerife',
  },
];

const NOT_AVAILABLE = '_U';

function text(value: string | undefined): string {
  const trimmed = (value ?? '').trim();
  return trimmed === NOT_AVAILABLE ? '' : trimmed;
}

/**
 * Fila del CSV canario → registro del espejo; null si no es utilizable.
 * Toda «vivienda vacacional» canaria es la vivienda completa (Decreto
 * 113/2015), así que no hay modalidad por habitaciones.
 */
export function parseCanariasRow(
  row: Record<string, string>,
  municipality: CanariasMunicipality,
): OfficialVutRecord | null {
  const signatura = text(row.establecimiento_id);
  if (signatura.length === 0) return null;
  const addressText = text(row.direccion);
  const latitude = Number(text(row.latitud));
  const longitude = Number(text(row.longitud));
  // ~30% de fichas traen (0,0) — la isla nula: se tratan como sin ubicar y
  // los carriles de geocodificación las resuelven por dirección.
  const plausible =
    Number.isFinite(latitude) &&
    Number.isFinite(longitude) &&
    !(latitude === 0 && longitude === 0) &&
    coordinatesPlausibleForMunicipality(municipality.name, latitude, longitude);
  const places = Number(text(row.plazas));
  return {
    id: `can-${signatura.replace(/[^A-Za-z0-9-]/gu, '-')}`,
    registrationCode: signatura,
    licenseKey: normalizeLicenseKey(signatura),
    name: text(row.establecimiento_nombre_comercial),
    addressText,
    street: normalizeStreet(addressText),
    number: normalizeStreetNumber(extractStreetNumber(addressText)),
    postalCode: text(row.direccion_codigo_postal),
    municipality: municipality.name,
    cityId: municipality.cityId,
    entire: true,
    places: Number.isFinite(places) && places > 0 ? places : 0,
    latitude: plausible ? latitude : null,
    longitude: plausible ? longitude : null,
  };
}
