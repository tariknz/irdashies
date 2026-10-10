/**
 * Track centreline geometry indexed by lap progress.
 *
 * The track drawings in `tracks.json` are hand-traced SVG paths sampled on an
 * integer pixel grid. That is fine for a whole-track map, but a close-range
 * view zooms in far enough for the pixel steps to show as jitter. This module
 * resamples the path at even lap-progress intervals and smooths it, so a
 * caller can ask for the position and heading at any progress cheaply.
 */

export interface TrackPathPoint {
  x: number;
  y: number;
}

export interface TrackPathData {
  trackPathPoints: readonly TrackPathPoint[];
  /** Path length in drawing units. */
  totalLength: number;
  /** Path length at the start/finish line, in drawing units. */
  startFinishLength: number;
  direction: 'clockwise' | 'anticlockwise' | null | undefined;
}

export interface TrackGeometry {
  /** Sample coordinates; sample i sits at lap progress i / count. */
  readonly xs: Float64Array;
  readonly ys: Float64Array;
  readonly count: number;
  /** Drawing units per metre of real track, measured on the smoothed line. */
  readonly unitsPerMeter: number;
  readonly trackLength: number;
}

export interface TrackGeometryOptions {
  /** Metres between samples. */
  sampleSpacing?: number;
  /** Width of the smoothing window in metres. */
  smoothing?: number;
}

const MIN_SAMPLES = 256;
const MAX_SAMPLES = 16384;

const wrap01 = (value: number) => {
  const wrapped = value % 1;
  return wrapped < 0 ? wrapped + 1 : wrapped;
};

/**
 * Same mapping the track map uses: progress runs from the start/finish line
 * along or against the path depending on the drawing's direction.
 */
const progressToPathPoint = (
  path: TrackPathData,
  progress: number,
  output: TrackPathPoint
) => {
  const { trackPathPoints: points, totalLength } = path;
  const adjusted = totalLength * wrap01(progress);
  const length =
    path.direction === 'anticlockwise'
      ? (path.startFinishLength + adjusted) % totalLength
      : (path.startFinishLength - adjusted + totalLength) % totalLength;
  const floatIndex = (length / totalLength) * (points.length - 1);
  const index1 = Math.floor(floatIndex);
  const index2 = Math.min(index1 + 1, points.length - 1);
  const amount = floatIndex - index1;
  output.x = points[index1].x + (points[index2].x - points[index1].x) * amount;
  output.y = points[index1].y + (points[index2].y - points[index1].y) * amount;
};

/** Circular moving average, in place via a scratch buffer. */
const boxSmooth = (values: Float64Array, halfWindow: number) => {
  if (halfWindow < 1) return;
  const count = values.length;
  const source = values.slice();
  const width = halfWindow * 2 + 1;
  let sum = 0;
  for (let offset = -halfWindow; offset <= halfWindow; offset += 1) {
    sum += source[(offset + count) % count];
  }
  for (let index = 0; index < count; index += 1) {
    values[index] = sum / width;
    sum -= source[(index - halfWindow + count) % count];
    sum += source[(index + halfWindow + 1) % count];
  }
};

export const buildTrackGeometry = (
  path: TrackPathData,
  trackLength: number,
  { sampleSpacing = 2, smoothing = 16 }: TrackGeometryOptions = {}
): TrackGeometry | null => {
  if (
    path.trackPathPoints.length < 2 ||
    !(path.totalLength > 0) ||
    !(trackLength > 0)
  ) {
    return null;
  }

  const count = Math.min(
    MAX_SAMPLES,
    Math.max(MIN_SAMPLES, Math.round(trackLength / sampleSpacing))
  );
  const xs = new Float64Array(count);
  const ys = new Float64Array(count);
  const point = { x: 0, y: 0 };
  for (let index = 0; index < count; index += 1) {
    progressToPathPoint(path, index / count, point);
    xs[index] = point.x;
    ys[index] = point.y;
  }

  // Two box passes approximate a triangular kernel the width of `smoothing`.
  const metresPerSample = trackLength / count;
  const halfWindow = Math.round(smoothing / metresPerSample / 4);
  for (let pass = 0; pass < 2; pass += 1) {
    boxSmooth(xs, halfWindow);
    boxSmooth(ys, halfWindow);
  }

  let length = 0;
  for (let index = 0; index < count; index += 1) {
    const next = (index + 1) % count;
    length += Math.hypot(xs[next] - xs[index], ys[next] - ys[index]);
  }
  if (!(length > 0)) return null;

  return { xs, ys, count, unitsPerMeter: length / trackLength, trackLength };
};

/** Writes the centreline position at `progress` into `output`. */
export const pointAtProgress = (
  geometry: TrackGeometry,
  progress: number,
  output: TrackPathPoint
): TrackPathPoint => {
  const { xs, ys, count } = geometry;
  const floatIndex = wrap01(progress) * count;
  const index1 = Math.floor(floatIndex) % count;
  const index2 = (index1 + 1) % count;
  const amount = floatIndex - Math.floor(floatIndex);
  output.x = xs[index1] + (xs[index2] - xs[index1]) * amount;
  output.y = ys[index1] + (ys[index2] - ys[index1]) * amount;
  return output;
};

const behind = { x: 0, y: 0 };
const ahead = { x: 0, y: 0 };

/**
 * Writes the unit direction of travel at `progress` into `output`, measured
 * across a few metres so neighbouring samples cannot make it flicker.
 */
export const tangentAtProgress = (
  geometry: TrackGeometry,
  progress: number,
  output: TrackPathPoint,
  spanMetres = 4
): TrackPathPoint => {
  const span = spanMetres / geometry.trackLength;
  pointAtProgress(geometry, progress - span, behind);
  pointAtProgress(geometry, progress + span, ahead);
  const dx = ahead.x - behind.x;
  const dy = ahead.y - behind.y;
  const length = Math.hypot(dx, dy);
  if (length > 0) {
    output.x = dx / length;
    output.y = dy / length;
  } else {
    output.x = 0;
    output.y = -1;
  }
  return output;
};
