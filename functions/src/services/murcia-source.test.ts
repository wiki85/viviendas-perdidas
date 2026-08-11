import { describe, expect, it } from 'vitest';
import { ingestMurciaTable, type MurciaBuckets } from './murcia-source.js';
import { MURCIA_MUNICIPALITIES } from '../domain/murcia.js';

const bySourceName = new Map(MURCIA_MUNICIPALITIES.map((entry) => [entry.sourceName, entry]));

/** Tabla HTML del ITREM con la cabecera real y las filas dadas. */
function table(rows: string[][]): string {
  const header =
    '<tr><th>SIGNATURA</th><th>DIRECCIÓN</th><th>LOCALIDAD</th><th>C.POSTAL</th>' +
    '<th>PLAZAS</th><th>REF. CATASTRAL</th><th>N. COMERCIAL</th></tr>';
  const body = rows
    .map((cells) => `<tr>${cells.map((c) => `<td>${c}</td>`).join('')}</tr>`)
    .join('');
  return `<table>${header}${body}</table>`;
}

describe('ingestMurciaTable', () => {
  it('merges viviendas and apartamentos into the same buckets without collisions', () => {
    const buckets: MurciaBuckets = new Map();
    const viviendas = ingestMurciaTable(
      table([['VV.MU.6935-1', 'CL REAL Nº 16', 'CARTAGENA', '30648', '6', '', 'CASA CUEVA']]),
      bySourceName,
      buckets,
    );
    // Los apartamentos: una fila por apartamento (A.MU.###-n), cada una cuenta.
    const apartamentos = ingestMurciaTable(
      table([
        ['A.MU.095-1', 'CL MANGA Nº 3 P1', 'CARTAGENA (LA MANGA)', '30380', '4', '', 'MARUJA I'],
        ['A.MU.095-2', 'CL MANGA Nº 3 P2', 'CARTAGENA (LA MANGA)', '30380', '4', '', 'MARUJA I'],
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

  it('throws when the table lacks the expected header (fails safe, no bad rows)', () => {
    expect(() =>
      ingestMurciaTable('<table><tr><td>vacío</td></tr></table>', bySourceName, new Map()),
    ).toThrow();
  });
});
