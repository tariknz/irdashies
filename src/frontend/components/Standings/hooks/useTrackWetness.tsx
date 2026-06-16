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

export const useTrackWetness = () => {
  const trackWetnessVal = useTelemetry('TrackWetness');
  const trackWetness = useMemo(() => {
    const wetnessLevel = trackWetnessVal?.value[0] ?? 0;
    return wetnessLevels[wetnessLevel] ?? '';
  }, [trackWetnessVal?.value]);

  return { trackWetness };
};
