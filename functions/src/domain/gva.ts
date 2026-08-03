import { normalizeStreet, normalizeStreetNumber } from './address.js';
import type { OfficialVutRecord } from './openrta.js';

/**
 * Municipalities mirrored from the Registre de Turisme de la Comunitat
 * Valenciana (GVA daily dump). Filtered by INE codes — the `municipio` text
 * mixes bilingual spellings ('ALACANT/ALICANTE') that make brittle keys.
 * `name` is our canonical record spelling; it must have an entry in
 * MUNICIPALITY_CENTERS for the plausibility guard.
 */
export interface GvaMunicipality {
  codProvincia: string;
  codMunicipio: string;
  name: string;
  cityId: string;
}

export const GVA_MUNICIPALITIES: readonly GvaMunicipality[] = [
  { codProvincia: '46', codMunicipio: '250', name: 'VALÈNCIA', cityId: 'valencia' },
  { codProvincia: '03', codMunicipio: '014', name: 'ALICANTE', cityId: 'alicante' },
  { codProvincia: '03', codMunicipio: '031', name: 'BENIDORM', cityId: 'benidorm' },
  { codProvincia: '03', codMunicipio: '133', name: 'TORREVIEJA', cityId: 'torrevieja' },
  { codProvincia: '03', codMunicipio: '047', name: 'CALP', cityId: 'calp' },
  { codProvincia: '03', codMunicipio: '063', name: 'DÉNIA', cityId: 'denia' },
];

/**
 * Maps a row of the GVA CSV (`lista-de-viviendas-turisticas.csv`) to our
 * record; null if unusable. Valencian VUTs are always whole dwellings (the
 * regional regulation requires ceding the full home), so `entire` is true.
 * The dump publishes no coordinates but a cadastral reference in ~99% of
 * rows: the sync resolves it against the Catastro (parcel centroid).
 */
export function parseGvaRow(
  row: Record<string, string>,
  municipality: GvaMunicipality,
): OfficialVutRecord | null {
  const signatura = (row.signatura ?? '').trim();
  if (signatura.length === 0) return null;
  const direccion = (row.direccion ?? '').trim();
  // 'CL ARRABAL, 11, Es:T Pl:OD Pt:OS' → road / number / staircase-floor-door.
  const parts = direccion.split(',').map((part) => part.trim());
  const road = parts[0] ?? '';
  const rawNumber = parts[1] ?? '';
  const number = /^\d+/u.test(rawNumber) ? rawNumber : '';
  const detail = parts
    .slice(number.length > 0 ? 2 : 1)
    .join(', ')
    .trim();
  const addressText =
    `${road}${number.length > 0 ? `, ${number}` : ''}${detail.length > 0 ? ` (${detail})` : ''}`.trim();
  const places = Number(row.plazas_totales);
  const cadastralRef = (row.ref_catastral ?? '').trim().toLocaleUpperCase('es');
  return {
    id: `gva-${signatura}`,
    registrationCode: signatura,
    licenseKey: signatura.toLocaleUpperCase('es'),
    name: (row.nombre ?? '').trim(),
    addressText,
    street: normalizeStreet(road),
    number: normalizeStreetNumber(number),
    postalCode: (row.cp ?? '').trim(),
    municipality: municipality.name,
    cityId: municipality.cityId,
    entire: true,
    places: Number.isFinite(places) && places > 0 ? places : 0,
    // Long enough to be a real parcel+property reference (RC14 + extras).
    // Conditional spread: an explicit `undefined` would be rejected by
    // Firestore when the record is persisted.
    ...(cadastralRef.length >= 14 ? { cadastralRef } : {}),
    latitude: null,
    longitude: null,
  };
}

/**
 * Coordinates from a Consulta_CPMRC response of the Sede del Catastro
 * (XML; `xcen` is the longitude, `ycen` the latitude when SRS=EPSG:4326).
 * Null when the service reports an error or the geometry is missing.
 */
export function parseCatastroCoordinates(
  xml: string,
): { latitude: number; longitude: number } | null {
  if (!/<cuerr>\s*0\s*<\/cuerr>/u.test(xml)) return null;
  const x = /<xcen>([-\d.]+)<\/xcen>/u.exec(xml);
  const y = /<ycen>([-\d.]+)<\/ycen>/u.exec(xml);
  const longitude = Number(x?.[1]);
  const latitude = Number(y?.[1]);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  if (latitude < 27.4 || latitude > 44.2 || longitude < -18.5 || longitude > 4.5) return null;
  return { latitude, longitude };
}
