import { describe, expect, it } from 'vitest';
import { ingestMurciaTable, type MurciaBuckets } from './murcia-source.js';
import { MURCIA_MUNICIPALITIES } from '../domain/murcia.js';

const bySourceName = new Map(MURCIA_MUNICIPALITIES.map((entry) => [entry.sourceName, entry]));

/** Tabla HTML del ITREM con la cabecera real de agosto de 2026: 13 columnas
 * y la dirección servida como entidad HTML («DIRECCI&Oacute;N»), tal cual
 * llega del portal. Cada fila: [signatura, nombre, dirección, localidad,
 * cp, plazas, refCatastral]. */
function table(rows: string[][]): string {
  const header =
    '<tr><th>SIGNATURA</th><th>FECHA DE PRESENTACIÓN DECLARACIÓN RESPONSABLE</th>' +
    '<th>FECHA DE RESOLUCIÓN DE CLASIFICACIÓN</th><th>N. COMERCIAL</th>' +
    '<th>DIRECCI&Oacute;N</th><th>LOCALIDAD</th><th>C.POSTAL</th><th>Nº VIV</th>' +
    '<th>PLAZAS</th><th>TELÉFONO</th><th>REF. CATASTRAL</th><th>WEB</th><th>EMAIL</th></tr>';
  const body = rows
    .map(([signatura, nombre, direccion, localidad, cp, plazas, catastral]) => {
      const cells = [
        signatura,
        '01/02/2024',
        '01/03/2024',
        nombre,
        direccion,
        localidad,
        cp,
        '1',
        plazas,
        '',
        catastral,
        '',
        '',
      ];
      return `<tr>${cells.map((c) => `<td>${c ?? ''}</td>`).join('')}</tr>`;
    })
    .join('');
  return `<table>${header}${body}</table>`;
}

describe('ingestMurciaTable', () => {
  it('merges viviendas and apartamentos into the same buckets without collisions', () => {
    const buckets: MurciaBuckets = new Map();
    const viviendas = ingestMurciaTable(
      table([['VV.MU.6935-1', 'CASA CUEVA', 'CL REAL Nº 16', 'CARTAGENA', '30648', '6', '']]),
      bySourceName,
      buckets,
    );
    // Los apartamentos: una fila por apartamento (A.MU.###-n), cada una cuenta.
    const apartamentos = ingestMurciaTable(
      table([
        ['A.MU.095-1', 'MARUJA I', 'CL MANGA Nº 3 P1', 'CARTAGENA (LA MANGA)', '30380', '4', ''],
        ['A.MU.095-2', 'MARUJA I', 'CL MANGA Nº 3 P2', 'CARTAGENA (LA MANGA)', '30380', '4', ''],
      ]),
      bySourceName,
      buckets,
    );
    expect(viviendas).toBe(1);
    expect(apartamentos).toBe(2);
    const cartagena = buckets.get('CARTAGENA');
    // 1 vivienda + 2 apartamentos, cada uno una vivienda perdida.
    expect(cartagena?.size).toBe(3);
    expect([...(cartagena?.keys() ?? [])]).toEqual([
      'mur-VV-MU-6935-1',
      'mur-A-MU-095-1',
      'mur-A-MU-095-2',
    ]);
  });

  it('decodes the DIRECCI&Oacute;N header entity and keeps addresses (ago 2026)', () => {
    const buckets: MurciaBuckets = new Map();
    ingestMurciaTable(
      table([['VV.MU.6935-1', 'CASA CUEVA', 'CL REAL Nº 16', 'CARTAGENA', '30648', '6', '']]),
      bySourceName,
      buckets,
    );
    const record = buckets.get('CARTAGENA')?.get('mur-VV-MU-6935-1');
    expect(record?.addressText).toBe('CL REAL Nº 16');
  });

  it('throws when the table lacks the expected header (fails safe, no bad rows)', () => {
    expect(() =>
      ingestMurciaTable('<table><tr><td>vacío</td></tr></table>', bySourceName, new Map()),
    ).toThrow();
  });

  it('throws when a required column disappears instead of importing blank fields', () => {
    const withoutAddress =
      '<table><tr><th>SIGNATURA</th><th>LOCALIDAD</th><th>C.POSTAL</th><th>PLAZAS</th>' +
      '<th>REF. CATASTRAL</th><th>N. COMERCIAL</th></tr>' +
      '<tr><td>VV.MU.1-1</td><td>CARTAGENA</td><td>30648</td><td>4</td><td></td><td>X</td></tr></table>';
    expect(() => ingestMurciaTable(withoutAddress, bySourceName, new Map())).toThrow(/DIRECCIÓN/u);
  });
});
