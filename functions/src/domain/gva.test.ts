import { describe, expect, it } from 'vitest';
import { parseCsvRecords } from './csv.js';
import { parseCatastroCoordinates, parseGvaRow, GVA_MUNICIPALITIES } from './gva.js';

const VALENCIA = GVA_MUNICIPALITIES.find((entry) => entry.cityId === 'valencia') ?? {
  codProvincia: '46',
  codMunicipio: '250',
  name: 'VALÈNCIA',
  cityId: 'valencia',
};

function gvaRow(overrides: Record<string, string> = {}): Record<string, string> {
  return {
    signatura: 'CV-VUT0514102-A',
    nombre: '',
    direccion: 'CL ARRABAL, 11, Es:T Pl:OD Pt:OS',
    cp: '46001',
    cod_provincia: '46',
    cod_municipio: '250',
    municipio: 'VALÈNCIA',
    plazas_totales: '14',
    dormit_totales: '7',
    ref_catastral: '7439912YJ4073N0001TY',
    rural: 'N',
    ...overrides,
  };
}

describe('parseGvaRow', () => {
  it('maps a register row with address, capacity and cadastral reference', () => {
    const record = parseGvaRow(gvaRow(), VALENCIA);
    expect(record).toMatchObject({
      id: 'gva-CV-VUT0514102-A',
      registrationCode: 'CV-VUT0514102-A',
      entire: true,
      places: 14,
      municipality: 'VALÈNCIA',
      cityId: 'valencia',
      postalCode: '46001',
      street: 'calle arrabal',
      number: '11',
      cadastralRef: '7439912YJ4073N0001TY',
      latitude: null,
      longitude: null,
    });
    expect(record?.addressText).toBe('CL ARRABAL, 11 (Es:T Pl:OD Pt:OS)');
  });

  it('omits the cadastral field entirely when the reference is unusable', () => {
    const record = parseGvaRow(gvaRow({ ref_catastral: '123' }), VALENCIA);
    expect(record).not.toBeNull();
    // Firestore rejects explicit `undefined` values in persisted documents.
    expect(Object.keys(record ?? {})).not.toContain('cadastralRef');
  });

  it('handles addresses without a street number', () => {
    const record = parseGvaRow(gvaRow({ direccion: 'PARTIDA BENIATLA, POLIG 5' }), VALENCIA);
    expect(record?.number).toBe('');
    expect(record?.addressText).toBe('PARTIDA BENIATLA (POLIG 5)');
  });

  it('rejects rows without signatura', () => {
    expect(parseGvaRow(gvaRow({ signatura: ' ' }), VALENCIA)).toBeNull();
  });
});

describe('parseCsvRecords', () => {
  it('indexes semicolon-separated rows by header', () => {
    const rows = parseCsvRecords('a;b\n1;"x;y"\n', ';');
    expect(rows).toEqual([{ a: '1', b: 'x;y' }]);
  });
});

describe('parseCatastroCoordinates', () => {
  const OK_XML = `<consulta_coordenadas><control><cucoor>1</cucoor><cuerr>0</cuerr></control>
    <coordenadas><coord><geo><xcen>-0.149730860304789</xcen><ycen>38.847436303904</ycen><srs>EPSG:4326</srs></geo></coord></coordenadas></consulta_coordenadas>`;

  it('extracts longitude (xcen) and latitude (ycen)', () => {
    expect(parseCatastroCoordinates(OK_XML)).toEqual({
      latitude: 38.847436303904,
      longitude: -0.149730860304789,
    });
  });

  it('returns null on service errors or missing geometry', () => {
    expect(
      parseCatastroCoordinates(
        '<consulta_coordenadas><control><cuerr>1</cuerr></control></consulta_coordenadas>',
      ),
    ).toBeNull();
    expect(parseCatastroCoordinates('<control><cuerr>0</cuerr></control>')).toBeNull();
  });

  it('rejects coordinates outside the Spanish bounding box', () => {
    const xml = OK_XML.replace('38.847436303904', '10.0').replace('-0.149730860304789', '55.0');
    expect(parseCatastroCoordinates(xml)).toBeNull();
  });
});
