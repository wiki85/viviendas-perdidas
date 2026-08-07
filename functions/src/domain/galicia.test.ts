import { describe, expect, it } from 'vitest';
import { GALICIA_MUNICIPALITIES, isGaliciaDwellingType, parseGaliciaRow } from './galicia.js';

const VIGO = GALICIA_MUNICIPALITIES.find((entry) => entry.cityId === 'vigo');
if (VIGO === undefined) throw new Error('Vigo debe estar espejada');

const ROW: Record<string, string> = {
  signatura: 'VUT-PO-004521',
  denominacion: 'PISO CENTRO VIGO',
  tipo: 'VIVIENDAS USO TURÍSTICO',
  categoria: '',
  habitaciones: '2',
  plazas: '4',
  longitud: '',
  latitud: '',
  direccion: 'RÚA URZAIZ 45, 3º',
  parroquia: 'VIGO (SANTIAGO)',
  lugar: '',
  codigo_postal: '36201',
  municipio: 'VIGO',
  provincia: 'PONTEVEDRA',
};

describe('parseGaliciaRow', () => {
  it('maps a real row without coordinates (pending geocoding)', () => {
    const record = parseGaliciaRow(ROW, VIGO);
    expect(record).toMatchObject({
      id: 'gal-VUT-PO-004521',
      registrationCode: 'VUT-PO-004521',
      cityId: 'vigo',
      municipality: 'VIGO',
      entire: true,
      places: 4,
      postalCode: '36201',
      latitude: null,
      longitude: null,
    });
  });

  it('accepts plausible comma-decimal coordinates when present', () => {
    const record = parseGaliciaRow({ ...ROW, longitud: '-8,72243', latitud: '42,23282' }, VIGO);
    expect(record?.latitude).toBeCloseTo(42.23282);
    expect(record?.longitude).toBeCloseTo(-8.72243);
  });

  it('falls back to lugar and parroquia for rural rows without street', () => {
    const record = parseGaliciaRow(
      { ...ROW, direccion: '', lugar: 'O BARREIRO', parroquia: 'CABALAR (SANTA MARÍA)' },
      VIGO,
    );
    expect(record?.addressText).toBe('O BARREIRO, CABALAR (SANTA MARÍA)');
  });

  it('only mirrors the dwelling figures of the REAT', () => {
    expect(isGaliciaDwellingType('VIVIENDAS USO TURÍSTICO')).toBe(true);
    expect(isGaliciaDwellingType('VIVIENDAS TURÍSTICAS')).toBe(true);
    expect(isGaliciaDwellingType('PENSIONES')).toBe(false);
    expect(parseGaliciaRow({ ...ROW, tipo: 'HOTELES' }, VIGO)).toBeNull();
  });

  it('rejects rows without signatura', () => {
    expect(parseGaliciaRow({ ...ROW, signatura: '' }, VIGO)).toBeNull();
  });

  it('drops the phone numbers some rows carry in the postal-code column', () => {
    expect(parseGaliciaRow({ ...ROW, codigo_postal: '662574097' }, VIGO)?.postalCode).toBe('');
    expect(parseGaliciaRow(ROW, VIGO)?.postalCode).toBe('36201');
  });
});
