import type { SessionBarSnapshot } from '@irdashies/types';
import { shallow } from 'zustand/shallow';
import { useSessionBarSelector } from '../ChannelStore';

export interface WeatherData {
  trackMoisture: number | undefined;
  windYaw: number | undefined;
  windDirection: number | undefined;
  windVelocity: number | undefined;
  humidity: number | undefined;
  precipitation: number | undefined;
}

const EMPTY_WEATHER: readonly [
  number | undefined,
  number | undefined,
  number | undefined,
  number | undefined,
  number | undefined,
  number | undefined,
] = [undefined, undefined, undefined, undefined, undefined, undefined];

const selectWeather = (snapshot: SessionBarSnapshot) =>
  [
    snapshot.trackWetness,
    snapshot.windYaw,
    snapshot.windDirection,
    snapshot.windVelocity,
    snapshot.relativeHumidity,
    snapshot.precipitation,
  ] as const;

/**
 * Subscribes to weather telemetry data but only updates React state
 * at a throttled interval. Weather data changes slowly so 60 FPS
 * updates are unnecessary.
 *
 * YawNorth is a single player-perspective value (length 1) — not a per-car
 * array. It does not follow CamCarIdx when spectating, so windYaw always
 * reflects the player's own car heading.
 */
export const useThrottledWeather = (): WeatherData => {
  const data =
    useSessionBarSelector(selectWeather, { equality: shallow }) ??
    EMPTY_WEATHER;

  return {
    trackMoisture: data[0],
    windYaw: data[1],
    windDirection: data[2],
    windVelocity: data[3],
    humidity: data[4],
    precipitation: data[5],
  };
};
