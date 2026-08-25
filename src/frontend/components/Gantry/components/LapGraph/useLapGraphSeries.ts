import { useMemo } from 'react';
import {
  buildGapAxis,
  buildLinearAxis,
  buildPositionAxis,
  type LinearAxis,
} from './lapGraphScales';
import {
  clampWindow,
  type LapBounds,
  type LapWindow,
} from './lapGraphViewport';

export type LapGraphMode = 'trace' | 'position' | 'gap';

export interface LapPoint {
  lap: number;
  value: number;
}

export interface LapGraphSeries {
  carIdx: number;
  carNumber: string;
  /** Already formatted for display. Do not reformat. */
  displayName: string;
  isPlayer: boolean;
  /** CSS colour string, already resolved from the car class. */
  color: string;
  points: readonly LapPoint[];
}

/** Context is the field, pinned is the user's set, focus is the one line. */
export type EmphasisTier = 'context' | 'pinned' | 'focus';

export interface StrokeStyle {
  color: string;
  width: number;
  alpha: number;
}

export interface PreparedSeries {
  source: LapGraphSeries;
  tier: EmphasisTier;
  stroke: StrokeStyle;
  /** Clipped to the window and decimated. Ready to stroke, nothing else. */
  points: readonly LapPoint[];
}

export interface LapGraphGeometry {
  bounds: LapBounds;
  /** The input window, clamped to the data. */
  window: LapWindow;
  axis: LinearAxis;
  /** True for position mode, where 1 belongs at the top. */
  inverted: boolean;
  /** Draw order: context first, focus last. */
  ordered: readonly PreparedSeries[];
  /** Unwindowed source series by carIdx, for O(1) pointer hit testing. */
  byCarIdx: ReadonlyMap<number, LapGraphSeries>;
  /** Points actually stroked, after windowing and decimation. */
  drawnPointCount: number;
  /** Cars drawn at context strength, i.e. the faint background field. */
  contextCount: number;
}

const EMPTY_BOUNDS: LapBounds = { minLap: 1, maxLap: 1 };

export const lapBoundsOf = (series: readonly LapGraphSeries[]): LapBounds => {
  let minLap = Number.POSITIVE_INFINITY;
  let maxLap = Number.NEGATIVE_INFINITY;
  for (const entry of series) {
    const { points } = entry;
    if (points.length === 0) continue;
    const first = points[0].lap;
    const last = points[points.length - 1].lap;
    if (first < minLap) minLap = first;
    if (last > maxLap) maxLap = last;
  }
  if (!Number.isFinite(minLap) || !Number.isFinite(maxLap)) return EMPTY_BOUNDS;
  return { minLap, maxLap };
};

/** First index whose lap is at or after `lap`. Points are lap-ordered. */
const lowerBound = (points: readonly LapPoint[], lap: number): number => {
  let low = 0;
  let high = points.length;
  while (low < high) {
    const mid = Math.floor((low + high) / 2);
    if (points[mid].lap < lap) low = mid + 1;
    else high = mid;
  }
  return low;
};

/** First index whose lap is strictly after `lap`. */
const upperBound = (points: readonly LapPoint[], lap: number): number => {
  let low = 0;
  let high = points.length;
  while (low < high) {
    const mid = Math.floor((low + high) / 2);
    if (points[mid].lap <= lap) low = mid + 1;
    else high = mid;
  }
  return low;
};

/**
 * The points inside the window, plus one on each side so the line reaches the
 * edges instead of stopping short of them.
 */
export const windowSlice = (
  points: readonly LapPoint[],
  window: LapWindow
): readonly LapPoint[] => {
  if (points.length === 0) return points;
  const from = Math.max(0, lowerBound(points, window.start) - 1);
  const to = Math.min(points.length, upperBound(points, window.end) + 1);
  if (from === 0 && to === points.length) return points;
  return points.slice(from, to);
};

/**
 * Reduces a series to at most two points per pixel column, keeping the minimum
 * and maximum of each column in lap order. A one-lap spike therefore survives,
 * which naive stride sampling cannot guarantee.
 */
