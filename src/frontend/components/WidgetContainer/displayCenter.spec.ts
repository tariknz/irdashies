import { describe, expect, it } from 'vitest';
import {
  CENTER_GUIDE_SHOW_PX,
  CENTER_SNAP_PX,
  displayCenterX,
  isNearDisplayCenter,
  snapToDisplayCenter,
} from './displayCenter';

const CENTER = 960;
const at = (x: number, width = 400) => ({ x, y: 100, width, height: 200 });

describe('displayCenterX', () => {
  it('is the middle of the display, in screen coordinates', () => {
    expect(displayCenterX({ x: 0, y: 0, width: 1920, height: 1080 })).toBe(960);
    // A second display to the right of the primary.
    expect(displayCenterX({ x: 1920, y: 0, width: 2560, height: 1440 })).toBe(
      3200
    );
  });
});

describe('isNearDisplayCenter', () => {
  it('is near while the widget covers the middle', () => {
    expect(isNearDisplayCenter(at(CENTER - 200), CENTER)).toBe(true);
    expect(isNearDisplayCenter(at(CENTER - 390), CENTER)).toBe(true);
  });

  it('is near when the right edge comes close from the left', () => {
    expect(
      isNearDisplayCenter(at(CENTER - 400 - CENTER_GUIDE_SHOW_PX), CENTER)
    ).toBe(true);
    expect(
      isNearDisplayCenter(at(CENTER - 400 - CENTER_GUIDE_SHOW_PX - 1), CENTER)
    ).toBe(false);
  });

  it('is near when the left edge comes close from the right', () => {
    expect(isNearDisplayCenter(at(CENTER + CENTER_GUIDE_SHOW_PX), CENTER)).toBe(
      true
    );
    expect(
      isNearDisplayCenter(at(CENTER + CENTER_GUIDE_SHOW_PX + 1), CENTER)
    ).toBe(false);
  });
});

describe('snapToDisplayCenter', () => {
  it('centers the widget when its center is close to the middle', () => {
    const raw = at(CENTER - 200 + CENTER_SNAP_PX);
    expect(snapToDisplayCenter(raw, raw, CENTER).x).toBe(CENTER - 200);
    const other = at(CENTER - 200 - CENTER_SNAP_PX);
    expect(snapToDisplayCenter(other, other, CENTER).x).toBe(CENTER - 200);
  });

  it('leaves the widget alone farther away', () => {
    const raw = at(CENTER - 200 + CENTER_SNAP_PX + 1);
    expect(snapToDisplayCenter(raw, raw, CENTER)).toBe(raw);
  });

  it('decides on the pointer-driven layout, not the grid-snapped one', () => {
    // The grid moved the widget out of reach; the pointer is still close.
    const raw = at(CENTER - 200 + CENTER_SNAP_PX);
    const gridded = at(CENTER - 200 + CENTER_SNAP_PX + 4);
    expect(snapToDisplayCenter(gridded, raw, CENTER).x).toBe(CENTER - 200);
  });

  it('lands on a whole pixel for an odd width', () => {
    const raw = at(CENTER - 150, 301);
    expect(snapToDisplayCenter(raw, raw, CENTER).x).toBe(
      Math.round(CENTER - 150.5)
    );
  });
});
