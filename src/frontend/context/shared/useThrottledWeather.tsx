import { useEffect, useRef, useState } from 'react';
import { useTelemetryStore } from '@irdashies/context';
import type { Telemetry } from '@irdashies/types';

const WEATHER_UPDATE_INTERVAL_MS = 1000;

interface ThrottledWeatherState {
  trackMoisture: number | undefined;
  yawNorthValues: number[];
  windDirection: number | undefined;
  windVelocity: number | undefined;
  humidity: number | undefined;
}

export interface WeatherData {
  trackMoisture: number | undefined;
  windYaw: number | undefined;
  windDirection: number | undefined;
  windVelocity: number | undefined;
  humidity: number | undefined;
}

const selectWeatherData = (
  telemetry: Telemetry | null
): ThrottledWeatherState => ({
  trackMoisture: telemetry?.TrackWetness?.value?.[0],
  yawNorthValues: telemetry?.YawNorth?.value?.[0],
  windDirection: telemetry?.WindDir?.value?.[0],
  windVelocity: telemetry?.WindVel?.value?.[0],
  humidity: telemetry?.RelativeHumidity?.value?.[0],
});

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
  const [data, setData] = useState<ThrottledWeatherState>(() =>
    selectWeatherData(useTelemetryStore.getState().telemetry)
  );
  const lastUpdateRef = useRef(0);

  useEffect(() => {
    const unsubscribe = useTelemetryStore.subscribe((state) => {
      const now = Date.now();
      if (now - lastUpdateRef.current < WEATHER_UPDATE_INTERVAL_MS) {
        return;
      }
      lastUpdateRef.current = now;
      setData(selectWeatherData(state.telemetry));
    });

    return unsubscribe;
  }, []);

  return {
    trackMoisture: data.trackMoisture,
    windYaw: data.yawNorthValues[0],
    windDirection: data.windDirection,
    windVelocity: data.windVelocity,
    humidity: data.humidity,
  };
};
