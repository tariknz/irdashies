import { useSessionBarSnapshot } from '../ChannelStore';

export interface WeatherData {
  trackMoisture: number | undefined;
  windYaw: number | undefined;
  windDirection: number | undefined;
  windVelocity: number | undefined;
  humidity: number | undefined;
  precipitation: number | undefined;
}

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
  const data = useSessionBarSnapshot();

  return {
    trackMoisture: data?.trackWetness,
    windYaw: data?.windYaw,
    windDirection: data?.windDirection,
    windVelocity: data?.windVelocity,
    humidity: data?.relativeHumidity,
    precipitation: data?.precipitation,
  };
};
