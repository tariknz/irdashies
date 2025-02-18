import { useTelemetry, useTelemetryValue } from '@irdashies/context';
import { useMemo } from 'react';

const wetnessLevels: Record<number, string> = {
  0: '',
  1: 'Dry',
  2: 'Mostly Dry',
  3: 'Very Lightly Wet',
  4: 'Lightly Wet',
  5: 'Moderately Wet',
  6: 'Very Wet',
  7: 'Extremely Wet',
};

export const useWeather = () => {
  const humidity = useTelemetryValue('RelativeHumidity');
  const weatherType = useTelemetryValue('WeatherType');
  const trackAirTemp = useTelemetryValue('AirTemp');
  const trackSurfaceTemp = useTelemetryValue('PlayerTrackSurface');
  const windVelocity = useTelemetryValue('WindVel');
  const windDirection = useTelemetryValue('WindDir');

  return {
    humidity,
    weatherType,
    trackAirTemp,
    trackSurfaceTemp,
    windVelocity,
    windDirection,
  };
};

export const useTrackWeather = () => {
  const trackMoisture = useTelemetry('TrackWetness');
  const windYaw = useTelemetry('YawNorth');
  const windDirection = useTelemetry('WindDir');
  const windVelo = useTelemetry('WindVel');
  const trackState = useMemo(() => {
    const wetnessLevel = trackMoisture?.value[0] ?? '';
    return wetnessLevels[wetnessLevel] ?? '';
  }, [trackMoisture?.value]);

  return { trackState, trackMoisture, windDirection, windVelo, windYaw };
};
