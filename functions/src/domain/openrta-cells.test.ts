import { describe, expect, it } from 'vitest';
import { geohashForLocation } from 'geofire-common';
import type { OfficialVutRecord } from './openrta.js';
import { buildOfficialCells, CELL_PRECISIONS, PIN_CELL_PRECISION } from './openrta-cells.js';

function record(overrides: Partial<OfficialVutRecord>): OfficialVutRecord {
  return {
    rtaId: 1,
    registrationCode: 'VUT/SE/00001',
    licenseKey: 'VUT/SE/1',
    name: 'Vivienda de prueba',
    addressText: 'CALLE Prueba Nº 1',
    street: 'prueba',
    number: '1',
    postalCode: '41001',
    municipality: 'SEVILLA',
    cityId: 'sevilla',
    entire: true,
    places: 4,
    latitude: 37.39,
    longitude: -5.99,
    ...overrides,
  };
}

describe('buildOfficialCells', () => {
  const records = [
    record({ rtaId: 1, latitude: 37.39, longitude: -5.99, entire: true }),
    record({ rtaId: 2, latitude: 37.391, longitude: -5.991, entire: false }),
    // Málaga: far enough to always land in another precision-4 cell.
    record({ rtaId: 3, latitude: 36.72, longitude: -4.42, entire: true }),
    // Without coordinates: must be excluded from every cell.
    record({ rtaId: 4, latitude: null, longitude: null }),
  ];
  const build = buildOfficialCells(records, geohashForLocation);

  it('creates cells for every precision, excluding unlocated records', () => {
    for (const precision of CELL_PRECISIONS) {
      const cells = build.cells.filter((cell) => cell.precision === precision);
      const total = cells.reduce((sum, cell) => sum + cell.count, 0);
      expect(total).toBe(3);
      for (const cell of cells) {
        expect(cell.id).toHaveLength(precision);
      }
    }
  });

  it('aggregates counts, entire homes and centroids per cell', () => {
    const sevillaPrefix = geohashForLocation([37.39, -5.99], 4);
    const sevillaCell = build.cells.find(
      (cell) => cell.precision === 4 && cell.id === sevillaPrefix,
    );
    expect(sevillaCell).toMatchObject({ count: 2, entireCount: 1 });
    expect(sevillaCell?.lat).toBeCloseTo((37.39 + 37.391) / 2, 6);
    expect(sevillaCell?.lng).toBeCloseTo((-5.99 + -5.991) / 2, 6);
  });

  it('embeds the full pin payload only at the finest precision', () => {
    expect(build.pinCells.length).toBeGreaterThanOrEqual(2);
    const withPin = build.pinCells.find((cell) => cell.pins.some((pin) => pin.id === 'rta-1'));
    expect(withPin?.id).toBe(geohashForLocation([37.39, -5.99], PIN_CELL_PRECISION));
    expect(withPin?.pins[0]).toMatchObject({
      registrationCode: 'VUT/SE/00001',
      municipality: 'SEVILLA',
      postalCode: '41001',
      entire: true,
      places: 4,
      lat: 37.39,
      lng: -5.99,
    });
  });

  it('keeps cells sorted by id inside each precision for deterministic writes', () => {
    for (const precision of CELL_PRECISIONS) {
      const ids = build.cells.filter((cell) => cell.precision === precision).map((cell) => cell.id);
      expect(ids).toEqual([...ids].sort((a, b) => a.localeCompare(b)));
    }
  });
});
