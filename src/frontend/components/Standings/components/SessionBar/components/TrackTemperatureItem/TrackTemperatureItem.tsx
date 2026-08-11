import { memo } from 'react';
import { RoadHorizonIcon } from '@phosphor-icons/react';
import { useSessionBarSnapshot } from '@irdashies/context';
import { formatTemperature } from '../../formatTemperature';
import { sessionBarItemWrapperClass } from '../../sessionBarItemWrapperClass';
import type { SessionBarItemProps } from '../../sessionBarItemTypes';

export const TrackTemperatureItem = memo(
  ({ settings, standalone }: SessionBarItemProps) => {
    const trackTempC = useSessionBarSnapshot()?.trackTemp;
    const trackTemp = formatTemperature(
      trackTempC,
      settings?.trackTemperature?.unit ?? 'Metric'
    );

    return (
      <div className={sessionBarItemWrapperClass(standalone)}>
        <div className="flex justify-center gap-1 items-center">
          <RoadHorizonIcon />
          <span>{trackTemp}</span>
        </div>
      </div>
    );
  }
);
TrackTemperatureItem.displayName = 'TrackTemperatureItem';
