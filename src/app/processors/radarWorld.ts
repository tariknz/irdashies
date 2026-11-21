import type { RadarCar } from '@irdashies/types';

export const WORLD_LANE_WIDTH_M = 2.6;
const MAX_WORLD_LANE = 4;
const STRAIGHT_OVER_ALONG_SLACK_M = 10;
const MIN_STRAIGHT_RATIO = 0.8;
const MIN_STRAIGHT_SLACK_M = 3;
const SIGN_CHECK_FROM_M = 8;

export interface RadarWorldChannels {
  available: readonly unknown[];
  lateral: readonly unknown[];
  longitudinal: readonly unknown[];
  heading: readonly unknown[];
}

export const hasWorldChannels = (channels: RadarWorldChannels): boolean =>
  channels.available.length > 0;

const finiteAt = (values: readonly unknown[], index: number): number | null => {
  const value = values[index];
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
};

export const worldLaneOf = (lateralM: number): number =>
  Math.max(
    -MAX_WORLD_LANE,
    Math.min(MAX_WORLD_LANE, lateralM / WORLD_LANE_WIDTH_M)
  );

export const applyWorldOffset = (
  car: RadarCar,
  channels: RadarWorldChannels,
  carIdx: number
): boolean => {
  if (channels.available[carIdx] !== true) return false;
  const lateral = finiteAt(channels.lateral, carIdx);
  const longitudinal = finiteAt(channels.longitudinal, carIdx);
  if (lateral === null || longitudinal === null) return false;

  const along = Math.abs(car.dist);
  const straight = Math.hypot(lateral, longitudinal);
  if (straight > along + STRAIGHT_OVER_ALONG_SLACK_M) return false;
  if (straight < along * MIN_STRAIGHT_RATIO - MIN_STRAIGHT_SLACK_M) {
    return false;
  }
  if (
    along > SIGN_CHECK_FROM_M &&
    Math.abs(longitudinal) > SIGN_CHECK_FROM_M &&
    longitudinal * car.dist < 0
  ) {
    return false;
  }

  car.dist = longitudinal;
  car.lateralM = lateral;
  car.headingRad = finiteAt(channels.heading, carIdx) ?? 0;
  car.lane = worldLaneOf(lateral);
  car.laneSource = 'world';
  return true;
};
