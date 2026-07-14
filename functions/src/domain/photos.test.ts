import { describe, expect, it } from 'vitest';
import { MAX_PHOTO_BYTES } from '../config.js';
import { photoRejectionReason } from './photos.js';

function jpegBytes(size: number): Uint8Array {
  const bytes = new Uint8Array(size);
  bytes[0] = 0xff;
  bytes[1] = 0xd8;
  bytes[2] = 0xff;
  bytes[size - 2] = 0xff;
  bytes[size - 1] = 0xd9;
  return bytes;
}

describe('photoRejectionReason', () => {
  it('accepts a well-formed JPEG within limits', () => {
    expect(photoRejectionReason(jpegBytes(2_048))).toBeNull();
  });

  it('rejects empty and tiny payloads', () => {
    expect(photoRejectionReason(new Uint8Array(0))).toBe('empty');
    expect(photoRejectionReason(jpegBytes(64))).toBe('too_small');
  });

  it('rejects payloads above the size limit', () => {
    expect(photoRejectionReason(jpegBytes(MAX_PHOTO_BYTES + 1))).toBe('too_large');
  });

  it('rejects non-JPEG payloads such as PNG headers', () => {
    const png = new Uint8Array(2_048);
    png.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    expect(photoRejectionReason(png)).toBe('not_jpeg');
  });
});
