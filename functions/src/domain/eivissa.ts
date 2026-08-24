import { normalizeStreet, normalizeStreetNumber } from './address.js';
import { sha256 } from './crypto.js';
import {
  extractStreetNumber,
  normalizeLicenseKey,
  sanitizePublicName,
  type OfficialVutRecord,
} from './openrta.js';

/**
 * Portal de Registres Turístics del Consell Insular d'Eivissa: export vivo
 * (tabla HTML servida como .xls, ISO-8859-1) con las cuatro figuras de
 * vivienda de la isla — Estancia Turística (Vacacional) y Vivienda Turística
 * (Vacacional) —, todas cesión de la vivienda completa. Sin coordenadas,
 * pero con referencia catastral en el ~98,5% de filas: la ubicación se
 * resuelve por el carril gratuito del Catastro. El titular («Explotador»,
 * con NIF), el teléfono y el email se descartan en la ingesta.
 */

export interface EivissaMunicipality {
  /** Valor exacto de la columna Municipi del export. */
  sourceName: string;
  /** Nombre para mostrar y para el radio de plausibilidad. */
  name: string;
  cityId: string;
}

export const EIVISSA_MUNICIPALITIES: readonly EivissaMunicipality[] = [
  {
    sourceName: 'SANT JOSEP DE SA TALAIA',
    name: 'SANT JOSEP DE SA TALAIA',
    cityId: 'sant-josep-de-sa-talaia',
  },
  {
    sourceName: 'SANTA EULARIA DES RIU',
    name: 'SANTA EULÀRIA DES RIU',
    cityId: 'santa-eularia-des-riu',
  },
  {
    sourceName: 'SANT ANTONI DE PORTMANY',
    name: 'SANT ANTONI DE PORTMANY',
    cityId: 'sant-antoni-de-portmany',
  },
  {
    sourceName: 'SANT JOAN DE LABRITJA',
    name: 'SANT JOAN DE LABRITJA',
    cityId: 'sant-joan-de-labritja',
  },
  { sourceName: 'EIVISSA', name: 'EIVISSA', cityId: 'eivissa' },
];

/** Fila del export ibicenco, ya como celdas de texto plano. */
export interface EivissaRow {
  subTipus: string;
  numeroInscripcio: string;
  nomComercial: string;
  totalPlaces: string;
  referenciaCadastral: string;
  direccio: string;
  municipi: string;
}

/** Figuras del export que son viviendas cedidas completas. El export de
 * habitatges turístics no incluye comercializadores ni mediadores (van en
 * otras categorías del portal), pero la lista cerrada protege de que un día
 * los mezclen. */
const EIVISSA_DWELLING_SUBTYPES = new Set([
  'Estancia Turística Vacacional',
  'Estancia Turística',
  'Vivienda Turística Vacacional',
  'Vivienda Turística',
]);

/** El export rellena huecos con una pseudo-fila «NUEVO BOLSA DE PLAZAS»
 * (sin municipio real, número «#» y 0 plazas): nunca es una vivienda. */
export function isEivissaGhostRow(row: EivissaRow): boolean {
  return row.municipi === 'NUEVO BOLSA DE PLAZAS' || row.numeroInscripcio.replace(/#/gu, '') === '';
}

/** Código postal balear dentro de la dirección («… - 07820 SANT ANTONI…»). */
function extractPostalCode(address: string): string {
  const match = /\b(07\d{3})\b/u.exec(address);
  return match?.[1] ?? '';
}

/**
 * Fila del export → registro del espejo; null si no es una vivienda del
 * municipio pedido. El número de inscripción llega con «#» inicial y se
 * repite en algunas fincas: la dirección desambigua, como en Menorca.
 */
export function parseEivissaRow(
  row: EivissaRow,
  municipality: EivissaMunicipality,
): OfficialVutRecord | null {
  if (isEivissaGhostRow(row)) return null;
  if (row.municipi !== municipality.sourceName) return null;
  if (!EIVISSA_DWELLING_SUBTYPES.has(row.subTipus)) return null;

  const registrationCode = row.numeroInscripcio.replace(/^#/u, '').trim();
  if (registrationCode.length === 0) return null;
  const addressText = row.direccio.replace(/\s+/gu, ' ').trim();
  const places = Number(row.totalPlaces);
  const cadastralRef = row.referenciaCadastral.trim().toLocaleUpperCase('es');

  return {
    id: `eiv-${registrationCode.replace(/[^A-Za-z0-9-]/gu, '-')}-${sha256(addressText).slice(0, 8)}`,
    registrationCode,
    licenseKey: normalizeLicenseKey(registrationCode),
    name: sanitizePublicName(row.nomComercial),
    addressText,
    street: normalizeStreet(addressText.split(/[,;]/u)[0] ?? addressText),
    number: normalizeStreetNumber(extractStreetNumber(addressText)),
    postalCode: extractPostalCode(addressText),
    municipality: municipality.name,
    cityId: municipality.cityId,
    entire: true,
    places: Number.isFinite(places) && places > 0 ? places : 0,
    ...(cadastralRef.length >= 14 ? { cadastralRef } : {}),
    latitude: null,
    longitude: null,
  };
}
