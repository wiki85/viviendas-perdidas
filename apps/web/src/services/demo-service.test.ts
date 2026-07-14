import { describe, expect, it } from 'vitest';
import type { Aggregate, VisibleScope } from '../domain/types';
import { DemoListingsService } from './demo-service';

const russafaScope: VisibleScope = {
  scopeId: 'valencia__russafa',
  scope: 'neighborhood',
  cityId: 'valencia',
  neighborhoodId: 'russafa',
  name: 'Russafa',
};

function nextAggregate(service: DemoListingsService, scope = russafaScope) {
  return new Promise<Aggregate>((resolve, reject) => {
    const unsubscribe = service.subscribeAggregate(
      scope,
      (aggregate) => {
        unsubscribe();
        resolve(aggregate);
      },
      reject,
    );
  });
}

describe('DemoListingsService', () => {
  it('sums inhabitants rounded per listing, matching the backend trigger', async () => {
    const service = new DemoListingsService();
    const aggregate = await nextAggregate(service);
    expect(aggregate.lostDwellings).toBe(22);
    expect(aggregate.lostInhabitants).toBe(56);
  });

  it('keeps the building duplicate flow non-overridable', async () => {
    const service = new DemoListingsService();
    const result = await service.createListing({
      type: 'building',
      dwellingsCount: 12,
      location: { lat: 39.46174, lng: -0.37322 },
    });
    expect(result).toMatchObject({
      created: false,
      reason: 'possible_duplicate',
      canCreate: false,
    });
  });

  it('updates neighborhood impact immediately after a new building', async () => {
    const service = new DemoListingsService();
    const before = await nextAggregate(service);
    const result = await service.createListing({
      type: 'building',
      dwellingsCount: 12,
      location: { lat: 39.4665, lng: -0.365 },
    });
    expect(result.created).toBe(true);
    const after = await nextAggregate(service);
    expect(after.lostDwellings - before.lostDwellings).toBe(12);
    expect(after.lostFamilies - before.lostFamilies).toBe(12);
    expect(after.lostInhabitants - before.lostInhabitants).toBe(30);
  });

  it('makes a device vote idempotent', async () => {
    const service = new DemoListingsService();
    const first = await service.voteListing('demo-vlc-1', 'confirm', 'a'.repeat(64));
    const second = await service.voteListing('demo-vlc-1', 'confirm', 'a'.repeat(64));
    expect(first.created).toBe(true);
    expect(second.alreadyVoted).toBe(true);
    expect(second.confirmations).toBe(first.confirmations);
  });
});
