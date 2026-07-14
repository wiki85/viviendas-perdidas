import { describe, expect, it } from 'vitest';
import { calculateImpact, formatInteger } from './impact';

describe('calculateImpact', () => {
  it('applies the INE household-size rule and rounds inhabitants', () => {
    expect(calculateImpact(12)).toEqual({
      lostDwellings: 12,
      lostFamilies: 12,
      lostInhabitants: 30,
    });
    expect(calculateImpact(1).lostInhabitants).toBe(3);
  });

  it('does not emit negative impacts', () => {
    expect(calculateImpact(-4).lostDwellings).toBe(0);
  });

  it('formats counters for Spanish readers', () => {
    expect(Number(formatInteger(4200).replace(/\D/g, ''))).toBe(4200);
  });
});
