import { describe, expect, it } from 'vitest';
import { MENORCA_MUNICIPALITIES, parseMenorcaFeature } from './menorca.js';

const MAO = MENORCA_MUNICIPALITIES.find((entry) => entry.cityId === 'mao');
if (MAO === undefined) throw new Error('Mahón debe estar espejada');

const FEATURE = {
  properties: {
    nom: 'CASITA TIERRA NUEVA',
    tipus: 'HABITATGE TURÍSTIC DE VACANCES',
    registre: '685/1989',
    domicili: 'S´ALBUFERA, 792 - SANTA MADRONA - 792 ',
    poblacio: 'MAÓ',
    nombreplaces: 4,
    nombrehabitacions: 0,
  },
  geometry: { type: 'Point', coordinates: [4.243636483355779, 39.943186862834125] },
};

describe('parseMenorcaFeature', () => {
  it('maps a real feature with its own coordinates', () => {
    const record = parseMenorcaFeature(FEATURE, MAO);
    expect(record).toMatchObject({
      registrationCode: '685/1989',
      cityId: 'mao',
      municipality: 'MAÓ',
      entire: true,
      places: 4,
      latitude: 39.943186862834125,
      longitude: 4.243636483355779,
    });
    expect(record?.id.startsWith('men-685-1989-')).toBe(true);
  });

  it('derives distinct ids for repeated registre values at different addresses', () => {
    const twin = {
      ...FEATURE,
      properties: { ...FEATURE.properties, domicili: 'CAMÍ DE BAIX, 3' },
    };
    expect(parseMenorcaFeature(FEATURE, MAO)?.id).not.toBe(parseMenorcaFeature(twin, MAO)?.id);
    // La misma ficha siempre produce la misma clave.
    expect(parseMenorcaFeature(FEATURE, MAO)?.id).toBe(parseMenorcaFeature(FEATURE, MAO)?.id);
  });

  it('only accepts features of the requested municipality', () => {
    const ciutadella = MENORCA_MUNICIPALITIES.find((entry) => entry.cityId === 'ciutadella');
    if (ciutadella === undefined) throw new Error('Ciudadela debe estar espejada');
    expect(parseMenorcaFeature(FEATURE, ciutadella)).toBeNull();
  });

  it('drops implausible coordinates but keeps the record for geocoding', () => {
    const offshore = {
      ...FEATURE,
      geometry: { type: 'Point', coordinates: [-3.7038, 40.4168] },
    };
    const record = parseMenorcaFeature(offshore, MAO);
    expect(record?.latitude).toBeNull();
    expect(record?.longitude).toBeNull();
  });

  it('rejects features without registre', () => {
    const anonymous = { ...FEATURE, properties: { ...FEATURE.properties, registre: '' } };
    expect(parseMenorcaFeature(anonymous, MAO)).toBeNull();
  });
});
