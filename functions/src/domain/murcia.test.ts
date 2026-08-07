import { describe, expect, it } from 'vitest';
import {
  MURCIA_MUNICIPALITIES,
  murciaBaseLocality,
  parseMurciaRow,
  type MurciaRow,
} from './murcia.js';

const CARTAGENA = MURCIA_MUNICIPALITIES.find((entry) => entry.cityId === 'cartagena');
if (CARTAGENA === undefined) throw new Error('Cartagena debe estar espejada');

const ROW: MurciaRow = {
  signatura: 'VV.MU.6935-1',
  direccion: 'CL REAL DE PAVOS - Nº 16 - PISO 0 -',
  localidad: 'CARTAGENA (LA MANGA DEL MAR MENOR)',
  codigoPostal: '30648',
  plazas: '6',
  referenciaCatastral: '30001A013000260000FI',
  nombreComercial: 'CASA CUEVA LA LIBELA',
};

describe('parseMurciaRow', () => {
  it('maps a real row with cadastral reference and no coordinates', () => {
    const record = parseMurciaRow(ROW, CARTAGENA);
    expect(record).toMatchObject({
      id: 'mur-VV-MU-6935-1',
      registrationCode: 'VV.MU.6935-1',
      cityId: 'cartagena',
      municipality: 'CARTAGENA',
      entire: true,
      places: 6,
      cadastralRef: '30001A013000260000FI',
      latitude: null,
      longitude: null,
    });
    expect(record?.addressText).toBe('CL REAL DE PAVOS - Nº 16 - PISO 0');
    expect(record?.number).toBe('16');
  });

  it('omits cadastralRef when the column is empty or malformed', () => {
    expect(parseMurciaRow({ ...ROW, referenciaCatastral: '' }, CARTAGENA)?.cadastralRef).toBe(
      undefined,
    );
    expect(parseMurciaRow({ ...ROW, referenciaCatastral: 'S/N' }, CARTAGENA)?.cadastralRef).toBe(
      undefined,
    );
  });

  it('rejects rows without signatura', () => {
    expect(parseMurciaRow({ ...ROW, signatura: ' ' }, CARTAGENA)).toBeNull();
  });

  it('blanks commercial names that are just the owner email', () => {
    expect(
      parseMurciaRow({ ...ROW, nombreComercial: 'NOMBRE.APELLIDO@PROVEEDOR.COM' }, CARTAGENA)?.name,
    ).toBe('');
    expect(parseMurciaRow({ ...ROW, nombreComercial: '1209 GOLF@D BEACH' }, CARTAGENA)?.name).toBe(
      '1209 GOLF@D BEACH',
    );
  });
});

describe('murciaBaseLocality', () => {
  it('strips the pedanía from the LOCALIDAD field', () => {
    expect(murciaBaseLocality('CARTAGENA (LA MANGA DEL MAR MENOR)')).toBe('CARTAGENA');
    expect(murciaBaseLocality('MURCIA')).toBe('MURCIA');
    expect(murciaBaseLocality(' ÁGUILAS (CALABARDINA) ')).toBe('ÁGUILAS');
  });
});
