import { normalizeStreet, normalizeStreetNumber } from './address.js';
import {
  coordinatesPlausibleForMunicipality,
  extractStreetNumber,
  normalizeLicenseKey,
  sanitizePublicName,
  type OfficialVutRecord,
} from './openrta.js';

/**
 * Registro de Turismo de Castilla y León (Junta de Castilla y León,
 * CC BY 4.0, portal Opendatasoft con refresco diario). Se espeja el
 * establecimiento «Vivienda turística», con número de registro
 * (`05/000001`), dirección, plazas y GPS solo en ~28% de filas — algunas
 * corruptas («-,0066667»), de ahí la validación estricta.
 */

export interface CastillaLeonMunicipality {
  /** Valor exacto de `municipio` en el export del portal. */
  sourceName: string;
  /** Nombre para mostrar y para el radio de plausibilidad. */
  name: string;
  cityId: string;
}

export const CASTILLA_LEON_MUNICIPALITIES: readonly CastillaLeonMunicipality[] = [
  { sourceName: 'León', name: 'LEÓN', cityId: 'leon' },
  { sourceName: 'Burgos', name: 'BURGOS', cityId: 'burgos' },
  { sourceName: 'Salamanca', name: 'SALAMANCA', cityId: 'salamanca' },
  { sourceName: 'Valladolid', name: 'VALLADOLID', cityId: 'valladolid' },
  { sourceName: 'Zamora', name: 'ZAMORA', cityId: 'zamora' },
  { sourceName: 'Ávila', name: 'ÁVILA', cityId: 'avila' },
  { sourceName: 'Soria', name: 'SORIA', cityId: 'soria' },
];

/** GPS del portal con coma decimal y filas corruptas: null si no cuadra. */
function parseCastillaLeonCoordinate(value: string): number | null {
  const trimmed = value.trim().replace(',', '.');
  if (!/^-?\d+(?:\.\d+)?$/u.test(trimmed)) return null;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) && parsed !== 0 ? parsed : null;
}

/**
 * Fila del registro castellanoleonés → registro del espejo; null si no es
 * utilizable. La vivienda turística de Castilla y León se cede completa
 * (Decreto 3/2017), sin modalidad por habitaciones. Los teléfonos y el email
 * del titular se descartan aquí: nunca se espejan.
 */
export function parseCastillaLeonRow(
  row: Record<string, string>,
  municipality: CastillaLeonMunicipality,
): OfficialVutRecord | null {
  const registro = (row.n_registro ?? '').trim();
  if (registro.length === 0) return null;

  const addressText = (row.direccion ?? '').trim();
  const latitude = parseCastillaLeonCoordinate(row.gps_latitud ?? '');
  const longitude = parseCastillaLeonCoordinate(row.gps_longitud ?? '');
  const plausible =
    latitude !== null &&
    longitude !== null &&
    coordinatesPlausibleForMunicipality(municipality.name, latitude, longitude);

  const places = Number((row.plazas ?? '').trim());
  return {
    id: `cyl-${registro.replace(/[^A-Za-z0-9-]/gu, '-')}`,
    registrationCode: registro,
    licenseKey: normalizeLicenseKey(registro),
    name: sanitizePublicName(row.nombre ?? ''),
    addressText,
    street: normalizeStreet(addressText.split(',')[0] ?? addressText),
    number: normalizeStreetNumber(extractStreetNumber(addressText)),
    postalCode: (row.c_postal ?? '').trim(),
    municipality: municipality.name,
    cityId: municipality.cityId,
    entire: true,
    places: Number.isFinite(places) && places > 0 ? places : 0,
    latitude: plausible ? latitude : null,
    longitude: plausible ? longitude : null,
  };
}
