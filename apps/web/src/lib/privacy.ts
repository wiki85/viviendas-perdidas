const EMAIL_PATTERN = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i;
const PHONE_PATTERN = /(?:\+?34[\s.-]*)?(?:\d[\s.-]*){9}/;
const URL_PATTERN = /(?:https?:\/\/|www\.|\b[a-z0-9-]+\.(?:com|es|net|org)\b)/i;

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
  return { valid: true };
}
