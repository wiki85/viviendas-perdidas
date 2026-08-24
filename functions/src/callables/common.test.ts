import { HttpsError } from 'firebase-functions/v2/https';
import type { CallableRequest } from 'firebase-functions/v2/https';
import { afterEach, describe, expect, it, vi } from 'vitest';

// common.ts arrastra services/rate-limit.ts, que inicializa firebase-admin;
// aquí solo se prueban las guardas puras, así que se corta esa rama.
vi.mock('../services/rate-limit.js', () => ({
  appCheckTokenHash: (token: string) => `hash:${token}`,
}));

const { requireModerator, requireUser } = await import('./common.js');

function requestWithAuth(auth: unknown): CallableRequest<unknown> {
  return { auth } as CallableRequest<unknown>;
}

function codeOf(run: () => unknown): string {
  try {
    run();
  } catch (cause) {
    if (cause instanceof HttpsError) return cause.code;
    throw cause;
  }
  throw new Error('Se esperaba un HttpsError');
}

afterEach(() => {
  delete process.env.ADMIN_EMAILS;
});

describe('requireUser', () => {
  it('rechaza peticiones sin sesión', () => {
    expect(codeOf(() => requireUser(undefined))).toBe('unauthenticated');
    expect(codeOf(() => requireUser({ uid: 'u1', token: {} }))).toBe('unauthenticated');
  });

  it('rechaza correos sin verificar, incluso con el claim ausente', () => {
    expect(
      codeOf(() => requireUser({ uid: 'u1', token: { email: 'a@b.es', email_verified: false } })),
    ).toBe('failed-precondition');
    expect(codeOf(() => requireUser({ uid: 'u1', token: { email: 'a@b.es' } }))).toBe(
      'failed-precondition',
    );
  });

  it('devuelve uid y correo normalizado a minúsculas', () => {
    const result = requireUser({
      uid: 'u1',
      token: { email: 'Vecina@Example.COM', email_verified: true },
    });
    expect(result).toEqual({ uid: 'u1', email: 'vecina@example.com' });
  });
});

describe('requireModerator', () => {
  it('exige sesión con correo verificado', () => {
    expect(codeOf(() => requireModerator(requestWithAuth(undefined)))).toBe('unauthenticated');
    expect(
      codeOf(() =>
        requireModerator(
          requestWithAuth({ token: { email: 'wiki85@gmail.com', email_verified: false } }),
        ),
      ),
    ).toBe('unauthenticated');
  });

  it('deniega cuentas verificadas que no están en la allowlist', () => {
    process.env.ADMIN_EMAILS = 'mod@example.com';
    expect(
      codeOf(() =>
        requireModerator(
          requestWithAuth({ token: { email: 'otra@example.com', email_verified: true } }),
        ),
      ),
    ).toBe('permission-denied');
  });

  it('acepta cuentas de la allowlist ADMIN_EMAILS ignorando mayúsculas', () => {
    process.env.ADMIN_EMAILS = 'mod@example.com, otra@example.com';
    expect(
      requireModerator(
        requestWithAuth({ token: { email: 'Mod@Example.com', email_verified: true } }),
      ),
    ).toBe('Mod@Example.com');
  });
});
