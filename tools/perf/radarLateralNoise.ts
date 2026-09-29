/**
 * Why: the third review comment on the radar PR asks whether projecting the
 * sampled centreline is what makes blips wobble side to side. The display
 * already treats the track polyline as noisy — `drawFollowingRoad` runs a
 * binomial B-spline filter over it because it "can contain one-pixel-scale
 * reversals" — but car positions are placed from the raw points, with the
 * comment "car positions are not filtered and remain exactly where the radar
 * placed them".
 *
 * That filtered road is the honest reference: it is the same road, with the
 * sampling noise taken out and the real shape kept. Placing a car a fixed gap
 * ahead through both geometries and differencing the lateral answers measures
 * exactly what the raw polyline adds, at the rate the processor actually
 * samples it.
 *
 * Run: npx tsx tools/perf/radarLateralNoise.ts
 */
import tracks from '../../src/frontend/assets/data/tracks.json';
import {
  filteredTrackPathPoints,
  progressToTrackPoint,
  tangentAngleAt,
} from '../../src/frontend/domain/trackGeometry';
import type {
  TrackDrawing,
  TrackPathPoint,
} from '../../src/frontend/domain/trackGeometry';
import brandsSession from '../../test-data/1731663749009/session.json';
import interlagosSession from '../../test-data/1747384033336/session.json';
import watkinsSession from '../../test-data/1781323503005/session.json';

interface SessionFixture {
  WeekendInfo: { TrackID: number; TrackLength: string };
}

const trackLengthOf = (session: SessionFixture) => {
  const match = /([\d.]+)\s*(km|mi)?/.exec(session.WeekendInfo.TrackLength);
  if (!match) throw new Error('fixture has no parsable track length');
  if (match[2] === 'km') return Number(match[1]) * 1000;
  if (match[2] === 'mi') return Number(match[1]) * 1609.344;
  return Number(match[1]);
};

const trackDrawings = tracks as unknown as Record<
  number,
  TrackDrawing | undefined
>;

/**
 * The reference: the same polyline with a much deeper filter than the one the
 * widget ships, so it is closer to the road the drawing is trying to describe
 * than to the drawing itself. A three-pass kernel is enough for the shipped
 * filter; a sixteen-pass one stands in for the true centreline.
 */
const deepSmooth = (
  points: readonly TrackPathPoint[],
  totalLength: number,
  passes: number
): readonly TrackPathPoint[] => {
  const distinct = points.length - 1;
  const unitsPerPoint = totalLength / distinct;
  const radius = Math.max(
    1,
    Math.min(Math.floor(distinct / 4), Math.round(3 / unitsPerPoint))
  );
  const choose = (n: number, k: number) => {
    let result = 1;
    for (let i = 0; i < k; i += 1) result = (result * (n - i)) / (i + 1);
    return result;
  };
  const kernel: number[] = [];
  for (let k = 0; k <= 2 * radius; k += 1) {
    kernel.push(choose(2 * radius, k) / 4 ** radius);
  }
  const kernelTotal = kernel.reduce((sum, weight) => sum + weight, 0);
  const clamp = (index: number) => ((index % distinct) + distinct) % distinct;
  let current: readonly TrackPathPoint[] = points;
  for (let pass = 0; pass < passes; pass += 1) {
    const next: TrackPathPoint[] = new Array(points.length);
    for (let index = 0; index < points.length; index += 1) {
      let x = 0;
      let y = 0;
      for (let k = 0; k < kernel.length; k += 1) {
        const sample = current[clamp(index + k - radius)];
        x += sample.x * kernel[k];
        y += sample.y * kernel[k];
      }
      next[index] = { x: x / kernelTotal, y: y / kernelTotal };
    }
    current = next;
  }
  return current;
};

