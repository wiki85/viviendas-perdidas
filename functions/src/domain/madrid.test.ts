import { describe, expect, it } from 'vitest';
import { parseMadridRow } from './madrid.js';

describe('parseMadridRow', () => {
  const structured = {
    TipoAlojamiento: 'VT',
    TipoVia: 'CALLE',
    NombreVia: 'de Fuentidueña',
    Numero: '12',
    Portal: '',
    Bloque: '',
    Escalera: '1',
    Planta: 'bajo',
    Puerta: 'B',
    Localidad: 'Madrid',
  };

  it('maps a structured (2026) row with synthetic id and unit detail', () => {
    const record = parseMadridRow(structured);
    expect(record).toMatchObject({
      registrationCode: '',
      entire: true,
      places: 0,
      municipality: 'MADRID',
      cityId: 'madrid',
      street: 'calle de fuentiduena',
      number: '12',
      latitude: null,
    });
    expect(record?.id).toMatch(/^mad-[0-9a-f]{16}$/);
    expect(record?.addressText).toBe('CALLE de Fuentidueña, 12 (esc. 1, planta bajo, puerta B)');
  });

  it('maps a legacy (2025) row parsing the free-text address', () => {
    const record = parseMadridRow({
      ALOJAMIENTO: 'VIVIENDA USO TUR.',
      DIRECCION_VT: 'C/ LUIS DE ASTRANA MARIN, Nº 8, P01, A',
      MUNICIPIO: 'MADRID',
    });
    expect(record).toMatchObject({
      municipality: 'MADRID',
      number: '8',
      entire: true,
    });
    expect(record?.addressText).toBe('C/ LUIS DE ASTRANA MARIN, 8 (P01, A)');
    expect(record?.id).toMatch(/^mad-[0-9a-f]{16}$/);
  });

  it('produces the same id for the same dwelling re-declared', () => {
    const first = parseMadridRow(structured);
    const second = parseMadridRow({ ...structured, Localidad: 'MADRID' });
    expect(first?.id).toBe(second?.id);
  });

  it('filters other lodging types and other municipalities', () => {
    expect(parseMadridRow({ ...structured, TipoAlojamiento: 'AT' })).toBeNull();
    expect(parseMadridRow({ ...structured, Localidad: 'Alcobendas' })).toBeNull();
    expect(
      parseMadridRow({
        ALOJAMIENTO: 'VIVIENDA USO TUR.',
        DIRECCION_VT: 'C/ MAYOR, Nº 1',
        MUNICIPIO: 'GETAFE',
      }),
    ).toBeNull();
  });
});
