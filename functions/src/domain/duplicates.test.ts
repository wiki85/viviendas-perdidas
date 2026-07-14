import { describe, expect, it } from 'vitest';
import type { DuplicateCandidate, ListingAddress } from '../types.js';
import { classifyDuplicateCandidates, samePortal } from './duplicates.js';

const targetAddress: ListingAddress = {
  formatted: 'Carrer de Cadis, 10, València',
  street: 'Carrer de Cadis',
  number: '10',
  postalCode: '46006',
  locality: 'València',
  province: 'Valencia',
};

function candidate(overrides: Partial<DuplicateCandidate> = {}): DuplicateCandidate {
  return {
    id: 'candidate-1',
    type: 'unit',
    dwellingsCount: 1,
    address: targetAddress,
    location: { latitude: 39.462, longitude: -0.374 },
    neighborhoodId: 'russafa',
    cityId: 'valencia',
    status: 'active',
    ...overrides,
  };
}

describe('duplicate classification', () => {
  it('normalizes accents, case, punctuation and common street prefixes', () => {
    expect(
      samePortal(targetAddress, {
        ...targetAddress,
        street: 'carrer de càdis',
        number: '10 ',
      }),
    ).toBe(true);
  });

  it('blocks a building and warns for units at the same portal within 25 m', () => {
    const result = classifyDuplicateCandidates(
      targetAddress,
      { latitude: 39.462, longitude: -0.374 },
      [candidate(), candidate({ id: 'building', type: 'building', dwellingsCount: 8 })],
    );
    expect(result.possible.map(({ id }) => id)).toEqual(['candidate-1']);
    expect(result.blocking.map(({ id }) => id)).toEqual(['building']);
  });

  it('ignores removed, distant, and different-number candidates', () => {
    const result = classifyDuplicateCandidates(
      targetAddress,
      { latitude: 39.462, longitude: -0.374 },
      [
        candidate({ id: 'removed', status: 'removed' }),
        candidate({ id: 'distant', location: { latitude: 39.463, longitude: -0.374 } }),
        candidate({ id: 'other-number', address: { ...targetAddress, number: '12' } }),
      ],
    );
    expect(result).toEqual({ blocking: [], possible: [] });
  });
});
