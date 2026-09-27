import { act, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useRadarMotion } from './useRadarMotion';
import type { RadarBlip } from '../radarBlips';

const TRACK_LENGTH_M = 500;

const blip = (carIdx: number, alongM: number, lateralM = 0): RadarBlip => ({
  carIdx,
  alongM,
  lateralM,
  drawLateralM: lateralM,
  relYaw: 0,
  gapM: Math.abs(alongM),
  side: null,
  rimSignal: null,
  carNumber: null,
  isPaceCar: false,
});

describe('useRadarMotion', () => {
  let callbacks: FrameRequestCallback[];
  let nextFrameId: number;
  let clock: number;

  const advanceClock = (ms: number) => {
    clock += ms;
  };

  beforeEach(() => {
    callbacks = [];
    nextFrameId = 0;
    clock = 0;
    vi.spyOn(performance, 'now').mockImplementation(() => clock);
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
      callbacks.push(callback);
      return ++nextFrameId;
    });
    vi.stubGlobal('cancelAnimationFrame', vi.fn());
  });

  afterEach(() => {
    delete window.rendererPerfBridge;
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  interface Observed {
    along: number[];
    lateral: number[];
  }

  const recordDraw =
    (observed: Observed) =>
    (alongM: Float64Array, lateralM: Float64Array, count: number) => {
      observed.along.push(alongM[0]);
      observed.lateral?.push(lateralM[0]);
      void count;
    };
  it('glides a car between its snapshot positions in metre units', () => {
    const observed: Observed = { along: [], lateral: [] };
    const Harness = ({ blips }: { blips: readonly RadarBlip[] }) => {
      useRadarMotion(blips, TRACK_LENGTH_M, recordDraw(observed), false);
      return null;
    };

    const start: RadarBlip[] = [blip(1, 0)];
    const view = render(<Harness blips={start} />);
    expect(observed.along).toHaveLength(1);
    expect(observed.along[0]).toBeCloseTo(0, 6);
    // The first snapshot has no previous value: one paint, no frames.
    expect(callbacks).toHaveLength(0);

    // Retarget 2 m ahead; halfway through the 40 ms cadence the drawn value is
    // strictly between the endpoints. Metre units prove the lap-fraction
    // round-trip. Retargeting a moving car starts the RAF loop.
    advanceClock(0);
    view.rerender(<Harness blips={[blip(1, 2)]} />);
    observed.along = [];
    act(() => callbacks.shift()?.(20));
    expect(observed.along[0]).toBeGreaterThan(0.01);
    expect(observed.along[0]).toBeLessThan(1.99);

    act(() => callbacks.shift()?.(40));
    expect(observed.along[observed.along.length - 1]).toBeCloseTo(2, 6);
    expect(callbacks).toHaveLength(0);
  });

  it('advances lateral motion while along-track motion is active', () => {
    const observed: Observed = { along: [], lateral: [] };
    const Harness = ({ blips }: { blips: readonly RadarBlip[] }) => {
      useRadarMotion(blips, TRACK_LENGTH_M, recordDraw(observed), false);
      return null;
    };

    const view = render(<Harness blips={[blip(1, 0, 0)]} />);
    view.rerender(<Harness blips={[blip(1, 2, 2)]} />);
    act(() => callbacks.shift()?.(20));

    expect(observed.lateral.at(-1)).toBeGreaterThan(0.01);
    expect(observed.lateral.at(-1)).toBeLessThan(1.99);
  });

  it('never teleports: consecutive draws differ by no more than the target delta', () => {
    const observed: Observed = { along: [], lateral: [] };
    const Harness = ({ blips }: { blips: readonly RadarBlip[] }) => {
      useRadarMotion(blips, TRACK_LENGTH_M, recordDraw(observed), false);
      return null;
    };

    const view = render(<Harness blips={[blip(1, 0)]} />);
    while (callbacks.length) {
      act(() => callbacks.shift()?.(clock + 8));
      clock += 8;
    }

    view.rerender(<Harness blips={[blip(1, 2)]} />);
    let previous = 0;
    while (callbacks.length) {
      act(() => callbacks.shift()?.(clock + 8));
      clock += 8;
      const current = observed.along[observed.along.length - 1];
      expect(Math.abs(current - previous)).toBeLessThanOrEqual(2.5);
      previous = current;
    }
    expect(previous).toBeCloseTo(2, 1);
  });

  it('draws a car behind the player behind it, not a lap ahead', () => {
    const observed: Observed = { along: [], lateral: [] };
    const Harness = ({ blips }: { blips: readonly RadarBlip[] }) => {
      useRadarMotion(blips, TRACK_LENGTH_M, recordDraw(observed), false);
      return null;
    };

    const view = render(<Harness blips={[blip(1, 0)]} />);
    observed.along = [];
    view.rerender(<Harness blips={[blip(1, -4)]} />);
    while (callbacks.length) {
      act(() => callbacks.shift()?.(clock + 8));
      clock += 8;
    }

    // The interpolator stores lap fractions in [0, 1), so -4 m comes back as
    // 496 m unless the shortest delta is recovered.
    const drawn = observed.along[observed.along.length - 1];
    expect(drawn).toBeLessThan(0);
    expect(drawn).toBeCloseTo(-4, 6);
  });

  it('keeps ticking after geometry settles while the pulse is active', () => {
    // A stable blip list: a fresh array on every render would look like a
    // geometry change and request a frame on its own account.
    const blips = [blip(1, 1)];
    const Harness = ({ pulseActive }: { pulseActive: boolean }) => {
      useRadarMotion(
        blips,
        TRACK_LENGTH_M,
        (a, l, c) => {
          void a;
          void l;
          void c;
        },
        pulseActive
      );
      return null;
    };

    const view = render(<Harness pulseActive={false} />);
    expect(callbacks).toHaveLength(0);

    view.rerender(<Harness pulseActive />);
    expect(callbacks).toHaveLength(1);
    act(() => callbacks.shift()?.(16));
    expect(callbacks).toHaveLength(1);

    // The pending callback is cancelled, not removed from the log, so what
    // matters is that turning the pulse off requests nothing further.
    const pending = callbacks.length;
    view.rerender(<Harness pulseActive={false} />);
    expect(callbacks).toHaveLength(pending);
    expect(cancelAnimationFrame).toHaveBeenCalled();
  });

  it('stops requesting frames once the blips have settled', () => {
    let draws = 0;
    const Harness = ({ blips }: { blips: readonly RadarBlip[] }) => {
      useRadarMotion(
        blips,
        TRACK_LENGTH_M,
        (a, l, c) => {
          void a;
          void l;
          void c;
          draws++;
        },
        false
      );
      return null;
    };

    const view = render(<Harness blips={[blip(1, 1)]} />);
    view.rerender(<Harness blips={[blip(1, 1)]} />);
    // The second retarget has no movement: one paint, no frames.
    expect(callbacks).toHaveLength(0);
    expect(draws).toBe(2);
  });

  it('interpolates the drawn lateral offset, not the measured one', () => {
    // A car the sim reports alongside has a measured offset of zero and a
    // placed one a car width to the side. Following the measured value would
    // paint it on the player; following the placed one is what the disc does.
    const observed: Observed = { along: [], lateral: [] };
    const Harness = ({ blips }: { blips: readonly RadarBlip[] }) => {
      useRadarMotion(blips, TRACK_LENGTH_M, recordDraw(observed), false);
      return null;
    };

    render(
      <Harness
        blips={[{ ...blip(1, 0, 0), drawLateralM: -2.2 } as RadarBlip]}
      />
    );

    expect(observed.lateral.at(-1)).toBeCloseTo(-2.2, 6);
  });
});
