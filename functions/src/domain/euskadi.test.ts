import { describe, expect, it } from 'vitest';
import { parseEuskadiRecord, EUSKADI_MUNICIPALITIES } from './euskadi.js';

const BILBAO = EUSKADI_MUNICIPALITIES.find((entry) => entry.cityId === 'bilbao') ?? {
  match: 'Bilbao',
  name: 'BILBAO',
  cityId: 'bilbao',
};

function row(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    Nregistro: 'EBI00003',
    Direccion: 'Bidebarrieta, 7, 1º DR (Bilbao)',
    Codigopostal: '48005',
    Municipio: 'Bilbao',
    Capacidad: '5',
    ...overrides,
  };
}

describe('parseEuskadiRecord', () => {
  it('maps a whole dwelling with parsed address', () => {
    const record = parseEuskadiRecord(row(), BILBAO, true);
    expect(record).toMatchObject({
      id: 'eus-EBI00003',
      registrationCode: 'EBI00003',
      entire: true,
      places: 5,
      municipality: 'BILBAO',
      cityId: 'bilbao',
      postalCode: '48005',
      street: 'bidebarrieta',
      number: '7',
      latitude: null,
      longitude: null,
    });
    expect(record?.addressText).toBe('Bidebarrieta, 7 (1º DR)');
  });

  it('marks rooms-only rentals as non-entire', () => {
    const record = parseEuskadiRecord(row({ Nregistro: 'LBI00248' }), BILBAO, false);
    expect(record?.entire).toBe(false);
    expect(record?.id).toBe('eus-LBI00248');
  });

  it('filters by exact municipality value', () => {
    expect(parseEuskadiRecord(row({ Municipio: 'Getxo' }), BILBAO, true)).toBeNull();
    const donostia = EUSKADI_MUNICIPALITIES.find((entry) => entry.cityId === 'donostia');
    expect(donostia).toBeDefined();
    expect(
      parseEuskadiRecord(row({ Municipio: 'Donostia / San Sebastián' }), donostia ?? BILBAO, true),
    ).not.toBeNull();
  });

  it('rejects rows without registry code', () => {
    expect(parseEuskadiRecord(row({ Nregistro: ' ' }), BILBAO, true)).toBeNull();
  });
});

describe('city slug aliases', () => {
  it('makes bilingual municipality spellings converge on one page', async () => {
    const { slugifyCity } = await import('./address.js');
    expect(slugifyCity('Donostia-San Sebastián')).toBe('donostia');
    expect(slugifyCity('San Sebastián')).toBe('donostia');
    expect(slugifyCity('Palma de Mallorca')).toBe('palma');
    expect(slugifyCity('Pamplona / Iruña')).toBe('pamplona');
    expect(slugifyCity('Alacant/Alicante')).toBe('alicante');
    expect(slugifyCity('Bilbao')).toBe('bilbao');
    expect(slugifyCity('València')).toBe('valencia');
  });
});
