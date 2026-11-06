import { render, waitFor, cleanup } from '@testing-library/react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useLapTraceStore } from '@irdashies/context';
import {
  DEFAULT_LAP_TRACE_COLORS,
  type ChannelBridge,
  type LapTraceSampleSnapshot,
} from '@irdashies/types';
import { hydrateLapTrace } from '@irdashies/domain/lapTrace/hydrateLapTrace';
import { tileLayout } from '@irdashies/domain/lapTrace/lapTraceTiles';
import { LapTracePlot } from './LapTracePlot';
import { makeSyntheticLapTrace } from './fixtures/syntheticLap';
import { PLOT_BOTTOM, PLOT_TOP, VIEW_WIDTH, yForNorm } from './layout';

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

interface Point {
  x: number;
  y: number;
}

/** Pull the (x, y) pairs out of a path built as a run of M/L commands. */
const pointsOf = (d: string): Point[] =>
  [...d.matchAll(/[ML](-?[\d.]+) (-?[\d.]+)/g)].map((m) => ({
    x: Number(m[1]),
    y: Number(m[2]),
  }));

type Layer = 'reference' | 'ghost' | 'abs-area' | 'ghost-overlay' | 'markers';

interface Tile {
  svg: SVGSVGElement;
  /** The path's `d`, in the layer's own coordinates. */
  d: string;
  /** Where the layer's x = 0 sits in the window, in viewBox units. */
  offset: number;
  /** The layer's width in viewBox units. */
  width: number;
  /** Every point of the path, in window coordinates. */
  points: Point[];
  /** The points inside the layer's own box, which is all it shows. */
  shown: Point[];
}

/**
 * The elements of a layer on screen, each with one trace read back into
 * window coordinates. A reference span is translated by a percentage of its
 * own width, and its viewBox is that width in the same units as the
 * window's; the driver's layers are the window itself.
 */
const tilesOf = (container: HTMLElement, layer: Layer, trace: string): Tile[] =>
  [...container.querySelectorAll<SVGSVGElement>(`svg[data-layer="${layer}"]`)]
    .filter((svg) => svg.style.display !== 'none')
    .map((svg) => {
      const width = Number(svg.getAttribute('viewBox')?.split(' ')[2]);
      const pct = Number(
        /translateX\((-?[\d.]+)%\)/.exec(svg.style.transform)?.[1] ?? 0
      );
      const offset = (pct / 100) * width;
      const d =
        svg.querySelector(`path[data-trace="${trace}"]`)?.getAttribute('d') ??
        '';
      const local = pointsOf(d);
      return {
        svg,
        d,
        offset,
        width,
        points: local.map((p) => ({ x: p.x + offset, y: p.y })),
        shown: local
          .filter((p) => p.x >= 0 && p.x <= width)
          .map((p) => ({ x: p.x + offset, y: p.y })),
      };
    });

/** Everything a layer's trace shows on screen, left to right. */
const shownPoints = (
  container: HTMLElement,
  layer: Layer,
  trace: string
): Point[] =>
  tilesOf(container, layer, trace)
    .flatMap((t) => t.shown)
    .sort((a, b) => a.x - b.x);

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
  pushGhost(samples);
};

