import { describe, expect, it } from 'vitest';
import { formatEurosCompact, summarizeCityImpact } from './city-impact';

describe('summarizeCityImpact', () => {
  it('combines community and official sources into one summary', () => {
    const summary = summarizeCityImpact('sevilla', {
      community: {
        lostDwellings: 34,
        lostFamilies: 34,
        lostInhabitants: 85,
        listingsCount: 12,
        lostCommercial: 3,
      },
      official: { total: 9578, entireHomes: 8876, roomsOnly: 702, places: 40000 },
    });
    expect(summary).not.toBeNull();
    expect(summary?.dwellingsTotal).toBe(9612);
    expect(summary?.households).toBe(8910);
    expect(summary?.annualSpendEur).toBe(8910 * 34_044);
    expect(summary?.classrooms).toBeGreaterThan(100);
    expect(summary?.officialStockSharePct).toBeCloseTo(3.6, 5);
    expect(summary?.hasOfficial).toBe(true);
  });

  it('works with community-only cities and hides the stock ratio', () => {
    const summary = summarizeCityImpact('valencia', {
      community: {
        lostDwellings: 34,
        lostFamilies: 34,
        lostInhabitants: 85,
        listingsCount: 12,
        lostCommercial: 3,
      },
      official: null,
    });
    expect(summary?.households).toBe(34);
    expect(summary?.officialStockSharePct).toBeNull();
    expect(summary?.hasOfficial).toBe(false);
  });

  it('returns null when there is nothing to announce', () => {
    expect(summarizeCityImpact('nowhere', { community: null, official: null })).toBeNull();
  });
});

describe('formatEurosCompact', () => {
  it('compacts millions and rounds thousands', () => {
    expect(formatEurosCompact(306_396_000)).toBe('306 M€');
    expect(formatEurosCompact(1_157_496)).toBe('1,2 M€');
    expect(formatEurosCompact(620_400)).toBe('620.000 €');
  });
});
