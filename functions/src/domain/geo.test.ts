import { describe, expect, it } from 'vitest';
import { distanceMeters, isInsideSpainBoundingBox } from './geo.js';

describe('geo primitives', () => {
  it('accepts mainland and Canary coordinates but rejects clearly foreign coordinates', () => {
    expect(isInsideSpainBoundingBox({ latitude: 40.4168, longitude: -3.7038 })).toBe(true);
    expect(isInsideSpainBoundingBox({ latitude: 28.1235, longitude: -15.4363 })).toBe(true);
    expect(isInsideSpainBoundingBox({ latitude: 48.8566, longitude: 2.3522 })).toBe(false);
  });

  it('computes short distances in meters', () => {
    const distance = distanceMeters(
      { latitude: 39.462, longitude: -0.374 },
      { latitude: 39.4621, longitude: -0.374 },
    );
    expect(distance).toBeGreaterThan(11);
    expect(distance).toBeLessThan(12);
  });
});
