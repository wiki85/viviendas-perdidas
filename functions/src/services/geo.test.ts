import { describe, expect, it } from 'vitest';
import { resolveNeighborhood } from './geo.js';

describe('resolveNeighborhood', () => {
  it('resolves a point inside the real Russafa polygon', () => {
    expect(resolveNeighborhood('valencia', { latitude: 39.46, longitude: -0.374 })).toEqual({
      id: '2-russafa',
      name: 'Russafa',
    });
  });

  it('resolves real neighbourhoods in the five imported cities', () => {
    // Triana (Sevilla), el Raval (Barcelona), Palacio-ish center (Madrid).
    expect(
      resolveNeighborhood('sevilla', { latitude: 37.3838, longitude: -6.0025 }),
    ).not.toBeNull();
    expect(
      resolveNeighborhood('barcelona', { latitude: 41.3797, longitude: 2.1687 }),
    ).not.toBeNull();
    expect(resolveNeighborhood('madrid', { latitude: 40.415, longitude: -3.7104 })).not.toBeNull();
    expect(resolveNeighborhood('malaga', { latitude: 36.7213, longitude: -4.4214 })).not.toBeNull();
    // Casco Viejo (Bilbao), Gros (Donostia), Cort (Palma), Ensanche (Pamplona).
    expect(resolveNeighborhood('bilbao', { latitude: 43.2569, longitude: -2.9236 })).not.toBeNull();
    expect(
      resolveNeighborhood('donostia', { latitude: 43.3247, longitude: -1.9754 }),
    ).not.toBeNull();
    expect(resolveNeighborhood('palma', { latitude: 39.5696, longitude: 2.6501 })).not.toBeNull();
    expect(resolveNeighborhood('pamplona', { latitude: 42.8125, longitude: -1.644 })).toEqual({
      id: '4',
      name: 'Ensanche/Zabalgunea',
    });
    // Catedral de Granada y casco de Marbella (barrios DERA/IECA).
    expect(
      resolveNeighborhood('granada', { latitude: 37.1765, longitude: -3.5979 }),
    ).not.toBeNull();
    expect(
      resolveNeighborhood('marbella', { latitude: 36.5101, longitude: -4.8863 }),
    ).not.toBeNull();
  });

  it('returns null outside the municipality or for an unknown city', () => {
    // Mar Mediterráneo frente a València y una ciudad sin polígonos.
    expect(resolveNeighborhood('valencia', { latitude: 39.4, longitude: -0.2 })).toBeNull();
    expect(resolveNeighborhood('zaragoza', { latitude: 41.6488, longitude: -0.8891 })).toBeNull();
  });

  it('treats polygon boundaries as contained', () => {
    expect(resolveNeighborhood('barcelona', { latitude: 41.388, longitude: 2.17 })).not.toBeNull();
  });
});