export const decimateMinMax = (
  points: readonly LapPoint[],
  columns: number
): readonly LapPoint[] => {
  const total = points.length;
  const buckets = Math.floor(columns);
  if (total === 0) return points;
  if (buckets < 1) return [points[0]];
  if (total <= buckets) return points;

  const out: LapPoint[] = [];
  for (let bucket = 0; bucket < buckets; bucket++) {
    const from = Math.floor((bucket * total) / buckets);
    const to = Math.min(total, Math.floor(((bucket + 1) * total) / buckets));
    if (to <= from) continue;

    let lowIndex = from;
    let highIndex = from;
    for (let i = from + 1; i < to; i++) {
      if (points[i].value < points[lowIndex].value) lowIndex = i;
      if (points[i].value > points[highIndex].value) highIndex = i;
    }
    const first = Math.min(lowIndex, highIndex);
    const second = Math.max(lowIndex, highIndex);
    out.push(points[first]);
    if (second !== first) out.push(points[second]);
  }

  // Keep the true ends so the line still spans the window.
  if (out.length === 0 || out[0] !== points[0]) out.unshift(points[0]);
  const last = points[total - 1];
  if (out[out.length - 1] !== last) out.push(last);
  return out;
};

export interface ValueExtent {
  min: number;
  max: number;
}

export const valueExtentOf = (
  windowed: readonly (readonly LapPoint[])[]
): ValueExtent => {
  let min = Number.POSITIVE_INFINITY;
  let max = Number.NEGATIVE_INFINITY;
  for (const points of windowed) {
    for (const point of points) {
      const { value } = point;
      if (!Number.isFinite(value)) continue;
      if (value < min) min = value;
      if (value > max) max = value;
    }
  }
  if (!Number.isFinite(min) || !Number.isFinite(max)) return { min: 0, max: 1 };
  return { min, max };
};

/** Turns a gap axis into the same shape the other two modes return. */
const gapAxisAsLinear = (extent: ValueExtent): LinearAxis => {
  // A car ahead of the nominal class leader has a negative gap, and the axis
  // caption promises to show it. Only an all-positive field gets the tighter
  // gap-specific stepping.
  if (extent.min < 0) return buildLinearAxis(extent.min, extent.max);
  const gap = buildGapAxis(Math.max(extent.max, 0));
  return { min: 0, max: gap.max, step: gap.step, values: gap.values };
};

export const buildModeAxis = (
  mode: LapGraphMode,
  extent: ValueExtent
): LinearAxis => {
  if (mode === 'position') return buildPositionAxis(extent.max);
  if (mode === 'gap') return gapAxisAsLinear(extent);
  return buildLinearAxis(extent.min, extent.max);
};

/** Vertical pixel for a value. Position mode counts downwards from the top. */
export const valueToY = (
  value: number,
  axis: LinearAxis,
  plotHeight: number,
  inverted: boolean
): number => {
  const span = axis.max - axis.min;
  if (span <= 0) return plotHeight / 2;
  const ratio = (value - axis.min) / span;
  return inverted ? ratio * plotHeight : (1 - ratio) * plotHeight;
};

const HEX_SHORT = /^#([\da-f])([\da-f])([\da-f])$/i;
const HEX_LONG = /^#([\da-f]{2})([\da-f]{2})([\da-f]{2})$/i;

/**
 * Lifts a colour towards white so the focus tier reads brighter than a pinned
 * line of the same class colour. Unparseable colours pass through unchanged.
 */
export const brightenColor = (color: string, amount = 0.4): string => {
  const short = HEX_SHORT.exec(color);
  const long = HEX_LONG.exec(color);
  if (!short && !long) return color;
  const channels = short
    ? [short[1], short[2], short[3]].map((part) => parseInt(part + part, 16))
    : [long?.[1], long?.[2], long?.[3]].map((part) =>
        parseInt(part ?? '0', 16)
      );
  const lifted = channels.map((channel) =>
    Math.round(Math.min(255, channel + (255 - channel) * amount))
  );
  return `#${lifted.map((c) => c.toString(16).padStart(2, '0')).join('')}`;
};

