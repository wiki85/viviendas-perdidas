import { normalizeStreet, normalizeStreetNumber } from './address.js';
import { sha256 } from './crypto.js';
import {
  coordinatesPlausibleForMunicipality,
  extractStreetNumber,
  normalizeLicenseKey,
  sanitizePublicName,
  type OfficialVutRecord,
} from './openrta.js';

/**
 * Registre d'estades turístiques i habitatges turístics de vacances de
 * Menorca (Consell Insular, vía catálogo CAIB, CC BY). GeoJSON con el 100%
 * de puntos georreferenciados, número de registro, dirección y plazas. El
 * esquema es DISTINTO al de Mallorca: tipus ESTADES / HABITATGE TURÍSTIC DE
 * VACANCES, sin grupos ETV y con claves en minúscula.
 */

export interface MenorcaMunicipality {
  /** Valor de `poblacio` en el GeoJSON (ojo: hay valores con espacio final). */
  sourceName: string;
  /** Nombre para mostrar y para el radio de plausibilidad. */
  name: string;
  cityId: string;
}

export const MENORCA_MUNICIPALITIES: readonly MenorcaMunicipality[] = [
  { sourceName: 'CIUTADELLA', name: 'CIUTADELLA', cityId: 'ciutadella' },
  { sourceName: 'SANT LLUÍS', name: 'SANT LLUÍS', cityId: 'sant-lluis' },
  { sourceName: 'ES MERCADAL', name: 'ES MERCADAL', cityId: 'es-mercadal' },
  { sourceName: 'ALAIOR', name: 'ALAIOR', cityId: 'alaior' },
  { sourceName: 'MAÓ', name: 'MAÓ', cityId: 'mao' },
];

interface GeoJsonFeature {
  properties?: Record<string, unknown> | null;
  geometry?: { coordinates?: unknown } | null;
}

function asText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

/**
 * Punto del registro menorquín → registro del espejo; null si no pertenece
 * al municipio pedido. Ambas figuras insulares (estades turístiques y
 * habitatge turístic de vacances) ceden la vivienda completa, así que no hay
 * modalidad por habitaciones. El teléfono del titular se descarta: no se
 * espeja nunca.
 */
export function parseMenorcaFeature(
  feature: GeoJsonFeature,
  municipality: MenorcaMunicipality,
): OfficialVutRecord | null {
  const properties = feature.properties ?? {};
  const registre = asText(properties.registre);
  if (registre.length === 0) return null;
  if (asText(properties.poblacio) !== municipality.sourceName) return null;

  const addressText = asText(properties.domicili).replace(/\s+/gu, ' ');
  const rawCoordinates = feature.geometry?.coordinates;
  let latitude: number | null = null;
  let longitude: number | null = null;
  if (Array.isArray(rawCoordinates)) {
    const lng = Number(rawCoordinates[0]);
    const lat = Number(rawCoordinates[1]);
    if (
      Number.isFinite(lat) &&
      Number.isFinite(lng) &&
      coordinatesPlausibleForMunicipality(municipality.name, lat, lng)
    ) {
      latitude = lat;
      longitude = lng;
    }
  }

  const places = Number(properties.nombreplaces);
  return {
    // El número de registro se repite en fincas con varias viviendas: la
    // dirección desambigua sin depender del orden del volcado.
    id: `men-${registre.replace(/[^A-Za-z0-9-]/gu, '-')}-${sha256(addressText).slice(0, 8)}`,
    registrationCode: registre,
    licenseKey: normalizeLicenseKey(registre),
    name: sanitizePublicName(asText(properties.nom)),
    addressText,
    street: normalizeStreet(addressText.split(',')[0] ?? addressText),
    number: normalizeStreetNumber(extractStreetNumber(addressText)),
    postalCode: '',
    municipality: municipality.name,
    cityId: municipality.cityId,
    entire: true,
    places: Number.isFinite(places) && places > 0 ? places : 0,
    latitude,
    longitude,
  };
}
