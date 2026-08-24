import { describe, expect, it } from 'vitest';
import {
  EIVISSA_MUNICIPALITIES,
  isEivissaGhostRow,
  parseEivissaRow,
  type EivissaRow,
} from './eivissa.js';

function municipality(name: string) {
  const entry = EIVISSA_MUNICIPALITIES.find((candidate) => candidate.name === name);
  if (entry === undefined) throw new Error(`Municipio de test ausente: ${name}`);
  return entry;
}
const santJosep = municipality('SANT JOSEP DE SA TALAIA');
const santaEularia = municipality('SANTA EULÀRIA DES RIU');

/** Fila real del export del 24-08-2026 (Cala Tarida, rústica con RC de polígono). */
const CALA_TARIDA: EivissaRow = {
  subTipus: 'Estancia Turística Vacacional',
  numeroInscripcio: '#ETV1276E',
  nomComercial: '101',
  totalPlaces: '12',
  referenciaCadastral: '07048A02100022',
  direccio: 'CR CALA TARIDA 101 FRENTE BAR STOP SANT JOSEP - SANT JOSEP DE SA TALAIA',
  municipi: 'SANT JOSEP DE SA TALAIA',
};

/** Fila real urbana con RC de finca y código postal dentro de la dirección. */
const CALA_LLONGA: EivissaRow = {
  subTipus: 'Estancia Turística Vacacional',
  numeroInscripcio: '#ETV1691E',
  nomComercial: 'AGUAMARIN 1',
  totalPlaces: '6',
  referenciaCadastral: '2031036CD7123S',
  direccio:
    'CL KILIMANJARO 31 URB.CALA LLONGA PARCELA 72A CALA LLONGA - 07849 SANTA EULARIA DES RIU',
  municipi: 'SANTA EULARIA DES RIU',
};

describe('parseEivissaRow', () => {
  it('convierte una fila real en registro con referencia catastral', () => {
    const record = parseEivissaRow(CALA_TARIDA, santJosep);
    expect(record).not.toBeNull();
    expect(record?.registrationCode).toBe('ETV1276E');
    expect(record?.id).toMatch(/^eiv-ETV1276E-[0-9a-f]{8}$/u);
    expect(record?.places).toBe(12);
    expect(record?.cadastralRef).toBe('07048A02100022');
    expect(record?.entire).toBe(true);
    expect(record?.latitude).toBeNull();
    expect(record?.municipality).toBe('SANT JOSEP DE SA TALAIA');
  });

  it('extrae el código postal cuando viaja dentro de la dirección', () => {
    const record = parseEivissaRow(CALA_LLONGA, santaEularia);
    expect(record?.postalCode).toBe('07849');
    expect(record?.municipality).toBe('SANTA EULÀRIA DES RIU');
  });

  it('desambigua números de inscripción repetidos con la dirección', () => {
    const twin = { ...CALA_TARIDA, direccio: 'CR CALA TARIDA 102 - SANT JOSEP DE SA TALAIA' };
    const a = parseEivissaRow(CALA_TARIDA, santJosep);
    const b = parseEivissaRow(twin, santJosep);
    expect(a?.id).not.toBe(b?.id);
  });

  it('descarta filas de otro municipio y figuras que no son vivienda', () => {
    expect(parseEivissaRow(CALA_TARIDA, santaEularia)).toBeNull();
    expect(parseEivissaRow({ ...CALA_TARIDA, subTipus: 'Comercialitzador' }, santJosep)).toBeNull();
  });

  it('descarta la pseudo-fila «NUEVO BOLSA DE PLAZAS»', () => {
    const ghost: EivissaRow = {
      subTipus: 'Estancia Turística Vacacional',
      numeroInscripcio: '#',
      nomComercial: '',
      totalPlaces: '0',
      referenciaCadastral: '',
      direccio: '',
      municipi: 'NUEVO BOLSA DE PLAZAS',
    };
    expect(isEivissaGhostRow(ghost)).toBe(true);
    for (const municipality of EIVISSA_MUNICIPALITIES) {
      expect(parseEivissaRow(ghost, municipality)).toBeNull();
    }
  });

  it('ignora referencias catastrales cortas o malformadas', () => {
    const record = parseEivissaRow({ ...CALA_TARIDA, referenciaCadastral: '123' }, santJosep);
    expect(record?.cadastralRef).toBeUndefined();
  });
});
