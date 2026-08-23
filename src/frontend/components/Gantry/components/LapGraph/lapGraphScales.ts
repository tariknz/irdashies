/**
 * Axis maths for the lap graph, kept pure so it can be tested without a DOM.
 */

/** Above this the axis stops growing and out-of-range points are clipped. */
export const MAX_GAP_CEILING_SECONDS = 600;

/** Hard ceiling on gridline count, whatever the data does. */
export const MAX_GRIDLINES = 8;

const GAP_STEPS = [1, 2, 5, 10, 15, 30, 60, 120, 300, 600];

/**
 * Smallest step from the ladder that keeps the gridline count within
 * MAX_GRIDLINES. Falls back to an even split of the range when even the
 * largest step is too fine.
 */
export const gapAxisStep = (maxGap: number): number => {
  for (const step of GAP_STEPS) {
    if (maxGap / step <= MAX_GRIDLINES) return step;
  }
  return Math.ceil(maxGap / MAX_GRIDLINES);
};

export interface GapAxis {
  max: number;
  step: number;
  values: number[];
}

/**
 * Builds the y axis for a gap plot. The range is clamped, so a car sitting in
 * the garage cannot compress the field into a smear at the top, and the
 * gridline loop can never run away on a garbage value.
 */
export const buildGapAxis = (rawMaxGap: number): GapAxis => {
  const bounded = Math.min(
    Math.max(Number.isFinite(rawMaxGap) ? rawMaxGap : 0, 1),
    MAX_GAP_CEILING_SECONDS
  );
  const step = gapAxisStep(bounded);
  const max = Math.ceil(bounded / step) * step;
  const values: number[] = [];
  for (
    let value = 0;
    value <= max && values.length <= MAX_GRIDLINES;
    value += step
  ) {
    values.push(value);
  }
  return { max, step, values };
};

/**
 * Lap numbers to label, at most `maxLabels` of them, always including the
 * first and never overlapping.
 */
export const lapAxisLabels = (
  minLap: number,
  maxLap: number,
  maxLabels: number
): number[] => {
  const total = maxLap - minLap + 1;
  if (total <= 1) return [minLap];
  const limit = Math.max(2, maxLabels);
  const step = Math.max(1, Math.ceil(total / limit));
  const labels: number[] = [];
  for (let lap = minLap; lap <= maxLap; lap += step) labels.push(lap);
  if (labels[labels.length - 1] !== maxLap) labels.push(maxLap);
  return labels;
};

/**
 * How many lap labels fit across a plot of this width, given roughly how wide
 * one label renders. Never returns fewer than 2.
 */
export const lapLabelCapacity = (
  plotWidth: number,
  approxLabelWidth: number
): number => Math.max(2, Math.floor(plotWidth / Math.max(1, approxLabelWidth)));

/** A y axis that can span negative values, used by trace mode. */
export interface LinearAxis {
  min: number;
  max: number;
  step: number;
  values: number[];
}

const LADDER = [1, 2, 2.5, 5];

/**
 * Smallest 1/2/2.5/5 x 10^n step that keeps the gridline count within
 * MAX_GRIDLINES. Returned steps are always positive.
 */
export const niceStep = (range: number, maxLines = MAX_GRIDLINES): number => {
  const span = Number.isFinite(range) ? Math.abs(range) : 0;
  const lines = Math.max(1, maxLines);
  if (span <= 0) return 1;
  const rough = span / lines;
  const magnitude = Math.pow(10, Math.floor(Math.log10(rough)));
  for (const factor of LADDER) {
    const step = factor * magnitude;
    if (span / step <= lines) return step;
  }
  return 10 * magnitude;
};

/**
 * Builds a y axis over an arbitrary range, snapped outwards to whole steps.
 * A flat series still gets a usable axis rather than a zero-height one.
 */
export const buildLinearAxis = (
  rawMin: number,
  rawMax: number,
  maxLines = MAX_GRIDLINES
): LinearAxis => {
  let low = Number.isFinite(rawMin) ? rawMin : 0;
  let high = Number.isFinite(rawMax) ? rawMax : 0;
  if (high < low) [low, high] = [high, low];
  if (high - low < 1e-9) {
    const pad = Math.max(1, Math.abs(high) * 0.05);
    low -= pad;
    high += pad;
  }

  const step = niceStep(high - low, maxLines);
  const min = Math.floor(low / step) * step;
  const max = Math.ceil(high / step) * step;
  const values: number[] = [];
  for (
    let value = min;
    value <= max + step / 2 && values.length <= MAX_GRIDLINES;
    value += step
  ) {
    // Re-snap so repeated addition of a fractional step does not drift.
    values.push(Math.round(value / step) * step);
  }
  return { min, max, step, values };
};

const POSITION_STEPS = [1, 2, 5, 10, 20, 25, 50, 100];

/**
 * Position axis. Always starts at 1, always steps by whole positions, and the
 * caller draws it inverted so position 1 sits at the top.
 */
export const buildPositionAxis = (rawMaxPosition: number): LinearAxis => {
  const bounded = Math.min(
    Math.max(
      Number.isFinite(rawMaxPosition) ? Math.ceil(rawMaxPosition) : 2,
      2
    ),
    999
  );
  const step =
    POSITION_STEPS.find(
      (candidate) => (bounded - 1) / candidate <= MAX_GRIDLINES
    ) ?? Math.ceil((bounded - 1) / MAX_GRIDLINES);
  const values: number[] = [];
  for (
    let value = 1;
    value <= bounded && values.length <= MAX_GRIDLINES;
    value += step
  ) {
    values.push(value);
  }
  if (values[values.length - 1] !== bounded && values.length <= MAX_GRIDLINES) {
    values.push(bounded);
  }
  return { min: 1, max: bounded, step, values };
};

/** Axis tick text. Position ticks are whole numbers; times carry a sign. */
export const formatAxisValue = (
  mode: 'trace' | 'position' | 'gap',
  value: number
): string => {
  if (mode === 'position') return String(Math.round(value));
  const rounded = Math.abs(value) < 0.05 ? 0 : value;
  const decimals = Math.abs(rounded) >= 100 ? 0 : 1;
  const text = rounded.toFixed(decimals);
  return rounded > 0 ? `+${text}` : text;
};
