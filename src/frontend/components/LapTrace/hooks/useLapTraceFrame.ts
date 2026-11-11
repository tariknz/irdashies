import { useEffect, useRef, type RefObject } from 'react';
import type { LapTraceSamples, LapTraceView } from '@irdashies/types';
import { getChannelSnapshotStore, useLapTraceStore } from '@irdashies/context';
import {
  MAX_SAMPLE_GAP_M,
  indexAtOrBefore,
  normalisePct,
} from '@irdashies/domain/lapTrace/lapSamples';
import { xForMetres } from '@irdashies/domain/lapTrace/lapTraceWindow';
import {
  REFERENCE_SPAN_SLOTS,
  lapPieces,
  spanTileAt,
  tileContent,
  tileLayout,
  tileTranslatePct,
  type LapPiece,
  type TileLayout,
} from '@irdashies/domain/lapTrace/lapTraceTiles';
import { scheduleLapTraceFrames } from './lapTraceFrameScheduler';
import {
  ABS_BAR_Y,
  GEAR_LABELS,
  PLOT_BOTTOM,
  PLOT_TOP,
  VIEW_HEIGHT,
  VIEW_WIDTH,
  yForNorm,
} from '../layout';

/**
 * 'screen' blend mode so the ABS fill lightens/mixes with whatever's beneath
 * it — a filled reference throttle or brake bar it overlaps — instead of just
 * occluding it, so both "ABS was on" and "the reference had the pedal down
 * here" stay readable at once. Against the plot's dark background alone
 * (nothing to mix with) it reads as the plain ABS colour, same as normal alpha
 * blending would.
 */
const ABS_BLEND_MODE = 'screen';

