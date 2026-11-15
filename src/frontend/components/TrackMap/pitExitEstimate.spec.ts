import { describe, expect, it, vi } from 'vitest';
import type { PitStopEstimateSnapshot } from '@irdashies/types';
import { drawPitExitMarker, drawPitExitRange } from './trackDrawingUtils';
import { pitExitTrafficLines, toPitExitMarker } from './hooks/usePitExitMarker';

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
  inStop: false,
  aheadCarIdx: null,
  aheadGapSeconds: null,
  behindCarIdx: null,
  behindGapSeconds: null,
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
      ahead: null,
      behind: null,
    });
  });

  it('carries the cars either side of the rejoin point', () => {
    const marker = toPitExitMarker(
      snapshot({
        aheadCarIdx: 3,
        aheadGapSeconds: 1.4,
        behindCarIdx: 9,
        behindGapSeconds: 2,
      }),
      7,
      on
    );
    expect(marker?.ahead).toEqual({ carIdx: 3, gapSeconds: 1.4 });
    expect(marker?.behind).toEqual({ carIdx: 9, gapSeconds: 2 });
  });

  it('stays up during a stop after refuelling clears "fuel stop needed"', () => {
    const fuelOnly = { enabled: true, showWhen: 'fuelStopNeeded' as const };
    expect(
      toPitExitMarker(
        snapshot({ fuelStopNeeded: false, inStop: true }),
        7,
        fuelOnly
      )
    ).not.toBeNull();
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

describe('pitExitTrafficLines', () => {
  const numbers: Record<number, string> = { 3: '12', 9: '7' };
  const carNumber = (carIdx: number) => numbers[carIdx];

  it('lists the car ahead then the car behind, with the gaps', () => {
    expect(
      pitExitTrafficLines(
        {
          ahead: { carIdx: 3, gapSeconds: 1.4 },
          behind: { carIdx: 9, gapSeconds: 2 },
        },
        carNumber
      )
    ).toEqual(['#12 1.4s ahead', '#7 2.0s behind']);
  });

  it('leaves out a side with no car, or a car it cannot name', () => {
    expect(
      pitExitTrafficLines(
        { ahead: null, behind: { carIdx: 9, gapSeconds: 0.3 } },
        carNumber
      )
    ).toEqual(['#7 0.3s behind']);
    expect(
      pitExitTrafficLines(
        { ahead: { carIdx: 99, gapSeconds: 1 }, behind: null },
        carNumber
      )
    ).toEqual([]);
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
      measureText: vi.fn((text: string) => ({ width: text.length * 5 })),
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

  it('lists the cars either side below the ring, one per line', () => {
    const { ctx } = context();
    drawPitExitMarker(ctx, marker, 0.5, flat, 10, 8, scratch(), [
      '#12 1.4s ahead',
      '#7 2.0s behind',
    ]);
    const texts = vi.mocked(ctx.fillText).mock.calls;
    const ahead = texts.find(([text]) => text === '#12 1.4s ahead');
    const behind = texts.find(([text]) => text === '#7 2.0s behind');
    expect(ahead?.[2]).toBeGreaterThan(10);
    expect(behind?.[2]).toBeGreaterThan(ahead?.[2] ?? Infinity);
    expect(ctx.roundRect).toHaveBeenCalledTimes(2);
  });

  it('draws no traffic box without traffic', () => {
    const { ctx } = context();
    drawPitExitMarker(ctx, marker, 0.5, flat, 10, 8, scratch());
    expect(ctx.roundRect).toHaveBeenCalledTimes(1);
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
