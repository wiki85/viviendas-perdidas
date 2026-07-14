import { describe, expect, it } from 'vitest';
import type { ListingLike } from '../types.js';
import { aggregateDeltas, inhabitantsForDwellings } from './aggregates.js';

function listing(overrides: Partial<ListingLike> = {}): ListingLike {
  return {
    type: 'unit',
    dwellingsCount: 1,
    address: {
      formatted: 'Calle de Cádiz, 10, València',
      street: 'Calle de Cádiz',
      number: '10',
      postalCode: '46006',
      locality: 'València',
      province: 'Valencia',
    },
    location: { latitude: 39.462, longitude: -0.374 },
    neighborhoodId: 'russafa',
    cityId: 'valencia',
    status: 'active',
    ...overrides,
  };
}

describe('aggregateDeltas', () => {
  it('adds city and neighborhood contributions for a new listing', () => {
    expect(aggregateDeltas(null, listing())).toEqual([
      {
        scopeId: 'valencia',
        scope: 'city',
        cityId: 'valencia',
        neighborhoodId: null,
        listingsCount: 1,
        lostDwellings: 1,
        lostFamilies: 1,
        lostInhabitants: 3,
        lostCommercial: 0,
      },
      {
        scopeId: 'valencia__russafa',
        scope: 'neighborhood',
        cityId: 'valencia',
        neighborhoodId: 'russafa',
        listingsCount: 1,
        lostDwellings: 1,
        lostFamilies: 1,
        lostInhabitants: 3,
        lostCommercial: 0,
      },
    ]);
  });

  it('uses exact rounded before/after contributions when dwellings change', () => {
    const deltas = aggregateDeltas(listing({ dwellingsCount: 1 }), listing({ dwellingsCount: 2 }));
    expect(deltas).toHaveLength(2);
    expect(deltas[0]).toMatchObject({
      listingsCount: 0,
      lostDwellings: 1,
      lostFamilies: 1,
      // round(2 * 2.5) - round(1 * 2.5) = 5 - 3 = 2
      lostInhabitants: 2,
    });
  });

  it('counts flagged listings and removes all contributions only at removed', () => {
    expect(aggregateDeltas(listing(), listing({ status: 'flagged' }))).toEqual([]);
    expect(
      aggregateDeltas(listing({ status: 'flagged' }), listing({ status: 'removed' }))[0],
    ).toMatchObject({
      listingsCount: -1,
      lostDwellings: -1,
      lostInhabitants: -3,
    });
  });

  it('moves contributions between cities and neighborhoods', () => {
    const deltas = aggregateDeltas(
      listing(),
      listing({ cityId: 'madrid', neighborhoodId: 'salamanca' }),
    );
    expect(deltas.map((delta) => [delta.scopeId, delta.listingsCount])).toEqual([
      ['valencia', -1],
      ['valencia__russafa', -1],
      ['madrid', 1],
      ['madrid__salamanca', 1],
    ]);
  });

  it('rounds a 12-home building to 30 inhabitants', () => {
    expect(inhabitantsForDwellings(12, 'valencia')).toBe(30);
  });

  it('counts a converted commercial premises as one lost local and no dwellings', () => {
    const deltas = aggregateDeltas(null, listing({ type: 'commercial' }));
    expect(deltas[0]).toMatchObject({
      listingsCount: 1,
      lostDwellings: 0,
      lostFamilies: 0,
      lostInhabitants: 0,
      lostCommercial: 1,
    });
    expect(
      aggregateDeltas(
        listing({ type: 'commercial' }),
        listing({ type: 'commercial', status: 'removed' }),
      )[0],
    ).toMatchObject({
      lostCommercial: -1,
      lostDwellings: 0,
    });
  });
});
