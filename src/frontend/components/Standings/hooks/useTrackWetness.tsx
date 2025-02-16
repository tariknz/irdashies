import { useMemo } from 'react';
import { useTelemetry } from '@irdashies/context';

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

export const useTrackWeather = () => {
  const trackMoisture = useTelemetry('TrackWetness');
  const windYaw = useTelemetry('YawNorth');
  const windDirection = useTelemetry('WindDir')
  const windVelo = useTelemetry('WindVel');
  const trackState = useMemo(() => {
    const wetnessLevel = trackMoisture?.value[0] ?? '';
    return wetnessLevels[wetnessLevel] ?? '';
  }, [trackMoisture?.value]);

  return { trackState, trackMoisture, windDirection, windVelo, windYaw };
};
