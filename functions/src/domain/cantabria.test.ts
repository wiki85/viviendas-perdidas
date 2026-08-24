import { describe, expect, it } from 'vitest';
import {
  CANTABRIA_MUNICIPALITIES,
  parseCantabriaFeature,
  type CantabriaFeature,
} from './cantabria.js';

function municipality(name: string) {
  const entry = CANTABRIA_MUNICIPALITIES.find((candidate) => candidate.name === name);
  if (entry === undefined) throw new Error(`Municipio de test ausente: ${name}`);
  return entry;
}
const suances = municipality('SUANCES');
const comillas = municipality('COMILLAS');

/** Feature real de la capa 3 (muestreo del 24-08-2026, Suances). */
const SUANCES_FEATURE: CantabriaFeature = {
  attributes: {
    objectid: 15079,
    nombre: 'APARTAMENTO SUANCES',
    modalidad: 'ALQUILER COMPLETO',
    telefono1: 625479802,
    email1: 'titular@example.com',
    pagina_web: null,
    num_plazas: 4,
    signatura: 'VUT',
    nombre_via: 'CEBALLOS',
    numero: '41-F',
    bloque: null,
    escalera: null,
    piso: '1',
    puerta: 'B',
    cpostal: '39340',
    localidad: '0850005',
    municipio: '085',
  },
  geometry: { x: -4.043240241999968, y: 43.430710125000076 },
};

describe('parseCantabriaFeature', () => {
  it('convierte una feature real en registro con coordenadas nativas', () => {
    const record = parseCantabriaFeature(SUANCES_FEATURE, suances);
    expect(record).not.toBeNull();
    expect(record?.id).toMatch(/^cnt-[0-9a-f]{16}$/u);
    expect(record?.registrationCode).toBe('');
    expect(record?.entire).toBe(true);
    expect(record?.places).toBe(4);
    expect(record?.latitude).toBeCloseTo(43.4307, 3);
    expect(record?.longitude).toBeCloseTo(-4.0432, 3);
    expect(record?.postalCode).toBe('39340');
    expect(record?.addressText).toBe('CEBALLOS, 41-F (piso 1, puerta B)');
    // El teléfono y el email del titular no viajan al espejo.
    expect(JSON.stringify(record)).not.toContain('625479802');
    expect(JSON.stringify(record)).not.toContain('example.com');
  });

  it('separa la modalidad compartida y rechaza modalidades desconocidas', () => {
    const shared = parseCantabriaFeature(
      {
        ...SUANCES_FEATURE,
        attributes: { ...SUANCES_FEATURE.attributes, modalidad: 'ALQUILER COMPARTIDO' },
      },
      suances,
    );
    expect(shared?.entire).toBe(false);
    const unknown = parseCantabriaFeature(
      {
        ...SUANCES_FEATURE,
        attributes: { ...SUANCES_FEATURE.attributes, modalidad: 'HOTEL' },
      },
      suances,
    );
    expect(unknown).toBeNull();
  });

  it('descarta features de otro municipio', () => {
    expect(parseCantabriaFeature(SUANCES_FEATURE, comillas)).toBeNull();
  });

  it('descarta coordenadas implausibles y deja el registro para geocodificar', () => {
    const far = parseCantabriaFeature(
      { ...SUANCES_FEATURE, geometry: { x: -3.7038, y: 40.4168 } },
      suances,
    );
    expect(far?.latitude).toBeNull();
    expect(far?.longitude).toBeNull();
  });

  it('la identidad sintética distingue puertas y municipios', () => {
    const otherDoor = parseCantabriaFeature(
      {
        ...SUANCES_FEATURE,
        attributes: { ...SUANCES_FEATURE.attributes, puerta: 'C' },
      },
      suances,
    );
    expect(otherDoor?.id).not.toBe(parseCantabriaFeature(SUANCES_FEATURE, suances)?.id);
  });
});
