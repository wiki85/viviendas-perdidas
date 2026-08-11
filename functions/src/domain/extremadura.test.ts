import { describe, expect, it } from 'vitest';
import {
  EXTREMADURA_MUNICIPALITIES,
  normalizeExtremaduraMunicipality,
  parseExtremaduraRow,
} from './extremadura.js';

const MERIDA = EXTREMADURA_MUNICIPALITIES.find((entry) => entry.cityId === 'merida');
if (MERIDA === undefined) throw new Error('Mérida debe estar espejada');

const ROW: Record<string, string> = {
  ['Provincia']: 'Badajoz',
  ['Tipo recurso']: 'Apartamento turístico',
  ['Categoría']: 'Tercera',
  ['exp_fecapertura']: '2019-05-24',
  ['Nombre establecimiento']: 'LOS EUCALIPTOS',
  ['Municipio']: 'MERIDA',
  ['Dirección']: 'C/ ERMITA, S/N',
  ['C. Postal']: '6207',
  ['Unidades de Alojamiento']: '1',
  ['Total Nº Dormitorios']: '1',
  ['Total Nº Plazas']: '2',
  ['Plazas Convertibles']: '2',
};

describe('parseExtremaduraRow', () => {
  it('maps a real row and restores the postal code leading zero', () => {
    const record = parseExtremaduraRow(ROW, MERIDA);
    expect(record).toMatchObject({
      registrationCode: '',
      cityId: 'merida',
      municipality: 'MÉRIDA',
      entire: true,
      places: 2,
      postalCode: '06207',
      latitude: null,
      longitude: null,
    });
    expect(record?.id.startsWith('ext-')).toBe(true);
  });

  it('derives a stable synthetic key from the sheet fields', () => {
    expect(parseExtremaduraRow(ROW, MERIDA)?.id).toBe(parseExtremaduraRow(ROW, MERIDA)?.id);
    expect(parseExtremaduraRow(ROW, MERIDA)?.id).not.toBe(
      parseExtremaduraRow({ ...ROW, ['Dirección']: 'AVDA. EXTREMADURA 9' }, MERIDA)?.id,
    );
  });

  it('rejects rows without name nor address', () => {
    expect(
      parseExtremaduraRow({ ...ROW, ['Nombre establecimiento']: '', ['Dirección']: '' }, MERIDA),
    ).toBeNull();
  });

  it('counts a whole apartment building by its units', () => {
    // «LUSITANIA» en Mérida: 15 apartamentos en un solo registro.
    const record = parseExtremaduraRow(
      { ...ROW, ['Nombre establecimiento']: 'LUSITANIA', ['Unidades de Alojamiento']: '15' },
      MERIDA,
    );
    expect(record?.units).toBe(15);
  });

  it('leaves single-unit apartments without a units field', () => {
    expect(parseExtremaduraRow({ ...ROW, ['Unidades de Alojamiento']: '1' }, MERIDA)?.units).toBe(
      undefined,
    );
  });
});

describe('normalizeExtremaduraMunicipality', () => {
  it('folds case and accents so the CSV variants match', () => {
    expect(normalizeExtremaduraMunicipality('Cáceres')).toBe('CACERES');
    expect(normalizeExtremaduraMunicipality('MERIDA ')).toBe('MERIDA');
  });
});
