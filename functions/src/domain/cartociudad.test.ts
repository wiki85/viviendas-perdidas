import { describe, expect, it } from 'vitest';
import {
  cartoCiudadMunicipality,
  cartoCiudadMuniMatches,
  parseCartoCiudadResponse,
} from './cartociudad.js';

const PORTAL = `callback({"muni":"Bilbao","type":"portal","lat":43.2659674516213,"lng":-2.9351731739993934})`;

describe('parseCartoCiudadResponse', () => {
  it('accepts portal-level matches and extracts WGS84 coordinates', () => {
    expect(parseCartoCiudadResponse(PORTAL)).toEqual({
      latitude: 43.2659674516213,
      longitude: -2.9351731739993934,
      muni: 'Bilbao',
    });
  });

  it('rejects coarse matches (street or municipality centroids)', () => {
    expect(parseCartoCiudadResponse(PORTAL.replace('"portal"', '"callejero"'))).toBeNull();
    expect(parseCartoCiudadResponse(PORTAL.replace('"portal"', '"Municipio"'))).toBeNull();
  });

  it('handles empty and malformed responses', () => {
    expect(parseCartoCiudadResponse('callback([])')).toBeNull();
    expect(parseCartoCiudadResponse('callback(null)')).toBeNull();
    expect(parseCartoCiudadResponse('<html>error</html>')).toBeNull();
  });

  it('rejects coordinates outside the Spanish bounding box', () => {
    expect(parseCartoCiudadResponse(PORTAL.replace('43.2659674516213', '10.0'))).toBeNull();
  });
});

describe('cartoCiudadMunicipality', () => {
  it('uses the short spelling of bilingual municipality names', () => {
    expect(cartoCiudadMunicipality('DONOSTIA / SAN SEBASTIÁN')).toBe('SAN SEBASTIÁN');
    expect(cartoCiudadMunicipality('BILBAO')).toBe('BILBAO');
  });
});

describe('cartoCiudadMuniMatches', () => {
  it('accepts matching municipalities across spellings', () => {
    expect(cartoCiudadMuniMatches('Madrid', 'MADRID')).toBe(true);
    expect(cartoCiudadMuniMatches('Donostia/San Sebastián', 'DONOSTIA / SAN SEBASTIÁN')).toBe(true);
    expect(cartoCiudadMuniMatches('', 'MADRID')).toBe(true);
  });

  it('rejects a portal the geocoder places in another municipality', () => {
    expect(cartoCiudadMuniMatches('Alcobendas', 'MADRID')).toBe(false);
    expect(cartoCiudadMuniMatches('Getafe', 'MADRID')).toBe(false);
  });
});
