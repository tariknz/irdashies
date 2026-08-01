import { memo } from 'react';
import { ThermometerIcon } from '@phosphor-icons/react';
import { useTrackTemperature } from '../../../../hooks/useTrackTemperature';
import { sessionBarItemWrapperClass } from '../../sessionBarItemWrapperClass';
import type { SessionBarItemProps } from '../../sessionBarItemTypes';

export const AirTemperatureItem = memo(
  ({ settings, standalone }: SessionBarItemProps) => {
    const { airTemp } = useTrackTemperature({
      airTempUnit: settings?.airTemperature?.unit ?? 'Metric',
      trackTempUnit: settings?.trackTemperature?.unit ?? 'Metric',
    });

    return (
      <div className={sessionBarItemWrapperClass(standalone)}>
        <div className="flex justify-center gap-1 items-center">
          <ThermometerIcon />
          <span>{airTemp}</span>
        </div>
      </div>
    );
  }
);
AirTemperatureItem.displayName = 'AirTemperatureItem';
