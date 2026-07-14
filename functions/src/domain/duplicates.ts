import { DUPLICATE_RADIUS_METERS } from '../config.js';
import type { Coordinates, DuplicateCandidate, ListingAddress } from '../types.js';
import { normalizeStreet, normalizeStreetNumber } from './address.js';
import { distanceMeters } from './geo.js';

export interface DuplicateResult {
  blocking: DuplicateCandidate[];
  possible: DuplicateCandidate[];
}

export function samePortal(a: ListingAddress, b: ListingAddress): boolean {
  return (
    normalizeStreet(a.street) === normalizeStreet(b.street) &&
    normalizeStreetNumber(a.number) === normalizeStreetNumber(b.number)
  );
}

export function classifyDuplicateCandidates(
  address: ListingAddress,
  location: Coordinates,
  candidates: readonly DuplicateCandidate[],
  radiusMeters = DUPLICATE_RADIUS_METERS,
): DuplicateResult {
  const relevant = candidates.filter(
    (candidate) =>
      candidate.status !== 'removed' &&
      samePortal(address, candidate.address) &&
      distanceMeters(location, candidate.location) <= radiusMeters,
  );

  return {
    blocking: relevant.filter((candidate) => candidate.type === 'building'),
    possible: relevant.filter((candidate) => candidate.type !== 'building'),
  };
}
