import { Timestamp } from 'firebase-admin/firestore';
import { db } from '../firebase.js';

const ERROR_LOG_TTL_MS = 30 * 24 * 60 * 60 * 1_000;
const MAX_DETAILS_LENGTH = 8_000;

/**
 * Persists a diagnostic entry in the server-only `errorLogs` collection so the
 * admin panel can inspect failures without leaking details to end users.
 * Never throws: logging must not break the request being handled.
 */
export async function recordClientError(
  action: string,
  kind: string,
  details: unknown,
): Promise<void> {
  try {
    let serialized: string;
    try {
      serialized = JSON.stringify(details) ?? 'null';
    } catch {
      serialized = String(details);
    }
    if (serialized.length > MAX_DETAILS_LENGTH) {
      serialized = `${serialized.slice(0, MAX_DETAILS_LENGTH)}…`;
    }
    const now = Timestamp.now();
    await db.collection('errorLogs').add({
      action,
      kind,
      details: serialized,
      createdAt: now,
      expiresAt: Timestamp.fromMillis(now.toMillis() + ERROR_LOG_TTL_MS),
    });
  } catch {
    // Swallow logging failures on purpose.
  }
}

/** Standard shape for logging a caught error together with the raw payload. */
export function describeCaughtError(
  error: unknown,
  requestData: unknown,
): {
  kind: string;
  details: Record<string, unknown>;
} {
  const kind =
    error && typeof error === 'object' && 'code' in error
      ? `https_${String(error.code)}`
      : error instanceof Error
        ? error.name
        : 'unknown';
  return {
    kind,
    details: {
      message: error instanceof Error ? error.message : String(error),
      httpDetails:
        error && typeof error === 'object' && 'details' in error ? (error.details ?? null) : null,
      requestData: requestData ?? null,
    },
  };
}
