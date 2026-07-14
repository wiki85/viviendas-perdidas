import { MAX_PHOTO_BYTES } from '../config.js';

/**
 * Returns the reason a decoded photo must be rejected, or null when valid.
 * Only baseline JPEG is accepted: the client always re-encodes through a
 * canvas, which also strips EXIF metadata (GPS, device identifiers).
 */
export function photoRejectionReason(bytes: Uint8Array): string | null {
  if (bytes.length === 0) return 'empty';
  if (bytes.length > MAX_PHOTO_BYTES) return 'too_large';
  if (bytes.length < 128) return 'too_small';
  const isJpeg =
    bytes[0] === 0xff &&
    bytes[1] === 0xd8 &&
    bytes[2] === 0xff &&
    bytes[bytes.length - 2] === 0xff &&
    bytes[bytes.length - 1] === 0xd9;
  if (!isJpeg) return 'not_jpeg';
  return null;
}
