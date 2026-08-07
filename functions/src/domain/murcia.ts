import { normalizeStreet, normalizeStreetNumber } from './address.js';
import {
  extractStreetNumber,
  normalizeLicenseKey,
  sanitizePublicName,
  type OfficialVutRecord,
} from './openrta.js';

/**
 * Registro de empresas y actividades turísticas de la Región de Murcia
 * (ITREM) — «viviendas vacacionales». El export público es una tabla HTML
 * servida con extensión .xls (ISO-8859-1) con número de registro estable
 * (`VV.MU.6935-1`), dirección, localidad, plazas y referencia catastral en
 * ~72% de filas — el carril del Catastro resuelve esas gratis.
 */

export interface MurciaMunicipality {
  /** Municipio base del campo LOCALIDAD («CARTAGENA (LA MANGA)» → «CARTAGENA»). */
  sourceName: string;
  /** Nombre para mostrar y para el radio de plausibilidad. */
  name: string;
  cityId: string;
}

export const MURCIA_MUNICIPALITIES: readonly MurciaMunicipality[] = [
  { sourceName: 'CARTAGENA', name: 'CARTAGENA', cityId: 'cartagena' },
  { sourceName: 'SAN JAVIER', name: 'SAN JAVIER', cityId: 'san-javier' },
  { sourceName: 'TORRE PACHECO', name: 'TORRE-PACHECO', cityId: 'torre-pacheco' },
  { sourceName: 'MURCIA', name: 'MURCIA', cityId: 'murcia' },
  { sourceName: 'MAZARRÓN', name: 'MAZARRÓN', cityId: 'mazarron' },
  { sourceName: 'LOS ALCÁZARES', name: 'LOS ALCÁZARES', cityId: 'los-alcazares' },
  {
    sourceName: 'SAN PEDRO DEL PINATAR',
    name: 'SAN PEDRO DEL PINATAR',
    cityId: 'san-pedro-del-pinatar',
  },
  { sourceName: 'ÁGUILAS', name: 'ÁGUILAS', cityId: 'aguilas' },
];

/** «CARTAGENA (LA MANGA DEL MAR MENOR)» → «CARTAGENA». */
export function murciaBaseLocality(locality: string): string {
  return locality.replace(/\s*\(.*$/u, '').trim();
}

/** Referencias catastrales de finca o inmueble (14 o 20 caracteres). */
const CADASTRAL_PATTERN = /^[0-9A-Z]{14}(?:[0-9A-Z]{6})?$/u;

export interface MurciaRow {
  signatura: string;
  direccion: string;
  localidad: string;
  codigoPostal: string;
  plazas: string;
  referenciaCatastral: string;
  nombreComercial: string;
}

/**
 * Fila del listado del ITREM → registro del espejo; null si no es
 * utilizable. Toda vivienda vacacional murciana se cede completa (Decreto
 * 256/2019), así que no hay modalidad por habitaciones. La fuente no trae
 * coordenadas: la referencia catastral (Catastro) y la dirección
 * (CartoCiudad/Geocoding) las resuelven en pasadas.
 */
export function parseMurciaRow(
  row: MurciaRow,
  municipality: MurciaMunicipality,
): OfficialVutRecord | null {
  const signatura = row.signatura.trim();
  if (signatura.length === 0) return null;
  // «CL REAL DE PAVOS - Nº 16 - PISO 0 -» → sin el guion colgante final.
  const addressText = row.direccion.replace(/[\s-]+$/u, '').trim();
  const cadastral = row.referenciaCatastral.trim().toLocaleUpperCase('es');
  const places = Number(row.plazas.trim());
  const record: OfficialVutRecord = {
    id: `mur-${signatura.replace(/[^A-Za-z0-9-]/gu, '-')}`,
    registrationCode: signatura,
    licenseKey: normalizeLicenseKey(signatura),
    name: sanitizePublicName(row.nombreComercial),
    addressText,
    street: normalizeStreet(addressText.split(' - ')[0] ?? addressText),
    number: normalizeStreetNumber(extractStreetNumber(addressText)),
    postalCode: row.codigoPostal.trim(),
    municipality: municipality.name,
    cityId: municipality.cityId,
    entire: true,
    places: Number.isFinite(places) && places > 0 ? places : 0,
    latitude: null,
    longitude: null,
  };
  if (CADASTRAL_PATTERN.test(cadastral)) record.cadastralRef = cadastral;
  return record;
}
