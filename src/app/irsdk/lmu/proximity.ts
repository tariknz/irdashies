import { CarLeftRight } from '@irdashies/types';
import type { LmuRawTelemetry } from '../native/lmu';

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

export function deriveLmuRelativePositions(
  raw: LmuRawTelemetry
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
  const playerYaw = Math.atan2(
    raw.vehOriX[playerIdx],
    raw.vehOriZ[playerIdx]
  );
  if (![playerX, playerZ, playerYaw].every(Number.isFinite)) return null;

  const sin = Math.sin(playerYaw - Math.PI);
  const cos = Math.cos(playerYaw - Math.PI);
  const length = raw.vehTelemetryAvailable.length;
  const result: LmuRelativePositions = {
    available: Array(length).fill(false),
    lateral: Array(length).fill(0),
    longitudinal: Array(length).fill(0),
    heading: Array(length).fill(0),
  };

  for (let carIdx = 0; carIdx < length; carIdx += 1) {
    if (carIdx === playerIdx || raw.vehTelemetryAvailable[carIdx] !== 1) {
      continue;
    }

    const deltaX = raw.vehPosX[carIdx] - playerX;
    const deltaZ = -(raw.vehPosZ[carIdx] - playerZ);
    const lateral = cos * deltaX - sin * deltaZ;
    const longitudinal = cos * deltaZ + sin * deltaX;
    const heading =
      Math.atan2(raw.vehOriX[carIdx], raw.vehOriZ[carIdx]) - playerYaw;
    if (![lateral, longitudinal, heading].every(Number.isFinite)) continue;

    result.available[carIdx] = true;
    result.lateral[carIdx] = lateral;
    result.longitudinal[carIdx] = longitudinal;
    result.heading[carIdx] = heading;
  }

  return result;
}

export function classifyLmuBlindSpot(
  positions: LmuRelativePositions | null
): CarLeftRight | null {
  if (!positions) return null;

  let left = 0;
  let right = 0;
  for (let carIdx = 0; carIdx < positions.available.length; carIdx += 1) {
    if (!positions.available[carIdx]) continue;
    const lateral = positions.lateral[carIdx];
    const longitudinal = positions.longitudinal[carIdx];
    if (
      Math.abs(longitudinal) >= MAX_LONGITUDINAL_DISTANCE ||
      Math.abs(lateral) <= VEHICLE_WIDTH * 0.9 ||
      Math.abs(lateral) >= MAX_LATERAL_DISTANCE
    ) {
      continue;
    }
    if (lateral < 0) left += 1;
    else right += 1;
  }

  if (left && right) return CarLeftRight.CarLeftRight;
  if (left > 1) return CarLeftRight.Cars2Left;
  if (right > 1) return CarLeftRight.Cars2Right;
  if (left) return CarLeftRight.CarLeft;
  if (right) return CarLeftRight.CarRight;
  return CarLeftRight.Clear;
}
