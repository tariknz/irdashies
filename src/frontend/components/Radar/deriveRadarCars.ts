import type { BlindSpotSnapshot } from '@irdashies/types';

export interface RadarCar {
  carIdx: number;
  lateral: number;
  longitudinal: number;
  heading: number;
  sameClass: boolean;
  opacity: number;
}

export function deriveRadarCars(
  snapshot: BlindSpotSnapshot | undefined,
  playerCarIdx: number | undefined,
  range: number
): RadarCar[] {
  if (
    !snapshot ||
    playerCarIdx === undefined ||
    playerCarIdx < 0 ||
    range <= 0
  ) {
    return [];
  }

  const available = snapshot.relativeAvailable ?? [];
  const lateral = snapshot.relativeLateral ?? [];
  const longitudinal = snapshot.relativeLongitudinal ?? [];
  const heading = snapshot.relativeHeading ?? [];
  const pitRoad = snapshot.carIdxOnPitRoad ?? [];
  const classes = snapshot.carIdxClass ?? [];
  const playerClass = classes[playerCarIdx];
  const cars: RadarCar[] = [];

  for (let carIdx = 0; carIdx < available.length; carIdx += 1) {
    const x = lateral[carIdx];
    const y = longitudinal[carIdx];
    if (
      carIdx === playerCarIdx ||
      !available[carIdx] ||
      pitRoad[carIdx] ||
      !Number.isFinite(x) ||
      !Number.isFinite(y) ||
      Math.hypot(x, y) >= range
    ) {
      continue;
    }
    cars.push({
      carIdx,
      lateral: x,
      longitudinal: y,
      heading: Number.isFinite(heading[carIdx]) ? heading[carIdx] : 0,
      sameClass: playerClass !== undefined && classes[carIdx] === playerClass,
      opacity: Math.max(0.3, 1 - (Math.hypot(x, y) / range) * 0.7),
    });
  }

  return cars;
}
