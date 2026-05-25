import { DropIcon, SunIcon, WavesIcon } from '@phosphor-icons/react';
import { memo } from 'react';

const MIN_WETNESS = 1;
const MAX_WETNESS = 7;
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
    const normalizedMoisture = trackMoisture || MIN_WETNESS;
    const wetnessScale = MAX_WETNESS - MIN_WETNESS;
    const trackWetnessPct =
      ((normalizedMoisture - MIN_WETNESS) / wetnessScale) * 100;

    const safeTrackMoisture = trackMoisture ?? DEFAULT_WETNESS;
    const trackState =
      safeTrackMoisture in WETNESS_LEVELS
        ? WETNESS_LEVELS[safeTrackMoisture]
        : 'Unknown';

    return (
      <div className="bg-slate-800/70 p-2 rounded-sm w-full min-w-0">
        <div className="flex flex-row gap-x-2 items-center text-sm mb-2">
          <WavesIcon className="flex-none" />
          <span className="truncate min-w-0 flex-1">Wetness</span>
          <div className="flex-none whitespace-nowrap text-right capitalize">
            {trackState}
          </div>
        </div>
        <div className="flex items-center flex-row gap-x-2 px-1">
          <SunIcon size={14} className="text-gray-400 flex-none" />
          <div className="grow bg-gray-700/50 rounded-full h-2">
            <div
              role="progressbar"
              aria-valuenow={trackWetnessPct}
              aria-valuemin={0}
              aria-valuemax={100}
              style={{ width: `${trackWetnessPct}%` }}
              className="bg-blue-500 h-2 rounded-full transition-all duration-1000 ease-in-out shadow-[0_0_8px_rgba(59,130,246,0.5)]"
            />
          </div>
          <DropIcon size={14} className="text-blue-400 flex-none" />
        </div>
      </div>
    );
  }
);
WeatherTrackWetness.displayName = 'WeatherTrackWetness';
