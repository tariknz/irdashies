import { describe, expect, it } from 'vitest';

import { formatLapTotal } from './formatLapTotal';

describe('formatLapTotal', () => {
  it('omits a trailing zero for whole lap totals', () => {
    expect(formatLapTotal(55)).toBe('55');
  });

  it('keeps one decimal place for fractional lap totals', () => {
    expect(formatLapTotal(33.8)).toBe('33.8');
  });

  it('omits the decimal when the displayed value rounds to a whole lap', () => {
    expect(formatLapTotal(54.999999)).toBe('55');
  });
});
