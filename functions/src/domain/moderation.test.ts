import { describe, expect, it } from 'vitest';
import { moderationStatus } from './moderation.js';

describe('moderationStatus', () => {
  it('flags at five reports when reports exceed twice confirmations', () => {
    expect(moderationStatus(0, 4)).toBe('active');
    expect(moderationStatus(0, 5)).toBe('flagged');
    expect(moderationStatus(3, 5)).toBe('active');
    expect(moderationStatus(2, 5)).toBe('flagged');
  });

  it('removes at fifteen reports regardless of confirmations', () => {
    expect(moderationStatus(100, 15)).toBe('removed');
  });
});
