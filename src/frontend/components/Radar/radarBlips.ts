import {
  filteredTrackPathPoints,
  progressToTrackPoint,
  tangentAngleAt,
  type TrackDrawing,
} from '@irdashies/domain/trackGeometry';
import {
  alongsideWindowM,
  assignOverlapSides,
  retainSideWindowM,
  rimSignalWindowM,
  type OverlapSide,
  type RadarOverlap,
} from './overlapSides';
import { MAX_RADAR_RANGE_M } from './radarFade';

export interface RadarBlip {
  carIdx: number;
  /** Metres along the road; positive is ahead of the player. */
  alongM: number;
  /**
   * Metres to the driver's right of the centreline, negative to the left, as
   * projected from the car's position on the track. Zero for a car running
   * abreast, because the SDK publishes no lateral offset for one: it snaps onto
   * the player's own point of the centreline.
   */
  lateralM: number;
  /**
   * Where the body is actually drawn: the projection, moved aside when the sim
   * reports the car alongside and the projection would put it on the player.
   *
   * This is what the widget interpolates and paints. `lateralM` stays the real
   * measurement, because the sideways motion between snapshots is the car's own
   * and not the sim's verdict — feeding the placed offset back as the next
   * snapshot's target would walk the car further out on every frame.
   */
  drawLateralM: number;
  /**
   * Road heading at this car relative to the player's, radians in (-PI, PI].
   * Both are measured against the same centreline, so the track's running
   * direction cancels out.
   */
  relYaw: number;
  /**
   * Fore/aft gap in metres; the show-when-nearby gate reads the nearest one.
   */
  gapM: number;
  /** Set when the sim reports this car directly alongside. */
  side: OverlapSide | null;
  /** Rim indicator driven by the sim side, or both when it is silent. */
  rimSignal: 'left' | 'right' | 'both' | null;
  color?: string | null;
  /** Car number for the blip label; null when the session has none. */
  carNumber: string | null;
  /** Set when this is the session's pace car, which carries a fixed label. */
  isPaceCar: boolean;
}

/**
 * What the widget must carry from one frame to the next, per car, as two
 * arrays indexed by car index. Car indices are dense and small, so this is
 * the shape the data already has; a map keyed by the same indices allocated a
 * hash table and an object per car on every snapshot. 0 is "none" in both.
 *
 * The caller owns the storage, keeps two sets and alternates between them, and
 * drops both when the session, track or field size changes: car indices are
 * re-used between sessions, so carried-over state would belong to other cars.
 */
export interface RadarTargetState {
  /** Which side the car was last drawn on: -1 its left, 1 its right, 0 none. */
  side: Int8Array;
  /**
   * The direction the car was last drawn in: -1 behind, 1 ahead, 0 never drawn.
   * A car running abreast oscillates about the player's lap fraction, so the
   * sign of its measured offset hops between frames; the radar holds the side
   * it first drew the car on instead of letting it flicker.
   */
  alongSign: Int8Array;
}

/** A zeroed target state for a field of `carCount` cars. */
export const emptyTargetState = (carCount: number): RadarTargetState => ({
  side: new Int8Array(carCount),
  alongSign: new Int8Array(carCount),
});

export interface RadarBlipResult {
  /**
   * The track centreline is usable. False means positions cannot be projected
   * onto the road at all — the widget has nothing to draw, exactly as the
   * track map draws nothing for a track without path points.
   */
  hasGeometry: boolean;
  /** The focus car has a usable position; false blanks the radar. */
  playerOnRoad: boolean;
  blips: RadarBlip[];
  /**
   * This frame's state, to alternate with `previousTargets` next frame. This
   * is the buffer the caller passed as `nextTargets`, filled in place.
   */
  targets: RadarTargetState;
  /** Number of valid `(alongM, lateralM)` pairs written to the map buffer. */
  followingMapPointCount: number;
  /** Player frame in the track drawing space, for the original SVG path. */
  followingMapCameraPlayerX: number;
  followingMapCameraPlayerY: number;
  followingMapCameraForwardX: number;
  followingMapCameraForwardY: number;
  followingMapCameraRightX: number;
  followingMapCameraRightY: number;
  followingMapUnitsPerMetre: number;
}

