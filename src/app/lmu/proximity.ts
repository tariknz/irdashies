import { CarLeftRight } from '@irdashies/types';
import type { LmuRawTelemetry } from './native';

export interface LmuRelativePositions {
  available: boolean[];
  lateral: number[];
  longitudinal: number[];
  heading: number[];
}

const VEHICLE_WIDTH = 2.2;
const VEHICLE_LENGTH = 4.6;
const MAX_LATERAL_DISTANCE = VEHICLE_WIDTH * 1.9;
const MAX_LONGITUDINAL_DISTANCE = VEHICLE_LENGTH * 1.2;

/**
 * Cars further away than this in plain world distance are not computed.
 *
 * Everything downstream is about cars alongside: the classification below
 * needs |longitudinal| under 5.52 m and |lateral| under 4.18 m, and the blind
 * spot bar shows a few metres either way. 20 m is far beyond both, so the gate
 * cannot change an answer -- it only avoids rotating and taking an atan2 for
 * a car most of a straight away.
 *
 * It is tested on the squared distance so no square root is taken either.
 */
const RELEVANT_RADIUS_M = 20;
const RELEVANT_RADIUS_SQ = RELEVANT_RADIUS_M * RELEVANT_RADIUS_M;

/**
 * Reusable output buffers.
 *
 * Held by the caller across frames because this runs at the telemetry poll
 * rate: allocating four arrays per frame handed the collector ~250 arrays a
 * second for nothing. Passing a buffer makes a frame allocation-free.
 */
export const createLmuRelativePositionsBuffer = (): LmuRelativePositions => ({
  available: [],
  lateral: [],
  longitudinal: [],
  heading: [],
});

/**
 * Whether a frame carries what the relative-position maths needs.
 *
 * Separate from the maths so a caller that only wants to report the data as
 * missing -- the bridge's one-line warning -- does not have to run a whole
 * derivation and throw the result away.
 */
export function lmuRelativePositionsAvailable(raw: LmuRawTelemetry): boolean {
  const playerIdx = raw.playerHasVehicle ? raw.playerVehicleIdx : -1;
  return (
    playerIdx >= 0 &&
    raw.vehTelemetryAvailable?.[playerIdx] === 1 &&
    !!raw.vehPosX &&
    !!raw.vehPosZ &&
    !!raw.vehOriX &&
    !!raw.vehOriZ &&
    Number.isFinite(raw.vehPosX[playerIdx]) &&
    Number.isFinite(raw.vehPosZ[playerIdx])
  );
}

export function deriveLmuRelativePositions(
  raw: LmuRawTelemetry,
  /** Reused when given; a fresh buffer is allocated when it is not. */
  out: LmuRelativePositions = createLmuRelativePositionsBuffer()
): LmuRelativePositions | null {
  const playerIdx = raw.playerHasVehicle ? raw.playerVehicleIdx : -1;
  if (
    playerIdx < 0 ||
    raw.vehTelemetryAvailable?.[playerIdx] !== 1 ||
    !raw.vehPosX ||
    !raw.vehPosZ ||
    !raw.vehOriX ||
    !raw.vehOriZ
  ) {
    return null;
  }

  const playerX = raw.vehPosX[playerIdx];
  const playerZ = raw.vehPosZ[playerIdx];
  const playerYaw = Math.atan2(raw.vehOriX[playerIdx], raw.vehOriZ[playerIdx]);
  if (![playerX, playerZ, playerYaw].every(Number.isFinite)) return null;

  const sin = Math.sin(playerYaw - Math.PI);
  const cos = Math.cos(playerYaw - Math.PI);
  const length = raw.vehTelemetryAvailable.length;

  // Truncate to this frame's grid, then clear. A slot left over from a longer
  // frame would otherwise still read available.
  const { available, lateral, longitudinal, heading } = out;
  available.length = length;
  lateral.length = length;
  longitudinal.length = length;
  heading.length = length;
  available.fill(false);

  for (let carIdx = 0; carIdx < length; carIdx += 1) {
    if (carIdx === playerIdx || raw.vehTelemetryAvailable[carIdx] !== 1) {
      continue;
    }

    const deltaX = raw.vehPosX[carIdx] - playerX;
    const deltaZ = -(raw.vehPosZ[carIdx] - playerZ);
    // Cheap gate before the trig. Two multiplies and an add against a squared
    // radius, rather than a rotation and an atan2 per car per frame.
    if (deltaX * deltaX + deltaZ * deltaZ > RELEVANT_RADIUS_SQ) continue;

    const carLateral = cos * deltaX - sin * deltaZ;
    // Negated: positive is ahead.
    //
    // The rotation itself comes from TinyPedal, but that only fixes the
    // arithmetic -- it says nothing about which way the result points, and the
    // sign came out inverted against LMU. Established from a real session: a
    // car overtaking from behind drove the blind spot bar downwards when it
    // should have climbed. Consumers treat positive as ahead, so the
    // correction belongs here rather than at each of them.
    const carLongitudinal = -(cos * deltaZ + sin * deltaX);
    const carHeading =
      Math.atan2(raw.vehOriX[carIdx], raw.vehOriZ[carIdx]) - playerYaw;
    if (
      !Number.isFinite(carLateral) ||
      !Number.isFinite(carLongitudinal) ||
      !Number.isFinite(carHeading)
    ) {
      continue;
    }

    available[carIdx] = true;
    lateral[carIdx] = carLateral;
    longitudinal[carIdx] = carLongitudinal;
    heading[carIdx] = carHeading;
  }

  return out;
}

