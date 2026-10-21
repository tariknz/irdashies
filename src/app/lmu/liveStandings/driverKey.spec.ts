import { describe, expect, it } from 'vitest';
import { lmuDriverKey } from './driverKey';

describe('lmuDriverKey', () => {
  it('joins the two spellings of a name that the two sources use', () => {
    // Shared memory's plain name, and the websocket's numbered one.
    expect(lmuDriverKey('Herve Attard')).toBe(lmuDriverKey('#42 Herve Attard'));
  });

  it('ignores casing, padding and repeated spaces', () => {
    expect(lmuDriverKey('  HERVE   ATTARD ')).toBe(
      lmuDriverKey('Herve Attard')
    );
  });

  it('drops a car number wherever it sits', () => {
    expect(lmuDriverKey('Herve Attard #7')).toBe(lmuDriverKey('Herve Attard'));
    expect(lmuDriverKey('# 7 Herve Attard')).toBe(lmuDriverKey('Herve Attard'));
  });

  it('keeps names apart', () => {
    expect(lmuDriverKey('Herve Attard')).not.toBe(lmuDriverKey('Herve Attart'));
  });

  it('reports nothing usable as an empty key', () => {
    expect(lmuDriverKey(undefined)).toBe('');
    expect(lmuDriverKey(null)).toBe('');
    expect(lmuDriverKey('   ')).toBe('');
    expect(lmuDriverKey('#12')).toBe('');
  });
});
