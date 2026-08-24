import { normalizeStreet, normalizeStreetNumber } from './address.js';
import { coordinatesPlausibleForMunicipality, type OfficialVutRecord } from './openrta.js';

/**
 * Visor municipal de viviendas de uso turístico con licencia urbanística del
 * Ayuntamiento de Gijón (Urbanismo/PGO): GeoJSON con el 100% de puntos en
 * WGS84, expediente único estable y referencia catastral en el ~99,8%. El
 * Principado no publica el REAT, así que este visor es hoy la única fuente
 * oficial per-vivienda de la ciudad. El interesado (titular) y el enlace al
 * expediente interno se descartan en la ingesta. Sin plazas.
 */

export const GIJON_MUNICIPALITY = { sourceName: 'GIJÓN', name: 'GIJÓN', cityId: 'gijon' } as const;

/** Feature del GeoJSON embebido del visor qgis2web. */
export interface GijonFeature {
  properties?: Record<string, unknown> | null;
  geometry?: { coordinates?: unknown } | null;
}

const GIJON_SUBTYPE = 'Vivienda de Uso Turistico';
const GIJON_LICENSED = 'CON LICENCIA';

function asText(value: unknown): string {
  if (typeof value === 'number') return String(value);
  return typeof value === 'string' ? value.trim() : '';
}

/**
 * Feature del visor → registro del espejo; null si no es una VUT con
 * licencia concedida. El expediente urbanístico hace de identificador
 * (único y persistente); no es un código del registro turístico, así que no
 * participa del cruce de licencias con los registros vecinales.
 */
export function parseGijonFeature(feature: GijonFeature): OfficialVutRecord | null {
  const properties = feature.properties ?? {};
  if (asText(properties.subtipolog) !== GIJON_SUBTYPE) return null;
  if (asText(properties.licencia) !== GIJON_LICENSED) return null;
  const expediente = asText(properties.expediente);
  if (expediente.length === 0) return null;

  const street = asText(properties.calle);
  const number = asText(properties.numero);
  const addressText = `${street}${number.length > 0 ? `, ${number}` : ''}`.trim();

  let latitude: number | null = null;
  let longitude: number | null = null;
  const rawCoordinates = feature.geometry?.coordinates;
  if (Array.isArray(rawCoordinates)) {
    const lng = Number(rawCoordinates[0]);
    const lat = Number(rawCoordinates[1]);
    if (
      Number.isFinite(lat) &&
      Number.isFinite(lng) &&
      coordinatesPlausibleForMunicipality(GIJON_MUNICIPALITY.name, lat, lng)
    ) {
      latitude = lat;
      longitude = lng;
    }
  }

  const cadastralRef = asText(properties.ref_catast).toLocaleUpperCase('es');
  return {
    id: `gij-${expediente.replace(/[^A-Za-z0-9-]/gu, '-')}`,
    registrationCode: expediente,
    licenseKey: '',
    name: '',
    addressText,
    street: normalizeStreet(street),
    number: normalizeStreetNumber(number),
    postalCode: '',
    municipality: GIJON_MUNICIPALITY.name,
    cityId: GIJON_MUNICIPALITY.cityId,
    entire: true,
    // El visor no publica plazas: Gijón queda fuera de las métricas de
    // capacidad.
    places: 0,
    ...(cadastralRef.length >= 14 ? { cadastralRef } : {}),
    latitude,
    longitude,
  };
}
