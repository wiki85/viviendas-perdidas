import { describe, expect, it } from 'vitest';
import { CITY_CENSUS, computeCityImpact } from './city-impact.js';

describe('computeCityImpact', () => {
  it('estimates local spend, school children and classrooms from households', () => {
    const impact = computeCityImpact({
      cityId: 'sevilla',
      households: 1000,
      inhabitants: 2500,
      officialTotal: 0,
      officialPlaces: 0,
    });
    expect(impact.annualSpendEur).toBe(34_044_000);
    expect(impact.foodSpendEur).toBe(5_379_000);
    expect(impact.under15).toBe(345);
    expect(impact.classrooms).toBe(16);
    expect(impact.officialStockSharePct).toBeNull();
    expect(impact.placesPer100).toBeNull();
  });

  it('relates official VUT to the census stock of the mirrored cities', () => {
    const impact = computeCityImpact({
      cityId: 'sevilla',
      households: 8876,
      inhabitants: 22_190,
      officialTotal: 9578,
      officialPlaces: 40_000,
    });
    // 9.578 VUT over 266.588 main homes ≈ 3,6%.
    expect(impact.officialStockSharePct).toBeCloseTo(3.6, 5);
    // 40.000 places over 688.714 inhabitants ≈ 5,8 per 100.
    expect(impact.placesPer100).toBeCloseTo(5.8, 5);
  });

  it('returns null ratios for cities without census data', () => {
    const impact = computeCityImpact({
      cityId: 'valencia',
      households: 10,
      inhabitants: 25,
      officialTotal: 5,
      officialPlaces: 20,
    });
    expect(impact.officialStockSharePct).toBeNull();
    expect(impact.placesPer100).toBeNull();
  });

  it('covers the eleven mirrored municipalities in the census table', () => {
    expect(Object.keys(CITY_CENSUS)).toHaveLength(11);
    for (const census of Object.values(CITY_CENSUS)) {
      expect(census.mainDwellings).toBeGreaterThan(10_000);
      expect(census.population).toBeGreaterThan(100_000);
    }
  });
});
