import { DropIcon, SunIcon, WavesIcon } from '@phosphor-icons/react';
import { memo } from 'react';
import { TrackWetness } from '@irdashies/types';

// Track wetness constants
const MIN_WETNESS = TrackWetness.Dry;
const MAX_WETNESS = TrackWetness.ExtremelyWet;
const DEFAULT_WETNESS = TrackWetness.Unknown;
const FALLBACK_TRACK_STATE = 'N/A';
const WETNESS_LEVELS: Record<number, string> = {
  [TrackWetness.Unknown]: '',
  [TrackWetness.Dry]: 'Dry',
  [TrackWetness.MostlyDry]: 'Mostly Dry',
  [TrackWetness.VeryLightlyWet]: 'Very Lightly Wet',
  [TrackWetness.LightlyWet]: 'Lightly Wet',
  [TrackWetness.ModeratelyWet]: 'Moderately Wet',
  [TrackWetness.VeryWet]: 'Very Wet',
  [TrackWetness.ExtremelyWet]: 'Extremely Wet',
};

export interface WeatherTrackWetnessProps {
  trackMoisture?: number;
  variant?: 'default' | 'compact' | 'inline';
}

export const WeatherTrackWetness = memo(
  ({ trackMoisture, variant = 'default' }: WeatherTrackWetnessProps) => {
    // Calculate wetness percentage (0-100%), clamped so out-of-range
    // moisture values can't produce negative or >100% widths.
    const normalizedMoisture = Math.min(
      MAX_WETNESS,
      Math.max(MIN_WETNESS, trackMoisture ?? MIN_WETNESS)
    );
    const wetnessScale = MAX_WETNESS - MIN_WETNESS;
    const trackWetnessPct =
      ((normalizedMoisture - MIN_WETNESS) / wetnessScale) * 100;

    // Get the descriptive state of track wetness
    const safeTrackMoisture = trackMoisture ?? DEFAULT_WETNESS;
    const trackState =
      safeTrackMoisture in WETNESS_LEVELS
        ? WETNESS_LEVELS[safeTrackMoisture]
        : 'Unknown';
    const trackStateLabel = trackState || FALLBACK_TRACK_STATE;

    if (variant === 'compact') {
      return (
        <div className="bg-slate-800/70 px-2 py-1 rounded-sm min-w-0">
          <div className="flex items-center gap-x-1.5">
            <WavesIcon size={12} className="flex-none text-white/50" />
            <span className="text-sm font-medium capitalize truncate">
              {trackStateLabel}
            </span>
          </div>
        </div>
      );
    }

    if (variant === 'inline') {
      return (
        <div className="bg-slate-800/70 px-2 py-1 rounded-sm min-w-0">
          <div className="flex items-center gap-x-1.5 text-sm">
            <WavesIcon size={12} className="flex-none text-white/50" />
            <span className="truncate min-w-0 text-white/60">Wetness</span>
            <div className="flex-none whitespace-nowrap text-right font-medium capitalize">
              {trackStateLabel}
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="bg-slate-800/70 p-2 rounded-sm w-full min-w-0">
        {/* Header row with consistency label styling */}
        <div className="flex flex-row gap-x-2 items-center text-sm mb-2">
          <WavesIcon className="flex-none" />
          <div className="flex-1 min-w-0 truncate capitalize">
            {trackStateLabel}
          </div>
        </div>

        {/* Detail row with progress bar */}
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
            ></div>
          </div>
          <DropIcon size={14} className="text-blue-400 flex-none" />
        </div>
      </div>
    );
  }
);
WeatherTrackWetness.displayName = 'WeatherTrackWetness';
