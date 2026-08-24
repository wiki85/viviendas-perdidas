import { describe, expect, it } from 'vitest';
import { parseAvilesRow, type AvilesRow } from './aviles.js';

/** Fila real del datastore (muestreo del 24-08-2026). */
const FRUELA: AvilesRow = {
  _id: 21,
  Signatura: 'VUT.1097.AS',
  Titular: 'LOPEZ LOPEZ,JOSEFINA',
  'Nombre Comercial': 'FRUELA 12',
  Tipo: 'Vivienda de Uso Turístico',
  Domicilio: 'FRUELA',
  Numero: '12',
  Bloque: null,
  Escalera: null,
  Piso: '4',
  Puerta: null,
  Plazas: '4',
  'Ref. Catastral': '4461012TP6246S0009EB',
  Localidad: 'AVILÉS',
  Municipio: 'AVILES',
  CP: '33400',
  Estado: 'VIGENTE',
  'Fecha Alta': '2019-10-17 00:00:00',
};

/** Bloque de apartamentos turísticos real (Galiana 25, 40 plazas). */
const GALIANA: AvilesRow = {
  ...FRUELA,
  Signatura: 'AT.1206.AS',
  'Nombre Comercial': 'SUITE 1907 AVILES',
  Tipo: 'Apartamento Turístico',
  Domicilio: 'GALIANA',
  Numero: '25',
  Piso: null,
  Plazas: '40',
  'Ref. Catastral': null,
};

describe('parseAvilesRow', () => {
  it('convierte una VUT real en registro con signatura y catastral', () => {
    const record = parseAvilesRow(FRUELA);
    expect(record?.id).toBe('avi-VUT-1097-AS');
    expect(record?.registrationCode).toBe('VUT.1097.AS');
    expect(record?.places).toBe(4);
    expect(record?.cadastralRef).toBe('4461012TP6246S0009EB');
    expect(record?.addressText).toBe('FRUELA, 12 (piso 4)');
    expect(record?.units).toBeUndefined();
    // El titular no viaja al espejo.
    expect(JSON.stringify(record)).not.toContain('JOSEFINA');
  });

  it('cuenta los bloques de apartamentos por sus unidades estimadas', () => {
    const record = parseAvilesRow(GALIANA);
    expect(record?.units).toBe(11); // 40 plazas ÷ ~3,5 por apartamento
    expect(record?.entire).toBe(true);
    expect(record?.cadastralRef).toBeUndefined();
  });

  it('descarta hoteles, no vigentes y otros municipios', () => {
    expect(parseAvilesRow({ ...FRUELA, Signatura: 'H.0123.AS' })).toBeNull();
    expect(parseAvilesRow({ ...FRUELA, Estado: 'BAJA' })).toBeNull();
    expect(parseAvilesRow({ ...FRUELA, Municipio: 'CASTRILLON' })).toBeNull();
  });

  it('limpia los NBSP que cuela el datastore', () => {
    const record = parseAvilesRow({ ...FRUELA, Domicilio: 'LA HERA' });
    expect(record?.addressText).toBe('LA HERA, 12 (piso 4)');
  });
});
