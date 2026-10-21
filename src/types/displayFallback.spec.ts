import { describe, it, expect } from 'vitest';
import { fitLayoutToDisplay, isLayoutOnDisplay } from './displayFallback';

const primary = { x: 0, y: 0, width: 1920, height: 1080 };

describe('fitLayoutToDisplay', () => {
  it('leaves a widget already on the display alone', () => {
    const layout = { x: 100, y: 200, width: 300, height: 100 };
    expect(fitLayoutToDisplay(layout, primary)).toEqual(layout);
  });

  it('maps a widget from a same-sized monitor on the right', () => {
    const layout = { x: 1920 + 500, y: 300, width: 300, height: 100 };
    expect(fitLayoutToDisplay(layout, primary)).toEqual({
      ...layout,
      x: 500,
    });
  });

  it('maps a widget from a monitor on the left', () => {
    const layout = { x: -1920 + 500, y: 300, width: 300, height: 100 };
    expect(fitLayoutToDisplay(layout, primary).x).toBe(500);
  });

  it('keeps a widget from a larger monitor fully inside', () => {
    const layout = { x: 1920 + 1800, y: 1300, width: 300, height: 100 };
    const fitted = fitLayoutToDisplay(layout, primary);
    expect(isLayoutOnDisplay(fitted, primary)).toBe(true);
    expect(fitted.x + fitted.width).toBeLessThanOrEqual(1920);
    expect(fitted.y + fitted.height).toBeLessThanOrEqual(1080);
  });
});
