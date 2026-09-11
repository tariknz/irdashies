import { render, waitFor, cleanup } from '@testing-library/react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useLapTraceStore } from '@irdashies/context';
import { DEFAULT_LAP_TRACE_COLORS } from '@irdashies/types';
import { hydrateLapTrace } from '../../domain/lapTrace/hydrateLapTrace';
import { LapTracePlot } from './LapTracePlot';
import { makeSyntheticLapTrace } from './fixtures/syntheticLap';
import {
  MAX_GEAR_LABELS,
  PLOT_BOTTOM,
  PLOT_TOP,
  VIEW_WIDTH,
  yForNorm,
} from './layout';

vi.mock('@irdashies/utils/logger', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

const TRACK_LENGTH_M = 5000;

const defaultProps = {
  metersBehind: 200,
  metersAhead: 200,
  showThrottle: true,
  showBrake: true,
  showSpeed: true,
  showGhost: true,
  showGearLabels: true,
  showBrakePointMarkers: true,
  showThrottlePointMarkers: true,
  ghostOpacity: 0.45,
  driverOpacity: 1,
  referenceFilled: false,
  strokeWidth: 3,
  colors: DEFAULT_LAP_TRACE_COLORS,
};

const seedReference = () => {
  const record = makeSyntheticLapTrace({ trackLengthM: TRACK_LENGTH_M });
  const view = hydrateLapTrace(record);
  useLapTraceStore.setState({
    trackId: record.trackId,
    trackLengthM: record.trackLengthM,
    referenceLap: view,
  });
  return view;
};

/** Pull the x coordinates out of a path built as a run of M/L commands. */
const xsOf = (d: string): number[] =>
  [...d.matchAll(/[ML](-?[\d.]+)/g)].map((m) => Number(m[1]));

/** Pull the (x, y) pairs out of a path built as a run of M/L commands. */
const pointsOf = (d: string): { x: number; y: number }[] =>
  [...d.matchAll(/[ML](-?[\d.]+) (-?[\d.]+)/g)].map((m) => ({
    x: Number(m[1]),
    y: Number(m[2]),
  }));

interface GhostSample {
  d: number;
  throttle?: number;
  brake?: number;
  speed?: number;
  abs?: number;
}

/** Write a driven lap straight into the active buffer, one sample per entry. */
const seedGhost = async (samples: GhostSample[]) => {
  await useLapTraceStore
    .getState()
    .initialize(undefined, 1, '', 'car', TRACK_LENGTH_M);
  seedReference();
  const { activeLap } = useLapTraceStore.getState();
  if (!activeLap) throw new Error('activeLap not initialised');
  for (const s of samples) {
    activeLap.samples.push(
      s.d,
      s.d / 40,
      s.throttle ?? 0,
      s.brake ?? 0,
      s.speed ?? 40,
      3,
      s.abs ?? 0
    );
  }
  useLapTraceStore.setState({ activeLap });
};

/**
 * Write the tail of a finished lap into the carry-over, the way the recorder
 * does at a crossing. Distances are lap-local, so near `TRACK_LENGTH_M`.
 */
const seedCarryOver = (samples: GhostSample[]) => {
  const { activeLap } = useLapTraceStore.getState();
  if (!activeLap) throw new Error('activeLap not initialised');
  for (const s of samples) {
    activeLap.carryOver.push(
      s.d,
      s.d / 40,
      s.throttle ?? 0,
      s.brake ?? 0,
      s.speed ?? 40,
      3,
      s.abs ?? 0
    );
  }
  useLapTraceStore.setState({ activeLap });
};

/** Samples every `step` metres from 0 to `untilM`, shaped by `at`. */
const everyMetres = (
  untilM: number,
  step: number,
  at: (d: number) => Omit<GhostSample, 'd'>
): GhostSample[] => {
  const out: GhostSample[] = [];
  for (let d = 0; d <= untilM; d += step) out.push({ d, ...at(d) });
  return out;
};

const ghostPathByStroke = (container: HTMLElement, stroke: string) =>
  [...container.querySelectorAll('svg > g')[1].querySelectorAll('path')].find(
    (p) => p.getAttribute('stroke') === stroke
  );

describe('LapTracePlot', () => {
  beforeEach(() => {
    useLapTraceStore.getState().reset();
  });

  afterEach(() => {
    cleanup();
  });

  it('keeps a stopped car on the axis, not below it', async () => {
    // The shared speed scale is the reference lap's own range, whose floor is
    // its slowest corner — not a floor the driver shares. Stopped in the pits
    // normalises well below zero, which used to draw a flat line under the
    // plot until the car passed the reference's minimum speed.
    const reference = seedReference();
    expect(reference.speedMinMs).toBeGreaterThan(0);

    await seedGhost(everyMetres(400, 5, () => ({ speed: 0, throttle: 0 })));

    const { container } = render(
      <LapTracePlot {...defaultProps} carDistanceMOverride={300} />
    );

    await waitFor(() => {
      const d =
        ghostPathByStroke(
          container,
          DEFAULT_LAP_TRACE_COLORS.ghostSpeed
        )?.getAttribute('d') ?? '';
      expect(d).not.toBe('');
      const ys = pointsOf(d).map((p) => p.y);
      expect(ys.length).toBeGreaterThan(0);
      // PLOT_BOTTOM is the largest y in the band; nothing may sit past it.
      for (const y of ys) expect(y).toBeLessThanOrEqual(PLOT_BOTTOM);
      expect(Math.max(...ys)).toBeCloseTo(PLOT_BOTTOM, 5);
    });
  });

  describe('the start/finish seam', () => {
    const CAR_M = 30;
    /** x of the car, and of the line itself, for the default 200/200 window. */
    const carX = ((CAR_M - CAR_M + 200) / 400) * VIEW_WIDTH;
    const lineX = ((0 - CAR_M + 200) / 400) * VIEW_WIDTH;

    const seedJustAfterTheLine = async () => {
      await seedGhost(
        everyMetres(CAR_M, 5, () => ({ throttle: 1, speed: 40 }))
      );
    };

    it('runs the driver trace back over the line into the lap just finished', async () => {
      await seedJustAfterTheLine();
      seedCarryOver(
        everyMetres(200, 5, () => ({ throttle: 1, speed: 40 })).map((s) => ({
          ...s,
          d: TRACK_LENGTH_M - 200 + s.d,
        }))
      );

      const { container } = render(
        <LapTracePlot {...defaultProps} carDistanceMOverride={CAR_M} />
      );

      await waitFor(() => {
        const d =
          ghostPathByStroke(
            container,
            DEFAULT_LAP_TRACE_COLORS.ghostThrottle
          )?.getAttribute('d') ?? '';
        expect(d).not.toBe('');
        const xs = xsOf(d);
        // Reaches the left edge of the window, which is the previous lap.
        expect(Math.min(...xs)).toBeLessThan(lineX - 1);
        // One subpath: the pen stays down across the seam, so the trace is
        // continuous rather than two strokes meeting at the line.
        expect((d.match(/M/g) ?? []).length).toBe(1);
      });
    });

    it('stops at the line when no lap was carried over', async () => {
      await seedJustAfterTheLine();

      const { container } = render(
        <LapTracePlot {...defaultProps} carDistanceMOverride={CAR_M} />
      );

      await waitFor(() => {
        const d =
          ghostPathByStroke(
            container,
            DEFAULT_LAP_TRACE_COLORS.ghostThrottle
          )?.getAttribute('d') ?? '';
        expect(d).not.toBe('');
        // Nothing behind the line exists on the first lap of a session.
        expect(Math.min(...xsOf(d))).toBeGreaterThanOrEqual(lineX - 1);
      });
    });

    it('never draws the carried lap ahead of the car', async () => {
      await seedJustAfterTheLine();
      seedCarryOver(
        everyMetres(200, 5, () => ({ throttle: 1, speed: 40 })).map((s) => ({
          ...s,
          d: TRACK_LENGTH_M - 200 + s.d,
        }))
      );

      const { container } = render(
        <LapTracePlot {...defaultProps} carDistanceMOverride={CAR_M} />
      );

      await waitFor(() => {
        const d =
          ghostPathByStroke(
            container,
            DEFAULT_LAP_TRACE_COLORS.ghostThrottle
          )?.getAttribute('d') ?? '';
        expect(d).not.toBe('');
        // The reference may run ahead; what the driver has actually done
        // cannot, whichever lap the samples came from.
        expect(Math.max(...xsOf(d))).toBeLessThanOrEqual(carX + 1);
      });
    });
  });

  describe('ABS', () => {
    /** An in-progress lap braking across the window, with ABS in the middle. */
    const seedAbsLap = () =>
      seedGhost(
        everyMetres(TRACK_LENGTH_M - 1, 2, (d) => ({
          brake: 0.8,
          // ABS only over a stretch in the middle of the window around 800 m.
          abs: d >= 750 && d < 850 ? 1 : 0,
        }))
      );

    it('highlights only the stretch of brake trace where ABS engaged', async () => {
      await seedAbsLap();
      const { container } = render(
        <LapTracePlot {...defaultProps} showAbs carDistanceMOverride={800} />
      );

      await waitFor(() => {
        const paths = [...container.querySelectorAll('path')];
        const withD = paths.filter(
          (p) => (p.getAttribute('d') ?? '').length > 0
        );
        expect(withD.length).toBeGreaterThan(0);
      });

      const brake = ghostPathByStroke(
        container,
        DEFAULT_LAP_TRACE_COLORS.ghostBrake
      );
      const abs = ghostPathByStroke(container, DEFAULT_LAP_TRACE_COLORS.abs);
      const brakeXs = xsOf(brake?.getAttribute('d') ?? '');
      const absXs = xsOf(abs?.getAttribute('d') ?? '');
      // The ABS overlay covers a strict subset of the brake run it sits on:
      // 750..800 m of a window that starts at 600 m.
      expect(absXs.length).toBeGreaterThan(0);
      expect(absXs.length).toBeLessThan(brakeXs.length);
      expect(Math.min(...absXs)).toBeGreaterThan(Math.min(...brakeXs));
    });

    it('draws no ABS overlay when it is switched off', async () => {
      await seedAbsLap();
      const withAbs = render(
        <LapTracePlot {...defaultProps} showAbs carDistanceMOverride={800} />
      );
      await waitFor(() =>
        expect(
          withAbs.container.querySelectorAll('path').length
        ).toBeGreaterThan(0)
      );
      const withAbsCount = withAbs.container.querySelectorAll('path').length;
      cleanup();

      const withoutAbs = render(
        <LapTracePlot
          {...defaultProps}
          showAbs={false}
          carDistanceMOverride={800}
        />
      );
      expect(withoutAbs.container.querySelectorAll('path').length).toBeLessThan(
        withAbsCount
      );
    });

    it('adds a strip only when the ABS bar is switched on', async () => {
      await seedAbsLap();
      const without = render(
        <LapTracePlot {...defaultProps} carDistanceMOverride={800} />
      );
      const baseline = without.container.querySelectorAll('path').length;
      cleanup();

      const withBar = render(
        <LapTracePlot {...defaultProps} showAbsBar carDistanceMOverride={800} />
      );
      expect(withBar.container.querySelectorAll('path').length).toBe(
        baseline + 1
      );
      await waitFor(() => {
        const bar = [...withBar.container.querySelectorAll('path')].find(
          (p) => p.getAttribute('stroke-width') === '4'
        );
        // One run, drawn as its two ends.
        expect(xsOf(bar?.getAttribute('d') ?? '')).toHaveLength(2);
      });
    });

    it('fills the brake curve down to the axis, blended, when absStyle is "bar"', async () => {
      await seedAbsLap();
      const overlay = render(
        <LapTracePlot
          {...defaultProps}
          showAbs
          absStyle="overlay"
          carDistanceMOverride={800}
        />
      );
      const overlayCount = overlay.container.querySelectorAll('path').length;
      cleanup();

      const bar = render(
        <LapTracePlot
          {...defaultProps}
          showAbs
          absStyle="bar"
          carDistanceMOverride={800}
        />
      );

      expect(bar.container.querySelectorAll('path').length).toBe(
        overlayCount + 1
      );

      let filled: Element | undefined;
      await waitFor(() => {
        filled = [...bar.container.querySelectorAll('path')].find(
          (p) =>
            p.getAttribute('fill') !== 'none' &&
            p.getAttribute('fill') !== null &&
            (p.getAttribute('d') ?? '').includes('Z')
        );
        expect(filled).toBeTruthy();
      });
      expect((filled as SVGElement)?.style.mixBlendMode).toBe('screen');
    });
  });

  it('draws the reference traces across the window', async () => {
    seedReference();
    const { container } = render(
      <LapTracePlot {...defaultProps} carDistanceMOverride={800} />
    );

    await waitFor(() => {
      const paths = [...container.querySelectorAll('path')];
      expect(paths.length).toBeGreaterThan(0);
      expect(paths.some((p) => p.getAttribute('d'))).toBe(true);
    });

    const paths = [...container.querySelectorAll('path')];
    const drawn = paths.filter((p) => (p.getAttribute('d') ?? '').length > 0);
    // Throttle, brake and speed for the reference lap.
    expect(drawn.length).toBeGreaterThanOrEqual(3);

    const xs = xsOf(drawn[drawn.length - 1].getAttribute('d') ?? '');
    expect(xs.length).toBeGreaterThan(50);
    expect(Math.min(...xs)).toBeLessThanOrEqual(0);
    expect(Math.max(...xs)).toBeGreaterThanOrEqual(VIEW_WIDTH);
  });

  it('keeps x monotonic when the window straddles start/finish', async () => {
    seedReference();
    const { container } = render(
      <LapTracePlot
        {...defaultProps}
        carDistanceMOverride={TRACK_LENGTH_M - 20}
      />
    );

    const firstDrawn = () =>
      [...container.querySelectorAll('path')]
        .map((p) => p.getAttribute('d') ?? '')
        .find((v) => v.length > 0);

    await waitFor(() => {
      expect(firstDrawn()).toBeTruthy();
    });

    const d = firstDrawn() ?? '';
    const xs = xsOf(d);
    expect(xs.length).toBeGreaterThan(50);
    for (let i = 1; i < xs.length; i++) {
      expect(xs[i]).toBeGreaterThanOrEqual(xs[i - 1]);
    }
    // One continuous run through the line — no pen lift at the seam.
    expect((d.match(/M/g) ?? []).length).toBe(1);
  });

  it('never draws the ghost trace ahead of the car, even when the window wraps at start/finish', async () => {
    // Hand-populate the whole lap as already driven — including the samples
    // near the start line, which is exactly the data a forward wrap near the
    // line would otherwise surface on the wrong (ahead) side of the car.
    await seedGhost(
      everyMetres(TRACK_LENGTH_M - 1, 2, () => ({
        throttle: 0.9,
        brake: 0.1,
        speed: 50,
      }))
    );

    const { container } = render(
      <LapTracePlot
        {...defaultProps}
        carDistanceMOverride={TRACK_LENGTH_M - 20}
      />
    );

    await waitFor(() => {
      const groups = container.querySelectorAll('svg > g');
      const ghostGroup = groups[1];
      const drawn = ghostGroup
        ? [...ghostGroup.querySelectorAll('path')].some(
            (p) => (p.getAttribute('d') ?? '').length > 0
          )
        : false;
      expect(drawn).toBe(true);
    });

    // Reference group (groups[0]) legitimately draws ahead of the car — only
    // the ghost/driver group (groups[1]) is under test here.
    const ghostGroup = container.querySelectorAll('svg > g')[1];
    const ghostXs = [...ghostGroup.querySelectorAll('path')]
      .map((p) => p.getAttribute('d') ?? '')
      .flatMap(xsOf);

    expect(ghostXs.length).toBeGreaterThan(0);
    for (const x of ghostXs) {
      // VIEW_WIDTH/2 is the car's x for this file's symmetric
      // metersBehind/metersAhead=200/200 defaultProps; +0.05 tolerates the
      // path's toFixed(1) rounding at the exact boundary.
      expect(x).toBeLessThanOrEqual(VIEW_WIDTH / 2 + 0.05);
    }
  });

  it('keeps a throttle lift drawn before the brake application that followed it', async () => {
    // The two inputs 0.3 m apart — well inside one decimation bin — must
    // still come out in order: the throttle reaches zero at 799.7 m, the
    // brake leaves zero at 800.0 m. This is the whole point of storing the
    // samples rather than a per-distance aggregate.
    const samples = everyMetres(798, 2, () => ({ throttle: 1, brake: 0 }));
    samples.push({ d: 799.7, throttle: 0, brake: 0 });
    samples.push({ d: 800, throttle: 0, brake: 1 });
    await seedGhost(samples);

    const { container } = render(
      <LapTracePlot {...defaultProps} carDistanceMOverride={800} />
    );

    await waitFor(() => {
      const brake = ghostPathByStroke(
        container,
        DEFAULT_LAP_TRACE_COLORS.ghostBrake
      );
      expect((brake?.getAttribute('d') ?? '').length).toBeGreaterThan(0);
    });

    const baseline = yForNorm(0);
    const throttle = pointsOf(
      ghostPathByStroke(
        container,
        DEFAULT_LAP_TRACE_COLORS.ghostThrottle
      )?.getAttribute('d') ?? ''
    );
    const brake = pointsOf(
      ghostPathByStroke(
        container,
        DEFAULT_LAP_TRACE_COLORS.ghostBrake
      )?.getAttribute('d') ?? ''
    );

    const throttleOffX = throttle.find(
      (p) => Math.abs(p.y - baseline) < 0.2
    )?.x;
    const brakeOnX = brake.find((p) => p.y < baseline - 1)?.x;
    expect(throttleOffX).toBeDefined();
    expect(brakeOnX).toBeDefined();
    expect(throttleOffX as number).toBeLessThan(brakeOnX as number);
  });

  it('keeps a one-sample brake stab through decimation', async () => {
    await seedGhost(
      everyMetres(700, 2, (d) => ({ throttle: 1, brake: d === 600 ? 1 : 0 }))
    );

    const { container } = render(
      <LapTracePlot {...defaultProps} carDistanceMOverride={700} />
    );

    await waitFor(() => {
      const brake = ghostPathByStroke(
        container,
        DEFAULT_LAP_TRACE_COLORS.ghostBrake
      );
      expect((brake?.getAttribute('d') ?? '').length).toBeGreaterThan(0);
    });

    const brake = pointsOf(
      ghostPathByStroke(
        container,
        DEFAULT_LAP_TRACE_COLORS.ghostBrake
      )?.getAttribute('d') ?? ''
    );
    const top = yForNorm(1);
    expect(brake.some((p) => Math.abs(p.y - top) < 0.2)).toBe(true);
  });

  it('leaves the traces empty until a reference lap exists', async () => {
    const { container } = render(
      <LapTracePlot {...defaultProps} carDistanceMOverride={800} />
    );

    await waitFor(() => {
      expect(container.querySelectorAll('path').length).toBeGreaterThan(0);
    });

    const drawn = [...container.querySelectorAll('path')].filter(
      (p) => (p.getAttribute('d') ?? '').length > 0
    );
    expect(drawn).toHaveLength(0);
  });

  it('omits a channel that is switched off', async () => {
    seedReference();
    const { container } = render(
      <LapTracePlot
        {...defaultProps}
        showBrake={false}
        showSpeed={false}
        showGhost={false}
        carDistanceMOverride={800}
      />
    );

    await waitFor(() => {
      const drawn = [...container.querySelectorAll('path')].filter(
        (p) => (p.getAttribute('d') ?? '').length > 0
      );
      expect(drawn).toHaveLength(1);
    });
  });

  it('places brake application markers at their sub-metre position', async () => {
    const view = seedReference();
    const brakeOnM = view.events.brakeOnM;
    expect(brakeOnM.length).toBeGreaterThan(0);

    // Centre the window on the first braking point so it must be visible.
    const target = brakeOnM[0];
    const { container } = render(
      <LapTracePlot {...defaultProps} carDistanceMOverride={target} />
    );

    await waitFor(() => {
      const visible = [...container.querySelectorAll('line')].filter(
        (l) => l.style.visibility === 'visible'
      );
      expect(visible.length).toBeGreaterThan(0);
    });

    const visible = [...container.querySelectorAll('line')].filter(
      (l) => l.style.visibility === 'visible'
    );
    // The marker for the point under the car sits on the car line at x=500.
    const xs = visible.map((l) => Number(l.getAttribute('x1')));
    expect(xs.some((x) => Math.abs(x - VIEW_WIDTH / 2) < 1)).toBe(true);
  });

  it('draws markers as a dotted line through the full height of the plot', async () => {
    const view = seedReference();
    const brakeOnM = view.events.brakeOnM[0] ?? 0;

    const { container } = render(
      <LapTracePlot {...defaultProps} carDistanceMOverride={brakeOnM} />
    );

    await waitFor(() => {
      const visible = [...container.querySelectorAll('line')].filter(
        (l) => l.style.visibility === 'visible'
      );
      expect(visible.length).toBeGreaterThan(0);
    });

    const visible = [...container.querySelectorAll('line')].filter(
      (l) => l.style.visibility === 'visible'
    );
    for (const line of visible) {
      expect(Number(line.getAttribute('y1'))).toBe(PLOT_TOP);
      expect(Number(line.getAttribute('y2'))).toBe(PLOT_BOTTOM);
      expect(line.getAttribute('stroke-dasharray')).toBeTruthy();
    }
  });

  it('hides markers entirely when both settings are off', async () => {
    const view = seedReference();
    const target = view.events.brakeOnM[0] ?? 0;

    const { container } = render(
      <LapTracePlot
        {...defaultProps}
        showBrakePointMarkers={false}
        showThrottlePointMarkers={false}
        carDistanceMOverride={target}
      />
    );

    await waitFor(() => {
      expect(container.querySelectorAll('path').length).toBeGreaterThan(0);
    });

    // Gridlines and the car line carry no visibility style, so anything
    // explicitly visible would have to be a marker from the pool.
    const visible = [...container.querySelectorAll('line')].filter(
      (l) => l.style.visibility === 'visible'
    );
    expect(visible).toHaveLength(0);
  });

  it('shows brake markers when only that setting is on', async () => {
    const view = seedReference();
    const brakeOnM = view.events.brakeOnM[0] ?? 0;

    const { container } = render(
      <LapTracePlot
        {...defaultProps}
        showThrottlePointMarkers={false}
        carDistanceMOverride={brakeOnM}
      />
    );

    await waitFor(() => {
      const visible = [...container.querySelectorAll('line')].filter(
        (l) => l.style.visibility === 'visible'
      );
      expect(visible.length).toBeGreaterThan(0);
    });
  });

  it('shows throttle markers when only that setting is on', async () => {
    const view = seedReference();
    // The markers draw the filtered list, not every application.
    const throttleOnM = view.throttlePointsM[0] ?? 0;

    const { container } = render(
      <LapTracePlot
        {...defaultProps}
        showBrakePointMarkers={false}
        carDistanceMOverride={throttleOnM}
      />
    );

    await waitFor(() => {
      const visible = [...container.querySelectorAll('line')].filter(
        (l) => l.style.visibility === 'visible'
      );
      expect(visible.length).toBeGreaterThan(0);
    });
  });

  it('labels the window extents relative to the car', () => {
    seedReference();
    const { getByText } = render(
      <LapTracePlot {...defaultProps} carDistanceMOverride={800} />
    );

    expect(getByText('-200m')).toBeTruthy();
    expect(getByText('+200m')).toBeTruthy();
  });

  it('pre-renders a fixed gear label pool so no node is created per frame', () => {
    seedReference();
    const { getByTestId } = render(
      <LapTracePlot {...defaultProps} carDistanceMOverride={800} />
    );

    const labels = getByTestId('gear-labels').querySelectorAll('span');
    expect(labels.length).toBe(MAX_GEAR_LABELS);
  });

  it('positions gear labels once the plot has been measured', async () => {
    seedReference();
    const { getByTestId } = render(
      <LapTracePlot {...defaultProps} carDistanceMOverride={340} />
    );

    // jsdom reports a zero client width and has no ResizeObserver, so labels
    // stay hidden — the guard against dividing by an unmeasured width.
    await waitFor(() => {
      const labels = [...getByTestId('gear-labels').querySelectorAll('span')];
      expect(labels.every((el) => el.style.visibility === 'hidden')).toBe(true);
    });
  });

  describe('opacity controls', () => {
    it('applies ghostOpacity to reference group stroke and fill, and driverOpacity to driver group', () => {
      seedReference();
      const { container } = render(
        <LapTracePlot
          {...defaultProps}
          ghostOpacity={0.6}
          driverOpacity={0.8}
          referenceFilled={true}
          carDistanceMOverride={800}
        />
      );

      const groups = container.querySelectorAll('svg > g');
      expect(groups.length).toBeGreaterThanOrEqual(2);

      const refGroup = groups[0];
      const driverGroup = groups[1];

      expect(refGroup.getAttribute('stroke-opacity')).toBe('0.6');
      expect(driverGroup.getAttribute('stroke-opacity')).toBe('0.8');

      const refThrottlePath = refGroup.querySelectorAll('path')[1];
      expect(refThrottlePath.getAttribute('fill-opacity')).toBe(
        String(0.35 * 0.6)
      );
    });
  });

  it('renders traces in the configured colours', () => {
    seedReference();
    const colors = {
      ...DEFAULT_LAP_TRACE_COLORS,
      referenceThrottle: '#123456',
      ghostBrake: '#abcdef',
    };
    const { container } = render(
      <LapTracePlot
        {...defaultProps}
        colors={colors}
        carDistanceMOverride={800}
      />
    );

    const strokes = [...container.querySelectorAll('path')].map((p) =>
      p.getAttribute('stroke')
    );
    expect(strokes).toContain('#123456');
    expect(strokes).toContain('#abcdef');
  });
});
