import { normalizeComparable, normalizeStreet, normalizeStreetNumber } from './address.js';
import { sha256 } from './crypto.js';
import { extractStreetNumber, type OfficialVutRecord } from './openrta.js';

/**
 * The Comunidad de Madrid publishes «declaraciones responsables» of tourist
 * dwellings (CC BY 4.0) with no registry id, no places, no coordinates and
 * two CSV schemas: the 2025 files carry one free-text address column, the
 * 2026 ones structured fields. Identity is synthesized from the normalized
 * address (street + number + unit detail), which also deduplicates the same
 * dwelling re-declared across months.
 */

const MADRID_MUNICIPALITY = 'MADRID';

function syntheticId(street: string, number: string, detail: string): string {
  const key = `${normalizeComparable(street)}|${normalizeStreetNumber(number)}|${normalizeComparable(detail)}`;
  return `mad-${sha256(key).slice(0, 16)}`;
}

function buildRecord(
  street: string,
  number: string,
  detail: string,
  addressText: string,
): OfficialVutRecord {
  return {
    id: syntheticId(street, number, detail),
    // The open dataset publishes no registry code: the sheet hides the row.
    registrationCode: '',
    licenseKey: '',
    name: '',
    addressText,
    street: normalizeStreet(street),
    number: normalizeStreetNumber(number),
    postalCode: '',
    municipality: MADRID_MUNICIPALITY,
    cityId: 'madrid',
    entire: true,
    places: 0,
    latitude: null,
    longitude: null,
  };
}

/** 2026 schema: TipoAlojamiento;TipoVia;NombreVia;Numero;…;Localidad. */
export function parseMadridStructuredRow(row: Record<string, string>): OfficialVutRecord | null {
  if ((row.TipoAlojamiento ?? '').trim() !== 'VT') return null;
  if (normalizeComparable(row.Localidad ?? '') !== 'madrid') return null;
  const roadType = (row.TipoVia ?? '').trim();
  const roadName = (row.NombreVia ?? '').trim();
  if (roadName.length === 0) return null;
  const number = (row.Numero ?? '').trim();
  const street = [roadType, roadName].filter((part) => part.length > 0).join(' ');
  const detailParts = [
    ['portal', row.Portal],
    ['bloque', row.Bloque],
    ['esc.', row.Escalera],
    ['planta', row.Planta],
    ['puerta', row.Puerta],
  ]
    .map(([label, value]) =>
      (value ?? '').trim().length > 0 ? `${label} ${(value ?? '').trim()}` : '',
    )
    .filter((part) => part.length > 0);
  const detail = detailParts.join(', ');
  const addressText =
    `${street}${number.length > 0 ? `, ${number}` : ''}${detail.length > 0 ? ` (${detail})` : ''}`.trim();
  return buildRecord(street, number, detail, addressText);
}

/** 2025 schema: ALOJAMIENTO;DIRECCION_VT;MUNICIPIO (free-text address). */
export function parseMadridLegacyRow(row: Record<string, string>): OfficialVutRecord | null {
  if (!(row.ALOJAMIENTO ?? '').trim().toLocaleUpperCase('es').startsWith('VIVIENDA USO TUR')) {
    return null;
  }
  if (normalizeComparable(row.MUNICIPIO ?? '') !== 'madrid') return null;
  const direccion = (row.DIRECCION_VT ?? '').trim();
  if (direccion.length === 0) return null;
  // 'C/ LUIS DE ASTRANA MARIN, Nº 8, P01, A' → street / number / unit tail.
  const commaIndex = direccion.indexOf(',');
  const street = (commaIndex === -1 ? direccion : direccion.slice(0, commaIndex)).trim();
  const number = extractStreetNumber(direccion);
  const tail = commaIndex === -1 ? '' : direccion.slice(commaIndex + 1);
  const detail = tail
    .replace(/N[ºo°]?\s*\.?\s*\d+[A-Za-z]?/iu, '')
    .replace(/^[\s,]+|[\s,]+$/gu, '')
    .replace(/\s*,\s*/gu, ', ');
  const addressText =
    `${street}${number.length > 0 ? `, ${number}` : ''}${detail.length > 0 ? ` (${detail})` : ''}`.trim();
  return buildRecord(street, number, detail, addressText);
}

/** Routes a parsed CSV row to the schema it belongs to. */
export function parseMadridRow(row: Record<string, string>): OfficialVutRecord | null {
  if ('DIRECCION_VT' in row || 'ALOJAMIENTO' in row) return parseMadridLegacyRow(row);
  return parseMadridStructuredRow(row);
}
