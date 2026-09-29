/**
 * Track centreline geometry shared by any widget that has to place something
 * on the road — the track map, and the proximity radar's blip projection.
 *
 * Everything here works in the track drawing's own canvas space (1920x1080,
 * see tracks.json), not in metres. Callers convert with
 * `metresPerUnit = trackLengthM / totalLength`.
 *
 * The shapes mirror what tracks.json actually holds; `active` and `startFinish`
 * are read deeper than the track map needs because a radar places nothing when
 * either is missing.
 */
export interface TrackDrawing {
  active: {
    inside: string;
    outside: string;
    trackPathPoints?: { x: number; y: number }[];
    totalLength?: number;
  };
  startFinish: {
    line?: string;
    arrow?: string;
    point?: { x?: number; y?: number; length?: number } | null;
    direction?: 'clockwise' | 'anticlockwise' | null;
  };
  turns?: {
    x?: number;
    y?: number;
    content?: string;
  }[];
}

export interface TrackPathPoint {
  x: number;
  y: number;
}

/**
 * Binomial weights for a kernel of `2 * radius + 1` taps, normalised by
 * `4 ** radius` so they sum to one without a table of the wrong size for every
 * radius.
 */
const binomialWeight = (radius: number, offset: number): number =>
  binomialCoefficient(2 * radius, offset) / 4 ** radius;

const binomialCoefficient = (n: number, k: number): number => {
  let result = 1;
  for (let i = 0; i < k; i += 1) result = (result * (n - i)) / (i + 1);
  return result;
};

const SMOOTHING_PASSES = 3;

/**
 * A pass on its own moves a feature by about a third of the kernel's radius, so
 * three passes of a five-tap filter reach roughly half a kernel — close enough
 * to the measured noise for a real drawing. A coarse polyline needs more, and a
 * fixed pass count would round its corners off, so the radius is floored at one
 * point and the passes follow from it.
 */
const passesForRadius = (radius: number) =>
  Math.min(6, Math.max(SMOOTHING_PASSES, Math.ceil(radius / 2)));

/** A drawing's first and last point coincide, so the path is a closed loop. */
const isClosed = (points: readonly TrackPathPoint[]): boolean => {
  if (points.length < 2) return false;
  const last = points.length - 1;
  return points[0].x === points[last].x && points[0].y === points[last].y;
};

/**
 * A filtered copy of the path, keyed by the points array. The bundled drawings
 * outlive any number of frames but never change, so the filter runs once per
 * track. Keyed by length as well, because the kernel is sized from it: a caller
 * that passed a different length for the same array wants a differently
 * smoothed path, not the one already built. A per-length map rather than a
 * single entry so one caller's length cannot evict another's.
 */
const filteredCache = new WeakMap<
  readonly TrackPathPoint[],
  Map<number, readonly TrackPathPoint[]>
>();

/**
 * The road with the drawing's own sampling noise taken out.
 *
 * `tracks.json` is a polyline on a one-unit grid, so a road that is dead
 * straight steps sideways by a unit every few points. Interpolating those
 * points directly puts that zigzag into every position read from the path, and
 * a grid unit is about 2.5 to 3.2 m on the bundled drawings — a fifth or more of
 * a 15 m radar disc, so a car holding a steady gap visibly wanders. Measured
 * against a steady gap on a straight, the raw points put 0.37 m of p95 lateral
 * wander on a blip and 1.0 deg of p95 rotation, repeating at the 25 Hz snapshot
 * rate. The heading chord below already averages part of this away, which is why
 * the rotation reads as steadier than the position; the position is the part that
 * needed the whole path smoothed.
 *
 * The filtered path is not the one drawn. Both the radar and the track map draw
 * the drawing's own SVG road, so a blip can sit slightly off the surface it
 * should be on. The offset is bounded by the filter's own reach, a fraction of a
 * metre against a road drawn at roughly 19 px wide, and it buys a car holding
 * its line instead of hunting across it. Where a caller does draw the filtered
 * path, the two are exactly co-located.
 *
 * The kernel is sized in metres, not points. Point spacing is whatever the
 * original artwork was sampled at — the bundled drawings run 2.5 to 3.2 m
 * between points — and a coarser one would be filtered far more gently in
 * metres than the noise it needs removing, while a path a great deal coarser
 * would have its corners rounded off by a kernel meant for the finer case.
 *
 * Wrapped rather than clamped, since a drawing is a closed loop and a filter
 * that pinned the seam would put a kink in the road there.
 */
