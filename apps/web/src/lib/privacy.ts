// KEEP IN SYNC with functions/src/domain/sanitize.ts: the server is the
// authority, and any note the client accepts but the server rejects makes
// the user complete all four wizard steps just to fail at the end.
const EMAIL_PATTERN = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i;
const PHONE_PATTERN = /(?:\+?34[\s.-]*)?(?:[6789][\s.-]*)?(?:\d[\s.-]*){8,9}/;
const URL_PATTERN = /(?:https?:\/\/|www\.|\b[a-z0-9-]+\.(?:com|net|org|es|io|co|me)\b)/i;
const HTML_PATTERN = /<\/?[a-z][^>]*>/i;
const CONTROL_CHARACTER_PATTERN = /(?![\t\n\r])\p{Cc}/u;

export type NoteValidation = { valid: true } | { valid: false; message: string };

export function validateLicenseNumber(value: string): NoteValidation {
  const normalized = value.trim();
  if (!normalized) return { valid: true };
  if (!/^(?=.*\p{L})(?=.*\p{N})[\p{L}\p{N}._/-]+$/u.test(normalized)) {
    return {
      valid: false,
      message: 'La licencia debe contener letras y números, sin espacios ni datos personales.',
    };
  }
  return { valid: true };
}

export function validateEvidenceNote(note: string): NoteValidation {
  const normalized = note.trim();
  if (normalized.length > 280) {
    return { valid: false, message: 'La nota no puede superar los 280 caracteres.' };
  }
  if (EMAIL_PATTERN.test(normalized)) {
    return { valid: false, message: 'No incluyas correos electrónicos ni datos personales.' };
  }
  if (PHONE_PATTERN.test(normalized)) {
    return { valid: false, message: 'No incluyas teléfonos ni datos personales.' };
  }
  if (URL_PATTERN.test(normalized)) {
    return { valid: false, message: 'No incluyas enlaces en la nota.' };
  }
  if (HTML_PATTERN.test(normalized)) {
    return { valid: false, message: 'La nota no puede contener código ni etiquetas.' };
  }
  if (CONTROL_CHARACTER_PATTERN.test(normalized)) {
    return { valid: false, message: 'La nota contiene caracteres no válidos.' };
  }
  return { valid: true };
}