export interface RadarBlipInput {
  carIdxLapDistPct: readonly number[];
  carIdxOnPitRoad: readonly boolean[];
  playerCarIdx: number | null;
  trackDrawing: TrackDrawing | undefined;
  /** Track length in metres; from the session's WeekendInfo.TrackLength. */
  trackLengthM: number;
  radarRange: number;
  hideInPit: boolean;
  /** The sim's own side-overlap verdict, for placing cars running abreast. */
  overlap: RadarOverlap;
  vehicleWidth: number;
  vehicleLength: number;
  /** Car number by CarIdx, for blip labels. */
  carNumbers: ReadonlyMap<number, string>;
  /** Resolved class or badge colour by CarIdx, when available. */
  carColors?: ReadonlyMap<number, string>;
  /**
   * The pace car's CarIdx as the driver roster flags it, or null when no
   * driver is flagged CarIsPaceCar.
   */
  paceCarIdx: number | null;
  /**
   * State carried over from the previous frame; the caller owns it and
   * alternates it with `nextTargets`.
   */
  previousTargets: RadarTargetState;
  /**
   * Caller-owned storage this frame's state is written into. It is cleared
   * here, so it must not be the same object as `previousTargets`, and it must
   * be at least as long as `carIdxLapDistPct`.
   */
  nextTargets: RadarTargetState;
  /** Caller-owned storage for the road path's `(alongM, lateralM)` pairs. */
  followingMapBuffer: Float64Array;
}

const EMPTY_TARGETS: RadarTargetState = emptyTargetState(0);

/**
 * Camera fields for a result that draws nothing. The units are identity so a
 * caller reading them without checking `hasGeometry` still gets finite values.
 */
const ZERO_CAMERA = {
  followingMapCameraPlayerX: 0,
  followingMapCameraPlayerY: 0,
  followingMapCameraForwardX: 1,
  followingMapCameraForwardY: 0,
  followingMapCameraRightX: 0,
  followingMapCameraRightY: 1,
  followingMapUnitsPerMetre: 1,
};

const NO_GEOMETRY: RadarBlipResult = {
  hasGeometry: false,
  playerOnRoad: false,
  blips: [],
  targets: EMPTY_TARGETS,
  followingMapPointCount: 0,
  ...ZERO_CAMERA,
};

/** Geometry exists, but the focus car is off the road: nothing to draw. */
const NOT_ON_ROAD: RadarBlipResult = {
  hasGeometry: true,
  playerOnRoad: false,
  blips: [],
  targets: EMPTY_TARGETS,
  followingMapPointCount: 0,
  ...ZERO_CAMERA,
};

/**
 * Scratch points the projection writes into, reused across calls. They are
 * filled by `progressToTrackPoint` and read back inside this one function,
 * which is synchronous and re-enters nothing, so two objects per call were
 * two objects the collector had to deal with 25 times a second for nothing.
 */
const playerPoint = { x: 0, y: 0 };
const carPoint = { x: 0, y: 0 };

/**
 * A frame that draws nothing, as a result built in the caller's output buffer.
 *
 * `nextTargets` was cleared before the geometry checks, so its returned state
 * is empty without mutating `previousTargets`. The caller can promote this
 * output only if the render commits.
 */
const nothingToDraw = (
  template: RadarBlipResult,
  nextTargets: RadarTargetState
): RadarBlipResult => ({ ...template, targets: nextTargets });

/** Metres between centreline samples in the following-car map. */
export const MAP_SAMPLE_M = 1;

const wrap01 = (value: number): number => ((value % 1) + 1) % 1;

/**
 * How far to the side an abreast car is drawn, in car widths. Just over one
 * width keeps it clear of the player's own rectangle.
 */
const ABREAST_LATERAL_FACTOR = 1.1;

/**
 * A sub-car-length latch. Measured on a replayed race, cars within a couple of
 * metres of the player oscillate ±0.5 m frame to frame, which flips the
 * ahead/behind sign; a real pass still sweeps through the latch.
 */
export const LONGITUDINAL_LATCH_M = 1;

/**
 * Holds a car on the side it was last drawn on while its measured offset sits
 * inside the latch: an oscillation about the player must not flip ahead/behind
 * frame to frame. Beyond the latch the measured along-track offset is passed
 * through untouched, so a genuine pass still crosses the axis.
 */
export const latchAlongSide = (
  alongM: number,
  previousSign: number,
  latchM: number
): number =>
  previousSign !== 0 &&
  Math.abs(alongM) <= latchM &&
  Math.sign(alongM) !== previousSign
    ? previousSign * Math.abs(alongM)
    : alongM;
const onRoad = (pct: number | undefined): pct is number =>
  typeof pct === 'number' && Number.isFinite(pct) && pct >= 0;

/** The fixed blip tag for the pace car; its number (0) is meaningless. */
export const PACE_CAR_LABEL = 'PACE';

/**
 * Blip text, or null when labels are off. The pace car is labelled with the
 * fixed tag rather than its number: the number is '0' and there is no
 * AbbrevName for it.
 */
export const blipLabel = (
  blip: { carNumber: string | null; isPaceCar: boolean },
  showLabels: boolean
): string | null => {
  if (!showLabels) return null;
  return blip.isPaceCar ? PACE_CAR_LABEL : blip.carNumber;
};

