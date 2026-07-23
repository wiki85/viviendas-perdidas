import type { OfficialVutRecord } from './openrta.js';

/**
 * Geohash precisions served to the map, from country view (~39 km cells) to
 * street view (~153 m cells). The web picks one per zoom band.
 */
export const CELL_PRECISIONS = [4, 5, 6, 7] as const;

/** Finest precision; its cells also embed the individual pins so the map can
 * show every dwelling at street zoom without reading 50k documents. */
export const PIN_CELL_PRECISION = 7;

export interface OfficialCellAggregate {
  /** Geohash prefix — also the Firestore document id. */
  id: string;
  precision: number;
  /** Centroid of the member dwellings (not the cell center). */
  lat: number;
  lng: number;
  count: number;
  entireCount: number;
}

export interface OfficialEmbeddedPin {
  /** Matches the officialVut document id (`rta-<id>`). */
  id: string;
  lat: number;
  lng: number;
  registrationCode: string;
  name: string;
  addressText: string;
  postalCode: string;
  municipality: string;
  entire: boolean;
  places: number;
}

export interface OfficialPinCellAggregate {
  id: string;
  lat: number;
  lng: number;
  count: number;
  pins: OfficialEmbeddedPin[];
}

type GeohashFn = (location: [number, number], precision?: number) => string;

interface CellAccumulator {
  sumLat: number;
  sumLng: number;
  count: number;
  entireCount: number;
  pins: OfficialEmbeddedPin[];
}

export interface OfficialCellsBuild {
  cells: OfficialCellAggregate[];
  pinCells: OfficialPinCellAggregate[];
}

/**
 * Aggregates the geolocated registry records into geohash cells per
 * precision. Records without coordinates (~1%) cannot be drawn nor counted
 * spatially, so they are excluded here (officialStats keeps the full totals).
 */
export function buildOfficialCells(
  records: readonly OfficialVutRecord[],
  geohashFor: GeohashFn,
): OfficialCellsBuild {
  const located: Array<{ record: OfficialVutRecord; lat: number; lng: number; hash: string }> = [];
  for (const record of records) {
    if (record.latitude === null || record.longitude === null) continue;
    located.push({
      record,
      lat: record.latitude,
      lng: record.longitude,
      hash: geohashFor([record.latitude, record.longitude], PIN_CELL_PRECISION),
    });
  }

  const cells: OfficialCellAggregate[] = [];
  const pinCells: OfficialPinCellAggregate[] = [];
  for (const precision of CELL_PRECISIONS) {
    const bucket = new Map<string, CellAccumulator>();
    for (const { record, lat, lng, hash } of located) {
      const prefix = hash.slice(0, precision);
      let cell = bucket.get(prefix);
      if (cell === undefined) {
        cell = { sumLat: 0, sumLng: 0, count: 0, entireCount: 0, pins: [] };
        bucket.set(prefix, cell);
      }
      cell.sumLat += lat;
      cell.sumLng += lng;
      cell.count += 1;
      if (record.entire) cell.entireCount += 1;
      if (precision === PIN_CELL_PRECISION) {
        cell.pins.push({
          id: `rta-${record.rtaId}`,
          lat,
          lng,
          registrationCode: record.registrationCode,
          name: record.name,
          addressText: record.addressText,
          postalCode: record.postalCode,
          municipality: record.municipality,
          entire: record.entire,
          places: record.places,
        });
      }
    }
    for (const [prefix, cell] of [...bucket.entries()].sort(([a], [b]) => a.localeCompare(b))) {
      const centroid = { lat: cell.sumLat / cell.count, lng: cell.sumLng / cell.count };
      cells.push({
        id: prefix,
        precision,
        lat: centroid.lat,
        lng: centroid.lng,
        count: cell.count,
        entireCount: cell.entireCount,
      });
      if (precision === PIN_CELL_PRECISION) {
        pinCells.push({
          id: prefix,
          lat: centroid.lat,
          lng: centroid.lng,
          count: cell.count,
          pins: cell.pins,
        });
      }
    }
  }
  return { cells, pinCells };
}
