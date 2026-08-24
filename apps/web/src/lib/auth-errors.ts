/**
 * Sign-in failure with a user-facing Spanish message already resolved.
 * Cancellations (user closed the popup) never become an AuthFlowError:
 * the auth service reports those as a `cancelled` outcome instead.
 */
export class AuthFlowError extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'AuthFlowError';
  }
}

const MESSAGES: Record<string, string> = {
  'auth/network-request-failed': 'No hay conexión. Comprueba tu red e inténtalo de nuevo.',
  'auth/too-many-requests': 'Demasiados intentos. Espera un minuto y vuelve a probarlo.',
  'auth/user-disabled': 'Esta cuenta está deshabilitada.',
  'auth/no-email': 'La cuenta no tiene un correo visible.',
  'auth/invalid-email': 'Ese correo no parece válido. Revísalo e inténtalo de nuevo.',
  'auth/invalid-action-code': 'El enlace ha caducado o ya se usó. Pide uno nuevo.',
  'auth/expired-action-code': 'El enlace ha caducado o ya se usó. Pide uno nuevo.',
};

/** The fallback keeps the auth/* code visible so error reports are diagnosable. */
export function messageForAuthCode(code: string): string {
  return MESSAGES[code] ?? `No se pudo iniciar sesión (${code}).`;
}
