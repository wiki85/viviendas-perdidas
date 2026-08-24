import { normalizeStreet, normalizeStreetNumber } from './address.js';
import {
  estimateApartmentUnits,
  normalizeLicenseKey,
  sanitizePublicName,
  type OfficialVutRecord,
} from './openrta.js';

/**
 * Dataset «Alojamientos turísticos» del CKAN municipal de Avilés (CC BY):
 * extracto del REAT asturiano con signatura oficial, plazas y referencia
 * catastral. Se espejan las figuras de vivienda por el PREFIJO de la
 * signatura — VUT. (viviendas de uso turístico), VV. (viviendas
 * vacacionales) y AT. (apartamentos turísticos, edificios contados por sus
 * apartamentos estimados por capacidad) —, inmune a los renombres de la
 * columna de tipo. El titular se descarta en la ingesta.
 */

export const AVILES_MUNICIPALITY = {
  sourceName: 'AVILES',
  name: 'AVILÉS',
  cityId: 'aviles',
} as const;

/** Fila del datastore CKAN. */
export type AvilesRow = Record<string, unknown>;

function asText(value: unknown): string {
  if (typeof value === 'number') return String(value);
  // El CKAN avilesino cuela NBSP dentro de los valores.
  return typeof value === 'string' ? value.replace(/\u00a0/gu, ' ').trim() : '';
}

/**
 * Fila del datastore → registro del espejo; null si no es una figura de
 * vivienda vigente del municipio.
 */
export function parseAvilesRow(row: AvilesRow): OfficialVutRecord | null {
  if (asText(row.Estado) !== 'VIGENTE') return null;
  if (asText(row.Municipio) !== AVILES_MUNICIPALITY.sourceName) return null;
  const signatura = asText(row.Signatura);
  const isApartmentBuilding = signatura.startsWith('AT.');
  if (!signatura.startsWith('VUT.') && !signatura.startsWith('VV.') && !isApartmentBuilding) {
    return null;
  }

  const street = asText(row.Domicilio);
  if (street.length === 0) return null;
  const number = asText(row.Numero);
  const detailParts = [
    ['bloque', row.Bloque],
    ['esc.', row.Escalera],
    ['piso', row.Piso],
    ['puerta', row.Puerta],
  ]
    .map(([label, value]) => (asText(value).length > 0 ? `${String(label)} ${asText(value)}` : ''))
    .filter((part) => part.length > 0);
  const detail = detailParts.join(', ');
  const addressText =
    `${street}${number.length > 0 ? `, ${number}` : ''}${detail.length > 0 ? ` (${detail})` : ''}`.trim();

  const places = Number(asText(row.Plazas));
  const safePlaces = Number.isFinite(places) && places > 0 ? places : 0;
  const cadastralRef = asText(row['Ref. Catastral']).toLocaleUpperCase('es');
  return {
    id: `avi-${signatura.replace(/[^A-Za-z0-9-]/gu, '-')}`,
    registrationCode: signatura,
    licenseKey: normalizeLicenseKey(signatura),
    name: sanitizePublicName(asText(row['Nombre Comercial'])),
    addressText,
    street: normalizeStreet(street),
    number: normalizeStreetNumber(number),
    postalCode: asText(row.CP),
    municipality: AVILES_MUNICIPALITY.name,
    cityId: AVILES_MUNICIPALITY.cityId,
    entire: true,
    places: safePlaces,
    // Un bloque de apartamentos cuenta sus apartamentos, estimados por su
    // capacidad; las viviendas sueltas siguen contando 1.
    ...(isApartmentBuilding && estimateApartmentUnits(safePlaces) > 1
      ? { units: estimateApartmentUnits(safePlaces) }
      : {}),
    ...(cadastralRef.length >= 14 ? { cadastralRef } : {}),
    latitude: null,
    longitude: null,
  };
}
