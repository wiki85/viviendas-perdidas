import { describe, expect, it } from 'vitest';
import { CASTILLA_LA_MANCHA_MUNICIPALITIES, parseCastillaLaManchaRow } from './castillalamancha.js';

const TOLEDO = CASTILLA_LA_MANCHA_MUNICIPALITIES.find((entry) => entry.cityId === 'toledo');
if (TOLEDO === undefined) throw new Error('Toledo debe estar espejada');

const ROW: Record<string, string> = {
  ['Campaña']: '2024',
  ['Nombre Establecimiento']: 'CASA DEL GRECO',
  ['Tipo Establecimiento']: 'Apartamentos turísticos',
  ['Subepígrafe']: 'V.U.T.',
  ['Categoría']: '',
  ['Dirección Establecimiento']: 'CALLE SANTO TOMÉ 13, 2º A',
  ['Municipio']: 'TOLEDO',
  ['Provincia']: 'TOLEDO',
  ['Código Postal Establecimiento']: '45002',
  // La cabecera real trae un espacio final en la columna de plazas.
  ['Total de plazas ']: '6',
};

describe('parseCastillaLaManchaRow', () => {
  it('maps a real row, reading the places column with its trailing space', () => {
    const record = parseCastillaLaManchaRow(ROW, TOLEDO);
    expect(record).toMatchObject({
      registrationCode: '',
      cityId: 'toledo',
      municipality: 'TOLEDO',
      entire: true,
      places: 6,
      postalCode: '45002',
      latitude: null,
      longitude: null,
    });
    expect(record?.id.startsWith('clm-')).toBe(true);
  });

  it('derives a stable synthetic key from the sheet fields', () => {
    expect(parseCastillaLaManchaRow(ROW, TOLEDO)?.id).toBe(
      parseCastillaLaManchaRow({ ...ROW, ['Campaña']: '2026' }, TOLEDO)?.id,
    );
    expect(parseCastillaLaManchaRow(ROW, TOLEDO)?.id).not.toBe(
      parseCastillaLaManchaRow(
        { ...ROW, ['Dirección Establecimiento']: 'CALLE ALFILERITOS 2' },
        TOLEDO,
      )?.id,
    );
  });

  it('rejects rows without name nor address', () => {
    expect(
      parseCastillaLaManchaRow(
        { ...ROW, ['Nombre Establecimiento']: '', ['Dirección Establecimiento']: '' },
        TOLEDO,
      ),
    ).toBeNull();
  });
});
