import { normalizeStreet, normalizeStreetNumber, slugifyCity } from './address.js';
import {
  coordinatesPlausibleForMunicipality,
  normalizeLicenseKey,
  type OfficialVutRecord,
} from './openrta.js';

/** Socrata values in `tipus_establiment` for the two kinds we mirror. */
export const CAT_ENTIRE_TYPE = "Habitatges d'ús turístic";
export const CAT_SHARED_TYPE = 'Llars compartides';

export interface CatCoordinates {
  latitude: number;
  longitude: number;
}

/**
 * Minimal RFC-4180 CSV parser (quoted fields, embedded commas/quotes/newlines).
 * Enough for the Ajuntament de Barcelona export; no external dependency.
 */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (inQuotes) {
      if (char === '"') {
        if (text[index + 1] === '"') {
          field += '"';
          index += 1;
        } else {
          inQuotes = false;
        }
      } else {
        field += char;
      }
      continue;
    }
    if (char === '"') {
      inQuotes = true;
    } else if (char === ',') {
      row.push(field);
      field = '';
    } else if (char === '\n' || char === '\r') {
      if (char === '\r' && text[index + 1] === '\n') index += 1;
      row.push(field);
      field = '';
      if (row.length > 1 || row[0] !== '') rows.push(row);
      row = [];
    } else {
      field += char;
    }
  }
  row.push(field);
  if (row.length > 1 || row[0] !== '') rows.push(row);
  return rows;
}

/**
 * Coordinates per registry code from the Ajuntament de Barcelona weekly
 * dataset («Viviendas de uso turístico de la ciudad de Barcelona», CC BY 4.0).
 * Column names despite appearances: LONGITUD_X is the longitude and
 * LATITUD_Y the latitude, already in WGS84.
 */
export function buildBarcelonaCoordinates(csvText: string): Map<string, CatCoordinates> {
  const rows = parseCsv(csvText.replace(/^\uFEFF/u, ''));
  const header = rows[0] ?? [];
  const codeIndex = header.indexOf('NUMERO_REGISTRE_GENERALITAT');
  const longitudeIndex = header.indexOf('LONGITUD_X');
  const latitudeIndex = header.indexOf('LATITUD_Y');
  const coordinates = new Map<string, CatCoordinates>();
  if (codeIndex === -1 || longitudeIndex === -1 || latitudeIndex === -1) return coordinates;
  for (const row of rows.slice(1)) {
    const code = normalizeLicenseKey(row[codeIndex] ?? '');
    const longitude = Number(row[longitudeIndex]);
    const latitude = Number(row[latitudeIndex]);
    if (code.length === 0 || !Number.isFinite(latitude) || !Number.isFinite(longitude)) continue;
    // Sanity: inside the Spanish bounding box, like the UTM conversions.
    if (latitude < 27.4 || latitude > 44.2 || longitude < -18.5 || longitude > 4.5) continue;
    coordinates.set(code, { latitude, longitude });
  }
  return coordinates;
}

function asText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

/**
 * Maps a Registre de Turisme de Catalunya row (Socrata t2h3-cgys) to our
 * record; null if unusable. Coordinates come from the city-hall join — rows
 * without a match stay null and enter the shared geocoding repair.
 */
export function parseCatRecord(
  raw: Record<string, unknown>,
  coordinatesByCode: ReadonlyMap<string, CatCoordinates>,
): OfficialVutRecord | null {
  const registrationCode = asText(raw.n_mero_inscripci);
  const municipality = asText(raw.municipi).toLocaleUpperCase('es');
  const type = asText(raw.tipus_establiment);
  if (registrationCode.length === 0 || municipality.length === 0) return null;
  if (type !== CAT_ENTIRE_TYPE && type !== CAT_SHARED_TYPE) return null;
  const roadType = asText(raw.tipus_de_via);
  const roadName = asText(raw.nom_de_la_via);
  const rawNumber = asText(raw.numero);
  const number = rawNumber.toLocaleUpperCase('es') === 'SN' ? '' : rawNumber;
  const floor = asText(raw.pis);
  const door = asText(raw.porta);
  const detail = [floor.length > 0 ? `pis ${floor}` : '', door.length > 0 ? `porta ${door}` : '']
    .filter((part) => part.length > 0)
    .join(', ');
  const road = [roadType, roadName].filter((part) => part.length > 0).join(' ');
  const addressText =
    `${road}${number.length > 0 ? `, ${number}` : ''}${detail.length > 0 ? ` (${detail})` : ''}`.trim();
  const licenseKey = normalizeLicenseKey(registrationCode);
  const located = coordinatesByCode.get(licenseKey) ?? null;
  const coordinates =
    located !== null &&
    coordinatesPlausibleForMunicipality(municipality, located.latitude, located.longitude)
      ? located
      : null;
  const name = asText(raw.r_tol);
  const places = Number(raw.total_places);
  return {
    id: `cat-${licenseKey}`,
    registrationCode,
    licenseKey,
    name: name === 'Sense especificar' ? '' : name,
    addressText,
    street: normalizeStreet(road.length > 0 ? road : addressText),
    number: normalizeStreetNumber(number),
    postalCode: asText(raw.codi_postal),
    municipality,
    cityId: slugifyCity(municipality),
    entire: type === CAT_ENTIRE_TYPE,
    places: Number.isFinite(places) && places > 0 ? places : 0,
    latitude: coordinates?.latitude ?? null,
    longitude: coordinates?.longitude ?? null,
  };
}