export const filteredTrackPathPoints = (
  points: readonly TrackPathPoint[],
  totalLength: number
): readonly TrackPathPoint[] => {
  // A length that is not a positive finite number, or a path too short to have
  // a direction, has no kernel to size. Handing the path back untouched leaves
  // the caller's own guards as the single place that decides a drawing is
  // unusable, instead of splitting that decision across two functions.
  if (points.length < 3 || !Number.isFinite(totalLength) || totalLength <= 0) {
    return points;
  }

  const cached = filteredCache.get(points);
  const byLength = cached?.get(totalLength);
  if (byLength) return byLength;

  const closed = isClosed(points);
  const distinct = closed ? points.length - 1 : points.length;
  const clamp = (index: number) =>
    closed
      ? ((index % distinct) + distinct) % distinct
      : Math.min(points.length - 1, Math.max(0, index));

  // The kernel has to reach the noise, so it is sized against the drawing's
  // own step. Three units is the one-unit grid the drawings are quantised to,
  // stepped once every few points.
  const unitsPerPoint = totalLength / Math.max(1, distinct);
  const radius = Math.max(
    1,
    Math.min(Math.floor(distinct / 4), Math.round(3 / unitsPerPoint))
  );
  const kernel: number[] = [];
  for (let offset = -radius; offset <= radius; offset += 1) {
    const binomial = binomialWeight(radius, offset + radius);
    kernel.push(binomial);
  }
  const kernelTotal = kernel.reduce((sum, weight) => sum + weight, 0);

  let current: readonly TrackPathPoint[] = points;
  for (let pass = 0; pass < passesForRadius(radius); pass += 1) {
    const next: TrackPathPoint[] = new Array(points.length);
    for (let index = 0; index < points.length; index += 1) {
      let x = 0;
      let y = 0;
      for (let offset = -radius; offset <= radius; offset += 1) {
        const weight = kernel[offset + radius];
        const sample = current[clamp(index + offset)];
        x += sample.x * weight;
        y += sample.y * weight;
      }
      next[index] = { x: x / kernelTotal, y: y / kernelTotal };
    }
    current = next;
  }

  if (cached) cached.set(totalLength, current);
  else filteredCache.set(points, new Map([[totalLength, current]]));
  return current;
};

/**
 * Lap distance fraction space into path-point float-index space, applying the
 * start/finish offset and the track's running direction. Shared by the point
 * lookup and the tangent lookup so a blip and its heading always agree.
 */
const progressToFloatIndex = (
  progress: number,
  trackPathPoints: readonly TrackPathPoint[],
  totalLength: number,
  intersectionLength: number,
  direction: 'clockwise' | 'anticlockwise' | null | undefined
): number => {
  const adjustedLength = (totalLength * progress) % totalLength;
  const length =
    direction === 'anticlockwise'
      ? (intersectionLength + adjustedLength) % totalLength
      : (intersectionLength - adjustedLength + totalLength) % totalLength;
  return (length / totalLength) * (trackPathPoints.length - 1);
};

export const progressToTrackPoint = (
  progress: number,
  trackPathPoints: readonly TrackPathPoint[],
  totalLength: number,
  intersectionLength: number,
  direction: 'clockwise' | 'anticlockwise' | null | undefined,
  output: { x: number; y: number }
) => {
  const floatIndex = progressToFloatIndex(
    progress,
    trackPathPoints,
    totalLength,
    intersectionLength,
    direction
  );
  const index1 = Math.floor(floatIndex);
  const index2 = Math.min(index1 + 1, trackPathPoints.length - 1);
  const amount = floatIndex - index1;
  const point1 = trackPathPoints[index1];
  const point2 = trackPathPoints[index2];
  output.x = point1.x + (point2.x - point1.x) * amount;
  output.y = point1.y + (point2.y - point1.y) * amount;
};

