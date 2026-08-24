import { normalizeStreet, normalizeStreetNumber } from './address.js';
import { extractStreetNumber, normalizeLicenseKey, type OfficialVutRecord } from './openrta.js';

/**
 * «Listado de Viviendas autorizadas» del Registro de Proveedores de
 * Servicios Turísticos de La Rioja (DG de Turismo): un PDF mensual con
 * columnas posicionales — nº de orden, número de registro estable
 * (VT-LR-NNNN), fecha de comunicación, dirección y municipio. Sin plazas,
 * sin coordenadas y sin referencia catastral: la ubicación va entera por la
 * geocodificación por dirección cacheada, como Navarra.
 *
 * Este módulo es la mitad pura: recibe los items de texto ya posicionados
 * (texto + x/y del extractor PDF del servicio) y reconstruye las filas.
 */

export interface RiojaTextItem {
  text: string;
  x: number;
  y: number;
}

export interface RiojaListing {
  registrationCode: string;
  addressText: string;
  municipality: string;
}

export interface RiojaMunicipality {
  /** Valor exacto de la columna de municipio del PDF. */
  sourceName: string;
  name: string;
  cityId: string;
}

export const LARIOJA_MUNICIPALITIES: readonly RiojaMunicipality[] = [
  { sourceName: 'LOGROÑO', name: 'LOGROÑO', cityId: 'logrono' },
  { sourceName: 'HARO', name: 'HARO', cityId: 'haro' },
  { sourceName: 'EZCARAY', name: 'EZCARAY', cityId: 'ezcaray' },
];

/** Geometría de columnas del listado (puntos PDF, medidos sobre la edición
 * de agosto de 2026): el registro arranca en x≈83, la fecha en x≈137, la
 * dirección en x≈188 y el municipio en x≈413. Los umbrales dejan holgura
 * para pequeñas variaciones de maquetación entre ediciones. */
const ADDRESS_MIN_X = 160;
const MUNICIPALITY_MIN_X = 380;
/** La misma fila visual puede repartir sus items en y que difieren ~1 pt;
 * filas contiguas distan ~11 pt: 3 pt separa sin ambigüedad. */
const ROW_Y_TOLERANCE = 3;

const REGISTRATION_PATTERN = /^VT-LR-\d+/u;
const DATE_PATTERN = /^\d{2}\/\d{2}\/\d{4}$/u;

interface RowCluster {
  y: number;
  items: RiojaTextItem[];
}

/** Agrupa los items de una página en filas visuales por proximidad de y. */
function clusterRows(items: readonly RiojaTextItem[]): RowCluster[] {
  const sorted = [...items]
    .filter((item) => item.text.trim().length > 0)
    .sort((a, b) => b.y - a.y || a.x - b.x);
  const rows: RowCluster[] = [];
  for (const item of sorted) {
    const current = rows[rows.length - 1];
    if (current !== undefined && Math.abs(current.y - item.y) <= ROW_Y_TOLERANCE) {
      current.items.push(item);
    } else {
      rows.push({ y: item.y, items: [item] });
    }
  }
  return rows;
}

/**
 * Items posicionados de todas las páginas → filas del listado. Las filas de
 * continuación (direcciones o municipios largos que saltan de línea) se
 * anexan a la fila anterior; las cabeceras y el título caen solas porque no
 * contienen un número de registro ni celdas de datos puras.
 */
export function extractRiojaListings(
  pages: ReadonlyArray<readonly RiojaTextItem[]>,
): RiojaListing[] {
  const listings: RiojaListing[] = [];
  for (const pageItems of pages) {
    for (const row of clusterRows(pageItems)) {
      const cells = row.items.sort((a, b) => a.x - b.x);
      const registration = cells.find((item) => REGISTRATION_PATTERN.test(item.text.trim()));
      const addressPart = cells
        .filter(
          (item) =>
            item.x >= ADDRESS_MIN_X &&
            item.x < MUNICIPALITY_MIN_X &&
            !DATE_PATTERN.test(item.text.trim()),
        )
        .map((item) => item.text.trim())
        .join(' ')
        .trim();
      const municipalityPart = cells
        .filter((item) => item.x >= MUNICIPALITY_MIN_X)
        .map((item) => item.text.trim())
        .join(' ')
        .trim();
      if (registration !== undefined) {
        listings.push({
          registrationCode: registration.text.trim(),
          addressText: addressPart,
          municipality: municipalityPart,
        });
        continue;
      }
      const last = listings.at(-1);
      if (
        last !== undefined &&
        (addressPart.length > 0 || municipalityPart.length > 0) &&
        cells.every((item) => item.x >= ADDRESS_MIN_X)
      ) {
        if (addressPart.length > 0) {
          last.addressText = `${last.addressText} ${addressPart}`.trim();
        }
        if (municipalityPart.length > 0) {
          last.municipality = `${last.municipality} ${municipalityPart}`.trim();
        }
      }
    }
  }
  return listings;
}

/** Fila del listado → registro del espejo; null si no es del municipio
 * pedido. La VUT riojana es siempre cesión completa (Decreto 10/2017): el
 * alquiler por habitaciones tributa como pensión y no entra en el listado. */
export function riojaListingToRecord(
  listing: RiojaListing,
  municipality: RiojaMunicipality,
): OfficialVutRecord | null {
  if (listing.municipality !== municipality.sourceName) return null;
  const registrationCode = listing.registrationCode.trim();
  if (registrationCode.length === 0) return null;
  const addressText = listing.addressText.replace(/\s+/gu, ' ').trim();
  if (addressText.length === 0) return null;
  return {
    id: `lrj-${registrationCode.replace(/[^A-Za-z0-9-]/gu, '-')}`,
    registrationCode,
    licenseKey: normalizeLicenseKey(registrationCode),
    name: '',
    addressText,
    street: normalizeStreet(addressText.split(',')[0] ?? addressText),
    number: normalizeStreetNumber(extractStreetNumber(addressText)),
    postalCode: '',
    municipality: municipality.name,
    cityId: municipality.cityId,
    entire: true,
    // El listado no publica plazas: La Rioja queda fuera de las métricas de
    // capacidad, como Aragón.
    places: 0,
    latitude: null,
    longitude: null,
  };
}