/**
 * Places nearby cars on the road as the player sees it: metres ahead/behind
 * from lap distance, and metres left/right from the centreline's own shape.
 *
 * The SDK publishes no per-car world position, so a car's lateral offset is
 * the centreline offset between its point and the player's — two cars side by
 * side on the same part of the road project onto each other. What the lateral
 * term does carry is how much the road bends between the two cars, which is
 * what curves a blip off the vertical axis in a corner. A car the sim reports
 * directly alongside is the exception: it is pinned to its side instead.
 */
export const computeRadarBlips = (input: RadarBlipInput): RadarBlipResult => {
  const {
    carIdxLapDistPct: positions,
    carIdxOnPitRoad,
    playerCarIdx,
    trackDrawing,
    trackLengthM,
    radarRange,
    hideInPit,
    overlap,
    vehicleWidth,
    vehicleLength,
    carNumbers,
    carColors,
    paceCarIdx,
    previousTargets,
    nextTargets,
    followingMapBuffer,
  } = input;

  // The output buffer must hold this frame's state and nothing else. A car
  // that has left the radar has to lose its entry: with a map that happened for
  // free on every frame, and here it is the difference between a car that comes
  // back still latched to the side it left on and one that adopts where it
  // actually is now.
  nextTargets.side.fill(0);
  nextTargets.alongSign.fill(0);
  const safeRadarRange = Number.isFinite(radarRange)
    ? Math.max(0, Math.min(radarRange, MAX_RADAR_RANGE_M))
    : 0;

  const trackPathPoints = trackDrawing?.active?.trackPathPoints;
  const totalLength = trackDrawing?.active?.totalLength;
  const intersectionLength = trackDrawing?.startFinish?.point?.length;
  const direction = trackDrawing?.startFinish?.direction;

  if (
    !trackPathPoints ||
    !totalLength ||
    intersectionLength === undefined ||
    !Number.isFinite(trackLengthM) ||
    trackLengthM <= 0 ||
    trackPathPoints.length < 3
  ) {
    return nothingToDraw(NO_GEOMETRY, nextTargets);
  }

  // Every position and heading below is read from the filtered road, not the
  // drawing's raw points. The raw polyline is quantised to a one-unit grid, and
  // a lateral offset taken between two points on it carries that grid's
  // zigzag: measured against a steady gap on a straight, the raw points put up
  // to half a metre of wander on a blip, which is most of a car width at the
  // widget's default scale, and it repeats at the 25 Hz snapshot rate. The road
  // this draws on is the drawing's own SVG, which is not filtered, so the
  // filtered blip can sit a fraction of a metre off it — well inside the
  // stroked width, and a fair trade for a car that holds its line.
  const pathPoints = filteredTrackPathPoints(trackPathPoints, totalLength);

  const playerPct = playerCarIdx === null ? undefined : positions[playerCarIdx];
  if (playerCarIdx === null || !onRoad(playerPct)) {
    return nothingToDraw(NOT_ON_ROAD, nextTargets);
  }

  const playerTangent = tangentAngleAt(
    playerPct,
    pathPoints,
    totalLength,
    intersectionLength,
    direction
  );
  if (playerTangent === null) {
    return nothingToDraw(NOT_ON_ROAD, nextTargets);
  }

  const metresPerUnit = trackLengthM / totalLength;
  // `tangentAngleAt` follows increasing path index. On an anticlockwise track
  // that is also the direction of travel; on a clockwise track cars run the
  // other way through the same points.
  const travelFlip = direction === 'anticlockwise' ? 0 : Math.PI;
  const rightX = -Math.sin(playerTangent + travelFlip);
  const rightY = Math.cos(playerTangent + travelFlip);

  progressToTrackPoint(
    playerPct,
    pathPoints,
    totalLength,
    intersectionLength,
    direction,
    playerPoint
  );

  const followingMapWindowM = safeRadarRange * 3;
  const halfMapWindowM = followingMapWindowM / 2;
  // The map and blips are projected sequentially, so one scratch point is
  // enough for both and the road path itself adds no per-frame allocation.
  let followingMapPointCount = 0;
  for (
    let alongM = -halfMapWindowM;
    alongM <= halfMapWindowM;
    alongM += MAP_SAMPLE_M
  ) {
    const progress = wrap01(playerPct + alongM / trackLengthM);
    progressToTrackPoint(
      progress,
      pathPoints,
      totalLength,
      intersectionLength,
      direction,
      carPoint
    );
    const offset = followingMapPointCount * 2;
    followingMapBuffer[offset] = alongM;
    followingMapBuffer[offset + 1] =
      ((carPoint.x - playerPoint.x) * rightX +
        (carPoint.y - playerPoint.y) * rightY) *
      metresPerUnit;
    followingMapPointCount += 1;
  }

  const blips: RadarBlip[] = [];

  for (let carIdx = 0; carIdx < positions.length; carIdx += 1) {
    if (carIdx === playerCarIdx) continue;
    const pct = positions[carIdx];
    if (!onRoad(pct)) continue;

    const inPit = carIdxOnPitRoad[carIdx] === true;
    if (hideInPit && inPit) continue;

    let delta = pct - playerPct;
    if (delta > 0.5) delta -= 1;
    else if (delta < -0.5) delta += 1;
    const rawAlongM = delta * trackLengthM;
    if (Math.abs(rawAlongM) > safeRadarRange) continue;
    // A car abreast oscillates about the player's lap fraction; hold it on the
    // side it was drawn on while the offset is inside the latch. The range
    // test deliberately ran on the raw value, so a latched car near the edge
    // is not dropped.
    const previousSign = previousTargets.alongSign[carIdx];
    const alongM = latchAlongSide(
      rawAlongM,
      previousSign,
      LONGITUDINAL_LATCH_M
    );

    progressToTrackPoint(
      pct,
      pathPoints,
      totalLength,
      intersectionLength,
      direction,
      carPoint
    );
    const lateralM =
      ((carPoint.x - playerPoint.x) * rightX +
        (carPoint.y - playerPoint.y) * rightY) *
      metresPerUnit;

    const carTangent = tangentAngleAt(
      pct,
      pathPoints,
      totalLength,
      intersectionLength,
      direction
    );
    const relYaw =
      carTangent === null
        ? 0
        : Math.atan2(
            Math.sin(carTangent - playerTangent),
            Math.cos(carTangent - playerTangent)
          );

    blips.push({
      carIdx,
      alongM,
      lateralM,
      drawLateralM: lateralM,
      relYaw,
      gapM: Math.abs(alongM),
      side: null,
      rimSignal: null,
      carNumber: carNumbers.get(carIdx) ?? null,
      color: carColors?.get(carIdx) ?? null,
      isPaceCar: carIdx === paceCarIdx,
    });
  }

  // A car running abreast projects onto the player's own point of the
  // centreline — the SDK publishes no lateral offset — so without this it would
  // be drawn on top of the player's rectangle. The sim's own side verdict puts
  // it to one side instead.
  //
  // The sides go straight into the caller's buffer, which this frame's state
  // is built in: one array serves as both the result and the record for the
  // next frame, so no side map is allocated at all. The buffer was zeroed at
  // the top of the call, so only the cars given a side appear in it.
  assignOverlapSides({
    blips,
    overlap,
    vehicleLength,
    previousSides: previousTargets.side,
    sides: nextTargets.side,
  });

  // The offset is full while the verdict covers the car, so a genuine overlap
  // reads at its real width; it fades out only in the retained tail, where the
  // verdict has gone but the car keeps its side for a few frames longer. It
  // lands on drawLateralM only: lateralM is what the road actually reports, and
  // the widget interpolates from it.
  const abeam = alongsideWindowM(vehicleLength);
  const retain = retainSideWindowM(vehicleLength);
  const fadeSpan = Math.max(1e-6, retain - abeam);

  const closeM = rimSignalWindowM(vehicleLength);
  for (const blip of blips) {
    const sideValue = nextTargets.side[blip.carIdx];
    const side = sideValue === 0 ? null : (sideValue as OverlapSide);
    blip.side = side;
    if (side !== null) {
      const closeness =
        blip.gapM <= abeam
          ? 1
          : Math.max(0, 1 - (blip.gapM - abeam) / fadeSpan);
      blip.drawLateralM =
        side * vehicleWidth * ABREAST_LATERAL_FACTOR * closeness;
    }
    if (blip.gapM <= closeM) {
      blip.rimSignal = side === null ? 'both' : side === -1 ? 'left' : 'right';
    }

    // A car with no history adopts its geometric sign, so a car entering the
    // range is unaffected by the latch until it has been drawn once.
    nextTargets.alongSign[blip.carIdx] =
      Math.sign(blip.alongM) || previousTargets.alongSign[blip.carIdx];
  }

  return {
    hasGeometry: true,
    playerOnRoad: true,
    blips,
    targets: nextTargets,
    followingMapPointCount,
    followingMapCameraPlayerX: playerPoint.x,
    followingMapCameraPlayerY: playerPoint.y,
    followingMapCameraForwardX: rightY,
    followingMapCameraForwardY: -rightX,
    followingMapCameraRightX: rightX,
    followingMapCameraRightY: rightY,
    followingMapUnitsPerMetre: totalLength / trackLengthM,
  };
};
