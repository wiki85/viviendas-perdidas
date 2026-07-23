import { describe, expect, it } from 'vitest';
import {
  extractStreetNumber,
  normalizeLicenseKey,
  parseRtaRecord,
  streetsLooselyMatch,
  utmToWgs84,
} from './openrta.js';

describe('normalizeLicenseKey', () => {
  it('uppercases and strips leading zeros from the numeric part', () => {
    expect(normalizeLicenseKey('vut/se/015513 ')).toBe('VUT/SE/15513');
    expect(normalizeLicenseKey('VUT/SE/15513')).toBe('VUT/SE/15513');
  });
});

describe('extractStreetNumber', () => {
  it('reads the portal number from an RTA address string', () => {
    expect(extractStreetNumber('CALLE Manzanares Nº 8 Plta/Piso 9 Pta/Letra D')).toBe('8');
    expect(extractStreetNumber('AVENIDA de la Constitución No 22')).toBe('22');
    expect(extractStreetNumber('Sin número')).toBe('');
  });
});

describe('utmToWgs84', () => {
  it('projects a Sevilla ETRS89/UTM30N coordinate into a plausible lat/lng', () => {
    const result = utmToWgs84(235864.81, 4140991.82);
    expect(result).toEqual({
      latitude: expect.closeTo(37.39, 1),
      longitude: expect.closeTo(-5.99, 1),
    });
  });

  it('rejects zero or non-finite coordinates', () => {
    expect(utmToWgs84(0, 0)).toBeNull();
    expect(utmToWgs84(Number.NaN, 10)).toBeNull();
  });
});

describe('parseRtaRecord', () => {
  const base = {
    id: 265317,
    registration_code: 'VUT/SE/015513',
    name: 'Manzanares 8',
    establishment_address: 'CALLE Manzanares Nº 8 Plta/Piso 9 Pta/Letra D',
    road_name: 'Manzanares',
    postal_code: '41010',
    municipalities: 'SEVILLA',
    group: 'Completa',
    tot_gen_places: 4,
    srid: '25830',
    coord_x: '235864,81',
    coord_y: '4140991,82',
    ind_pub_open_rta: 'S',
  };

  it('maps a full record with coordinates and entire-home flag', () => {
    expect(parseRtaRecord({ ...base })).toMatchObject({
      licenseKey: 'VUT/SE/15513',
      number: '8',
      cityId: 'sevilla',
      entire: true,
    });
    expect(parseRtaRecord({ ...base })?.latitude).not.toBeNull();
  });

  it('drops records not published in the open RTA', () => {
    expect(parseRtaRecord({ ...base, ind_pub_open_rta: 'N' })).toBeNull();
  });

  it('keeps a record without usable coordinates but no location', () => {
    const record = parseRtaRecord({ ...base, srid: '', coord_x: null, coord_y: null });
    expect(record).toMatchObject({ cityId: 'sevilla', latitude: null });
  });
});

describe('streetsLooselyMatch', () => {
  it('matches identical and containing street names', () => {
    expect(streetsLooselyMatch('calle manzanares', 'manzanares')).toBe(true);
    expect(streetsLooselyMatch('manzanares', 'calle manzanares')).toBe(true);
    expect(streetsLooselyMatch('manzanares', 'feria')).toBe(false);
    expect(streetsLooselyMatch('', 'feria')).toBe(false);
  });
});
