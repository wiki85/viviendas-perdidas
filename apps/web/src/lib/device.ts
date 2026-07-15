const DEVICE_KEY = 'viviendas-perdidas-device-v1';

/**
 * True on phones/tablets (coarse pointer). GPS positioning only makes
 * sense there: a desktop geolocates by IP, often kilometres away.
 */
export function isTouchDevice(): boolean {
  return (
    typeof window !== 'undefined' && (window.matchMedia?.('(pointer: coarse)').matches ?? false)
  );
}

function bytesToHex(bytes: Uint8Array) {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

export async function getDeviceFingerprintHash(): Promise<string> {
  let randomId = localStorage.getItem(DEVICE_KEY);
  if (!randomId) {
    randomId = crypto.randomUUID();
    localStorage.setItem(DEVICE_KEY, randomId);
  }
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(randomId));
  return bytesToHex(new Uint8Array(digest));
}
