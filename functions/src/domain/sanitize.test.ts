import { describe, expect, it } from 'vitest';
import { normalizeOptionalText, noteRejectionReason } from './sanitize.js';

describe('note sanitization', () => {
  it.each([
    ['Escribe a nombre@example.com', 'email'],
    ['Más info en https://example.com/anuncio', 'url'],
    ['<strong>Apartamento</strong>', 'html'],
    ['Llama al 612 345 678', 'phone'],
    ['Texto\u0000oculto', 'control-character'],
  ])('rejects unsafe text: %s', (note, reason) => {
    expect(noteRejectionReason(note)).toBe(reason);
  });

  it('accepts ordinary property evidence without personal data', () => {
    expect(noteRejectionReason('Placa VT-1234 visible junto al portal.')).toBeNull();
  });

  it('normalizes whitespace and empty optional strings', () => {
    expect(normalizeOptionalText('  Placa   visible  ')).toBe('Placa visible');
    expect(normalizeOptionalText('   ')).toBeNull();
    expect(normalizeOptionalText(undefined)).toBeNull();
  });
});
