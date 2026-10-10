import { describe, expect, it } from 'vitest';
import { fnv1a32 } from './hash';
import { resolveLmuTrackId } from './mapSession';

describe('fnv1a32', () => {
  /**
   * Literal values, deliberately.
   *
   * This was extracted from resolveLmuTrackId, whose own specs only assert
   * relations -- same name, same id; different names, different ids -- which
   * would stay green if the algorithm changed. A track id reaches saved data,
   * so these pin the algorithm itself rather than its consistency.
   */
  it('matches the reference FNV-1a 32-bit values', () => {
    expect(fnv1a32('')).toBe(2166136261); // the offset basis
    expect(fnv1a32('a')).toBe(3826002220);
    expect(fnv1a32('imola')).toBe(3979964595);
    expect(fnv1a32('spa francorchamps')).toBe(419315664);
    expect(fnv1a32('circuit de la sarthe')).toBe(3532960871);
  });

  it('stays an unsigned 32-bit integer', () => {
    // Math.imul yields a signed result; a negative hash would break both
    // callers -- a negative track id, and a comparison that never matches.
    const samples = ['a', 'imola', 'spa francorchamps', 'x'.repeat(500), 'é'];
    samples.forEach((text) => {
      const hash = fnv1a32(text);
      expect(Number.isInteger(hash)).toBe(true);
      expect(hash).toBeGreaterThanOrEqual(0);
      expect(hash).toBeLessThanOrEqual(0xffffffff);
    });
  });

  it('is sensitive to order and to every character', () => {
    expect(fnv1a32('ab')).not.toBe(fnv1a32('ba'));
    expect(fnv1a32('imola')).not.toBe(fnv1a32('imolaa'));
  });

  it('still produces the track ids it did before extraction', () => {
    // resolveLmuTrackId = LMU_TRACK_ID_OFFSET + fnv1a32(normalised name).
    expect(resolveLmuTrackId('Spa Francorchamps')).toBe(1_000_000 + 419315664);
    expect(resolveLmuTrackId('Imola')).toBe(1_000_000 + 3979964595);
  });
});
