import { describe, expect, it } from 'vitest';
import { roundLayout } from './roundLayout';

describe('roundLayout', () => {
  it('rounds the edges to whole pixels and takes the size between them', () => {
    expect(
      roundLayout({
        x: 10.4,
        y: 19.6,
        width: 396.40000000000003,
        height: 119.99999999999999,
      })
    ).toEqual({ x: 10, y: 20, width: 397, height: 120 });
  });

  it('keeps an edge already on a whole pixel where it is', () => {
    // Resized from the left and top by half a pixel: right edge at 400,
    // bottom at 150.
    expect(
      roundLayout({ x: 100.5, y: 50.5, width: 299.5, height: 99.5 })
    ).toEqual({ x: 101, y: 51, width: 299, height: 99 });
  });

  it('keeps the size of a dragged layout', () => {
    expect(roundLayout({ x: 10.4, y: 19.6, width: 300, height: 100 })).toEqual({
      x: 10,
      y: 20,
      width: 300,
      height: 100,
    });
  });
});
