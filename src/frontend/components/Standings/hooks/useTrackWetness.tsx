import { useMemo } from 'react';
import { useTelemetry } from '@irdashies/context';
import { TrackWetness } from '@irdashies/types';

const wetnessLevels: Record<number, string> = {
  [TrackWetness.Unknown]: '',
  [TrackWetness.Dry]: 'Dry',
  [TrackWetness.MostlyDry]: 'Mostly Dry',
  [TrackWetness.VeryLightlyWet]: 'Very Lightly Wet',
  [TrackWetness.LightlyWet]: 'Lightly Wet',
  [TrackWetness.ModeratelyWet]: 'Moderately Wet',
  [TrackWetness.VeryWet]: 'Very Wet',
  [TrackWetness.ExtremelyWet]: 'Extremely Wet',
};

export const useTrackWetness = () => {
  const trackWetnessVal = useTelemetry('TrackWetness');
  const trackWetness = useMemo(() => {
    const wetnessLevel = trackWetnessVal?.value[0] ?? 0;
    return wetnessLevels[wetnessLevel] ?? '';
  }, [trackWetnessVal?.value]);

  return { trackWetness };
};
