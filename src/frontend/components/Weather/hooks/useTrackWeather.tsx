import { useTelemetryValue } from '@irdashies/context';

export const useTrackWeather = () => {
  const trackMoisture = useTelemetryValue('TrackWetness');
  const windYaw = useTelemetryValue('YawNorth');
  const windDirection = useTelemetryValue('WindDir');
  const windVelocity = useTelemetryValue('WindVel');
  const humidity = useTelemetryValue('RelativeHumidity');

  return {
    trackMoisture,
    windDirection,
    windVelocity,
    humidity,
    windYaw,
  };
};