/** One contiguous run of the driver's lap. */
interface GhostPiece extends LapPiece {
  samples: LapTraceSamples;
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

/** Classes for a gear label, positioned by `left` within its span. */
const GEAR_LABEL_CLASS =
  'absolute bottom-0 -translate-x-1/2 text-[10px] leading-none font-semibold text-slate-300 tabular-nums';

/**
 * The layers the frame loop draws into. Paths are found inside each layer by
 * their `data-trace`.
 *
 * The reference layers come in slots, one span of the lap each (see
 * lapTraceTiles). Slot `i` of the marker and gear label layers always shows
 * the same stretch of track as slot `i` of the reference traces.
 */
export interface LapTraceFrameRefs {
  /** Reference traces: `speed`, `throttle`, `brake`. */
  referenceSpans: RefObject<(SVGSVGElement | null)[]>;
  /** Reference pedal points: `brake-markers`, `throttle-markers`. */
  markerSpans: RefObject<(SVGSVGElement | null)[]>;
  /** Gear labels, in the strip beneath the plot. */
  gearLabelSpans: RefObject<(HTMLDivElement | null)[]>;
  /** The driver's lap: `speed`, `throttle`, `brake`. */
  ghost: RefObject<SVGSVGElement | null>;
  /** The ABS fill, `abs-area`, blended over everything beneath it. */
  absArea: RefObject<SVGSVGElement | null>;
  /** ABS on top of the driver's lap: `brake-abs` and the `abs-bar` strip. */
  ghostOverlay: RefObject<SVGSVGElement | null>;
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
  /** Dotted line at the reference's brake application points. */
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
 * Skip a frame when the car has moved less than this and nothing else
 * changed. Position arrives at telemetry rate, and a car crawling in the pits
 * needs no new frame for every sample.
 */
const REBUILD_MIN_MOVE_M = 0.25;

/**
 * Accumulates one SVG path across any number of sample runs and lap pieces.
 * Points are collected as parts and joined once, so a path of a thousand
 * points does not cost a thousand string concatenations.
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

interface TileGeometry {
  /** Where x = 0 of the tile being built sits, in unwrapped metres. */
  tileStartM: number;
  /** Metres the window shows; sets the x scale, the same in every tile. */
  windowM: number;
  /** Metres per decimation bin. */
  binM: number;
}

/** x of an unwrapped distance in the tile being built. */
function tileX(distanceM: number, geometry: TileGeometry): number {
  return xForMetres(distanceM, geometry.tileStartM, 0, geometry.windowM);
}

/**
 * Append the samples inside [fromM, toM] (lap-local metres, plus `offsetM`
 * to unwrap them) to `path`, decimated per bin.
 *
 * Within each bin the first, lowest, highest and last samples are emitted at
 * their own x in sample order, which is what keeps a throttle lift drawn
 * before the brake application that followed it: every emitted point sits
 * where the sim measured it. Bins are counted from the start of the lap, on
 * the lap-local distance -- not from `fromM`, and not after `offsetM` -- so two
 * tiles sharing a stretch of track emit the same points along it.
 *
 * Values are normalised as `(value - min) / range` so pedals (0..1) and speed
 * (m/s against the lap's own range) share one code path.
 *
 * `gate` is an optional second mask: a sample only draws where it is above
 * zero, so the same channel can be redrawn as a highlight over part of its
 * own run (ABS over the brake trace) without a filtered copy. The pen lifts
 * at a gate-off sample and at a gap wider than MAX_SAMPLE_GAP_M.
 *
 * The first sample past `toM` is emitted too, so a line runs off the edge of
 * the tile rather than stopping just short of it — unless the gap to it would
 * lift the pen anyway, or it is further along than `limitM` (unwrapped). The
 * driver's lap passes the car's position there: nothing may be drawn ahead of
 * the car.
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
  limitM: number,
  geometry: TileGeometry
): void {
  const n = samples.length;
  if (n === 0 || !(toM >= fromM)) {
    path.break();
    return;
  }
  const { distanceM } = samples;
  const { binM } = geometry;

  const emit = (i: number) => {
    path.point(
      tileX(distanceM[i] + offsetM, geometry),
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

  // Start one sample before the range so the line enters from its edge.
  let i = indexAtOrBefore(samples, fromM);
  if (i < 0) i = 0;

  for (; i < n; i++) {
    const d = distanceM[i];
    if (d > toM) {
      if (
        d + offsetM <= limitM &&
        !(i > 0 && d - distanceM[i - 1] > MAX_SAMPLE_GAP_M) &&
        !(gate !== null && !(gate[i] > 0))
      ) {
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

    // From the lap-local distance, not the unwrapped one: the same stretch of
    // track is drawn at different offsets in neighbouring spans, and rounding
    // could put a sample on a bin boundary in a different bin in each, moving
    // the trace when the plot swaps spans. Each call bins its own piece.
    const bin = Math.floor(d / binM);
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
  geometry: TileGeometry
): void {
  const n = samples.length;
  if (n === 0) return;
  const { distanceM } = samples;
  const xAt = (i: number) => tileX(distanceM[i] + offsetM, geometry);

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

function setPath(el: SVGPathElement | null, d: string): void {
  if (el) el.setAttribute('d', d);
}

function tracePath(
  layer: Element | null | undefined,
  name: string
): SVGPathElement | null {
  return (
    layer?.querySelector<SVGPathElement>(`path[data-trace="${name}"]`) ?? null
  );
}

/** One span of the reference lap, in its three layers. */
interface SpanSlot {
  traces: SVGSVGElement | null;
  speed: SVGPathElement | null;
  throttle: SVGPathElement | null;
  brake: SVGPathElement | null;
  markers: SVGSVGElement | null;
  brakeMarkers: SVGPathElement | null;
  throttleMarkers: SVGPathElement | null;
  labels: HTMLDivElement | null;
  /** The distinct tile the span starts at; -1 for none. */
  content: number;
  /** The reference it was built from. */
  reference: LapTraceView | null;
  shown: boolean;
}

function spanSlots(refs: LapTraceFrameRefs): SpanSlot[] {
  return Array.from({ length: REFERENCE_SPAN_SLOTS }, (_, i) => {
    const traces = refs.referenceSpans.current[i] ?? null;
    const markers = refs.markerSpans.current[i] ?? null;
    return {
      traces,
      speed: tracePath(traces, 'speed'),
      throttle: tracePath(traces, 'throttle'),
      brake: tracePath(traces, 'brake'),
      markers,
      brakeMarkers: tracePath(markers, 'brake-markers'),
      throttleMarkers: tracePath(markers, 'throttle-markers'),
      labels: refs.gearLabelSpans.current[i] ?? null,
      content: -1,
      reference: null,
      // Unknown until the first frame hides or shows it.
      shown: true,
    };
  });
}

type SpanElement = SVGSVGElement | HTMLDivElement | null;

/** Size a span element to `spanM` of a `windowM`-wide plot. */
function sizeSpan(el: SpanElement, spanM: number, windowM: number): void {
  if (!el) return;
  el.style.width = `${(spanM / windowM) * 100}%`;
  if (el instanceof SVGSVGElement) {
    el.setAttribute(
      'viewBox',
      `0 0 ${((spanM / windowM) * VIEW_WIDTH).toFixed(3)} ${VIEW_HEIGHT}`
    );
  }
}

function showSpan(slot: SpanSlot, shown: boolean): void {
  if (slot.shown === shown) return;
  const display = shown ? '' : 'none';
  if (slot.traces) slot.traces.style.display = display;
  if (slot.markers) slot.markers.style.display = display;
  if (slot.labels) slot.labels.style.display = display;
  slot.shown = shown;
}

function moveSpan(slot: SpanSlot, transform: string): void {
  if (slot.traces) slot.traces.style.transform = transform;
  if (slot.markers) slot.markers.style.transform = transform;
  if (slot.labels) slot.labels.style.transform = transform;
}

/*
 * Slot lookups, as plain loops rather than find/some with a callback: they run
 * on every drawn frame, and a closure per call would allocate where the rest
 * of the loop does not.
 */

/** The slot holding `content` of `reference`, or null. */
function slotHolding(
  spans: SpanSlot[],
  content: number,
  reference: LapTraceView
): SpanSlot | null {
  for (const slot of spans) {
    if (slot.content === content && slot.reference === reference) return slot;
  }
  return null;
}

/** The first slot not on screen, or null. */
function hiddenSlot(spans: SpanSlot[]): SpanSlot | null {
  for (const slot of spans) {
    if (!slot.shown) return slot;
  }
  return null;
}

/** The speed axis, as the minimum and the span above it. */
interface SpeedScale {
  min: number;
  range: number;
}

/**
 * Set the speed axis from a lap's speed range. The reference spans and the
 * driver's lap must share it to be comparable, so both take it from here.
 */
function setSpeedScale(
  out: SpeedScale,
  minMs: number | undefined,
  maxMs: number | undefined
): SpeedScale {
  let min = minMs ?? 0;
  let max = maxMs ?? 0;
  if (!Number.isFinite(min) || !Number.isFinite(max)) {
    min = 0;
    max = 0;
  }
  out.min = min;
  out.range = max - min > 1 ? max - min : 1;
  return out;
}

/**
 * Drives the lap trace plot.
 *
 * Telemetry is read through a direct store subscription rather than a hook
 * (R2.3), so the React component renders only when its settings change —
 * never per frame. A frame is requested only when something the plot shows
 * can have changed: the car's position, the lap store's reference, track
 * length or active lap, or the settings, so an idle widget schedules no
 * frames at all and a driving one at most one per telemetry sample.
 *
 * The reference is drawn in spans fixed to track distance (see
 * lapTraceTiles). A span is built once and from then on only slid under the
 * car line with a composited transform, which moves its already rasterised
 * layer without repainting it; its pedal markers and gear labels are fixed
 * points on the reference, so they live in matching layers and slide with
 * it. The next span is built a frame after the window moves onto a new one,
 * so it is ready before the car reaches it.
 *
 * The driver's lap changes with every sample, so it is rebuilt each frame,
 * in window coordinates, in layers of its own: a frame repaints the stretch
 * behind the car and nothing else. It is one continuous path per trace — a
 * trace split across separately rasterised pieces shows a seam at every cut.
 * It stops at the car and never goes past it, and reaches back over the line
 * only as far as the carry-over the recorder kept of the lap just finished.
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
  // Asks the drawing effect for a frame. The position is subscribed in an
  // effect of its own, so a settings change does not resubscribe it.
  const requestDrawRef = useRef<() => void>(() => undefined);

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
        requestDrawRef.current();
      }
    });
  }, [carDistanceMOverride]);

  useEffect(() => {
    // Set once the scheduler below exists, before any frame can run.
    let requestDraw: () => void = () => undefined;
    const path = new PathBuilder();
    // Reused by every frame, like `pieces` and `ghostPieces`.
    const ghostScale: SpeedScale = { min: 0, range: 1 };
    const spanScale: SpeedScale = { min: 0, range: 1 };
    const pieces: LapPiece[] = [];
    // Reused every frame so the loop never allocates, mirroring `pieces`.
    const ghostPieces: GhostPiece[] = [
      { samples: EMPTY_SAMPLES, fromM: 0, toM: 0, offsetM: 0 },
      { samples: EMPTY_SAMPLES, fromM: 0, toM: 0, offsetM: 0 },
    ];
    const geometry: TileGeometry = {
      tileStartM: 0,
      windowM: metersBehind + metersAhead,
      binM: 1,
    };

    const spans = spanSlots(refs);
    const ghost = refs.ghost.current;
    const ghostSpeed = tracePath(ghost, 'speed');
    const ghostThrottle = tracePath(ghost, 'throttle');
    const ghostBrake = tracePath(ghost, 'brake');
    const absLayer = refs.absArea.current;
    const absArea = tracePath(absLayer, 'abs-area');
    const ghostOverlay = refs.ghostOverlay.current;
    const brakeAbs = tracePath(ghostOverlay, 'brake-abs');
    const absBar = tracePath(ghostOverlay, 'abs-bar');

    let layout: TileLayout | null = null;

    // What the last frame drew from, so a frame with nothing new is skipped.
    let lastCarDistanceM = Number.NaN;
    let lastReference: unknown = undefined;
    let lastSampleCount = -1;
    let lastLapSerial = -1;

    const hideReference = () => {
      for (const slot of spans) showSpan(slot, false);
    };

    /** Resize every span for a new layout, and forget what they held. */
    const applyLayout = (next: TileLayout) => {
      layout = next;
      geometry.binM = next.binM;
      for (const slot of spans) {
        sizeSpan(slot.traces, next.spanM, next.windowM);
        sizeSpan(slot.markers, next.spanM, next.windowM);
        sizeSpan(slot.labels, next.spanM, next.windowM);
        slot.content = -1;
      }
    };

