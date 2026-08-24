import { normalizeComparable, normalizeStreet, normalizeStreetNumber } from './address.js';
import { sha256 } from './crypto.js';
import {
  coordinatesPlausibleForMunicipality,
  sanitizePublicName,
  type OfficialVutRecord,
} from './openrta.js';

/**
 * Capa «Viviendas Turísticas» del servicio ArcGIS REST oficial de Cantabria
 * (geoservicios.cantabria.es, datos de la Dirección General de Turismo,
 * licencia de uso no comercial del Decreto 87/2013). Geometría nativa (el
 * servidor reproyecta a WGS84), plazas y modalidad separable (ALQUILER
 * COMPLETO / COMPARTIDO), pero SIN número de registro utilizable (el campo
 * `signatura` es literalmente «VUT»): la identidad se sintetiza de la
 * dirección, como en Madrid. El teléfono, el email y la web del titular se
 * descartan en la ingesta.
 */

export interface CantabriaMunicipality {
  /** Código del campo `municipio` de la capa (3 últimos dígitos del INE). */
  code: string;
  /** Nombre para mostrar y para el radio de plausibilidad. */
  name: string;
  cityId: string;
}

export const CANTABRIA_MUNICIPALITIES: readonly CantabriaMunicipality[] = [
  { code: '085', name: 'SUANCES', cityId: 'suances' },
  { code: '080', name: 'SAN VICENTE DE LA BARQUERA', cityId: 'san-vicente-de-la-barquera' },
  { code: '044', name: 'MIENGO', cityId: 'miengo' },
  { code: '052', name: 'PIÉLAGOS', cityId: 'pielagos' },
  { code: '035', name: 'LAREDO', cityId: 'laredo' },
  { code: '024', name: 'COMILLAS', cityId: 'comillas' },
  { code: '075', name: 'SANTANDER', cityId: 'santander' },
  { code: '061', name: 'RIBAMONTÁN AL MAR', cityId: 'ribamontan-al-mar' },
  { code: '047', name: 'NOJA', cityId: 'noja' },
  { code: '076', name: 'SANTILLANA DEL MAR', cityId: 'santillana-del-mar' },
  { code: '020', name: 'CASTRO-URDIALES', cityId: 'castro-urdiales' },
  { code: '087', name: 'TORRELAVEGA', cityId: 'torrelavega' },
];

/** Feature de la capa 3 del MapServer, ya como JSON. */
export interface CantabriaFeature {
  attributes?: Record<string, unknown> | null;
  geometry?: { x?: unknown; y?: unknown } | null;
}

/** Modalidades de la capa: lista cerrada para que una figura nueva no entre
 * en el recuento sin pasar por revisión. */
const ENTIRE_MODALITY = 'ALQUILER COMPLETO';
const SHARED_MODALITY = 'ALQUILER COMPARTIDO';

function asText(value: unknown): string {
  if (typeof value === 'number') return String(value);
  return typeof value === 'string' ? value.trim() : '';
}

/**
 * Feature de la capa → registro del espejo; null si no pertenece al
 * municipio pedido o su modalidad no es una de las dos conocidas. Sin número
 * de registro estable, la identidad se deriva de municipio + dirección
 * normalizada: una corrección de dirección aparece como alta más baja (el
 * mismo coste conocido de Madrid y CLM).
 */
export function parseCantabriaFeature(
  feature: CantabriaFeature,
  municipality: CantabriaMunicipality,
): OfficialVutRecord | null {
  const attributes = feature.attributes ?? {};
  if (asText(attributes.municipio) !== municipality.code) return null;
  const modalidad = asText(attributes.modalidad);
  if (modalidad !== ENTIRE_MODALITY && modalidad !== SHARED_MODALITY) return null;

  const streetName = asText(attributes.nombre_via);
  if (streetName.length === 0) return null;
  const number = asText(attributes.numero);
  const detailParts = [
    ['bloque', attributes.bloque],
    ['esc.', attributes.escalera],
    ['piso', attributes.piso],
    ['puerta', attributes.puerta],
  ]
    .map(([label, value]) => (asText(value).length > 0 ? `${String(label)} ${asText(value)}` : ''))
    .filter((part) => part.length > 0);
  const detail = detailParts.join(', ');
  const addressText =
    `${streetName}${number.length > 0 ? `, ${number}` : ''}${detail.length > 0 ? ` (${detail})` : ''}`.trim();

  let latitude: number | null = null;
  let longitude: number | null = null;
  const x = Number(feature.geometry?.x);
  const y = Number(feature.geometry?.y);
  if (
    Number.isFinite(x) &&
    Number.isFinite(y) &&
    coordinatesPlausibleForMunicipality(municipality.name, y, x)
  ) {
    latitude = y;
    longitude = x;
  }

  const places = Number(attributes.num_plazas);
  const identity = `${municipality.code}|${normalizeComparable(streetName)}|${normalizeStreetNumber(number)}|${normalizeComparable(detail)}`;
  return {
    id: `cnt-${sha256(identity).slice(0, 16)}`,
    // La capa no publica el número de registro real (signatura = «VUT»).
    registrationCode: '',
    licenseKey: '',
    name: sanitizePublicName(asText(attributes.nombre)),
    addressText,
    street: normalizeStreet(streetName),
    number: normalizeStreetNumber(number),
    postalCode: asText(attributes.cpostal),
    municipality: municipality.name,
    cityId: municipality.cityId,
    entire: modalidad === ENTIRE_MODALITY,
    places: Number.isFinite(places) && places > 0 ? places : 0,
    latitude,
    longitude,
  };
}
