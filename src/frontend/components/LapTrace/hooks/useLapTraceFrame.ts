import { useEffect, useRef, type RefObject } from 'react';
import type { LapTraceSamples } from '@irdashies/types';
import { getChannelSnapshotStore, useLapTraceStore } from '@irdashies/context';
import {
  MAX_SAMPLE_GAP_M,
  indexAtOrBefore,
  normalisePct,
} from '../../../domain/lapTrace/lapSamples';
import {
  createWindowPieces,
  windowPieces,
  xForMetres,
} from '../../../domain/lapTrace/lapTraceWindow';
import { ABS_BAR_Y, GEAR_LABELS, MAX_GEAR_LABELS, yForNorm } from '../layout';

/** The ghost traces, named so a piece can pull the field off its own buffer. */
type GhostChannel = 'throttle' | 'brake' | 'speed';

/**
 * One contiguous run of the ghost. `offsetM` unwraps a lap-local distance into
 * the window the same way WindowPiece does for the reference: 0 for this lap,
 * -trackLengthM for the tail of the lap before it.
 */
interface GhostPiece {
  samples: LapTraceSamples;
  fromM: number;
  toM: number;
  offsetM: number;
}

/** Placeholder for an unused piece slot; never drawn, since length is 0. */
const EMPTY_SAMPLES: LapTraceSamples = {
  length: 0,
  distanceM: new Float32Array(0),
  timeSec: new Float32Array(0),
  throttle: new Float32Array(0),
  brake: new Float32Array(0),
  speed: new Float32Array(0),
  gear: new Float32Array(0),
  absActive: new Float32Array(0),
};

export interface LapTraceFrameRefs {
  refThrottle: RefObject<SVGPathElement | null>;
  refBrake: RefObject<SVGPathElement | null>;
  refSpeed: RefObject<SVGPathElement | null>;
  ghostThrottle: RefObject<SVGPathElement | null>;
  ghostBrake: RefObject<SVGPathElement | null>;
  ghostSpeed: RefObject<SVGPathElement | null>;
  ghostBrakeAbs: RefObject<SVGPathElement | null>;
  ghostAbsArea: RefObject<SVGPathElement | null>;
  absBar: RefObject<SVGPathElement | null>;
  gearLabels: RefObject<(HTMLSpanElement | null)[]>;
  plotContainer: RefObject<HTMLDivElement | null>;
  markerRefBrakeOn: RefObject<(SVGLineElement | null)[]>;
  markerRefThrottleOn: RefObject<(SVGLineElement | null)[]>;
}

export interface LapTraceFrameOptions {
  /** Metres of track visible behind the car. */
  metersBehind: number;
  /** Metres of track visible ahead of the car. */
  metersAhead: number;
  showThrottle: boolean;
  showBrake: boolean;
  showSpeed: boolean;
  showGhost: boolean;
  showGearLabels: boolean;
  /** Dotted line at the reference's (and, while driving, your own) brake application/release points. */
  showBrakePointMarkers: boolean;
  /** Dotted line at the reference's throttle application point. */
  showThrottlePointMarkers: boolean;
  /** Highlight the driver's brake trace where ABS engaged. */
  showAbs: boolean;
  /** 'bar' also fills the brake curve down to the axis where ABS engaged. */
  absStyle: 'overlay' | 'bar';
  /** Also mark ABS activity as a strip beneath the traces. */
  showAbsBar: boolean;
  /** Fill the reference throttle/brake traces as bars down to the axis. */
  referenceFilled: boolean;
  /**
   * Pin the car to a fixed track distance instead of following telemetry.
   * Used by stories to render a specific point on track deterministically.
   */
  carDistanceMOverride?: number;
}

/**
 * Decimation bins across the window. Each bin emits at most its first, lowest,
 * highest and last sample, so a path never exceeds ~4 × this many points
 * however dense the telemetry, while a one-sample brake stab still shows.
 */
const PATH_BINS = 250;

/**
 * Skip rebuilding the paths when the car has moved less than this and nothing
 * else changed. Position arrives at telemetry rate; the frame loop runs at the
 * display's, so most frames have nothing new to draw.
 */
const REBUILD_MIN_MOVE_M = 0.25;

/**
 * Accumulates one SVG path across any number of sample runs and window
 * pieces. Points are collected as parts and joined once, so a path of a
 * thousand points does not cost a thousand string concatenations.
 *
 * `closeToBaseline` closes each contiguous run down to the axis (normalised
 * 0) and back, producing a filled bar/area instead of an open line. Each run
 * is closed separately so a gap cannot bridge two segments into one fill.
 */
