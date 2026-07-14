import { describe, expect, it } from 'vitest';
import { searchLocalPlaces } from './local-search';

describe('local Spanish search fallback', () => {
  it.each(['Ruzafa', 'Russafa', '46006'])('finds València for %s', (query) => {
    const result = searchLocalPlaces(query);
    expect(result[0]?.cityId).toBe('valencia');
  });

  it.each([
    ['Madrid', 'madrid'],
    ['Barcelona', 'barcelona'],
    ['València', 'valencia'],
  ])('finds the seeded city %s', (query, cityId) => {
    expect(searchLocalPlaces(query).some((place) => place.cityId === cityId)).toBe(true);
  });
});

