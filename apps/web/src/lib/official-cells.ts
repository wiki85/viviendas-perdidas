import { geohashForLocation } from 'geofire-common';
import type { MapBounds, OfficialCell, OfficialViewportStats } from '../domain/types';
import { boundsContain } from './geo';

/** From this zoom on, the map shows the exact official pins (clustered). */
export const OFFICIAL_PIN_MIN_ZOOM = 17;

/** Precision whose cells embed the individual pins (matches the sync). */
export const PIN_CELL_PRECISION = 7;

/**
 * Geohash cell footprint in degrees per precision. A geohash of precision p
 * encodes 5p bits, alternating longitude first: lng gets ceil(5p/2) bits and
 * lat floor(5p/2), so the grid is fixed multiples of these spans from -180/-90.
 */
export const CELL_DEGREES: Record<number, { lat: number; lng: number }> = {
  4: { lat: 180 / 2 ** 10, lng: 360 / 2 ** 10 },
  5: { lat: 180 / 2 ** 12, lng: 360 / 2 ** 13 },
  6: { lat: 180 / 2 ** 15, lng: 360 / 2 ** 15 },
  7: { lat: 180 / 2 ** 17, lng: 360 / 2 ** 18 },
};

/** Bubble granularity per zoom band, tuned to ~40–150 px between bubbles. */
export function officialPrecisionForZoom(zoom: number): number {
  if (zoom < 9) return 4;
  if (zoom < 12) return 5;
  if (zoom < 15) return 6;
  return 7;
}

/**
 * Ids of every street-level cell covering the viewport (padded by one cell so
 * pins near the edges never disappear). Empty above the safety cap — callers
 * only ask at street zoom, where the viewport spans ~100 cells.
 */
export function enumeratePinCellIds(bounds: MapBounds, cap = 700): string[] {
  const size = CELL_DEGREES[PIN_CELL_PRECISION];
  const fromLat = Math.floor((bounds.south + 90) / size.lat) - 1;
  const toLat = Math.floor((bounds.north + 90) / size.lat) + 1;
  const fromLng = Math.floor((bounds.west + 180) / size.lng) - 1;
  const toLng = Math.floor((bounds.east + 180) / size.lng) + 1;
  if ((toLat - fromLat + 1) * (toLng - fromLng + 1) > cap) return [];
  const ids: string[] = [];
  for (let latIndex = fromLat; latIndex <= toLat; latIndex += 1) {
    const lat = Math.max(-89.999, Math.min(89.999, -90 + (latIndex + 0.5) * size.lat));
    for (let lngIndex = fromLng; lngIndex <= toLng; lngIndex += 1) {
      const lng = Math.max(-179.999, Math.min(179.999, -180 + (lngIndex + 0.5) * size.lng));
      ids.push(geohashForLocation([lat, lng], PIN_CELL_PRECISION));
    }
  }
  return ids;
}

/** Sums the cells whose centroid falls inside the visible bounds. */
export function sumCellsInBounds(
  cells: readonly OfficialCell[],
  bounds: MapBounds,
): OfficialViewportStats {
  let total = 0;
  let entireHomes = 0;
  for (const cell of cells) {
    if (!boundsContain(bounds, cell.location)) continue;
    total += cell.count;
    entireHomes += cell.entireCount;
  }
  return { total, entireHomes, roomsOnly: total - entireHomes };
}

/** Compact bubble label: 847 → '847', 8.876 → '8,9 k', 28.421 → '28 k'. */
export function formatCellCount(count: number): string {
  if (count < 1000) return String(count);
  const thousands = count / 1000;
  return `${thousands.toLocaleString('es-ES', {
    maximumFractionDigits: thousands >= 10 ? 0 : 1,
  })} k`;
}
