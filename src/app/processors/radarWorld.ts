import type { RadarCar } from '@irdashies/types';

export const WORLD_LANE_WIDTH_M = 2.6;
const MAX_WORLD_LANE = 4;

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

export const radarDistanceOf = (
  car: Pick<RadarCar, 'dist' | 'lateralM'>
): number =>
  car.lateralM === undefined
    ? Math.abs(car.dist)
    : Math.hypot(car.dist, car.lateralM);

export const worldRelativeSpeed = (
  carSpeed: number,
  headingRad: number,
  playerSpeed: number
): number => carSpeed * Math.cos(headingRad) - playerSpeed;

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

  car.dist = longitudinal;
  car.lateralM = lateral;
  car.headingRad = finiteAt(channels.heading, carIdx) ?? 0;
  car.lane = worldLaneOf(lateral);
  car.laneSource = 'world';
  return true;
};