const measure = (name: string, session: SessionFixture, speedMs: number) => {
  const drawing = trackDrawings[session.WeekendInfo.TrackID];
  const pts = drawing?.active?.trackPathPoints;
  const totalLength = drawing?.active?.totalLength;
  const intersectionLength = drawing?.startFinish?.point?.length;
  const direction = drawing?.startFinish?.direction;
  if (!pts || !totalLength || intersectionLength === undefined) {
    console.log(`${name}: no drawing (track ${session.WeekendInfo.TrackID})`);
    return;
  }

  const trackLengthM = trackLengthOf(session);
  const metresPerUnit = trackLengthM / totalLength;
  const travelFlip = direction === 'anticlockwise' ? 0 : Math.PI;
  const shippedPts = filteredTrackPathPoints(pts, totalLength);
  const referencePts = deepSmooth(pts, totalLength, 16);
  const point = { x: 0, y: 0 };

  const gapM = 20;
  const stepM = speedMs / 25; // one snapshot at the processor's 25 Hz
  const error: number[] = [];
  const headingError: number[] = [];
  const rawStepFor: number[] = [];
  const filteredStepFor: number[] = [];
  const referenceStepFor: number[] = [];
  const rawError: number[] = [];
  const rawHeadingError: number[] = [];
  let previousRawHeading: number | null = null;
  let previousSmoothHeading: number | null = null;
  let previousUnfilteredHeading: number | null = null;

  const headingAt = (
    pct: number,
    source: readonly TrackPathPoint[]
  ): number | null =>
    tangentAngleAt(pct, source, totalLength, intersectionLength, direction);

  for (let alongM = 0; alongM < trackLengthM; alongM += stepM) {
    const playerPct = alongM / trackLengthM;
    const carPct = (playerPct + gapM / trackLengthM) % 1;
    const rawHeading = headingAt(playerPct, shippedPts);
    const smoothHeading = headingAt(playerPct, referencePts);
    if (rawHeading === null || smoothHeading === null) continue;

    const rightX = -Math.sin(rawHeading + travelFlip);
    const rightY = Math.cos(rawHeading + travelFlip);
    progressToTrackPoint(
      playerPct,
      shippedPts,
      totalLength,
      intersectionLength,
      direction,
      point
    );
    const playerX = point.x;
    const playerY = point.y;
    progressToTrackPoint(
      carPct,
      shippedPts,
      totalLength,
      intersectionLength,
      direction,
      point
    );
    const rawLateral =
      ((point.x - playerX) * rightX + (point.y - playerY) * rightY) *
      metresPerUnit;

    const smoothRightX = -Math.sin(smoothHeading + travelFlip);
    const smoothRightY = Math.cos(smoothHeading + travelFlip);
    progressToTrackPoint(
      playerPct,
      referencePts,
      totalLength,
      intersectionLength,
      direction,
      point
    );
    const smoothPlayerX = point.x;
    const smoothPlayerY = point.y;
    progressToTrackPoint(
      carPct,
      referencePts,
      totalLength,
      intersectionLength,
      direction,
      point
    );
    const smoothLateral =
      ((point.x - smoothPlayerX) * smoothRightX +
        (point.y - smoothPlayerY) * smoothRightY) *
      metresPerUnit;

    error.push(rawLateral - smoothLateral);

    // The same measurement through the drawing's raw points, which is what the
    // widget used before the filter, so the two are directly comparable.
    const unfilteredHeading = headingAt(playerPct, pts);
    if (unfilteredHeading !== null) {
      const unfilteredRightX = -Math.sin(unfilteredHeading + travelFlip);
      const unfilteredRightY = Math.cos(unfilteredHeading + travelFlip);
      progressToTrackPoint(
        playerPct,
        pts,
        totalLength,
        intersectionLength,
        direction,
        point
      );
      const unfilteredPlayerX = point.x;
      const unfilteredPlayerY = point.y;
      progressToTrackPoint(
        carPct,
        pts,
        totalLength,
        intersectionLength,
        direction,
        point
      );
      rawError.push(
        ((point.x - unfilteredPlayerX) * unfilteredRightX +
          (point.y - unfilteredPlayerY) * unfilteredRightY) *
          metresPerUnit -
          smoothLateral
      );
    } else {
      rawError.push(0);
    }

    // A step in the raw heading that the smooth one does not have is the blip
    // rotating on grid noise rather than on the road. The first sample has no
    // step, so both arrays carry a placeholder to stay index-aligned.
    const stepBetween = (a: number, b: number) =>
      Math.abs(Math.atan2(Math.sin(a - b), Math.cos(a - b)));
    const referenceStep =
      previousSmoothHeading === null
        ? 0
        : stepBetween(smoothHeading, previousSmoothHeading);
    const filteredStep =
      previousRawHeading === null
        ? 0
        : stepBetween(rawHeading, previousRawHeading);
    const unfilteredStep =
      previousUnfilteredHeading === null || unfilteredHeading === null
        ? 0
        : stepBetween(unfilteredHeading, previousUnfilteredHeading);

    headingError.push(filteredStep - referenceStep);
    filteredStepFor.push(filteredStep);
    referenceStepFor.push(referenceStep);
    rawHeadingError.push(unfilteredStep - referenceStep);
    rawStepFor.push(unfilteredStep);

    previousRawHeading = rawHeading;
    previousSmoothHeading = smoothHeading;
    previousUnfilteredHeading = unfilteredHeading;
  }

  const abs = (values: number[]) => values.map(Math.abs);
  const pct = (values: number[], p: number) => {
    if (values.length === 0) return 0;
    const sorted = [...values].sort((a, b) => a - b);
    return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * p))];
  };
  const worst = (values: number[]) => (values.length ? Math.max(...values) : 0);
  const deg = (radians: number) => (radians * 57.2958).toFixed(3);

  // A stretch the reference says is straight cannot be argued with, so the
  // reviewer\'s replay is measured there: anything either path adds is wobble.
  const isStraight = (index: number) => referenceStepFor[index] < 0.002;
  const straightIndexes: number[] = [];
  for (let i = 0; i < error.length; i += 1) {
    if (isStraight(i)) straightIndexes.push(i);
  }
  const straightShare = (straightIndexes.length / error.length) * 100;

  const line = (
    label: string,
    lateralError: number[],
    headingError: number[],
    stepFor: number[]
  ) => {
    const onStraight = straightIndexes.map((index) => lateralError[index]);
    const rotation = straightIndexes.map((index) => stepFor[index]);
    return (
      `  ${label}\n` +
      `    lateral vs reference: p50 ${pct(abs(lateralError), 0.5).toFixed(3)} m` +
      `  p95 ${pct(abs(lateralError), 0.95).toFixed(3)} m` +
      `  max ${worst(abs(lateralError)).toFixed(3)} m\n` +
      `    rotation per snapshot:  p50 ${deg(pct(abs(headingError), 0.5))} deg` +
      `  p95 ${deg(pct(abs(headingError), 0.95))} deg` +
      `  max ${deg(worst(abs(headingError)))} deg\n` +
      `    on the ${straightShare.toFixed(0)}% of the lap that is straight:\n` +
      `      lateral p95 ${pct(abs(onStraight), 0.95).toFixed(3)} m` +
      `  max ${worst(abs(onStraight)).toFixed(3)} m` +
      `   rotation p95 ${deg(pct(abs(rotation), 0.95))} deg` +
      `  max ${deg(worst(abs(rotation)))} deg`
    );
  };

  console.log(
    `\n${name} — ${(trackLengthM / 1000).toFixed(2)} km, ${(speedMs * 3.6).toFixed(0)} km/h, gap 20 m`
  );
  console.log(
    line('raw drawing points', rawError, rawHeadingError, rawStepFor)
  );
  console.log(
    line('shipped filtered path', error, headingError, filteredStepFor)
  );
};

const TRACKS: [string, SessionFixture][] = [
  ['Interlagos', interlagosSession as SessionFixture],
  ['Watkins Glen', watkinsSession as SessionFixture],
  ['Brands Hatch', brandsSession as SessionFixture],
];

for (const speedMs of [70, 60, 50, 40, 30, 20]) {
  console.log(`\n========== ${(speedMs * 3.6).toFixed(0)} km/h ==========`);
  for (const [name, session] of TRACKS) measure(name, session, speedMs);
}
