/**
 * Lap window maths for the lap graph. Pure, no DOM, no React.
 *
 * A window is a half-open-feeling but inclusive lap range held as floats, so a
 * wheel zoom can land between laps without the window snapping and jittering.
 */

/** Laps shown by default when the race is longer than this. */
export const DEFAULT_WINDOW_LAPS = 75;

/** Smallest window the user can zoom to. */
export const MIN_WINDOW_LAPS = 5;

/** How close the window end must be to the newest lap to count as live. */
export const FOLLOW_TOLERANCE_LAPS = 0.5;

export interface LapWindow {
  start: number;
  end: number;
}

export interface LapBounds {
  minLap: number;
  maxLap: number;
}

const finite = (value: number, fallback: number): number =>
  Number.isFinite(value) ? value : fallback;

const orderedBounds = (bounds: LapBounds): LapBounds => {
  const a = finite(bounds.minLap, 1);
  const b = finite(bounds.maxLap, a);
  return { minLap: Math.min(a, b), maxLap: Math.max(a, b) };
};

export const windowSpan = (window: LapWindow): number =>
  Math.max(0, window.end - window.start);

export const boundsSpan = (bounds: LapBounds): number => {
  const { minLap, maxLap } = orderedBounds(bounds);
  return maxLap - minLap;
};

/** Smallest span allowed for these bounds. Never wider than the race itself. */
export const minSpanFor = (bounds: LapBounds): number =>
  Math.min(MIN_WINDOW_LAPS, boundsSpan(bounds));

/**
 * Forces a window inside the bounds, keeping its span where it can. Span is
 * clamped first, then the start slides to fit — so zoom keeps its anchor and
 * pan stops at the ends instead of dragging the window off the data.
 */
export const clampWindow = (
  window: LapWindow,
  bounds: LapBounds
): LapWindow => {
  const { minLap, maxLap } = orderedBounds(bounds);
  const total = maxLap - minLap;
  if (total <= 0) return { start: minLap, end: maxLap };

  const min = Math.min(MIN_WINDOW_LAPS, total);
  let span = finite(window.end - window.start, total);
  if (span <= 0) span = total;
  span = Math.min(Math.max(span, min), total);

  let start = finite(window.start, minLap);
  start = Math.min(Math.max(start, minLap), maxLap - span);
  return { start, end: start + span };
};

/** The default view: the most recent laps, or the whole race when it is short. */
export const defaultWindow = (
  bounds: LapBounds,
  span = DEFAULT_WINDOW_LAPS
): LapWindow => {
  const { maxLap } = orderedBounds(bounds);
  return clampWindow({ start: maxLap - span, end: maxLap }, bounds);
};

/** Slides the window so its right edge sits on the newest lap. */
export const followWindow = (
  window: LapWindow,
  bounds: LapBounds
): LapWindow => {
  const current = clampWindow(window, bounds);
  const span = windowSpan(current);
  return clampWindow(
    { start: bounds.maxLap - span, end: bounds.maxLap },
    bounds
  );
};

export const isWindowLive = (
  window: LapWindow,
  bounds: LapBounds,
  tolerance = FOLLOW_TOLERANCE_LAPS
): boolean => orderedBounds(bounds).maxLap - window.end <= tolerance;

/**
 * Zooms about a lap. `factor` below 1 zooms in. The anchor lap keeps its
 * position across the plot, which is what makes wheel zoom feel attached to
 * the cursor rather than to the middle of the chart.
 */
export const zoomWindow = (
  window: LapWindow,
  bounds: LapBounds,
  factor: number,
  anchorLap: number
): LapWindow => {
  const current = clampWindow(window, bounds);
  const span = windowSpan(current);
  if (span <= 0 || !Number.isFinite(factor) || factor <= 0) return current;

  const total = boundsSpan(bounds);
  const nextSpan = Math.min(
    Math.max(span * factor, Math.min(MIN_WINDOW_LAPS, total)),
    total
  );
  const anchor = Math.min(
    Math.max(finite(anchorLap, current.start), current.start),
    current.end
  );
  const ratio = (anchor - current.start) / span;
  const start = anchor - ratio * nextSpan;
  return clampWindow({ start, end: start + nextSpan }, bounds);
};

