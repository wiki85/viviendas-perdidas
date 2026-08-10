import { describe, expect, it } from 'vitest';
import { makeVoteId, makePortalLockId, sha256 } from './crypto.js';

describe('makeVoteId', () => {
  const listing = 'abc123';
  const subjectA = sha256('token-de-app-check-A');
  const subjectB = sha256('token-de-app-check-B');

  it('is deterministic for the same listing and voter subject', () => {
    expect(makeVoteId(listing, subjectA)).toBe(makeVoteId(listing, subjectA));
  });

  it('is case-insensitive on the voter subject', () => {
    expect(makeVoteId(listing, subjectA.toUpperCase())).toBe(makeVoteId(listing, subjectA));
  });

  it('gives distinct ids for distinct voter subjects (one vote per identity)', () => {
    // La identidad es el sujeto de servidor: dos tokens distintos → dos votos.
    // Un atacante que quiera N votos necesita N tokens de App Check válidos,
    // no N variaciones de un campo del payload (VP-01).
    expect(makeVoteId(listing, subjectA)).not.toBe(makeVoteId(listing, subjectB));
  });

  it('gives distinct ids for distinct listings with the same subject', () => {
    expect(makeVoteId('abc123', subjectA)).not.toBe(makeVoteId('abc124', subjectA));
  });

  it('does not collide across the listing/subject boundary', () => {
    // El separador NUL evita que ('ab','c') y ('a','bc') colisionen.
    expect(makeVoteId('ab', 'c')).not.toBe(makeVoteId('a', 'bc'));
  });
});

describe('makePortalLockId', () => {
  it('is deterministic and separates its fields', () => {
    expect(makePortalLockId('sevilla', 'feria', '106')).toBe(
      makePortalLockId('sevilla', 'feria', '106'),
    );
    expect(makePortalLockId('sevilla', 'feria', '106')).not.toBe(
      makePortalLockId('sevilla', 'feria', '1061'),
    );
  });
});
