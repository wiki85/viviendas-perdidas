import { describe, expect, it } from 'vitest';
import { ARAGON_MUNICIPALITIES, normalizeAragonLocality, parseAragonRow } from './aragon.js';

const SALLENT = ARAGON_MUNICIPALITIES.find((entry) => entry.cityId === 'sallent-de-gallego');
if (SALLENT === undefined) throw new Error('Sallent de Gállego debe estar espejada');

const ROW = {
  vivienda: 'LA CASETA',
  localidad: 'FORMIGAL',
  direccion: 'CAMINO BARRAON, S/N FORMIGAL',
  codigoPostal: '22640',
  signatura: 'VU-HU-22-100',
};

describe('parseAragonRow', () => {
  it('maps a real row without places nor coordinates', () => {
    const record = parseAragonRow(ROW, SALLENT);
    expect(record).toMatchObject({
      id: 'ara-VU-HU-22-100',
      registrationCode: 'VU-HU-22-100',
      cityId: 'sallent-de-gallego',
      municipality: 'SALLENT DE GÁLLEGO',
      entire: true,
      places: 0,
      postalCode: '22640',
      latitude: null,
      longitude: null,
    });
  });

  it('rejects rows without signatura', () => {
    expect(parseAragonRow({ ...ROW, signatura: '' }, SALLENT)).toBeNull();
  });
});

describe('normalizeAragonLocality', () => {
  it('normalizes case and accents so núcleos match their aliases', () => {
    expect(normalizeAragonLocality('Sallent de Gállego ')).toBe('SALLENT DE GALLEGO');
    expect(normalizeAragonLocality('FORMIGAL')).toBe('FORMIGAL');
  });

  it('folds Formigal and Cerler into their municipalities via the alias lists', () => {
    expect(SALLENT.sourceNames).toContain('FORMIGAL');
    const benasque = ARAGON_MUNICIPALITIES.find((entry) => entry.cityId === 'benasque');
    expect(benasque?.sourceNames).toContain('CERLER');
  });
});
