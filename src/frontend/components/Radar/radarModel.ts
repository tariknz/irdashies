import type { RadarCar, RadarSnapshot } from '@irdashies/types';

export interface RadarFilterOptions {
  range: number;
  carLength: number;
  hideInPit: boolean;
}

/**
 * Cars worth drawing: inside the disc (plus a body length so a car slides
 * off the edge instead of vanishing at its centre), and on the same side of
 * the pit wall as the focus car when `hideInPit` is set.
 */
export const selectRadarCars = (
  snapshot: Pick<RadarSnapshot, 'cars' | 'focusOnPitRoad'>,
  { range, carLength, hideInPit }: RadarFilterOptions
): RadarCar[] =>
  snapshot.cars.filter(
    (car) =>
      Math.abs(car.dist) <= range + carLength &&
      (!hideInPit || car.onPitRoad === snapshot.focusOnPitRoad)
  );

/** Distance to the nearest car in metres, or Infinity when there is none. */
export const nearestDistance = (
  cars: readonly Pick<RadarCar, 'dist'>[]
): number =>
  cars.reduce(
    (nearest, car) => Math.min(nearest, Math.abs(car.dist)),
    Infinity
  );

export interface AutoHideOptions {
  showDistance: number;
  hideDistance: number;
}

/**
 * Two thresholds so a car hovering at one distance cannot make the radar
 * blink: it appears at `showDistance` and leaves past `hideDistance`.
 */
export const nextAutoHideVisible = (
  wasVisible: boolean,
  nearest: number,
  { showDistance, hideDistance }: AutoHideOptions
): boolean =>
  wasVisible
    ? nearest <= Math.max(hideDistance, showDistance)
    : nearest <= showDistance;