class PathBuilder {
  private readonly parts: string[] = [];
  private pen = false;
  private segStartX = 0;
  private lastX = 0;
  private closeToBaseline = false;

  begin(closeToBaseline: boolean): void {
    this.parts.length = 0;
    this.pen = false;
    this.closeToBaseline = closeToBaseline;
  }

  point(x: number, y: number): void {
    if (!this.pen) this.segStartX = x;
    this.parts.push(`${this.pen ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`);
    this.pen = true;
    this.lastX = x;
  }

  /** Lift the pen: the next point starts a new run. */
  break(): void {
    if (this.closeToBaseline && this.pen) {
      const baseY = yForNorm(0).toFixed(1);
      this.parts.push(
        `L${this.lastX.toFixed(1)} ${baseY}L${this.segStartX.toFixed(1)} ${baseY}Z`
      );
    }
    this.pen = false;
  }

  end(): string {
    this.break();
    return this.parts.join('');
  }
}

interface WindowGeometry {
  carDistanceM: number;
  metersBehind: number;
  metersAhead: number;
  /** Metres per decimation bin. */
  binM: number;
}

/**
 * Append the samples inside [fromM, toM] (lap-local metres, plus `offsetM`
 * to place them in the window) to `path`, decimated per bin.
 *
 * Within each bin the first, lowest, highest and last samples are emitted at
 * their own x in sample order, which is what keeps a throttle lift drawn
 * before the brake application that followed it: every emitted point sits
 * where the sim measured it.
 *
 * Values are normalised as `(value - min) / range` so pedals (0..1) and speed
 * (m/s against the lap's own range) share one code path.
 *
 * `gate` is an optional second mask: a sample only draws where it is above
 * zero, so the same channel can be redrawn as a highlight over part of its
 * own run (ABS over the brake trace) without a filtered copy. The pen lifts
 * at a gate-off sample and at a gap wider than MAX_SAMPLE_GAP_M.
 *
 * `includeBeyondEnd` emits the first sample past `toM` too, so a line runs
 * off the edge of the plot rather than stopping just short of it. The ghost
 * must never do this: nothing may be drawn ahead of the car.
 */
function appendSamples(
  path: PathBuilder,
  samples: LapTraceSamples,
  fromM: number,
  toM: number,
  offsetM: number,
  values: Float32Array,
  min: number,
  range: number,
  gate: Float32Array | null,
  includeBeyondEnd: boolean,
  geometry: WindowGeometry
): void {
  const n = samples.length;
  if (n === 0 || !(toM >= fromM)) {
    path.break();
    return;
  }
  const { distanceM } = samples;
  const { carDistanceM, metersBehind, metersAhead, binM } = geometry;

  const emit = (i: number) => {
    path.point(
      xForMetres(
        distanceM[i] + offsetM,
        carDistanceM,
        metersBehind,
        metersAhead
      ),
      yForNorm((values[i] - min) / range)
    );
  };

  let binIndex = Number.NaN;
  let binFirst = -1;
  let binLast = -1;
  let binMin = -1;
  let binMax = -1;

  const flushBin = () => {
    if (binFirst < 0) return;
    emit(binFirst);
    if (binLast !== binFirst) {
      const a = Math.min(binMin, binMax);
      const b = Math.max(binMin, binMax);
      if (a !== binFirst && a !== binLast) emit(a);
      if (b !== binFirst && b !== binLast && b !== a) emit(b);
      emit(binLast);
    }
    binFirst = -1;
  };

  // Start one sample before the window so the line enters from its edge.
  let i = indexAtOrBefore(samples, fromM);
  if (i < 0) i = 0;

  for (; i < n; i++) {
    const d = distanceM[i];
    if (d > toM) {
      if (includeBeyondEnd && !(gate !== null && !(gate[i] > 0))) {
        flushBin();
        emit(i);
      }
      break;
    }
    if (gate !== null && !(gate[i] > 0)) {
      flushBin();
      path.break();
      binIndex = Number.NaN;
      continue;
    }
    if (binFirst >= 0 && d - distanceM[i - 1] > MAX_SAMPLE_GAP_M) {
      flushBin();
      path.break();
      binIndex = Number.NaN;
    }

    const bin = Math.floor((d - fromM) / binM);
    if (bin !== binIndex) {
      flushBin();
      binIndex = bin;
      binFirst = i;
      binMin = i;
      binMax = i;
    } else {
      if (values[i] < values[binMin]) binMin = i;
      if (values[i] > values[binMax]) binMax = i;
    }
    binLast = i;
  }
  flushBin();
}

