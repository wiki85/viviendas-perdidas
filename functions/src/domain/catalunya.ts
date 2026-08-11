import { normalizeStreet, normalizeStreetNumber, slugifyCity } from './address.js';
import { parseCsv } from './csv.js';
import {
  coordinatesPlausibleForMunicipality,
  estimateApartmentUnits,
  normalizeLicenseKey,
  type OfficialVutRecord,
} from './openrta.js';

/** Socrata values in `tipus_establiment` we mirror: viviendas completas,
 * hogares compartidos y los edificios de apartamentos turísticos (separados
 * de «Hotels» en el registro). */
export const CAT_ENTIRE_TYPE = "Habitatges d'ús turístic";
export const CAT_SHARED_TYPE = 'Llars compartides';
export const CAT_APARTMENT_TYPE = 'Apartaments Turístics';

export interface CatCityEntry {
  latitude: number;
  longitude: number;
  /** Licensed capacity from the city-hall dataset. The Generalitat register
   * only publishes `total_places` for ~24% of HUTs; the city covers 99,9%. */
  places: number;
}

/**
 * Coordinates and licensed capacity per registry code from the Ajuntament de
 * Barcelona weekly dataset («Viviendas de uso turístico de la ciudad de
 * Barcelona», CC BY 4.0). Column names despite appearances: LONGITUD_X is the
 * longitude and LATITUD_Y the latitude, already in WGS84.
 */
export function buildBarcelonaCityIndex(csvText: string): Map<string, CatCityEntry> {
  const rows = parseCsv(csvText.replace(/^\uFEFF/u, ''));
  const header = rows[0] ?? [];
  const codeIndex = header.indexOf('NUMERO_REGISTRE_GENERALITAT');
  const longitudeIndex = header.indexOf('LONGITUD_X');
  const latitudeIndex = header.indexOf('LATITUD_Y');
  const placesIndex = header.indexOf('NUMERO_PLACES');
  const entries = new Map<string, CatCityEntry>();
  if (codeIndex === -1 || longitudeIndex === -1 || latitudeIndex === -1) return entries;
  for (const row of rows.slice(1)) {
    const code = normalizeLicenseKey(row[codeIndex] ?? '');
    const longitude = Number(row[longitudeIndex]);
    const latitude = Number(row[latitudeIndex]);
    if (code.length === 0 || !Number.isFinite(latitude) || !Number.isFinite(longitude)) continue;
    // Sanity: inside the Spanish bounding box, like the UTM conversions.
    if (latitude < 27.4 || latitude > 44.2 || longitude < -18.5 || longitude > 4.5) continue;
    const places = placesIndex === -1 ? NaN : Number(row[placesIndex]);
    entries.set(code, {
      latitude,
      longitude,
      places: Number.isFinite(places) && places > 0 ? places : 0,
    });
  }
  return entries;
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
  cityIndexByCode: ReadonlyMap<string, CatCityEntry>,
): OfficialVutRecord | null {
  const registrationCode = asText(raw.n_mero_inscripci);
  const municipality = asText(raw.municipi).toLocaleUpperCase('es');
  const type = asText(raw.tipus_establiment);
  if (registrationCode.length === 0 || municipality.length === 0) return null;
  if (type !== CAT_ENTIRE_TYPE && type !== CAT_SHARED_TYPE && type !== CAT_APARTMENT_TYPE) {
    return null;
  }
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
  const cityEntry = cityIndexByCode.get(licenseKey) ?? null;
  const coordinates =
    cityEntry !== null &&
    coordinatesPlausibleForMunicipality(municipality, cityEntry.latitude, cityEntry.longitude)
      ? cityEntry
      : null;
  const name = asText(raw.r_tol);
  // The Generalitat only publishes total_places for ~24% of HUTs even though
  // the licensed capacity is mandatory; the city-hall dataset fills the rest.
  const registryPlaces = Number(raw.total_places);
  const places =
    Number.isFinite(registryPlaces) && registryPlaces > 0
      ? registryPlaces
      : (cityEntry?.places ?? 0);
  const isApartmentBuilding = type === CAT_APARTMENT_TYPE;
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
    // Un edificio de apartamentos cede la vivienda completa (varias); solo el
    // hogar compartido es por habitaciones.
    entire: type !== CAT_SHARED_TYPE,
    places,
    // El registro no publica el nº de apartamentos: se estima por capacidad.
    ...(isApartmentBuilding && estimateApartmentUnits(places) > 1
      ? { units: estimateApartmentUnits(places) }
      : {}),
    latitude: coordinates?.latitude ?? null,
    longitude: coordinates?.longitude ?? null,
  };
}