export const CONTEXT_ALPHA = 0.15;

/** The three emphasis tiers from the plan, as concrete stroke settings. */
export const strokeStyleFor = (
  tier: EmphasisTier,
  color: string
): StrokeStyle => {
  if (tier === 'focus') {
    return { color: brightenColor(color), width: 3, alpha: 1 };
  }
  if (tier === 'pinned') return { color, width: 2, alpha: 1 };
  return { color, width: 1, alpha: CONTEXT_ALPHA };
};

/**
 * The player's own line is always at least pinned strength. Losing it in the
 * context wash is never the right answer.
 */
export const tierFor = (
  entry: LapGraphSeries,
  pinned: ReadonlySet<number>,
  focusedCarIdx: number | null
): EmphasisTier => {
  if (entry.carIdx === focusedCarIdx) return 'focus';
  if (entry.isPlayer || pinned.has(entry.carIdx)) return 'pinned';
  return 'context';
};

const TIER_ORDER: Record<EmphasisTier, number> = {
  context: 0,
  pinned: 1,
  focus: 2,
};

export interface LapGraphInput {
  series: readonly LapGraphSeries[];
  mode: LapGraphMode;
  window: LapWindow;
  /** Plot width in CSS pixels. Drives the decimation budget. */
  plotWidth: number;
  pinnedCarIdxs: readonly number[];
  focusedCarIdx: number | null;
}

/**
 * Everything the canvas needs for one draw, derived once. Pure, so it can be
 * tested without a DOM and memoised without surprises.
 */
export const prepareLapGraph = ({
  series,
  mode,
  window,
  plotWidth,
  pinnedCarIdxs,
  focusedCarIdx,
}: LapGraphInput): LapGraphGeometry => {
  const bounds = lapBoundsOf(series);
  const clamped = clampWindow(window, bounds);
  const pinned = new Set(pinnedCarIdxs);
  const columns = Math.max(1, Math.floor(plotWidth));

  const prepared: PreparedSeries[] = [];
  const windowed: (readonly LapPoint[])[] = [];
  const byCarIdx = new Map<number, LapGraphSeries>();
  let drawnPointCount = 0;
  let contextCount = 0;

  for (const entry of series) {
    byCarIdx.set(entry.carIdx, entry);
    const sliced = windowSlice(entry.points, clamped);
    if (sliced.length === 0) continue;
    windowed.push(sliced);

    const tier = tierFor(entry, pinned, focusedCarIdx);
    if (tier === 'context') contextCount++;
    const points = decimateMinMax(sliced, columns);
    drawnPointCount += points.length;
    prepared.push({
      source: entry,
      tier,
      stroke: strokeStyleFor(tier, entry.color),
      points,
    });
  }

  prepared.sort((a, b) => TIER_ORDER[a.tier] - TIER_ORDER[b.tier]);

  const extent = valueExtentOf(windowed);
  return {
    bounds,
    window: clamped,
    axis: buildModeAxis(mode, extent),
    inverted: mode === 'position',
    ordered: prepared,
    byCarIdx,
    drawnPointCount,
    contextCount,
  };
};

/** Value at an exact lap, or null when the car has no record for that lap. */
export const valueAtLap = (
  points: readonly LapPoint[],
  lap: number
): number | null => {
  const index = lowerBound(points, lap);
  const point = points[index];
  return point && point.lap === lap ? point.value : null;
};

export const useLapGraphSeries = (input: LapGraphInput): LapGraphGeometry => {
  const { series, mode, window, plotWidth, pinnedCarIdxs, focusedCarIdx } =
    input;
  return useMemo(
    () =>
      prepareLapGraph({
        series,
        mode,
        window,
        plotWidth,
        pinnedCarIdxs,
        focusedCarIdx,
      }),
    [series, mode, window, plotWidth, pinnedCarIdxs, focusedCarIdx]
  );
};
