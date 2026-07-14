import { describe, expect, it } from 'vitest';
import { resolveNeighborhood } from './geo.js';

describe('resolveNeighborhood', () => {
  it('resolves a point inside the Russafa seed polygon', () => {
    expect(resolveNeighborhood('valencia', { latitude: 39.46, longitude: -0.374 })).toEqual({
      id: 'russafa',
      name: 'Russafa',
    });
  });

  it('returns null outside seed coverage or for an unknown city', () => {
    expect(resolveNeighborhood('valencia', { latitude: 39.5, longitude: -0.4 })).toBeNull();
    expect(resolveNeighborhood('sevilla', { latitude: 37.389, longitude: -5.984 })).toBeNull();
  });

  it('treats polygon boundaries as contained', () => {
    expect(resolveNeighborhood('barcelona', { latitude: 41.388, longitude: 2.17 })).not.toBeNull();
  });
});
