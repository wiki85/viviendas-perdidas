import { describe, expect, it } from 'vitest';
import { geohashForLocation } from 'geofire-common';
import type { MapBounds, OfficialCell } from '../domain/types';
import {
  enumeratePinCellIds,
  formatCellCount,
  officialPrecisionForZoom,
  PIN_CELL_PRECISION,
  sumCellsInBounds,
} from './official-cells';

const SEVILLA_BOUNDS: MapBounds = {
  north: 37.396,
  south: 37.388,
  east: -5.986,
  west: -5.999,
};

function cell(id: string, lat: number, lng: number, count: number, entire: number): OfficialCell {
  return { id, precision: 6, location: { lat, lng }, count, entireCount: entire };
}

describe('officialPrecisionForZoom', () => {
  it('coarsens with distance and refines near street level', () => {
    expect(officialPrecisionForZoom(5.6)).toBe(4);
    expect(officialPrecisionForZoom(9)).toBe(5);
    expect(officialPrecisionForZoom(12)).toBe(6);
    expect(officialPrecisionForZoom(15)).toBe(7);
    expect(officialPrecisionForZoom(16.9)).toBe(7);
  });
});

describe('enumeratePinCellIds', () => {
  it('covers every street cell of the viewport, including its own point', () => {
    const ids = enumeratePinCellIds(SEVILLA_BOUNDS);
    expect(ids.length).toBeGreaterThan(0);
    expect(ids.length).toBeLessThanOrEqual(700);
    const inner = geohashForLocation([37.392, -5.992], PIN_CELL_PRECISION);
    expect(ids).toContain(inner);
    // Padding: a point just outside the edge still has its cell fetched.
    const edge = geohashForLocation([37.3968, -5.986], PIN_CELL_PRECISION);
    expect(ids).toContain(edge);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('returns nothing above the safety cap instead of exploding', () => {
    expect(enumeratePinCellIds({ north: 43.5, south: 36.0, east: 3.0, west: -9.0 })).toHaveLength(
      0,
    );
  });
});

describe('sumCellsInBounds', () => {
  it('counts only cells whose centroid is visible', () => {
    const cells = [
      cell('a', 37.39, -5.99, 120, 100),
      cell('b', 37.394, -5.988, 30, 10),
      // Outside the viewport: ignored.
      cell('c', 36.72, -4.42, 999, 999),
    ];
    expect(sumCellsInBounds(cells, SEVILLA_BOUNDS)).toEqual({
      total: 150,
      entireHomes: 110,
      roomsOnly: 40,
    });
  });
});

describe('formatCellCount', () => {
  it('keeps small counts and compacts thousands', () => {
    expect(formatCellCount(847)).toBe('847');
    expect(formatCellCount(8876)).toBe('8,9 k');
    expect(formatCellCount(28421)).toBe('28 k');
  });
});
