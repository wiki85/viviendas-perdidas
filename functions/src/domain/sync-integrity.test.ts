import { describe, expect, it } from 'vitest';
import { contentHash, isSuspiciousDrop } from './sync-integrity.js';

describe('contentHash', () => {
  it('is stable across key order and undefined fields', () => {
    expect(contentHash({ a: 1, b: 'x', c: null })).toBe(contentHash({ c: null, b: 'x', a: 1 }));
    expect(contentHash({ a: 1, b: undefined })).toBe(contentHash({ a: 1 }));
  });

  it('changes when any value changes, including nested arrays', () => {
    const base = { id: 5, pins: [{ lat: 1.5, lng: -2 }] };
    expect(contentHash(base)).not.toBe(contentHash({ ...base, id: 6 }));
    expect(contentHash(base)).not.toBe(contentHash({ id: 5, pins: [{ lat: 1.5, lng: -2.1 }] }));
  });
});

describe('isSuspiciousDrop', () => {
  it('flags empty or collapsed downloads for a municipality with history', () => {
    expect(isSuspiciousDrop(9578, 0)).toBe(true);
    expect(isSuspiciousDrop(9578, 4000)).toBe(true);
    expect(isSuspiciousDrop(207, 100)).toBe(true);
  });

  it('accepts normal weekly churn and first-ever downloads', () => {
    expect(isSuspiciousDrop(9578, 9300)).toBe(false);
    expect(isSuspiciousDrop(0, 5000)).toBe(false);
    // Small municipalities swing hard in relative terms: only a total wipe
    // is suspicious below the size threshold.
    expect(isSuspiciousDrop(150, 80)).toBe(false);
  });
});
