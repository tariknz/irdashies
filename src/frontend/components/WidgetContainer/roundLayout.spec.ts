import { describe, expect, it } from 'vitest';
import { roundLayout } from './roundLayout';

describe('roundLayout', () => {
  it('rounds position and size to whole pixels', () => {
    expect(
      roundLayout({
        x: 10.4,
        y: 19.6,
        width: 396.40000000000003,
        height: 119.99999999999999,
      })
    ).toEqual({ x: 10, y: 20, width: 396, height: 120 });
  });
});
