import { createHash } from 'node:crypto';

/**
 * Stable content hash for differential mirror writes: identical data must
 * hash identically regardless of object key order, so weekly syncs only
 * rewrite documents whose content actually changed.
 */
export function contentHash(value: unknown): string {
  return createHash('sha256').update(canonicalJson(value)).digest('hex').slice(0, 24);
}

function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? 'null';
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, entryValue]) => entryValue !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([key, entryValue]) => `${JSON.stringify(key)}:${canonicalJson(entryValue)}`);
  return `{${entries.join(',')}}`;
}

/**
 * True when a municipality's fresh download looks like a partial or empty
 * upstream response rather than a real registry change. Deleting a city's
 * mirror because the API hiccuped would blank its map layer for a week.
 */
export function isSuspiciousDrop(previousTotal: number, currentTotal: number): boolean {
  if (previousTotal <= 0) return false;
  if (currentTotal === 0) return true;
  return previousTotal >= 200 && currentTotal < previousTotal * 0.7;
}
