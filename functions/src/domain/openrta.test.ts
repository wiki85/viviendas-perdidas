import { describe, expect, it } from 'vitest';
import {
  cleanAddressForGeocoding,
  coordinatesPlausibleForMunicipality,
  estimateApartmentUnits,
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

  it('falls back to the trailing number when the Nº marker is missing', () => {
    expect(extractStreetNumber('CALLE FERIA 106')).toBe('106');
    expect(extractStreetNumber('AVENIDA 28 DE FEBRERO 3')).toBe('3');
    expect(extractStreetNumber('CALLE FERIA 106 Plta/Piso 2 Pta/Letra B')).toBe('106');
    expect(extractStreetNumber('CALLE SIN PORTAL')).toBe('');
  });
});

describe('utmToWgs84', () => {
  it('projects a Sevilla ETRS89/UTM30N coordinate into a plausible lat/lng', () => {
    const result = utmToWgs84(235864.81, 4140991.82);
    expect(result?.latitude).toBeCloseTo(37.39, 1);
    expect(result?.longitude).toBeCloseTo(-5.99, 1);
  });

  it('rejects coordinates far away from the record municipality', () => {
    // Laredo (Cantabria) — a real error found in the RTA for a Marbella VUT.
    expect(coordinatesPlausibleForMunicipality('MARBELLA', 43.4195, -3.4431)).toBe(false);
    expect(coordinatesPlausibleForMunicipality('GRANADA', 40.4737, -3.686)).toBe(false);
    expect(coordinatesPlausibleForMunicipality('MARBELLA', 36.5101, -4.8825)).toBe(true);
    // San Pedro de Alcántara still belongs to Marbella.
    expect(coordinatesPlausibleForMunicipality('MARBELLA', 36.4849, -4.9921)).toBe(true);
    // Unknown municipalities cannot be judged: give them the benefit of the doubt.
    expect(coordinatesPlausibleForMunicipality('OTRO SITIO', 43.4195, -3.4431)).toBe(true);
  });

  it('rejects zero or non-finite coordinates', () => {
    expect(utmToWgs84(0, 0)).toBeNull();
    expect(utmToWgs84(Number.NaN, 10)).toBeNull();
  });
});

describe('cleanAddressForGeocoding', () => {
  it('drops floor and door noise but keeps block and portal', () => {
    expect(
      cleanAddressForGeocoding('URBANIZACION Las lomas de Rio Real Nº 35 Plta/Piso 2 Pta/Letra G'),
    ).toBe('URBANIZACION Las lomas de Rio Real Nº 35');
    expect(
      cleanAddressForGeocoding('CONJUNTO LAS ADELFAS FASE II Blq. 10 Portal 3 Plta/Piso 1'),
    ).toBe('CONJUNTO LAS ADELFAS FASE II Blq. 10 Portal 3');
    expect(cleanAddressForGeocoding('CALLE Manzanares Nº 8')).toBe('CALLE Manzanares Nº 8');
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

  it('treats apartamentos turísticos as entire homes and counts their units', () => {
    // Fila real: los AT traen el tipo de inmueble en `group`, no la modalidad,
    // y su número real de apartamentos en `tot_gen_ua` (edificio de 54 pisos).
    const record = parseRtaRecord({
      ...base,
      registration_code: 'A/SE/00662',
      name: 'LIBERE SEVILLE TRIANA',
      objects_type_id: 'Apartamento turístico',
      group: 'Edificio/Complejo',
      tot_gen_ua: 54,
      tot_gen_places: 170,
    });
    expect(record).toMatchObject({
      registrationCode: 'A/SE/00662',
      entire: true,
      places: 170,
      units: 54,
    });
  });

  it('leaves ordinary VUT without a units field (1 dwelling per registration)', () => {
    expect(parseRtaRecord({ ...base, tot_gen_ua: 3 })?.units).toBeUndefined();
  });

  it('keeps a record without usable coordinates but no location', () => {
    const record = parseRtaRecord({ ...base, srid: '', coord_x: null, coord_y: null });
    expect(record).toMatchObject({ cityId: 'sevilla', latitude: null });
  });

  it('nullifies coordinates implausibly far from the municipality', () => {
    // Real case: a MARBELLA record whose UTM points at Laredo (Cantabria).
    const record = parseRtaRecord({
      ...base,
      municipalities: 'MARBELLA',
      coord_x: '464126,82',
      coord_y: '4807497,74',
    });
    expect(record).toMatchObject({ cityId: 'marbella', latitude: null, longitude: null });
  });
});

describe('estimateApartmentUnits', () => {
  it('estimates apartments from total capacity at ~3.5 places each', () => {
    expect(estimateApartmentUnits(66)).toBe(19); // 66/3.5 = 18.9
    expect(estimateApartmentUnits(30)).toBe(9); // 30/3.5 = 8.6
    expect(estimateApartmentUnits(12)).toBe(3); // 12/3.5 = 3.4
  });

  it('never estimates below one apartment', () => {
    expect(estimateApartmentUnits(4)).toBe(1);
    expect(estimateApartmentUnits(0)).toBe(1);
  });
});

describe('streetsLooselyMatch', () => {
  it('rejects lookalike prefixes that are different roads', () => {
    expect(streetsLooselyMatch('calle sol', 'calle soledad')).toBe(false);
    expect(streetsLooselyMatch('calle reposo', 'reposo')).toBe(true);
    expect(streetsLooselyMatch('avenida de la constitucion', 'constitucion')).toBe(true);
  });

  it('matches identical and containing street names', () => {
    expect(streetsLooselyMatch('calle manzanares', 'manzanares')).toBe(true);
    expect(streetsLooselyMatch('manzanares', 'calle manzanares')).toBe(true);
    expect(streetsLooselyMatch('manzanares', 'feria')).toBe(false);
    expect(streetsLooselyMatch('', 'feria')).toBe(false);
  });
});
