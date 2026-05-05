import { memo } from 'react';
import { RoadHorizonIcon } from '@phosphor-icons/react';
import type { TemperatureUnit } from '@irdashies/types';
import { useTrackTemperature } from '../../hooks/useTrackTemperature';

export const TrackTemperatureItem = memo(
  ({ unit }: { unit: TemperatureUnit }) => {
    const { trackTemp } = useTrackTemperature({ trackTempUnit: unit });
    return (
      <div className="flex justify-center gap-1 items-center">
        <RoadHorizonIcon />
        <span>{trackTemp}</span>
      </div>
    );
  }
);
TrackTemperatureItem.displayName = 'TrackTemperatureItem';
