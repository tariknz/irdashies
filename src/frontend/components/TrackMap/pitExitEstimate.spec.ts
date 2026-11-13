import { describe, expect, it, vi } from 'vitest';
import type { PitStopEstimateSnapshot } from '@irdashies/types';
import { drawPitExitMarker, drawPitExitRange } from './trackDrawingUtils';
import { toPitExitMarker } from './hooks/usePitExitMarker';

const snapshot = (
  overrides: Partial<PitStopEstimateSnapshot> = {}
): PitStopEstimateSnapshot => ({
  state: 'ok',
  offsetPct: 0.4,
  offsetNearPct: 0.38,
  offsetFarPct: 0.42,
  lapsLost: 0,
  lossSeconds: 40,
  fuelStopNeeded: true,
  sessionNum: 0,
  version: 1,
  ...overrides,
});

describe('toPitExitMarker', () => {
  const on = { enabled: true, showWhen: 'always' as const };

  it('anchors to the player car with the snapshot offsets', () => {
    expect(toPitExitMarker(snapshot(), 7, on)).toEqual({
      anchorCarIdx: 7,
      offsetPct: 0.4,
      nearPct: 0.38,
      farPct: 0.42,
      state: 'ok',
    });
  });

  it('shows nothing when switched off, hidden, or without a position', () => {
    expect(
      toPitExitMarker(snapshot(), 7, { ...on, enabled: false })
    ).toBeNull();
    expect(toPitExitMarker(snapshot(), 7, undefined)).toBeNull();
    expect(toPitExitMarker(snapshot({ state: 'hidden' }), 7, on)).toBeNull();
    expect(toPitExitMarker(snapshot({ offsetPct: null }), 7, on)).toBeNull();
    expect(toPitExitMarker(snapshot(), undefined, on)).toBeNull();
    expect(toPitExitMarker(undefined, 7, on)).toBeNull();
  });

  it('respects "only when a fuel stop is needed"', () => {
    const fuelOnly = { enabled: true, showWhen: 'fuelStopNeeded' as const };
    expect(toPitExitMarker(snapshot(), 7, fuelOnly)).not.toBeNull();
    expect(
      toPitExitMarker(snapshot({ fuelStopNeeded: false }), 7, fuelOnly)
    ).toBeNull();
    expect(
      toPitExitMarker(snapshot({ fuelStopNeeded: null }), 7, fuelOnly)
    ).toBeNull();
  });
});

describe('pit exit drawing', () => {
  const context = () => {
    const moves: number[] = [];
    const strokes: string[] = [];
    const ctx = {
      save: vi.fn(),
      restore: vi.fn(),
      beginPath: vi.fn(),
      moveTo: vi.fn((x: number) => moves.push(x)),
      lineTo: vi.fn(),
      arc: vi.fn(),
      roundRect: vi.fn(),
      fill: vi.fn(),
      fillText: vi.fn(),
      setLineDash: vi.fn(),
      stroke: vi.fn(function (this: { strokeStyle: string }) {
        strokes.push(this.strokeStyle);
      }),
      strokeStyle: '',
      globalAlpha: 1,
    } as unknown as CanvasRenderingContext2D;
    return { ctx, moves, strokes };
  };
  const flat = (progress: number, output: { x: number; y: number }) => {
    output.x = progress;
    output.y = 0;
  };
  const marker = {
    offsetPct: 0.2,
    nearPct: 0.1,
    farPct: 0.3,
    state: 'ok' as const,
  };
  const scratch = () => ({ x: 0, y: 0 });

  it('rings the player position minus the offset, black edge then white', () => {
    const { ctx, strokes } = context();
    drawPitExitMarker(ctx, marker, 0.5, flat, 10, 8, scratch());
    expect(ctx.arc).toHaveBeenCalledWith(
      expect.closeTo(0.3, 6),
      0,
      10,
      0,
      Math.PI * 2
    );
    expect(strokes).toEqual(['black', 'white']);
    expect(ctx.setLineDash).toHaveBeenNthCalledWith(1, []);
    expect(ctx.fillText).toHaveBeenCalledWith(
      'PIT',
      expect.closeTo(0.3, 6),
      expect.any(Number)
    );
  });

  it('dashes the ring while calibrating and fades it under caution', () => {
    const calibrating = context();
    drawPitExitMarker(
      calibrating.ctx,
      { ...marker, state: 'calibrating' },
      0.5,
      flat,
      10,
      8,
      scratch()
    );
    expect(calibrating.ctx.setLineDash).toHaveBeenNthCalledWith(1, [6, 3.5]);
    expect(calibrating.ctx.globalAlpha).toBe(1);

    const caution = context();
    drawPitExitMarker(
      caution.ctx,
      { ...marker, state: 'unreliable' },
      0.5,
      flat,
      10,
      8,
      scratch()
    );
    expect(caution.ctx.globalAlpha).toBe(0.6);
  });

  it('shades the range dark on a light track and light on a dark one', () => {
    const light = context();
    drawPitExitRange(light.ctx, marker, 0.5, flat, 6, false, scratch());
    expect(light.strokes).toEqual(['rgba(0, 0, 0, 0.45)']);
    const dark = context();
    drawPitExitRange(dark.ctx, marker, 0.5, flat, 6, true, scratch());
    expect(dark.strokes).toEqual(['rgba(255, 255, 255, 0.55)']);
  });

  it('breaks the range where it crosses start/finish', () => {
    const { ctx, moves } = context();
    // The range runs from 0.85 to 0.05, so it restarts once at the line.
    drawPitExitRange(ctx, marker, 0.15, flat, 6, false, scratch());
    expect(moves).toHaveLength(2);
  });
});
