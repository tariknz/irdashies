import { describe, expect, it } from 'vitest';
import { zoomPreviewAt } from './viewport';

describe('preview wheel zoom', () => {
  it('keeps the widget point under an off-centre cursor fixed', () => {
    const before = { scale: 0.4, pan: { x: -24, y: 60 } };
    const anchor = { x: 120, y: -40 };
    const after = zoomPreviewAt(before, -120, anchor);
    expect(after.scale).toBeGreaterThan(before.scale);
    expect((anchor.x - after.pan.x) / after.scale).toBeCloseTo(
      (anchor.x - before.pan.x) / before.scale
    );
    expect((anchor.y - after.pan.y) / after.scale).toBeCloseTo(
      (anchor.y - before.pan.y) / before.scale
    );
  });
  it('returns to the original view when reversing a scroll', () => {
    const start = { scale: 1, pan: { x: 30, y: -20 } };
    const anchor = { x: -200, y: 100 };
    const result = zoomPreviewAt(zoomPreviewAt(start, 80, anchor), -80, anchor);
    expect(result.scale).toBeCloseTo(start.scale);
    expect(result.pan.x).toBeCloseTo(start.pan.x);
    expect(result.pan.y).toBeCloseTo(start.pan.y);
  });
  it('limits extreme scroll events and clamps the zoom range', () => {
    expect(
      zoomPreviewAt({ scale: 4, pan: { x: 0, y: 0 } }, -10000, { x: 0, y: 0 })
        .scale
    ).toBe(4);
    expect(
      zoomPreviewAt({ scale: 0.05, pan: { x: 0, y: 0 } }, 10000, { x: 0, y: 0 })
        .scale
    ).toBe(0.05);
    const view = { scale: 1, pan: { x: 0, y: 0 } };
    expect(zoomPreviewAt(view, 10000, view.pan)).toEqual(
      zoomPreviewAt(view, 240, view.pan)
    );
  });
});
