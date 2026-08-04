import { describe, expect, it } from 'vitest';
import { CANARIAS_MUNICIPALITIES, parseCanariasRow } from './canarias.js';

const ARONA = CANARIAS_MUNICIPALITIES.find((entry) => entry.cityId === 'arona');
if (ARONA === undefined) throw new Error('Arona debe estar espejada');

const ROW = {
  establecimiento_id: 'A-38-4-0000685',
  establecimiento_nombre_comercial: ' Casa Tinali',
  establecimiento_modalidad: 'Extrahotelera',
  establecimiento_tipologia: 'Vivienda Vacacional',
  direccion: 'C/. Oroteanda Baja Nº 14',
  direccion_municipio_nombre: 'Arona',
  direccion_codigo_postal: '38639',
  plazas: '10',
  longitud: '-16.636038',
  latitud: '28.044253',
};

describe('parseCanariasRow', () => {
  it('maps a real row with its own coordinates and stable id', () => {
    const record = parseCanariasRow(ROW, ARONA);
    expect(record).toMatchObject({
      id: 'can-A-38-4-0000685',
      registrationCode: 'A-38-4-0000685',
      cityId: 'arona',
      municipality: 'ARONA',
      entire: true,
      places: 10,
      postalCode: '38639',
      latitude: 28.044253,
      longitude: -16.636038,
    });
    expect(record?.name).toBe('Casa Tinali');
  });

  it('treats the _U marker as missing and keeps the record', () => {
    const record = parseCanariasRow({ ...ROW, plazas: '_U', direccion: '_U' }, ARONA);
    expect(record).toMatchObject({ places: 0, addressText: '' });
  });

  it('drops coordinates outside the municipality radius', () => {
    // Madrid coords declared for an Arona dwelling: implausible.
    const record = parseCanariasRow({ ...ROW, latitud: '40.4168', longitud: '-3.7038' }, ARONA);
    expect(record?.latitude).toBeNull();
    expect(record?.longitude).toBeNull();
  });

  it('rejects rows without signatura', () => {
    expect(parseCanariasRow({ ...ROW, establecimiento_id: '' }, ARONA)).toBeNull();
  });

  it('mirrors the source spellings that differ from display names', () => {
    const santaCruz = CANARIAS_MUNICIPALITIES.find(
      (entry) => entry.cityId === 'santa-cruz-de-tenerife',
    );
    expect(santaCruz?.sourceName).toBe('Santa Cruz Tenerife');
    const sanBartolome = CANARIAS_MUNICIPALITIES.find(
      (entry) => entry.cityId === 'san-bartolome-de-tirajana',
    );
    expect(sanBartolome?.sourceName).toBe('San Bartolome De Tirajana');
  });
});
