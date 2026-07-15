import type { Request } from 'firebase-functions/v2/https';

/** Canonical public origin: SEO tags must not vary with the visited host. */
export const PUBLIC_ORIGIN = 'https://www.aquiviviamos.com';

export function escapeHtml(value: string): string {
  return value
    .replace(/&/gu, '&amp;')
    .replace(/</gu, '&lt;')
    .replace(/>/gu, '&gt;')
    .replace(/"/gu, '&quot;')
    .replace(/'/gu, '&#39;');
}

export function integer(value: unknown): number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 ? value : 0;
}

export function jsonForInlineScript(value: unknown): string {
  return JSON.stringify(value).replace(/</gu, '\\u003c');
}

/**
 * Public origin the visitor used. Behind the Hosting rewrite the Host header
 * is the internal Cloud Run hostname; the real one travels in X-Forwarded-Host.
 */
export function requestOrigin(request: Request): string {
  const forwardedHost = request.get('x-forwarded-host')?.split(',')[0]?.trim();
  const host = forwardedHost || request.get('host') || '';
  const protocol = request.get('x-forwarded-proto')?.split(',')[0]?.trim() || request.protocol;
  return `${protocol}://${host}`;
}