/**
 * The blind spot state, plus how far fore or aft the nearest car on each side
 * actually is.
 *
 * The offsets are the point of this. They are true metres, from world
 * positions the sim publishes at 100 Hz, so a consumer showing the car's
 * position alongside does not have to reconstruct it by subtracting
 * lap-distance percentages -- a signal quantised to whole metres by the 5 Hz
 * scoring block, which on a long circuit steps further per update than the
 * few metres such a display spans.
 *
 * Picked in the same pass as the classification, so the offsets cost nothing
 * beyond the comparison that was already being made.
 */
export interface LmuBlindSpotSummary {
  state: CarLeftRight;
  /** Fore (+) or aft (-) metres, or null when that side is clear. */
  leftLongitudinalM: number | null;
  rightLongitudinalM: number | null;
}

export function summariseLmuBlindSpot(
  positions: LmuRelativePositions | null
): LmuBlindSpotSummary | null {
  if (!positions) return null;

  let left = 0;
  let right = 0;
  let leftLongitudinalM: number | null = null;
  let rightLongitudinalM: number | null = null;
  let nearestLeft = Number.POSITIVE_INFINITY;
  let nearestRight = Number.POSITIVE_INFINITY;

  const { available, lateral, longitudinal } = positions;
  for (let carIdx = 0; carIdx < available.length; carIdx += 1) {
    if (!available[carIdx]) continue;
    const carLateral = lateral[carIdx];
    const carLongitudinal = longitudinal[carIdx];
    if (
      Math.abs(carLongitudinal) >= MAX_LONGITUDINAL_DISTANCE ||
      Math.abs(carLateral) <= VEHICLE_WIDTH * 0.9 ||
      Math.abs(carLateral) >= MAX_LATERAL_DISTANCE
    ) {
      continue;
    }
    // Nearest alongside wins the slot, which is the one a driver is about to
    // touch and the one the display is for.
    const fromAbeam = Math.abs(carLongitudinal);
    if (carLateral < 0) {
      left += 1;
      if (fromAbeam < nearestLeft) {
        nearestLeft = fromAbeam;
        leftLongitudinalM = carLongitudinal;
      }
    } else {
      right += 1;
      if (fromAbeam < nearestRight) {
        nearestRight = fromAbeam;
        rightLongitudinalM = carLongitudinal;
      }
    }
  }

  const state =
    left && right
      ? CarLeftRight.CarLeftRight
      : left > 1
        ? CarLeftRight.Cars2Left
        : right > 1
          ? CarLeftRight.Cars2Right
          : left
            ? CarLeftRight.CarLeft
            : right
              ? CarLeftRight.CarRight
              : CarLeftRight.Clear;

  return { state, leftLongitudinalM, rightLongitudinalM };
}

export function classifyLmuBlindSpot(
  positions: LmuRelativePositions | null
): CarLeftRight | null {
  return summariseLmuBlindSpot(positions)?.state ?? null;
}