/**
 * How much of the road a heading is measured over, in canvas units.
 *
 * The drawings are polylines on a one-unit grid, so a heading taken across a
 * neighbouring pair of points measures the grid rather than the road: on a
 * straight that is a zigzag of about ±18 degrees, and it is what made blips
 * rotate in steps and twitch from side to side. A chord of about this length
 * averages the grid away — and because the chord is centred on the point asked
 * about, it still reports the heading of the road there, even through a
 * corner, where a chord over an arc gives the tangent at the arc's midpoint.
 */
const HEADING_BASELINE_UNITS = 50;

/**
 * A half-chord in path points for each drawing, and the headings themselves.
 * Keyed by the points array, which comes from the bundled track data and so
 * outlives any number of frames but never changes.
 */
const headingCache = new WeakMap<readonly TrackPathPoint[], Float64Array>();

const smoothedHeadings = (
  trackPathPoints: readonly TrackPathPoint[],
  totalLength: number
): Float64Array => {
  const cached = headingCache.get(trackPathPoints);
  if (cached) return cached;

  const last = trackPathPoints.length - 1;
  const closed =
    trackPathPoints[0].x === trackPathPoints[last].x &&
    trackPathPoints[0].y === trackPathPoints[last].y;
  const distinct = closed ? last : trackPathPoints.length;
  // One point per this many units, so the same stretch of road is measured on
  // a coarse drawing and a dense one.
  const unitsPerPoint =
    totalLength > 0 ? totalLength / Math.max(1, distinct - 1) : 0;
  const half =
    unitsPerPoint > 0
      ? Math.max(1, Math.round(HEADING_BASELINE_UNITS / (2 * unitsPerPoint)))
      : 1;

  const clamp = (index: number) =>
    closed
      ? ((index % distinct) + distinct) % distinct
      : Math.min(last, Math.max(0, index));

  const headings = new Float64Array(trackPathPoints.length).fill(NaN);
  for (let index = 0; index < trackPathPoints.length; index += 1) {
    const before = trackPathPoints[clamp(index - half)];
    const after = trackPathPoints[clamp(index + half)];
    const dx = after.x - before.x;
    const dy = after.y - before.y;
    if (dx !== 0 || dy !== 0) headings[index] = Math.atan2(dy, dx);
  }

  headingCache.set(trackPathPoints, headings);
  return headings;
};

/**
 * Direction of the road at a lap distance fraction, in canvas-space radians.
 *
 * Uses neighbouring path points rather than the segment the point sits on, so
 * consecutive cars get a stable heading instead of flipping between segments
 * at the vertex they straddle. Null when the fraction is off the path or the
 * two neighbours coincide.
 *
 * The heading is interpolated between the two vertices the fraction sits
 * between, exactly as `progressToTrackPoint` interpolates the position. Taking
 * the nearest vertex instead quantises the heading to the path's own spacing
 * (a few metres), and a heading that steps while the position glides is what
 * reads as a car steering itself twenty times a second — the blip's rotation,
 * and, through the right vector its lateral offset is projected onto, its
 * side-to-side position as well.
 */
export const tangentAngleAt = (
  progress: number,
  trackPathPoints: readonly TrackPathPoint[],
  totalLength: number,
  intersectionLength: number,
  direction: 'clockwise' | 'anticlockwise' | null | undefined
): number | null => {
  if (trackPathPoints.length < 3 || totalLength <= 0) return null;
  const floatIndex = progressToFloatIndex(
    progress,
    trackPathPoints,
    totalLength,
    intersectionLength,
    direction
  );
  if (!Number.isFinite(floatIndex) || floatIndex < 0) return null;

  const headings = smoothedHeadings(trackPathPoints, totalLength);
  const last = trackPathPoints.length - 1;
  const index = Math.floor(floatIndex);
  const amount = floatIndex - index;
  const here = headings[index];
  if (Number.isNaN(here)) return null;
  const next = headings[Math.min(last, index + 1)];
  if (Number.isNaN(next) || amount === 0) return here;

  // Shortest way round, so a heading either side of ±pi does not swing the
  // long way through the opposite direction.
  const delta = Math.atan2(Math.sin(next - here), Math.cos(next - here));
  return here + delta * amount;
};
