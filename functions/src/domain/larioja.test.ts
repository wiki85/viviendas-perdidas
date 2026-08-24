import { describe, expect, it } from 'vitest';
import {
  extractRiojaListings,
  LARIOJA_MUNICIPALITIES,
  riojaListingToRecord,
  type RiojaTextItem,
} from './larioja.js';

function municipality(name: string) {
  const entry = LARIOJA_MUNICIPALITIES.find((candidate) => candidate.name === name);
  if (entry === undefined) throw new Error(`Municipio de test ausente: ${name}`);
  return entry;
}
const logrono = municipality('LOGROÑO');

/** Items reales de la edición de agosto de 2026 (coordenadas medidas):
 * cabecera, una fila normal y la fila partida en dos y (VT-LR-0015 con su
 * municipio un punto más arriba, la trampa que rompía el agrupado). */
const PAGE_ONE: RiojaTextItem[] = [
  { text: 'VUT AGOSTO 2026', x: 264, y: 811 },
  { text: 'NUMERO DE', x: 83, y: 780 },
  { text: 'REGISTRO', x: 86, y: 769 },
  { text: 'COM. INICIO', x: 140, y: 774 },
  { text: 'DIRECCIÓN', x: 281, y: 774 },
  { text: 'NOMBRE DEL MUNICIPIO', x: 433, y: 774 },
  { text: '1', x: 67, y: 758 },
  { text: 'VT-LR-1284', x: 83, y: 758 },
  { text: '02/09/2020', x: 137, y: 758 },
  { text: 'AVENIDA DE LA RIOJA, 8 2º DCHA.', x: 188, y: 758 },
  { text: 'ÁBALOS', x: 413, y: 758 },
  { text: '62', x: 63, y: 78 },
  { text: 'ARNEDILLO', x: 413, y: 78 },
  { text: 'VT-LR-0015', x: 82, y: 77 },
  { text: '22/08/2008', x: 137, y: 77 },
  { text: 'TRAVESÍA DE LA CRUZ, 2 1º IZDA.', x: 188, y: 77 },
];

/** Página con una dirección larga que salta de línea (continuación). */
const PAGE_TWO: RiojaTextItem[] = [
  { text: '900', x: 67, y: 700 },
  { text: 'VT-LR-2000', x: 83, y: 700 },
  { text: '01/01/2024', x: 137, y: 700 },
  { text: 'CALLE DEL MARQUÉS DE SAN NICOLÁS', x: 188, y: 700 },
  { text: 'LOGROÑO', x: 413, y: 700 },
  { text: '109 2º B', x: 188, y: 689 },
];

describe('extractRiojaListings', () => {
  const listings = extractRiojaListings([PAGE_ONE, PAGE_TWO]);

  it('reconstruye las filas y descarta cabeceras y título', () => {
    expect(listings.map((listing) => listing.registrationCode)).toEqual([
      'VT-LR-1284',
      'VT-LR-0015',
      'VT-LR-2000',
    ]);
    expect(listings[0]).toEqual({
      registrationCode: 'VT-LR-1284',
      addressText: 'AVENIDA DE LA RIOJA, 8 2º DCHA.',
      municipality: 'ÁBALOS',
    });
  });

  it('une la fila partida en dos alturas casi iguales', () => {
    expect(listings[1]).toEqual({
      registrationCode: 'VT-LR-0015',
      addressText: 'TRAVESÍA DE LA CRUZ, 2 1º IZDA.',
      municipality: 'ARNEDILLO',
    });
  });

  it('anexa las continuaciones de dirección a la fila anterior', () => {
    expect(listings[2]?.addressText).toBe('CALLE DEL MARQUÉS DE SAN NICOLÁS 109 2º B');
    expect(listings[2]?.municipality).toBe('LOGROÑO');
  });
});

describe('riojaListingToRecord', () => {
  it('convierte una fila de Logroño en registro geocodificable', () => {
    const record = riojaListingToRecord(
      {
        registrationCode: 'VT-LR-2000',
        addressText: 'CALLE DEL MARQUÉS DE SAN NICOLÁS 109 2º B',
        municipality: 'LOGROÑO',
      },
      logrono,
    );
    expect(record?.id).toBe('lrj-VT-LR-2000');
    expect(record?.number).toBe('109');
    expect(record?.entire).toBe(true);
    expect(record?.places).toBe(0);
    expect(record?.latitude).toBeNull();
  });

  it('descarta filas de otros municipios y sin dirección', () => {
    const abalos = {
      registrationCode: 'VT-LR-1284',
      addressText: 'AVENIDA DE LA RIOJA, 8',
      municipality: 'ÁBALOS',
    };
    expect(riojaListingToRecord(abalos, logrono)).toBeNull();
    expect(
      riojaListingToRecord({ ...abalos, municipality: 'LOGROÑO', addressText: '' }, logrono),
    ).toBeNull();
  });
});
