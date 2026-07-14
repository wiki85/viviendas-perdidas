import { describe, expect, it } from 'vitest';
import { validateEvidenceNote, validateLicenseNumber } from './privacy';

describe('validateEvidenceNote', () => {
  it('accepts a short observation about the property', () => {
    expect(validateEvidenceNote('Placa turística visible junto al portal.')).toEqual({ valid: true });
  });

  it.each([
    ['Escribe a vecino@example.com', 'correos'],
    ['Teléfono 612 345 678', 'teléfonos'],
    ['Anuncio en https://example.com/piso', 'enlaces'],
  ])('rejects personal or linked evidence: %s', (note, fragment) => {
    const result = validateEvidenceNote(note);
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.message).toContain(fragment);
  });
});

describe('validateLicenseNumber', () => {
  it('accepts a compact public license identifier', () => {
    expect(validateLicenseNumber('VT-12345-V')).toEqual({ valid: true });
  });

  it('rejects names, spaces and identifiers without digits', () => {
    expect(validateLicenseNumber('Nombre Persona').valid).toBe(false);
    expect(validateLicenseNumber('SOLO-LETRAS').valid).toBe(false);
  });
});
