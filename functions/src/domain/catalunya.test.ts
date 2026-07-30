import { describe, expect, it } from 'vitest';
import {
  buildBarcelonaCityIndex,
  parseCatRecord,
  CAT_ENTIRE_TYPE,
  CAT_SHARED_TYPE,
} from './catalunya.js';
import { parseCsv } from './csv.js';
import { cleanAddressForGeocoding, streetsLooselyMatch } from './openrta.js';

const CITY_CSV = [
  'N_EXPEDIENT,NOM_BARRI,NUMERO_REGISTRE_GENERALITAT,NUMERO_PLACES,LONGITUD_X,LATITUD_Y',
  '01-2009-0354,el Raval,HUTB-002222,3,2.17017206787341,41.3784454355655',
  '01-2011-0123,"Sant Pere, Santa Caterina i la Ribera",HUTB-003654,3,2.18200417667745,41.3828840594187',
  // Coordinates outside the Spanish bounding box: must be dropped.
  '01-2012-0001,Nowhere,HUTB-999999,2,55.0,10.0',
].join('\r\n');

function hutRow(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    tipus_establiment: CAT_ENTIRE_TYPE,
    n_mero_inscripci: 'HUTB-002222',
    r_tol: 'Sense especificar',
    estat: 'Alta',
    tipus_de_via: 'Carrer',
    nom_de_la_via: 'Marina',
    numero: '306',
    pis: '1',
    porta: '4',
    codi_postal: '08025',
    municipi: 'Barcelona',
    total_places: '6',
    ...overrides,
  };
}

describe('parseCsv', () => {
  it('handles quoted fields with embedded commas and CRLF endings', () => {
    const rows = parseCsv(CITY_CSV);
    expect(rows).toHaveLength(4);
    expect(rows[2]?.[1]).toBe('Sant Pere, Santa Caterina i la Ribera');
  });
});

describe('buildBarcelonaCityIndex', () => {
  const coordinates = buildBarcelonaCityIndex(CITY_CSV);

  it('indexes WGS84 coordinates and licensed places by registry code', () => {
    expect(coordinates.get('HUTB-002222')).toEqual({
      latitude: 41.3784454355655,
      longitude: 2.17017206787341,
      places: 3,
    });
  });

  it('drops rows with coordinates outside Spain', () => {
    expect(coordinates.size).toBe(2);
    expect(coordinates.has('HUTB-999999')).toBe(false);
  });
});

describe('parseCatRecord', () => {
  const coordinates = buildBarcelonaCityIndex(CITY_CSV);

  it('maps an entire-home HUT with joined coordinates', () => {
    const record = parseCatRecord(hutRow(), coordinates);
    expect(record).toMatchObject({
      id: 'cat-HUTB-002222',
      registrationCode: 'HUTB-002222',
      entire: true,
      places: 6,
      municipality: 'BARCELONA',
      cityId: 'barcelona',
      postalCode: '08025',
      number: '306',
      latitude: 41.3784454355655,
      longitude: 2.17017206787341,
    });
    expect(record?.addressText).toBe('Carrer Marina, 306 (pis 1, porta 4)');
    // 'Sense especificar' is the registry's own placeholder, not a name.
    expect(record?.name).toBe('');
  });

  it('leaves rows without a city-hall match unlocated for the geocoding repair', () => {
    const record = parseCatRecord(hutRow({ n_mero_inscripci: 'HUTB-777777' }), coordinates);
    expect(record?.latitude).toBeNull();
    expect(record?.longitude).toBeNull();
  });

  it('falls back to the city-hall capacity when the registry omits total_places', () => {
    const record = parseCatRecord(hutRow({ total_places: undefined }), coordinates);
    expect(record?.places).toBe(3);
    // Without a city-hall match either, capacity stays honestly at 0.
    const orphan = parseCatRecord(
      hutRow({ total_places: undefined, n_mero_inscripci: 'HUTB-777777' }),
      coordinates,
    );
    expect(orphan?.places).toBe(0);
  });

  it('treats llars compartides as rooms-only rentals', () => {
    const record = parseCatRecord(
      hutRow({ tipus_establiment: CAT_SHARED_TYPE, n_mero_inscripci: 'LLB-000004' }),
      coordinates,
    );
    expect(record?.entire).toBe(false);
    expect(record?.id).toBe('cat-LLB-000004');
  });

  it('ignores establishment types we do not mirror', () => {
    expect(parseCatRecord(hutRow({ tipus_establiment: 'Hotels' }), coordinates)).toBeNull();
  });

  it('normalizes SN (no number) to an empty street number', () => {
    const record = parseCatRecord(hutRow({ numero: 'SN', pis: '', porta: '' }), coordinates);
    expect(record?.number).toBe('');
    expect(record?.addressText).toBe('Carrer Marina');
  });
});

describe('address matching across registries', () => {
  it('strips the Catalan floor/door parenthetical before geocoding', () => {
    expect(cleanAddressForGeocoding('Carrer Marina, 306 (pis 1, porta 4)')).toBe(
      'Carrer Marina, 306',
    );
  });

  it('matches a Castilian submission against the Catalan registry street', () => {
    expect(streetsLooselyMatch('carrer marina', 'calle marina')).toBe(true);
    expect(streetsLooselyMatch('avinguda diagonal', 'avenida diagonal')).toBe(true);
    expect(streetsLooselyMatch('carrer marina', 'calle mallorca')).toBe(false);
  });
});
