import { describe, expect, it } from 'vitest';
import { parseMallorcaFeature } from './mallorca.js';

function feature(
  properties: Record<string, unknown> = {},
  coordinates: [number, number] | null = [2.6502, 39.5696],
) {
  return {
    properties: {
      Signatura: 'ETV/11326',
      Grup: 'Estada turística en habitatge (ETV)',
      Estat: 'Alta',
      Municipi: 'PALMA',
      Localitat: 'Palma',
      Direcció: 'BORDOY, 4  planta 1 porta B. 07012 PALMA, Mallorca',
      'Denominació comercial': 'Can Prova',
      Places: '6',
      ...properties,
    },
    geometry: coordinates === null ? null : { coordinates },
  };
}

describe('parseMallorcaFeature', () => {
  it('maps an active ETV dwelling with WGS84 geometry', () => {
    const record = parseMallorcaFeature(feature(), 'PALMA');
    expect(record).toMatchObject({
      id: 'caib-ETV-11326',
      registrationCode: 'ETV/11326',
      entire: true,
      places: 6,
      municipality: 'PALMA',
      cityId: 'palma',
      postalCode: '07012',
      street: 'bordoy',
      number: '4',
      latitude: 39.5696,
      longitude: 2.6502,
    });
    expect(record?.addressText).toBe('BORDOY, 4 (planta 1 porta B)');
  });

  it('excludes marketing operators — they are not dwellings', () => {
    expect(
      parseMallorcaFeature(feature({ Grup: 'Comercialitzador d´estades' }), 'PALMA'),
    ).toBeNull();
    expect(parseMallorcaFeature(feature({ Grup: 'Empresari d´habitatge' }), 'PALMA')).toBeNull();
  });

  it('filters by municipality and active state', () => {
    expect(parseMallorcaFeature(feature({ Municipi: 'SÓLLER' }), 'PALMA')).toBeNull();
    expect(parseMallorcaFeature(feature({ Estat: 'Baixa' }), 'PALMA')).toBeNull();
  });

  it('leaves features without geometry unlocated for the geocoding repair', () => {
    const record = parseMallorcaFeature(feature({}, null), 'PALMA');
    expect(record?.latitude).toBeNull();
    expect(record?.longitude).toBeNull();
  });

  it('drops implausible coordinates (outside the municipal radius)', () => {
    const record = parseMallorcaFeature(feature({}, [2.17, 41.38]), 'PALMA');
    expect(record?.latitude).toBeNull();
  });

  it('counts every mirrored group as a whole dwelling', () => {
    const etv60 = parseMallorcaFeature(
      feature({ Grup: 'Estada turística en habitatge (ETV60)', Signatura: 'ETV60/9' }),
      'PALMA',
    );
    expect(etv60?.entire).toBe(true);
    expect(etv60?.id).toBe('caib-ETV60-9');
  });
});
