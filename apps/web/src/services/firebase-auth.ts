import type { FirebaseApp } from 'firebase/app';
import {
  connectAuthEmulator,
  getAuth,
  getRedirectResult,
  GoogleAuthProvider,
  isSignInWithEmailLink,
  sendSignInLinkToEmail,
  signInWithEmailLink,
  signInWithPopup,
  signInWithRedirect,
  signOut,
  type Auth,
} from 'firebase/auth';
import type { PrepareAuthResult, SignInOutcome } from '../domain/types';
import { AuthFlowError, messageForAuthCode } from '../lib/auth-errors';
import { appConfig } from '../lib/config';

const EMAIL_STORAGE_KEY = 'newsletter:emailForSignIn';

let instance: Auth | null = null;
let redirectResultPromise: Promise<unknown> | null = null;

export function getFirebaseAuth(app: FirebaseApp): Auth {
  if (instance) return instance;
  const auth = getAuth(app);
  auth.languageCode = 'es';
  if (appConfig.useFirebaseEmulators) {
    connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
  }
  // Pre-warm gapi and the /__/auth/iframe now: otherwise the first click spends
  // the user gesture on that load and the browser blocks the popup that follows.
  // This same call consumes a pending signInWithRedirect return, so keep the
  // promise around for resolvePendingSession to await.
  redirectResultPromise = getRedirectResult(auth).catch(() => null);
  instance = auth;
  return auth;
}

/**
 * Resolves whatever session is pending when a page with login mounts: a
 * persisted session after a reload, a signInWithRedirect return, or a magic
 * link landing. Idempotent; never opens UI.
 */
export async function resolvePendingSession(auth: Auth): Promise<PrepareAuthResult> {
  if (isSignInWithEmailLink(auth, window.location.href)) {
    const stored = readStoredEmail();
    if (!stored) return { kind: 'emailLinkPendingEmail' };
    const outcome = await completeEmailLink(auth, stored);
    return outcome.status === 'ok' ? { kind: 'session', email: outcome.email } : { kind: 'none' };
  }
  await redirectResultPromise;
  await auth.authStateReady();
  const email = auth.currentUser?.email;
  return email ? { kind: 'session', email } : { kind: 'none' };
}

export async function signInWithGoogle(auth: Auth): Promise<SignInOutcome> {
  await auth.authStateReady();
  const existing = auth.currentUser?.email;
  if (existing) return { status: 'ok', email: existing };
  const provider = new GoogleAuthProvider();
  // Without this Google silently reuses the last account, which breaks the
  // admin gate's «Probar con otra cuenta» retry.
  provider.setCustomParameters({ prompt: 'select_account' });
  try {
    const credential = await signInWithPopup(auth, provider);
    const email = credential.user.email;
    if (!email) throw new AuthFlowError('auth/no-email', messageForAuthCode('auth/no-email'));
    return { status: 'ok', email };
  } catch (cause) {
    const code = authCode(cause);
    if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') {
      return { status: 'cancelled' };
    }
    if (code === 'auth/popup-blocked') {
      // Same-origin authDomain makes the redirect flow reliable; the result is
      // picked up by resolvePendingSession when the page comes back.
      await signInWithRedirect(auth, provider);
      return { status: 'redirecting' };
    }
    throw toFlowError(cause);
  }
}

export async function sendLoginLink(auth: Auth, email: string, continueUrl: string): Promise<void> {
  try {
    window.localStorage.setItem(EMAIL_STORAGE_KEY, email);
    await sendSignInLinkToEmail(auth, email, { url: continueUrl, handleCodeInApp: true });
  } catch (cause) {
    window.localStorage.removeItem(EMAIL_STORAGE_KEY);
    throw toFlowError(cause);
  }
}

export async function completeEmailLink(auth: Auth, email: string): Promise<SignInOutcome> {
  try {
    const credential = await signInWithEmailLink(auth, email, window.location.href);
    window.localStorage.removeItem(EMAIL_STORAGE_KEY);
    stripEmailLinkParams();
    return { status: 'ok', email: credential.user.email ?? email };
  } catch (cause) {
    throw toFlowError(cause);
  }
}

export async function signOutFirebase(auth: Auth): Promise<void> {
  await signOut(auth);
}

function readStoredEmail(): string | null {
  try {
    return window.localStorage.getItem(EMAIL_STORAGE_KEY);
  } catch {
    return null;
  }
}

/** Drops the oobCode/apiKey/... params of the magic link but keeps ?ciudad=. */
function stripEmailLinkParams(): void {
  const url = new URL(window.location.href);
  for (const key of ['apiKey', 'oobCode', 'mode', 'lang', 'continueUrl', 'tenantId']) {
    url.searchParams.delete(key);
  }
  window.history.replaceState({}, '', url.pathname + url.search + url.hash);
}

function authCode(cause: unknown): string {
  if (cause instanceof AuthFlowError) return cause.code;
  return typeof cause === 'object' &&
    cause !== null &&
    'code' in cause &&
    typeof (cause as { code: unknown }).code === 'string'
    ? (cause as { code: string }).code
    : '';
}

function toFlowError(cause: unknown): AuthFlowError {
  if (cause instanceof AuthFlowError) return cause;
  const code = authCode(cause) || 'auth/internal-error';
  return new AuthFlowError(code, messageForAuthCode(code));
}
