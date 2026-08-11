import { describe, expect, it } from 'vitest';
import { CASTILLA_LEON_MUNICIPALITIES, parseCastillaLeonRow } from './castillaleon.js';

const LEON = CASTILLA_LEON_MUNICIPALITIES.find((entry) => entry.cityId === 'leon');
if (LEON === undefined) throw new Error('León debe estar espejada');

const ROW: Record<string, string> = {
  establecimiento: 'Vivienda turística',
  n_registro: '24/000321',
  tipo: 'Piso',
  nombre: 'MIRADOR DE LA CATEDRAL',
  direccion: 'Calle ANCHA 12, 2º',
  c_postal: '24003',
  provincia: 'León',
  municipio: 'León',
  plazas: '5',
  gps_longitud: '-5,5697',
  gps_latitud: '42,5991',
};

describe('parseCastillaLeonRow', () => {
  it('maps a real row and accepts plausible comma-decimal GPS', () => {
    const record = parseCastillaLeonRow(ROW, LEON);
    expect(record).toMatchObject({
      id: 'cyl-24-000321',
      registrationCode: '24/000321',
      cityId: 'leon',
      municipality: 'LEÓN',
      entire: true,
      places: 5,
      postalCode: '24003',
    });
    expect(record?.latitude).toBeCloseTo(42.5991);
    expect(record?.longitude).toBeCloseTo(-5.5697);
  });

  it('discards the corrupt GPS format the portal ships («-,0066667»)', () => {
    const record = parseCastillaLeonRow(
      { ...ROW, gps_longitud: '-,0066667', gps_latitud: '42,5991' },
      LEON,
    );
    expect(record?.latitude).toBeNull();
    expect(record?.longitude).toBeNull();
  });

  it('discards implausible GPS outside the municipal radius', () => {
    const record = parseCastillaLeonRow(
      { ...ROW, gps_longitud: '-3,7038', gps_latitud: '40,4168' },
      LEON,
    );
    expect(record?.latitude).toBeNull();
    expect(record?.longitude).toBeNull();
  });

  it('keeps rows without GPS for the geocoding lanes', () => {
    const record = parseCastillaLeonRow({ ...ROW, gps_longitud: '', gps_latitud: '' }, LEON);
    expect(record?.latitude).toBeNull();
    expect(record?.addressText).toBe('Calle ANCHA 12, 2º');
  });

  it('rejects rows without registry number', () => {
    expect(parseCastillaLeonRow({ ...ROW, n_registro: '' }, LEON)).toBeNull();
  });

  it('counts an apartment building by estimated units and prefixes its id', () => {
    // «AL-BEREKA», apartamentos turísticos con 66 plazas → ~19 apartamentos.
    const record = parseCastillaLeonRow(
      {
        ...ROW,
        establecimiento: 'Apartamentos Turísticos',
        n_registro: '24/000321',
        nombre: 'AL-BEREKA',
        plazas: '66',
      },
      LEON,
    );
    expect(record?.units).toBe(19);
    // Prefijo distinto para no colisionar con una vivienda del mismo número.
    expect(record?.id).toBe('cyl-at-24-000321');
  });

  it('leaves a small single apartment building without a units field', () => {
    const record = parseCastillaLeonRow(
      { ...ROW, establecimiento: 'Apartamentos Turísticos', plazas: '4' },
      LEON,
    );
    expect(record?.units).toBeUndefined();
  });
});
