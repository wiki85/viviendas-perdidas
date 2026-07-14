import { HOUSEHOLD_SIZE, HOUSEHOLD_SIZE_BY_CITY } from '../config.js';
import type { ListingLike } from '../types.js';

export interface AggregateDelta {
  scopeId: string;
  scope: 'city' | 'neighborhood';
  cityId: string;
  neighborhoodId: string | null;
  listingsCount: number;
  lostDwellings: number;
  lostFamilies: number;
  lostInhabitants: number;
  lostCommercial: number;
}

function isCounted(listing: ListingLike | null): listing is ListingLike {
  return listing !== null && listing.status !== 'removed';
}

export function householdSizeForCity(cityId: string): number {
  return HOUSEHOLD_SIZE_BY_CITY[cityId] ?? HOUSEHOLD_SIZE;
}

export function inhabitantsForDwellings(dwellings: number, cityId: string): number {
  return Math.round(dwellings * householdSizeForCity(cityId));
}

export function listingContributions(listing: ListingLike | null, sign: 1 | -1): AggregateDelta[] {
  if (!isCounted(listing)) return [];

  // A converted commercial premises displaces neighbourhood commerce, not
  // residents: it counts as one lost local and zero dwellings/families.
  // Buildings can additionally wipe out the premises they declare.
  const dwellings = listing.type === 'commercial' ? 0 : listing.dwellingsCount;
  const commercialUnits =
    listing.type === 'commercial'
      ? 1
      : listing.type === 'building'
        ? (listing.commercialUnitsCount ?? 0)
        : 0;
  const base = {
    cityId: listing.cityId,
    listingsCount: sign,
    // `|| 0` normalizes JavaScript's negative zero when dwellings is 0.
    lostDwellings: sign * dwellings || 0,
    lostFamilies: sign * dwellings || 0,
    lostInhabitants: sign * inhabitantsForDwellings(dwellings, listing.cityId) || 0,
    lostCommercial: sign * commercialUnits || 0,
  };
  const contributions: AggregateDelta[] = [
    {
      ...base,
      scopeId: listing.cityId,
      scope: 'city',
      neighborhoodId: null,
    },
  ];

  if (listing.neighborhoodId !== null) {
    contributions.push({
      ...base,
      scopeId: `${listing.cityId}__${listing.neighborhoodId}`,
      scope: 'neighborhood',
      neighborhoodId: listing.neighborhoodId,
    });
  }
  return contributions;
}

export function aggregateDeltas(
  before: ListingLike | null,
  after: ListingLike | null,
): AggregateDelta[] {
  const merged = new Map<string, AggregateDelta>();
  for (const delta of [...listingContributions(before, -1), ...listingContributions(after, 1)]) {
    const existing = merged.get(delta.scopeId);
    if (existing === undefined) {
      merged.set(delta.scopeId, delta);
      continue;
    }
    existing.listingsCount += delta.listingsCount;
    existing.lostDwellings += delta.lostDwellings;
    existing.lostFamilies += delta.lostFamilies;
    existing.lostInhabitants += delta.lostInhabitants;
    existing.lostCommercial += delta.lostCommercial;
  }
  return [...merged.values()].filter(
    (delta) =>
      delta.listingsCount !== 0 ||
      delta.lostDwellings !== 0 ||
      delta.lostFamilies !== 0 ||
      delta.lostInhabitants !== 0 ||
      delta.lostCommercial !== 0,
  );
}
