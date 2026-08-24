import { describe, expect, it } from 'vitest';
import { parseGijonFeature, type GijonFeature } from './gijon.js';

/** Feature real del visor (muestreo del 24-08-2026, calle Capua 17). */
const CAPUA: GijonFeature = {
  properties: {
    id: '33',
    expediente: '828M/2014',
    tipologia: 'Declaración responsable',
    subtipolog: 'Vivienda de Uso Turistico',
    interesado: 'C-3 PATRIMONIO SL',
    objeto: 'COMUNICACION AMBIENTAL EDIFICIO PARA 16 APARTAMENTOS TURISTICOS EN CALLE CAPUA 17',
    estado: 'Expediente resuelto',
    licencia: 'CON LICENCIA',
    enlace_exp: 'http://erp/mytao/motores/mtrprc/expedienteDetail?dboid=123',
    calle: 'CAPUA',
    numero: '17',
    ref_catast: '5446624TP8254N0001XZ',
  },
  geometry: { coordinates: [-5.658359120259397, 43.54100843285398] },
};

describe('parseGijonFeature', () => {
  it('convierte una feature real en registro con coordenadas y catastral', () => {
    const record = parseGijonFeature(CAPUA);
    expect(record).not.toBeNull();
    expect(record?.id).toBe('gij-828M-2014');
    expect(record?.registrationCode).toBe('828M/2014');
    expect(record?.licenseKey).toBe('');
    expect(record?.addressText).toBe('CAPUA, 17');
    expect(record?.cadastralRef).toBe('5446624TP8254N0001XZ');
    expect(record?.latitude).toBeCloseTo(43.541, 3);
    expect(record?.entire).toBe(true);
    // El interesado y el enlace al ERP interno no viajan al espejo.
    expect(JSON.stringify(record)).not.toContain('PATRIMONIO');
    expect(JSON.stringify(record)).not.toContain('erp');
  });

  it('descarta subtipos distintos y expedientes sin licencia concedida', () => {
    expect(
      parseGijonFeature({
        ...CAPUA,
        properties: { ...CAPUA.properties, subtipolog: 'Hotel' },
      }),
    ).toBeNull();
    expect(
      parseGijonFeature({
        ...CAPUA,
        properties: { ...CAPUA.properties, licencia: 'EN TRÁMITE' },
      }),
    ).toBeNull();
  });

  it('descarta coordenadas fuera del radio gijonés', () => {
    const far = parseGijonFeature({ ...CAPUA, geometry: { coordinates: [-3.7038, 40.4168] } });
    expect(far?.latitude).toBeNull();
    expect(far?.cadastralRef).toBe('5446624TP8254N0001XZ');
  });
});