export const panWindow = (
  window: LapWindow,
  bounds: LapBounds,
  deltaLaps: number
): LapWindow => {
  const current = clampWindow(window, bounds);
  const delta = finite(deltaLaps, 0);
  return clampWindow(
    { start: current.start + delta, end: current.end + delta },
    bounds
  );
};

/** One arrow-key press. Steps by whole laps in the given direction. */
export const stepWindow = (
  window: LapWindow,
  bounds: LapBounds,
  direction: -1 | 1,
  stepLaps = 1
): LapWindow => panWindow(window, bounds, direction * Math.max(1, stepLaps));

/** Lap at a horizontal offset in the plot. O(1), used for pointer hit testing. */
export const xToLap = (
  x: number,
  window: LapWindow,
  plotWidth: number
): number => {
  const span = windowSpan(window);
  if (plotWidth <= 0 || span <= 0) return window.start;
  return window.start + (x / plotWidth) * span;
};

export const lapToX = (
  lap: number,
  window: LapWindow,
  plotWidth: number
): number => {
  const span = windowSpan(window);
  if (span <= 0) return plotWidth / 2;
  return ((lap - window.start) / span) * plotWidth;
};

/** Nearest whole lap under the pointer, never outside the visible window. */
export const nearestLapAtX = (
  x: number,
  window: LapWindow,
  plotWidth: number,
  bounds: LapBounds
): number => {
  const { minLap, maxLap } = orderedBounds(bounds);
  const low = Math.max(Math.ceil(minLap), Math.ceil(window.start));
  const high = Math.min(Math.floor(maxLap), Math.floor(window.end));
  const lap = Math.round(xToLap(x, window, plotWidth));
  return Math.min(Math.max(lap, low), Math.max(low, high));
};

export interface BrushRect {
  x: number;
  width: number;
}

/** Where the window sits on the whole-race overview strip. */
export const windowToBrush = (
  window: LapWindow,
  bounds: LapBounds,
  stripWidth: number
): BrushRect => {
  const { minLap } = orderedBounds(bounds);
  const total = boundsSpan(bounds);
  if (total <= 0 || stripWidth <= 0) return { x: 0, width: stripWidth };
  const scale = stripWidth / total;
  const x = (window.start - minLap) * scale;
  return { x, width: Math.max(1, windowSpan(window) * scale) };
};

/** Window implied by dragging between two x positions on the overview strip. */
/**
 * Lap under a pointer on the brush strip, which always spans the whole race.
 * Use this to find the lap a click landed on: reading it back out of a
 * zero-width window is wrong, because clamping widens that window to the
 * minimum span and slides its start away from the pointer.
 */
export const brushXToLap = (
  x: number,
  bounds: LapBounds,
  stripWidth: number
): number => {
  const { minLap, maxLap } = orderedBounds(bounds);
  const total = boundsSpan(bounds);
  if (total <= 0 || stripWidth <= 0) return minLap;
  const lap = minLap + (x / stripWidth) * total;
  return Math.min(Math.max(lap, minLap), maxLap);
};

export const brushToWindow = (
  xA: number,
  xB: number,
  bounds: LapBounds,
  stripWidth: number
): LapWindow => {
  const { minLap } = orderedBounds(bounds);
  const total = boundsSpan(bounds);
  if (total <= 0 || stripWidth <= 0)
    return clampWindow({ start: minLap, end: minLap }, bounds);
  const a = brushXToLap(Math.min(xA, xB), bounds, stripWidth);
  const b = brushXToLap(Math.max(xA, xB), bounds, stripWidth);
  return clampWindow({ start: a, end: b }, bounds);
};

/** Centres the window on a lap, keeping its span. Used for a brush click. */
export const centreWindowOn = (
  window: LapWindow,
  bounds: LapBounds,
  lap: number
): LapWindow => {
  const current = clampWindow(window, bounds);
  const half = windowSpan(current) / 2;
  return clampWindow({ start: lap - half, end: lap + half }, bounds);
};