const pushGhost = (samples: GhostSample[]) => {
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

/** Samples every `step` metres from `fromM` to `untilM`, shaped by `at`. */
const everyMetres = (
  untilM: number,
  step: number,
  at: (d: number) => Omit<GhostSample, 'd'>,
  fromM = 0
): GhostSample[] => {
  const out: GhostSample[] = [];
  for (let d = fromM; d <= untilM; d += step) out.push({ d, ...at(d) });
  return out;
};

/** A bridge that delivers lap-trace.sample frames when told to. */
const sampleBridge = () => {
  let deliver: ((payload: LapTraceSampleSnapshot) => void) | undefined;
  let version = 0;
  window.channelBridge = {
    subscribe: (
      channel: string,
      callback: (payload: LapTraceSampleSnapshot) => void
    ) => {
      if (channel === 'lap-trace.sample') deliver = callback;
      return () => undefined;
    },
  } as unknown as ChannelBridge;
  return (lapDistPct: number) =>
    deliver?.({
      sessionTime: lapDistPct * 100,
      lapDistPct,
      throttle: 0,
      brake: 0,
      speed: 50,
      gear: 3,
      brakeAbsActive: false,
      onPitRoad: false,
      isOnTrack: true,
      sessionNum: 0,
      lastLapTime: 0,
      lapCompleted: 0,
      incidentCount: 0,
      simLapInvalidated: false,
      version: ++version,
    });
};

const nextFrames = (count: number) =>
  new Promise<void>((resolve) => {
    const step = (left: number) =>
      left === 0 ? resolve() : setTimeout(() => step(left - 1), 20);
    step(count);
  });

describe('LapTracePlot', () => {
  beforeEach(() => {
    useLapTraceStore.getState().reset();
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    Reflect.deleteProperty(window, 'channelBridge');
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
      const ys = shownPoints(container, 'ghost', 'speed').map((p) => p.y);
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

    const seedLapJustFinished = () =>
      seedCarryOver(
        everyMetres(200, 5, () => ({ throttle: 1, speed: 40 })).map((s) => ({
          ...s,
          d: TRACK_LENGTH_M - 200 + s.d,
        }))
      );

    it('runs the driver trace back over the line into the lap just finished', async () => {
      await seedJustAfterTheLine();
      seedLapJustFinished();

      const { container } = render(
        <LapTracePlot {...defaultProps} carDistanceMOverride={CAR_M} />
      );

      await waitFor(() => {
        const xs = shownPoints(container, 'ghost', 'throttle').map((p) => p.x);
        // Reaches the left edge of the window, which is the previous lap.
        expect(Math.min(...xs)).toBeLessThan(lineX - 1);
        // One subpath: the pen stays down across the seam, so the trace is
        // continuous rather than two strokes meeting at the line.
        const [ghost] = tilesOf(container, 'ghost', 'throttle');
        expect((ghost.d.match(/M/g) ?? []).length).toBe(1);
      });
    });

    it('stops at the line when no lap was carried over', async () => {
      await seedJustAfterTheLine();

      const { container } = render(
        <LapTracePlot {...defaultProps} carDistanceMOverride={CAR_M} />
      );

      await waitFor(() => {
        const xs = shownPoints(container, 'ghost', 'throttle').map((p) => p.x);
        expect(xs.length).toBeGreaterThan(0);
        // Nothing behind the line exists on the first lap of a session.
        expect(Math.min(...xs)).toBeGreaterThanOrEqual(lineX - 1);
      });
    });

    it('never draws the carried lap ahead of the car', async () => {
      await seedJustAfterTheLine();
      seedLapJustFinished();

      const { container } = render(
        <LapTracePlot {...defaultProps} carDistanceMOverride={CAR_M} />
      );

      await waitFor(() => {
        const xs = tilesOf(container, 'ghost', 'throttle').flatMap((t) =>
          t.points.map((p) => p.x)
        );
        expect(xs.length).toBeGreaterThan(0);
        // The reference may run ahead; what the driver has actually done
        // cannot, whichever lap the samples came from — not even in the part
        // of a tile its clip hides.
        expect(Math.max(...xs)).toBeLessThanOrEqual(carX + 0.1);
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
        expect(
          shownPoints(container, 'ghost-overlay', 'brake-abs').length
        ).toBeGreaterThan(0);
      });

      const brakeXs = shownPoints(container, 'ghost', 'brake').map((p) => p.x);
      const absXs = shownPoints(container, 'ghost-overlay', 'brake-abs').map(
        (p) => p.x
      );
      // The ABS overlay covers a strict subset of the brake run it sits on:
      // 750..800 m of a window that starts at 600 m.
      expect(absXs.length).toBeLessThan(brakeXs.length);
      expect(Math.min(...absXs)).toBeGreaterThan(Math.min(...brakeXs));
    });

    it('draws no ABS overlay when it is switched off', async () => {
      await seedAbsLap();
      const { container } = render(
        <LapTracePlot
          {...defaultProps}
          showAbs={false}
          carDistanceMOverride={800}
        />
      );
      await waitFor(() =>
        expect(shownPoints(container, 'ghost', 'brake').length).toBeGreaterThan(
          0
        )
      );
      expect(container.querySelector('path[data-trace="brake-abs"]')).toBe(
        null
      );
      expect(container.querySelector('path[data-trace="abs-area"]')).toBe(null);
    });

    it('adds a strip only when the ABS bar is switched on', async () => {
      await seedAbsLap();
      const without = render(
        <LapTracePlot {...defaultProps} carDistanceMOverride={800} />
      );
      expect(
        without.container.querySelector('path[data-trace="abs-bar"]')
      ).toBe(null);
      cleanup();

      const withBar = render(
        <LapTracePlot {...defaultProps} showAbsBar carDistanceMOverride={800} />
      );
      await waitFor(() => {
        const drawn = tilesOf(
          withBar.container,
          'ghost-overlay',
          'abs-bar'
        ).filter((t) => t.d !== '');
        // One run, drawn as its two ends.
        expect(drawn).toHaveLength(1);
        expect(drawn[0].points).toHaveLength(2);
        expect(drawn[0].svg.querySelector('path[data-trace="abs-bar"]')).toBe(
          drawn[0].svg.querySelector('[stroke-width="4"]')
        );
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
      expect(
        overlay.container.querySelector('path[data-trace="abs-area"]')
      ).toBe(null);
      cleanup();

      const bar = render(
        <LapTracePlot
          {...defaultProps}
          showAbs
          absStyle="bar"
          carDistanceMOverride={800}
        />
      );

      await waitFor(() => {
        const filled = tilesOf(bar.container, 'abs-area', 'abs-area').filter(
          (t) => t.d.includes('Z')
        );
        expect(filled.length).toBeGreaterThan(0);
        // The layer is blended rather than the path, so the fill mixes with
        // the reference spans beneath it and not just its own layer.
        for (const tile of filled) {
          expect(tile.svg.style.mixBlendMode).toBe('screen');
        }
      });
    });

    it('blends the ABS fill only while there is ABS in the window', async () => {
      await seedAbsLap();
      // 2 km on, well clear of the stretch where ABS engaged.
      const { container } = render(
        <LapTracePlot
          {...defaultProps}
          showAbs
          absStyle="bar"
          carDistanceMOverride={2000}
        />
      );

      await waitFor(() => {
        expect(shownPoints(container, 'ghost', 'brake').length).toBeGreaterThan(
          0
        );
      });
      const tiles = tilesOf(container, 'abs-area', 'abs-area');
      expect(tiles.length).toBeGreaterThan(0);
      for (const tile of tiles) {
        expect(tile.d).toBe('');
        expect(tile.svg.style.mixBlendMode).toBe('');
      }
    });
  });

  it('draws the reference traces across the window', async () => {
    seedReference();
    const { container } = render(
      <LapTracePlot {...defaultProps} carDistanceMOverride={800} />
    );

    await waitFor(() => {
      expect(
        tilesOf(container, 'reference', 'throttle').length
      ).toBeGreaterThan(0);
    });

    for (const trace of ['throttle', 'brake', 'speed']) {
      const tiles = tilesOf(container, 'reference', trace);
      const xs = tiles.flatMap((t) => t.points.map((p) => p.x));
      expect(xs.length).toBeGreaterThan(50);
      expect(Math.min(...xs)).toBeLessThanOrEqual(0);
      expect(Math.max(...xs)).toBeGreaterThanOrEqual(VIEW_WIDTH);
    }
  });

  it('keeps x monotonic when the window straddles start/finish', async () => {
    seedReference();
    const { container } = render(
      <LapTracePlot
        {...defaultProps}
        carDistanceMOverride={TRACK_LENGTH_M - 20}
      />
    );

    // One span on screen, whatever the window straddles.
    await waitFor(() => {
      expect(tilesOf(container, 'reference', 'throttle')).toHaveLength(1);
    });

    const [span] = tilesOf(container, 'reference', 'throttle');
    expect(span.offset).toBeLessThanOrEqual(0);
    expect(span.offset + span.width).toBeGreaterThanOrEqual(VIEW_WIDTH);
    const xs = span.points.map((p) => p.x);
    expect(xs.length).toBeGreaterThan(50);
    for (let i = 1; i < xs.length; i++) {
      expect(xs[i]).toBeGreaterThanOrEqual(xs[i - 1]);
    }
    // One continuous run through the line — no pen lift at the seam.
    expect((span.d.match(/M/g) ?? []).length).toBe(1);
  });

  it('draws the same trace after moving onto the next span', async () => {
    seedReference();
    const layout = tileLayout(TRACK_LENGTH_M, 200, 200);
    if (!layout) throw new Error('no layout');
    // Either side of the moment the window's left edge crosses into the next
    // tile, which is when the plot swaps the span it shows. The start/finish
    // tile, so the new span also has to bin the line the same way.
    const boundaryCar = layout.tileM * layout.tileCount + 200;
    const at = async (car: number) => {
      const { container } = render(
        <LapTracePlot {...defaultProps} carDistanceMOverride={car} />
      );
      await waitFor(() =>
        expect(tilesOf(container, 'reference', 'throttle')).toHaveLength(1)
      );
      const [span] = tilesOf(container, 'reference', 'throttle');
      cleanup();
      return span;
    };
    const before = await at(boundaryCar - 0.4 - TRACK_LENGTH_M);
    const after = await at(boundaryCar + 0.4 - TRACK_LENGTH_M);
    expect(after.offset).not.toBeCloseTo(before.offset, 0);

    // The same stretch of track, seen 0.8 m apart: every point moves left by
    // the same 2 units and nothing else changes.
    const shift = (0.8 / 400) * VIEW_WIDTH;
    const key = (p: Point, dx: number) =>
      `${(p.x + dx).toFixed(0)},${p.y.toFixed(1)}`;
    const inView = (p: Point) => p.x > 10 && p.x < VIEW_WIDTH - 10;
    expect(after.shown.filter(inView).map((p) => key(p, shift))).toEqual(
      before.shown
        .filter((p) => inView({ x: p.x - shift, y: p.y }))
        .map((p) => key(p, 0))
    );
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
      expect(
        shownPoints(container, 'ghost', 'throttle').length
      ).toBeGreaterThan(0);
    });

    const ghostXs = ['throttle', 'brake', 'speed'].flatMap((trace) =>
      tilesOf(container, 'ghost', trace).flatMap((t) =>
        t.points.map((p) => p.x)
      )
    );
    expect(ghostXs.length).toBeGreaterThan(0);
    for (const x of ghostXs) {
      // VIEW_WIDTH/2 is the car's x for this file's symmetric
      // metersBehind/metersAhead=200/200 defaultProps; +0.1 tolerates the
      // toFixed rounding of the point and of the tile's offset.
      expect(x).toBeLessThanOrEqual(VIEW_WIDTH / 2 + 0.1);
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
      expect(shownPoints(container, 'ghost', 'brake').length).toBeGreaterThan(
        0
      );
    });

    const baseline = yForNorm(0);
    const throttleOffX = shownPoints(container, 'ghost', 'throttle').find(
      (p) => Math.abs(p.y - baseline) < 0.2
    )?.x;
    const brakeOnX = shownPoints(container, 'ghost', 'brake').find(
      (p) => p.y < baseline - 1
    )?.x;
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

    const top = yForNorm(1);
    await waitFor(() => {
      expect(
        shownPoints(container, 'ghost', 'brake').some(
          (p) => Math.abs(p.y - top) < 0.2
        )
      ).toBe(true);
    });
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
        showBrakePointMarkers={false}
        showThrottlePointMarkers={false}
        carDistanceMOverride={800}
      />
    );

    await waitFor(() => {
      const drawn = [...container.querySelectorAll('path')].filter(
        (p) => (p.getAttribute('d') ?? '').length > 0
      );
      expect(drawn.length).toBeGreaterThan(0);
      for (const path of drawn) {
        expect(path.getAttribute('data-trace')).toBe('throttle');
        expect(path.closest('svg')?.getAttribute('data-layer')).toBe(
          'reference'
        );
      }
    });
  });

  /** x of every marker line on screen, in window coordinates. */
  const markerXs = (container: HTMLElement, trace: string) =>
    tilesOf(container, 'markers', trace).flatMap((t) =>
      [...t.d.matchAll(/M(-?[\d.]+) /g)]
        .map((m) => Number(m[1]))
        .filter((x) => x >= 0 && x <= t.width)
        .map((x) => x + t.offset)
    );

  it('places brake application markers at their sub-metre position', async () => {
    const view = seedReference();
    const brakeOnM = view.events.brakeOnM;
    expect(brakeOnM.length).toBeGreaterThan(0);

    // Centre the window on the first braking point so it must be visible.
    const { container } = render(
      <LapTracePlot {...defaultProps} carDistanceMOverride={brakeOnM[0]} />
    );

    // The marker for the point under the car sits on the car line at x=500.
    await waitFor(() => {
      expect(
        markerXs(container, 'brake-markers').some(
          (x) => Math.abs(x - VIEW_WIDTH / 2) < 1
        )
      ).toBe(true);
    });
  });

  it('draws markers as a dotted line through the full height of the plot', async () => {
    const view = seedReference();
    const { container } = render(
      <LapTracePlot
        {...defaultProps}
        carDistanceMOverride={view.events.brakeOnM[0] ?? 0}
      />
    );

    await waitFor(() => {
      expect(markerXs(container, 'brake-markers').length).toBeGreaterThan(0);
    });

    for (const tile of tilesOf(container, 'markers', 'brake-markers')) {
      // One subpath per marker, so the dash pattern starts afresh at the top
      // of each line rather than carrying on from the one before.
      for (const line of tile.d.match(/M[^M]+/g) ?? []) {
        expect(line).toMatch(
          new RegExp(`^M-?[\\d.]+ ${PLOT_TOP}V${PLOT_BOTTOM}$`)
        );
      }
      const path = tile.svg.querySelector('path[data-trace="brake-markers"]');
      expect(path?.getAttribute('stroke-dasharray')).toBeTruthy();
    }
  });

  it('hides markers entirely when both settings are off', async () => {
    const view = seedReference();
    const { container } = render(
      <LapTracePlot
        {...defaultProps}
        showBrakePointMarkers={false}
        showThrottlePointMarkers={false}
        carDistanceMOverride={view.events.brakeOnM[0] ?? 0}
      />
    );

    await waitFor(() => {
      expect(
        tilesOf(container, 'reference', 'throttle').length
      ).toBeGreaterThan(0);
    });
    expect(container.querySelector('svg[data-layer="markers"]')).toBe(null);
  });

  it('shows brake markers when only that setting is on', async () => {
    const view = seedReference();
    const { container } = render(
      <LapTracePlot
        {...defaultProps}
        showThrottlePointMarkers={false}
        carDistanceMOverride={view.events.brakeOnM[0] ?? 0}
      />
    );

    await waitFor(() => {
      expect(markerXs(container, 'brake-markers').length).toBeGreaterThan(0);
    });
    expect(container.querySelector('path[data-trace="throttle-markers"]')).toBe(
      null
    );
  });

  it('shows throttle markers when only that setting is on', async () => {
    const view = seedReference();
    // The markers draw the filtered list, not every application.
    const { container } = render(
      <LapTracePlot
        {...defaultProps}
        showBrakePointMarkers={false}
        carDistanceMOverride={view.throttlePointsM[0] ?? 0}
      />
    );

    await waitFor(() => {
      expect(markerXs(container, 'throttle-markers').length).toBeGreaterThan(0);
    });
    expect(container.querySelector('path[data-trace="brake-markers"]')).toBe(
      null
    );
  });

  it('labels the window extents relative to the car', () => {
    seedReference();
    const { getByText } = render(
      <LapTracePlot {...defaultProps} carDistanceMOverride={800} />
    );

    expect(getByText('-200m')).toBeTruthy();
    expect(getByText('+200m')).toBeTruthy();
  });

  it('labels each gear change once, without measuring the plot', async () => {
    const view = seedReference();
    const { getByTestId } = render(
      <LapTracePlot {...defaultProps} carDistanceMOverride={340} />
    );

    const shownTiles = () =>
      [
        ...getByTestId('gear-labels').querySelectorAll<HTMLDivElement>(
          ':scope > div'
        ),
      ].filter((el) => el.style.display !== 'none');
    await waitFor(() => {
      expect(shownTiles().length).toBeGreaterThan(0);
      expect(
        shownTiles().some((el) => el.querySelectorAll('span').length > 0)
      ).toBe(true);
    });

    // Every change in the span on screen is labelled, once.
    const layout = tileLayout(TRACK_LENGTH_M, 200, 200);
    if (!layout) throw new Error('no layout');
    expect(shownTiles()).toHaveLength(1);
    const start = Math.floor((340 - 200) / layout.tileM) * layout.tileM;
    const inSpan = [...view.gearChangeM].filter(
      (m) => m >= start && m < start + layout.spanM
    );
    expect(shownTiles()[0].querySelectorAll('span')).toHaveLength(
      inSpan.length
    );
  });

  describe('spans', () => {
    const referenceTransforms = (container: HTMLElement) =>
      tilesOf(container, 'reference', 'throttle').map(
        (t) => t.svg.style.transform
      );
    const traceDs = (container: HTMLElement, layer: Layer) =>
      tilesOf(container, layer, 'throttle').map((t) => t.d);

    it('slides the reference as the car moves, and redraws only the driver', async () => {
      await useLapTraceStore
        .getState()
        .initialize(undefined, 1, '', 'car', TRACK_LENGTH_M);
      seedReference();
      pushGhost(everyMetres(1000, 1, () => ({ throttle: 1 })));
      const moveTo = sampleBridge();
      const { container } = render(<LapTracePlot {...defaultProps} />);
      moveTo(1000 / TRACK_LENGTH_M);
      await waitFor(() =>
        expect(traceDs(container, 'ghost').some((d) => d !== '')).toBe(true)
      );
      const transforms = referenceTransforms(container);
      const reference = traceDs(container, 'reference');
      const ghost = traceDs(container, 'ghost');

      // 5 m on, still inside the same span.
      pushGhost(everyMetres(1005, 1, () => ({ throttle: 0.5 }), 1001));
      moveTo(1005 / TRACK_LENGTH_M);
      await waitFor(() =>
        expect(referenceTransforms(container)).not.toEqual(transforms)
      );
      expect(traceDs(container, 'reference')).toEqual(reference);
      expect(traceDs(container, 'ghost')).not.toEqual(ghost);
    });

    it('builds the next span ahead of the car', async () => {
      seedReference();
      const { container } = render(
        <LapTracePlot {...defaultProps} carDistanceMOverride={800} />
      );
      const all = () =>
        [
          ...container.querySelectorAll<SVGSVGElement>(
            'svg[data-layer="reference"]'
          ),
        ].map(
          (svg) =>
            svg
              .querySelector('path[data-trace="throttle"]')
              ?.getAttribute('d') ?? ''
        );
      // The span on screen and, a frame later, the one after it.
      await waitFor(() => expect(all().every((d) => d !== '')).toBe(true));
      expect(tilesOf(container, 'reference', 'throttle')).toHaveLength(1);
    });
  });

  describe('frame scheduling', () => {
    const referenceThrottle = (container: HTMLElement) =>
      tilesOf(container, 'reference', 'throttle')
        .map((t) => t.d)
        .find((d) => d.length > 0) ?? '';

    it('asks for no frames while nothing changes', async () => {
      seedReference();
      const moveTo = sampleBridge();
      const { container } = render(<LapTracePlot {...defaultProps} />);
      moveTo(0.2);
      await waitFor(() => expect(referenceThrottle(container)).not.toBe(''));

      const raf = vi.spyOn(window, 'requestAnimationFrame');
      await nextFrames(10);

      expect(raf).not.toHaveBeenCalled();
    });

    it('draws a reference that arrives with no telemetry', async () => {
      useLapTraceStore.setState({ trackLengthM: TRACK_LENGTH_M });
      const { container } = render(
        <LapTracePlot {...defaultProps} carDistanceMOverride={800} />
      );
      await nextFrames(3);
      expect(referenceThrottle(container)).toBe('');

      seedReference();

      await waitFor(() => expect(referenceThrottle(container)).not.toBe(''));
    });

    it('writes no gear label as the car moves past them', async () => {
      seedReference();
      const moveTo = sampleBridge();
      const { getByTestId } = render(<LapTracePlot {...defaultProps} />);
      // 340 m into the synthetic lap, where the window holds gear changes.
      moveTo(340 / TRACK_LENGTH_M);
      const container = getByTestId('gear-labels');
      const tiles = () =>
        [...container.querySelectorAll<HTMLDivElement>(':scope > div')].filter(
          (el) => el.style.display !== 'none'
        );
      await waitFor(() =>
        expect(
          [...container.querySelectorAll(':scope > div')].every(
            (el) => el.querySelectorAll('span').length > 0
          )
        ).toBe(true)
      );
      const before = tiles().map((el) => el.style.transform);

      const mutations: MutationRecord[] = [];
      const observer = new MutationObserver((records) =>
        mutations.push(...records)
      );
      observer.observe(tiles()[0], {
        subtree: true,
        childList: true,
        characterData: true,
      });
      // A metre on: the labels move with their tile, and nothing is written
      // to them.
      moveTo(341 / TRACK_LENGTH_M);
      await waitFor(() =>
        expect(tiles().map((el) => el.style.transform)).not.toEqual(before)
      );
      observer.disconnect();

      expect(mutations).toEqual([]);
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

      const refGroup = container.querySelector(
        'svg[data-layer="reference"] > g'
      );
      const driverGroup = container.querySelector(
        'svg[data-layer="ghost"] > g'
      );

      expect(refGroup?.getAttribute('stroke-opacity')).toBe('0.6');
      expect(driverGroup?.getAttribute('stroke-opacity')).toBe('0.8');

      const refThrottlePath = refGroup?.querySelector(
        'path[data-trace="throttle"]'
      );
      expect(refThrottlePath?.getAttribute('fill-opacity')).toBe(
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
