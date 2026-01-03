import { DropIcon, SunIcon } from '@phosphor-icons/react';

// Track wetness constants
const MIN_WETNESS = 1;
const MAX_WETNESS = 7; // Extremely Wet
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

export const WeatherTrackWetness = ({
  trackMoisture,
}: WeatherTrackWetnessProps) => {
  // Calculate wetness percentage (0-100%)
  // Input range is 1-7, so we normalize it to 0-100%
  const normalizedMoisture = trackMoisture || MIN_WETNESS;
  const wetnessScale = MAX_WETNESS - MIN_WETNESS;
  const trackWetnessPct = ((normalizedMoisture - MIN_WETNESS) / wetnessScale) * 100;

  // Get the descriptive state of track wetness
  const safeTrackMoisture = trackMoisture ?? DEFAULT_WETNESS;
  const trackState = WETNESS_LEVELS[safeTrackMoisture] ?? 'Unknown';

  return (
    <div className="bg-slate-800/70 p-2 rounded-sm">
      <div className="flex items-center flex-row gap-x-1 mt-1">
        <SunIcon />
        <div className="w-full bg-gray-700 rounded-full h-2.5">
          <div
            role="progressbar"
            aria-valuenow={trackWetnessPct}
            aria-valuemin={0}
            aria-valuemax={100}
            style={{ width: `${trackWetnessPct}%` }}
            className="bg-blue-600 h-2.5 rounded-full transition-all duration-1000 ease-in-out"
          ></div>
        </div>
        <DropIcon />
      </div>
      <div className="text-center text-sm mt-1">{trackState}</div>
    </div>
  );
};
