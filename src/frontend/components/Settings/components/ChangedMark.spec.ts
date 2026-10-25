import { describe, expect, it } from 'vitest';
import { differsFromDefault } from './ChangedMark';

describe('differsFromDefault', () => {
  const defaults = { size: 5, look: { opacity: 85 }, list: [1, 2] };

  it('sees no change in matching or missing values', () => {
    expect(differsFromDefault({ ...defaults }, defaults)).toBe(false);
    expect(differsFromDefault({ size: 5 }, defaults)).toBe(false);
    expect(differsFromDefault(undefined, defaults)).toBe(false);
  });

  it('ignores keys the defaults do not have', () => {
    expect(differsFromDefault({ ...defaults, extra: 1 }, defaults)).toBe(false);
  });

  it('finds a change at any depth', () => {
    expect(differsFromDefault({ size: 6 }, defaults)).toBe(true);
    expect(differsFromDefault({ look: { opacity: 50 } }, defaults)).toBe(true);
    expect(differsFromDefault({ list: [2] }, defaults)).toBe(true);
  });
});
