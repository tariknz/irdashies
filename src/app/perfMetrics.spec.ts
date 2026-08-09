import { describe, expect, it } from 'vitest';
import { sumCompletePrivateMemoryMB } from './perfMetrics';

describe('performance process memory coverage', () => {
  it('sums private bytes only when every included process reports them', () => {
    expect(sumCompletePrivateMemoryMB([1024, 2048])).toBe(3);
    expect(sumCompletePrivateMemoryMB([1024, undefined])).toBeUndefined();
    expect(sumCompletePrivateMemoryMB([])).toBeUndefined();
  });
});
