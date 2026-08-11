import { describe, expect, it } from 'vitest';
import { parseNavarraRecord, NAVARRA_MUNICIPALITIES } from './navarra.js';

const PAMPLONA = NAVARRA_MUNICIPALITIES.find((entry) => entry.cityId === 'pamplona') ?? {
  match: 'Pamplona / Iruña',
  name: 'PAMPLONA',
  cityId: 'pamplona',
};

function row(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    COD_INSCRIPCION: 'UAT01417',
    NOMBRE: 'Apartamento Prueba',
    MODALIDAD: 'Apartamento Turístico',
    DIRECCION: 'Julio Ruiz de Alda 6 1ºC',
    CODIGO_POSTAL: 31004,
    MUNICIPIO: 'Pamplona / Iruña',
    PLAZAS: '4',
    ...overrides,
  };
}

describe('parseNavarraRecord', () => {
  it('maps an urban tourist apartment with parsed address', () => {
    const record = parseNavarraRecord(row(), PAMPLONA);
    expect(record).toMatchObject({
      id: 'nav-UAT01417',
      registrationCode: 'UAT01417',
      entire: true,
      places: 4,
      municipality: 'PAMPLONA',
      cityId: 'pamplona',
      postalCode: '31004',
      street: 'julio ruiz de alda',
      number: '6',
      latitude: null,
      longitude: null,
    });
    expect(record?.addressText).toBe('Julio Ruiz de Alda, 6 (1ºC)');
  });

  it('accepts viviendas turísticas and rejects every other lodging type', () => {
    expect(parseNavarraRecord(row({ MODALIDAD: 'Vivienda Turística' }), PAMPLONA)).not.toBeNull();
    for (const modalidad of ['Hotel', 'Hotel-apartamento', 'Pensión', 'Casa rural vivienda']) {
      expect(parseNavarraRecord(row({ MODALIDAD: modalidad }), PAMPLONA)).toBeNull();
    }
  });

  it('counts a bloque de apartamentos by estimated units from its capacity', () => {
    // «Libere Pamplona», bloque de apartamentos con 114 plazas → ~33 apartamentos.
    const record = parseNavarraRecord(
      row({
        MODALIDAD: 'Bloque apartamentos turísticos',
        PLAZAS: '114',
        NOMBRE: 'Libere Pamplona',
      }),
      PAMPLONA,
    );
    expect(record?.units).toBe(33);
    expect(record?.entire).toBe(true);
  });

  it('filters by exact municipality value', () => {
    expect(parseNavarraRecord(row({ MUNICIPIO: 'Tudela' }), PAMPLONA)).toBeNull();
  });

  it('keeps addresses without a trailing number intact', () => {
    const record = parseNavarraRecord(row({ DIRECCION: 'Plaza del Castillo' }), PAMPLONA);
    expect(record?.street).toBe('plaza del castillo');
    expect(record?.number).toBe('');
    expect(record?.addressText).toBe('Plaza del Castillo');
  });
});