/**
 * Flat runs at a fixed height wherever `gate` is set — the ABS strip. Only
 * where it happened matters, not how hard, so each run is just its two ends.
 */
function appendGateBar(
  path: PathBuilder,
  samples: LapTraceSamples,
  fromM: number,
  toM: number,
  offsetM: number,
  gate: Float32Array,
  y: number,
  geometry: WindowGeometry
): void {
  const n = samples.length;
  if (n === 0) return;
  const { distanceM } = samples;
  const { carDistanceM, metersBehind, metersAhead } = geometry;
  const xAt = (i: number) =>
    xForMetres(distanceM[i] + offsetM, carDistanceM, metersBehind, metersAhead);

  let runStart = -1;
  let runEnd = -1;
  const closeRun = () => {
    if (runStart < 0) return;
    path.point(xAt(runStart), y);
    path.point(xAt(runEnd), y);
    path.break();
    runStart = -1;
  };

  let i = indexAtOrBefore(samples, fromM);
  if (i < 0) i = 0;
  for (; i < n && distanceM[i] <= toM; i++) {
    if (!(gate[i] > 0)) {
      closeRun();
      continue;
    }
    if (runStart < 0) runStart = i;
    runEnd = i;
  }
  closeRun();
}

function setPath(ref: RefObject<SVGPathElement | null>, d: string): void {
  const el = ref.current;
  if (el) el.setAttribute('d', d);
}

function hideFrom(pool: (SVGLineElement | null)[], from: number): void {
  for (let i = from; i < pool.length; i++) {
    const el = pool[i];
    if (el) el.style.visibility = 'hidden';
  }
}

/**
 * Position the vertical markers for one kind of pedal application point.
 *
 * Positions are absolute metres along the lap, so each is tested at -1/0/+1 lap
 * offsets to catch the case where the window straddles start/finish. The pool
 * is fixed size and reused — no node is created per frame.
 */
function placeMarkers(
  pool: (SVGLineElement | null)[] | null,
  positions: Float32Array | undefined,
  count: number,
  carDistanceM: number,
  metersBehind: number,
  metersAhead: number,
  trackLengthM: number,
  /** Overrides the ahead-side cutoff; defaults to the full window. */
  maxDistanceM: number = carDistanceM + metersAhead
): void {
  if (!pool) return;
  if (!positions || count <= 0 || trackLengthM <= 0) {
    hideFrom(pool, 0);
    return;
  }

  const min = carDistanceM - metersBehind;
  const max = maxDistanceM;
  let shown = 0;

  for (let i = 0; i < count && shown < pool.length; i++) {
    for (let k = -1; k <= 1 && shown < pool.length; k++) {
      const metres = positions[i] + k * trackLengthM;
      if (metres < min || metres > max) continue;
      const el = pool[shown];
      if (!el) continue;
      const x = xForMetres(
        metres,
        carDistanceM,
        metersBehind,
        metersAhead
      ).toFixed(1);
      el.setAttribute('x1', x);
      el.setAttribute('x2', x);
      el.style.visibility = 'visible';
      shown++;
    }
  }

  hideFrom(pool, shown);
}

/**
 * Drives the lap trace plot.
 *
 * Telemetry is read through a direct store subscription rather than a hook
 * (R2.3) and drawing happens in a self-scheduling rAF loop, so the React
 * component renders only when its settings change — never per frame. The paths
 * are updated by setAttribute on persistent DOM nodes, the same technique the
 * existing Input Trace widget uses.
 *
 * Both laps are drawn straight from their samples, across window pieces so
 * they run continuously through start/finish. The reference spans the whole
 * window; the ghost stops at the car and never goes past it, and reaches back
 * over the line only as far as the carry-over the recorder kept of the lap
 * just finished.
 */
