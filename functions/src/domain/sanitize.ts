const EMAIL_PATTERN = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/iu;
const URL_PATTERN = /(?:https?:\/\/|www\.|\b[a-z0-9-]+\.(?:com|net|org|es|io|co|me)\b)/iu;
const HTML_PATTERN = /<\/?[a-z][^>]*>/iu;
const SPANISH_PHONE_PATTERN = /(?:\+?34[\s.-]*)?(?:[6789][\s.-]*)?(?:\d[\s.-]*){8,9}/u;
// Unicode control category minus the whitespace we tolerate (tab, LF, CR).
// \p{Cc} avoids control-character literals, so `no-control-regex` is happy
// in every lint config; it also covers the C1 range (U+0080–U+009F).
const CONTROL_CHARACTER_PATTERN = /(?![\t\n\r])\p{Cc}/u;

export type NoteRejectionReason = 'email' | 'url' | 'html' | 'phone' | 'control-character';

export function noteRejectionReason(note: string): NoteRejectionReason | null {
  if (CONTROL_CHARACTER_PATTERN.test(note)) return 'control-character';
  if (HTML_PATTERN.test(note)) return 'html';
  if (EMAIL_PATTERN.test(note)) return 'email';
  if (URL_PATTERN.test(note)) return 'url';
  if (SPANISH_PHONE_PATTERN.test(note)) return 'phone';
  return null;
}

export function normalizeOptionalText(value: string | null | undefined): string | null {
  if (value === null || value === undefined) return null;
  const normalized = value.normalize('NFC').trim().replace(/\s+/gu, ' ');
  return normalized.length === 0 ? null : normalized;
}
