import { defineString } from 'firebase-functions/params';

/**
 * Comma-separated list of Google account emails allowed to moderate photos.
 * Override per environment with `firebase functions:config` params or the
 * ADMIN_EMAILS environment variable at deploy time.
 */
export const adminEmails: ReturnType<typeof defineString> = defineString('ADMIN_EMAILS', {
  default: 'wiki85@gmail.com',
});

export function isAdminEmail(email: string): boolean {
  return adminEmails
    .value()
    .split(',')
    .map((candidate) => candidate.trim().toLowerCase())
    .filter((candidate) => candidate.length > 0)
    .includes(email.trim().toLowerCase());
}
