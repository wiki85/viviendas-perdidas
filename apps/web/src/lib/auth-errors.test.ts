import { describe, expect, it } from 'vitest';
import { AuthFlowError, messageForAuthCode } from './auth-errors';

describe('messageForAuthCode', () => {
  it('traduce los códigos conocidos a mensajes en español', () => {
    expect(messageForAuthCode('auth/network-request-failed')).toMatch(/conexión/i);
    expect(messageForAuthCode('auth/too-many-requests')).toMatch(/demasiados intentos/i);
    expect(messageForAuthCode('auth/invalid-action-code')).toMatch(/caducado/i);
    expect(messageForAuthCode('auth/expired-action-code')).toMatch(/caducado/i);
    expect(messageForAuthCode('auth/no-email')).toMatch(/correo/i);
  });

  it('mantiene visible un código desconocido para poder diagnosticarlo', () => {
    expect(messageForAuthCode('auth/internal-error')).toContain('auth/internal-error');
    expect(messageForAuthCode('auth/unauthorized-domain')).toContain('auth/unauthorized-domain');
  });
});

describe('AuthFlowError', () => {
  it('conserva el código y el mensaje ya resuelto', () => {
    const error = new AuthFlowError('auth/no-email', messageForAuthCode('auth/no-email'));
    expect(error).toBeInstanceOf(Error);
    expect(error.code).toBe('auth/no-email');
    expect(error.message).toBe(messageForAuthCode('auth/no-email'));
  });
});