export const useLapTraceFrame = (
  refs: LapTraceFrameRefs,
  options: LapTraceFrameOptions
) => {
  const {
    metersBehind,
    metersAhead,
    showThrottle,
    showBrake,
    showSpeed,
    showGhost,
    showGearLabels,
    showBrakePointMarkers,
    showThrottlePointMarkers,
    showAbs,
    absStyle,
    showAbsBar,
    referenceFilled,
    carDistanceMOverride,
  } = options;

  const lapDistPctRef = useRef(0);
  const plotWidthRef = useRef(0);

  // Track the rendered pixel width so gear labels can be positioned with a
  // composited transform rather than a layout-triggering `left`.
  useEffect(() => {
    const el = refs.plotContainer.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    plotWidthRef.current = el.clientWidth;
    const observer = new ResizeObserver(() => {
      plotWidthRef.current = el.clientWidth;
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [refs.plotContainer]);

  useEffect(() => {
    if (carDistanceMOverride !== undefined) return;
    // The same co-sampled channel the recorder uses, so the car line and the
    // newest ghost sample agree on where the car is.
    const store = getChannelSnapshotStore(
      'lap-trace.sample',
      window.channelBridge
    );
    const selection = store.createSelection((s) => s.lapDistPct, Object.is, 60);
    return selection.subscribe(() => {
      const value = selection.getSnapshot();
      if (typeof value === 'number' && value >= 0) {
        lapDistPctRef.current = value;
      }
    });
  }, [carDistanceMOverride]);

  useEffect(() => {
    let raf = 0;
    const path = new PathBuilder();
    const pieces = createWindowPieces();
    // Reused every frame so the loop never allocates, mirroring `pieces`.
    const ghostPieces: GhostPiece[] = [
      { samples: EMPTY_SAMPLES, fromM: 0, toM: 0, offsetM: 0 },
      { samples: EMPTY_SAMPLES, fromM: 0, toM: 0, offsetM: 0 },
    ];
    const geometry: WindowGeometry = {
      carDistanceM: 0,
      metersBehind,
      metersAhead,
      binM: (metersBehind + metersAhead) / PATH_BINS || 1,
    };

    // What the last rebuild drew, so a frame with nothing new is skipped.
    let lastCarDistanceM = Number.NaN;
    let lastReference: unknown = undefined;
    let lastSampleCount = -1;
    let lastLapSerial = -1;

    const buildReference = (
      ref: RefObject<SVGPathElement | null>,
      show: boolean,
      samples: LapTraceSamples,
      values: Float32Array,
      min: number,
      range: number,
      filled: boolean,
      carDistanceM: number,
      trackLengthM: number
    ) => {
      if (!show) {
        setPath(ref, '');
        return;
      }
      path.begin(filled);
      const count = windowPieces(
        carDistanceM,
        metersBehind,
        metersAhead,
        trackLengthM,
        pieces
      );
      // The pen stays down between pieces: a lap's last sample and its first
      // are a sample apart, so the trace runs straight through the line.
      for (let p = 0; p < count; p++) {
        const piece = pieces[p];
        appendSamples(
          path,
          samples,
          piece.fromM,
          piece.toM,
          piece.offsetM,
          values,
          min,
          range,
          null,
          true,
          geometry
        );
      }
      setPath(ref, path.end());
    };

    /**
     * The ghost across its pieces: the tail of the lap just finished (mapped
     * back over the line by its offset) and then this lap up to the car. The
     * pen stays down between them, so the trace runs through start/finish the
     * way the reference does. One piece before the first crossing of a
     * session, when there is no carry-over yet.
     */
    const buildGhost = (
      ref: RefObject<SVGPathElement | null>,
      show: boolean,
      pieceCount: number,
      channel: GhostChannel,
      min: number,
      range: number,
      filled: boolean,
      gated: boolean
    ) => {
      if (!show) {
        setPath(ref, '');
        return;
      }
      path.begin(filled);
      for (let p = 0; p < pieceCount; p++) {
        const piece = ghostPieces[p];
        appendSamples(
          path,
          piece.samples,
          piece.fromM,
          piece.toM,
          piece.offsetM,
          piece.samples[channel],
          min,
          range,
          gated ? piece.samples.absActive : null,
          false,
          geometry
        );
      }
      setPath(ref, path.end());
    };

    const draw = () => {
      raf = requestAnimationFrame(draw);

      // Read fresh every frame: the active lap's buffer is reset in place at
      // each lap boundary, so holding a reference across frames risks drawing
      // from a buffer that has since been rewound.
      const state = useLapTraceStore.getState();
      const { trackLengthM, referenceLap, activeLap } = state;

      const labels = refs.gearLabels.current;
      let labelsShown = 0;

      if (!(trackLengthM > 0)) {
        setPath(refs.refThrottle, '');
        setPath(refs.refBrake, '');
        setPath(refs.refSpeed, '');
        setPath(refs.ghostThrottle, '');
        setPath(refs.ghostBrake, '');
        setPath(refs.ghostSpeed, '');
        setPath(refs.ghostBrakeAbs, '');
        setPath(refs.ghostAbsArea, '');
        setPath(refs.absBar, '');
        placeMarkers(refs.markerRefBrakeOn.current, undefined, 0, 0, 0, 0, 0);
        placeMarkers(
          refs.markerRefThrottleOn.current,
          undefined,
          0,
          0,
          0,
          0,
          0
        );
        lastCarDistanceM = Number.NaN;
      } else {
        const carDistanceM =
          carDistanceMOverride ??
          normalisePct(lapDistPctRef.current) * trackLengthM;
        const sampleCount = activeLap?.samples.length ?? -1;
        const lapSerial = activeLap?.lapSerial ?? -1;

        if (
          Math.abs(carDistanceM - lastCarDistanceM) < REBUILD_MIN_MOVE_M &&
          referenceLap === lastReference &&
          sampleCount === lastSampleCount &&
          lapSerial === lastLapSerial
        ) {
          return;
        }
        lastCarDistanceM = carDistanceM;
        lastReference = referenceLap;
        lastSampleCount = sampleCount;
        lastLapSerial = lapSerial;
        geometry.carDistanceM = carDistanceM;

        // Both laps share one speed scale so they are directly comparable.
        // Prefer the reference's range — it is fixed, so the plot does not
        // rescale under the driver mid-corner. Before a reference exists, fall
        // back to the running range of the lap in progress.
        let speedMin = referenceLap?.speedMinMs ?? activeLap?.speedMinMs ?? 0;
        let speedMax = referenceLap?.speedMaxMs ?? activeLap?.speedMaxMs ?? 0;
        if (!Number.isFinite(speedMin) || !Number.isFinite(speedMax)) {
          speedMin = 0;
          speedMax = 0;
        }
        const speedRange = speedMax - speedMin > 1 ? speedMax - speedMin : 1;

        if (referenceLap) {
          const s = referenceLap.samples;
          buildReference(
            refs.refThrottle,
            showThrottle,
            s,
            s.throttle,
            0,
            1,
            referenceFilled,
            carDistanceM,
            trackLengthM
          );
          buildReference(
            refs.refBrake,
            showBrake,
            s,
            s.brake,
            0,
            1,
            referenceFilled,
            carDistanceM,
            trackLengthM
          );
          buildReference(
            refs.refSpeed,
            showSpeed,
            s,
            s.speed,
            speedMin,
            speedRange,
            false,
            carDistanceM,
            trackLengthM
          );
        } else {
          setPath(refs.refThrottle, '');
          setPath(refs.refBrake, '');
          setPath(refs.refSpeed, '');
        }

        if (activeLap && showGhost) {
          const s = activeLap.samples;
          // This lap has only been driven up to the car, so the ghost never
          // runs past it. Behind the line it continues into the carry-over the
          // recorder kept of the lap just finished, which is empty on the
          // first lap and after anything that broke the line's continuity.
          const loM = carDistanceM - metersBehind;
          let pieceCount = 0;

          const carry = activeLap.carryOver;
          if (loM < 0 && carry.length > 0 && trackLengthM > 0) {
            const piece = ghostPieces[pieceCount++];
            piece.samples = carry;
            piece.fromM = Math.max(0, trackLengthM + loM);
            piece.toM = trackLengthM;
            piece.offsetM = -trackLengthM;
          }

          const thisLap = ghostPieces[pieceCount++];
          thisLap.samples = s;
          thisLap.fromM = Math.max(0, loM);
          thisLap.toM = Math.min(s.lastDistanceM(), carDistanceM);
          thisLap.offsetM = 0;

          buildGhost(
            refs.ghostThrottle,
            showThrottle,
            pieceCount,
            'throttle',
            0,
            1,
            false,
            false
          );
          buildGhost(
            refs.ghostBrake,
            showBrake,
            pieceCount,
            'brake',
            0,
            1,
            false,
            false
          );
          buildGhost(
            refs.ghostSpeed,
            showSpeed,
            pieceCount,
            'speed',
            speedMin,
            speedRange,
            false,
            false
          );

          // ABS is drawn as a highlight over the brake trace it belongs to,
          // gated to the samples where it engaged, so the driver sees where
          // the system took over rather than just how hard they pressed.
          buildGhost(
            refs.ghostBrakeAbs,
            showAbs && showBrake,
            pieceCount,
            'brake',
            0,
            1,
            false,
            true
          );
          // The 'bar' style: the same run, but filled down to the axis
          // instead of just outlined, so it reads as a bar the way the Input
          // Trace widget's ABS indicator does.
          buildGhost(
            refs.ghostAbsArea,
            showAbs && showBrake && absStyle === 'bar',
            pieceCount,
            'brake',
            0,
            1,
            true,
            true
          );

          if (showAbsBar) {
            path.begin(false);
            for (let p = 0; p < pieceCount; p++) {
              const piece = ghostPieces[p];
              appendGateBar(
                path,
                piece.samples,
                piece.fromM,
                piece.toM,
                piece.offsetM,
                piece.samples.absActive,
                ABS_BAR_Y,
                geometry
              );
            }
            setPath(refs.absBar, path.end());
          } else {
            setPath(refs.absBar, '');
          }
        } else {
          setPath(refs.ghostThrottle, '');
          setPath(refs.ghostBrake, '');
          setPath(refs.ghostSpeed, '');
          setPath(refs.ghostBrakeAbs, '');
          setPath(refs.ghostAbsArea, '');
          setPath(refs.absBar, '');
        }

        // Pedal application points, interpolated between telemetry samples,
        // so they are what the driver reads a brake point off — the trace
        // behind them is context. Brake and throttle are independent toggles,
        // so each reads the reference's events only when its own flag is on.
        const events = showBrakePointMarkers ? referenceLap?.events : undefined;
        // Not events.throttleOnM: that carries every application, including
        // the blip of a downshift and the re-application after an upshift
        // lift, neither of which is where the reference picked the throttle
        // up. selectThrottlePoints strips those on hydrate.
        const throttlePointsM = showThrottlePointMarkers
          ? referenceLap?.throttlePointsM
          : undefined;
        // Only the reference lap's brake application is marked — where the
        // saved lap first gets on the brake. The reference's release point and
        // the driver's own live brake points are deliberately not drawn: the
        // marker answers "where does the reference start braking", nothing else.
        placeMarkers(
          refs.markerRefBrakeOn.current,
          showBrakePointMarkers ? events?.brakeOnM : undefined,
          showBrakePointMarkers ? (events?.brakeOnM.length ?? 0) : 0,
          carDistanceM,
          metersBehind,
          metersAhead,
          trackLengthM
        );
        placeMarkers(
          refs.markerRefThrottleOn.current,
          throttlePointsM,
          throttlePointsM?.length ?? 0,
          carDistanceM,
          metersBehind,
          metersAhead,
          trackLengthM
        );

        // Gear labels. The change list is small (capped at 512) so a full scan
        // is cheaper than maintaining a cursor across the start/finish wrap.
        const widthPx = plotWidthRef.current;
        if (showGearLabels && referenceLap && labels && widthPx > 0) {
          const changes = referenceLap.gearChangeM;
          const gears = referenceLap.gearChangeValues;
          const min = carDistanceM - metersBehind;
          const max = carDistanceM + metersAhead;
          for (
            let c = 0;
            c < changes.length && labelsShown < MAX_GEAR_LABELS;
            c++
          ) {
            for (let k = -1; k <= 1 && labelsShown < MAX_GEAR_LABELS; k++) {
              const metres = changes[c] + k * trackLengthM;
              if (metres < min || metres > max) continue;
              const el = labels[labelsShown];
              if (!el) continue;
              const x = xForMetres(
                metres,
                carDistanceM,
                metersBehind,
                metersAhead
              );
              el.textContent = GEAR_LABELS[gears[c] + 1] ?? '';
              el.style.transform = `translateX(${(x / 1000) * widthPx}px) translateX(-50%)`;
              el.style.visibility = 'visible';
              labelsShown++;
            }
          }
        }
      }

      if (labels) {
        for (let i = labelsShown; i < labels.length; i++) {
          const el = labels[i];
          if (el) el.style.visibility = 'hidden';
        }
      }
    };

    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [
    refs,
    metersBehind,
    metersAhead,
    showThrottle,
    showBrake,
    showSpeed,
    showGhost,
    showGearLabels,
    showBrakePointMarkers,
    showThrottlePointMarkers,
    showAbs,
    absStyle,
    showAbsBar,
    referenceFilled,
    carDistanceMOverride,
  ]);
};