    const buildReferenceTrace = (
      el: SVGPathElement | null,
      samples: LapTraceSamples,
      values: Float32Array,
      min: number,
      range: number,
      filled: boolean,
      pieceCount: number
    ) => {
      if (!el) return;
      // The pen stays down between pieces: a lap's last sample and its first
      // are a sample apart, so the trace runs straight through the line.
      path.begin(filled);
      for (let p = 0; p < pieceCount; p++) {
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
          Number.POSITIVE_INFINITY,
          geometry
        );
      }
      setPath(el, path.end());
    };

    /**
     * Dotted lines at fixed points on the reference, one subpath each so the
     * dash pattern restarts at the top of every line.
     */
    const buildMarkers = (
      el: SVGPathElement | null,
      positions: Float32Array | undefined,
      fromM: number,
      toM: number,
      trackLengthM: number
    ) => {
      if (!el) return;
      const parts: string[] = [];
      if (positions) {
        const firstLap = Math.floor(fromM / trackLengthM);
        const lastLap = Math.floor(toM / trackLengthM);
        for (const position of positions) {
          for (let k = firstLap; k <= lastLap; k++) {
            const metres = position + k * trackLengthM;
            if (metres < fromM || metres > toM) continue;
            const x = tileX(metres, geometry).toFixed(1);
            parts.push(`M${x} ${PLOT_TOP}V${PLOT_BOTTOM}`);
          }
        }
      }
      setPath(el, parts.join(''));
    };

    const buildGearLabels = (
      el: HTMLDivElement | null,
      changes: Float32Array,
      gears: ArrayLike<number>,
      fromM: number,
      toM: number,
      trackLengthM: number
    ) => {
      if (!el) return;
      const labels: HTMLSpanElement[] = [];
      const firstLap = Math.floor(fromM / trackLengthM);
      const lastLap = Math.floor(toM / trackLengthM);
      for (let c = 0; c < changes.length; c++) {
        for (let k = firstLap; k <= lastLap; k++) {
          const metres = changes[c] + k * trackLengthM;
          if (metres < fromM || metres >= toM) continue;
          const span = document.createElement('span');
          span.className = GEAR_LABEL_CLASS;
          span.style.left = `${(((metres - fromM) / (toM - fromM)) * 100).toFixed(3)}%`;
          span.textContent = GEAR_LABELS[gears[c] + 1] ?? '';
          labels.push(span);
        }
      }
      el.replaceChildren(...labels);
    };

    const fillSpan = (
      slot: SpanSlot,
      content: number,
      reference: LapTraceView,
      tiles: TileLayout
    ) => {
      const { trackLengthM, tileM, spanM } = tiles;
      const fromM = content * tileM;
      const toM = fromM + spanM;
      geometry.tileStartM = fromM;

      // Each trace starts a sample before the span and ends a sample after
      // it, so lines run off both edges and a filled trace closes down to
      // the axis outside the span, where it is clipped away.
      const pieceCount = lapPieces(fromM, toM, trackLengthM, pieces);
      const s = reference.samples;
      const speed = setSpeedScale(
        spanScale,
        reference.speedMinMs,
        reference.speedMaxMs
      );
      buildReferenceTrace(
        slot.throttle,
        s,
        s.throttle,
        0,
        1,
        referenceFilled,
        pieceCount
      );
      buildReferenceTrace(
        slot.brake,
        s,
        s.brake,
        0,
        1,
        referenceFilled,
        pieceCount
      );
      buildReferenceTrace(
        slot.speed,
        s,
        s.speed,
        speed.min,
        speed.range,
        false,
        pieceCount
      );

      // Pedal application points, interpolated between telemetry samples, so
      // they are what the driver reads a brake point off — the trace behind
      // them is context. Only the reference's brake *application* is marked.
      // Throttle draws throttlePointsM, not events.throttleOnM: that carries
      // every application, including the blip of a downshift and the
      // re-application after an upshift lift, neither of which is where the
      // reference picked the throttle up.
      buildMarkers(
        slot.brakeMarkers,
        showBrakePointMarkers ? reference.events.brakeOnM : undefined,
        fromM,
        toM,
        trackLengthM
      );
      buildMarkers(
        slot.throttleMarkers,
        showThrottlePointMarkers ? reference.throttlePointsM : undefined,
        fromM,
        toM,
        trackLengthM
      );
      buildGearLabels(
        slot.labels,
        reference.gearChangeM,
        reference.gearChangeValues,
        fromM,
        toM,
        trackLengthM
      );

      slot.content = content;
      slot.reference = reference;
    };

    /**
     * Put the span holding the window on screen, building it if no slot
     * already has it. Returns whether anything was built.
     */
    const placeReference = (
      carDistanceM: number,
      reference: LapTraceView | null,
      tiles: TileLayout
    ): boolean => {
      if (!reference) {
        hideReference();
        return false;
      }
      const tile = spanTileAt(carDistanceM, metersBehind, tiles);
      const content = tileContent(tile, tiles);

      let built = false;
      let current = slotHolding(spans, content, reference);
      if (!current) {
        // Not the slot on screen, if it can be helped: that is the span the
        // window has just left, and the one it is likeliest to go back to.
        current = hiddenSlot(spans) ?? spans[0];
        fillSpan(current, content, reference, tiles);
        built = true;
      }

      moveSpan(
        current,
        `translateX(${tileTranslatePct(
          tile * tiles.tileM,
          tiles.spanM,
          carDistanceM,
          metersBehind
        ).toFixed(3)}%)`
      );
      // Shown before the other is hidden, so no frame has neither.
      showSpan(current, true);
      for (const slot of spans) if (slot !== current) showSpan(slot, false);
      return built;
    };

    /**
     * Build the span after the one on screen into the spare slot, so moving
     * onto it costs a transform rather than a rebuild.
     */
    const prepareNextSpan = (
      carDistanceM: number,
      reference: LapTraceView | null,
      tiles: TileLayout
    ) => {
      if (!reference) return;
      const next = tileContent(
        spanTileAt(carDistanceM, metersBehind, tiles) + 1,
        tiles
      );
      if (slotHolding(spans, next, reference)) return;
      const spare = hiddenSlot(spans);
      if (spare) fillSpan(spare, next, reference, tiles);
    };

    const buildGhostTrace = (
      el: SVGPathElement | null,
      pieceCount: number,
      channel: 'throttle' | 'brake' | 'speed',
      min: number,
      range: number,
      filled: boolean,
      gated: boolean,
      carDistanceM: number
    ): string => {
      if (!el) return '';
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
          carDistanceM,
          geometry
        );
      }
      const d = path.end();
      setPath(el, d);
      return d;
    };

    // Whether the ABS area is blended. Set only while it has something to
    // draw: a blended layer makes Chromium composite the plot beneath it as
    // an isolated group, which is pure cost while the path is empty.
    let absBlendOn: boolean | undefined;
    const setAbsBlend = (on: boolean) => {
      if (!absLayer || absBlendOn === on) return;
      absLayer.style.mixBlendMode = on ? ABS_BLEND_MODE : '';
      absBlendOn = on;
    };

    const clearGhost = () => {
      setPath(ghostSpeed, '');
      setPath(ghostThrottle, '');
      setPath(ghostBrake, '');
      setPath(absArea, '');
      setAbsBlend(false);
      setPath(brakeAbs, '');
      setPath(absBar, '');
    };

    const drawGhost = (
      carDistanceM: number,
      activeLap: ReturnType<typeof useLapTraceStore.getState>['activeLap'],
      speedMin: number,
      speedRange: number,
      trackLengthM: number
    ) => {
      if (!activeLap || !showGhost) {
        clearGhost();
        return;
      }
      const s = activeLap.samples;
      // This lap has only been driven up to the car, so the ghost never runs
      // past it. Behind the line it continues into the carry-over the
      // recorder kept of the lap just finished, which is empty on the first
      // lap and after anything that broke the line's continuity.
      const loM = carDistanceM - metersBehind;
      geometry.tileStartM = loM;
      let pieceCount = 0;

      const carry = activeLap.carryOver;
      if (loM < 0 && carry.length > 0) {
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

      buildGhostTrace(
        ghostThrottle,
        pieceCount,
        'throttle',
        0,
        1,
        false,
        false,
        carDistanceM
      );
      buildGhostTrace(
        ghostBrake,
        pieceCount,
        'brake',
        0,
        1,
        false,
        false,
        carDistanceM
      );
      buildGhostTrace(
        ghostSpeed,
        pieceCount,
        'speed',
        speedMin,
        speedRange,
        false,
        false,
        carDistanceM
      );
      // ABS is drawn as a highlight over the brake trace it belongs to,
      // gated to the samples where it engaged, so the driver sees where the
      // system took over rather than just how hard they pressed.
      buildGhostTrace(
        brakeAbs,
        pieceCount,
        'brake',
        0,
        1,
        false,
        true,
        carDistanceM
      );
      // The 'bar' style: the same run, filled down to the axis.
      const area = buildGhostTrace(
        absArea,
        pieceCount,
        'brake',
        0,
        1,
        true,
        true,
        carDistanceM
      );
      setAbsBlend(area !== '');

      if (absBar) {
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
        setPath(absBar, path.end());
      }
    };

    const draw = () => {
      // Read fresh every frame: the active lap's buffer is reset in place at
      // each lap boundary, so holding a reference across frames risks drawing
      // from a buffer that has since been rewound.
      const { trackLengthM, referenceLap, activeLap } =
        useLapTraceStore.getState();

      let tiles = layout;
      if (tiles?.trackLengthM !== trackLengthM) {
        tiles = tileLayout(trackLengthM, metersBehind, metersAhead);
        lastCarDistanceM = Number.NaN;
        if (!tiles) {
          layout = null;
          hideReference();
          clearGhost();
          return;
        }
        applyLayout(tiles);
      }

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
        // A frame with nothing to move is the time to get the next span
        // ready.
        prepareNextSpan(carDistanceM, referenceLap, tiles);
        return;
      }
      lastCarDistanceM = carDistanceM;
      lastReference = referenceLap;
      lastSampleCount = sampleCount;
      lastLapSerial = lapSerial;

      // Both laps share one speed scale so they are directly comparable.
      // Prefer the reference's range — it is fixed, so the plot does not
      // rescale under the driver mid-corner, and it is the range its spans
      // were drawn on. Before a reference exists, fall back to the running
      // range of the lap in progress.
      const speed = setSpeedScale(
        ghostScale,
        referenceLap?.speedMinMs ?? activeLap?.speedMinMs,
        referenceLap?.speedMaxMs ?? activeLap?.speedMaxMs
      );

      const built = placeReference(carDistanceM, referenceLap, tiles);
      drawGhost(carDistanceM, activeLap, speed.min, speed.range, trackLengthM);
      if (built) {
        // Leave the next span for a frame of its own rather than doubling
        // this one's work, and make sure there is one even if the car stops
        // here.
        requestDraw();
      } else {
        prepareNextSpan(carDistanceM, referenceLap, tiles);
      }
    };

    // Nothing is placed until the first frame works out where it goes.
    hideReference();

    // The lap store's sample buffers grow in place without notifying (the
    // car's position covers those), so only a change of the objects drawn
    // from asks for a frame from the store: a reference loaded or cleared,
    // the track length, or a new active lap after a reset.
    const scheduler = scheduleLapTraceFrames(
      'lapTraceFrame',
      draw,
      (state, prev) =>
        state.referenceLap !== prev.referenceLap ||
        state.trackLengthM !== prev.trackLengthM ||
        state.activeLap !== prev.activeLap
    );
    requestDraw = scheduler.request;
    requestDrawRef.current = scheduler.request;

    return () => {
      scheduler.dispose();
      requestDrawRef.current = () => undefined;
    };
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
