import { WavesIcon } from '@phosphor-icons/react';
import { memo } from 'react';

const DEFAULT_WETNESS = 0;
const WETNESS_LEVELS: Record<number, string> = {
  0: '',
  1: 'Dry',
  2: 'Mostly Dry',
  3: 'Very Lightly Wet',
  4: 'Lightly Wet',
  5: 'Moderately Wet',
  6: 'Very Wet',
  7: 'Extremely Wet',
};

export interface WeatherTrackWetnessProps {
  trackMoisture?: number;
}

export const WeatherTrackWetness = memo(
  ({ trackMoisture }: WeatherTrackWetnessProps) => {
    const safeTrackMoisture = trackMoisture ?? DEFAULT_WETNESS;
    const label =
      safeTrackMoisture in WETNESS_LEVELS
        ? WETNESS_LEVELS[safeTrackMoisture]
        : 'Unknown';
    return (
      <div className="bg-slate-800/70 px-2 py-1 w-full min-w-0">
        <div className="flex items-center gap-x-1.5">
          <WavesIcon size={12} className="flex-none text-white/50" />
          <div className="flex items-center gap-x-1.5 min-w-0">
            <span className="text-sm font-medium capitalize truncate">
              {label}
            </span>
            {safeTrackMoisture > 0 && (
              <span className="flex-none text-xs text-white/50 bg-white/10 rounded px-1 py-px">
                {safeTrackMoisture}/7
              </span>
            )}
          </div>
        </div>
      </div>
    );
  }
);
WeatherTrackWetness.displayName = 'WeatherTrackWetness';
