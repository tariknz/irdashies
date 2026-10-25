import { describe, expect, it } from 'vitest';
import { clampSetting } from './clampSetting';

describe('clampSetting', () => {
  it('keeps a value inside its range', () => {
    expect(clampSetting(0, 3, 30, 8)).toBe(3);
    expect(clampSetting(99, 3, 30, 8)).toBe(30);
    expect(clampSetting(12, 3, 30, 8)).toBe(12);
  });

  it('falls back for anything that is not a finite number', () => {
    expect(clampSetting(undefined, 3, 30, 8)).toBe(8);
    expect(clampSetting('5', 3, 30, 8)).toBe(8);
    expect(clampSetting(Number.NaN, 3, 30, 8)).toBe(8);
  });
});
