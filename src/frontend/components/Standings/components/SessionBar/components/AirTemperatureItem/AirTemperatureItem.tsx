import { memo } from 'react';
import { ThermometerIcon } from '@phosphor-icons/react';
import { useAirTempC } from '@irdashies/context';
import { formatTemperature } from '../../formatTemperature';
import { sessionBarItemWrapperClass } from '../../sessionBarItemWrapperClass';
import type { SessionBarItemProps } from '../../sessionBarItemTypes';

export const AirTemperatureItem = memo(
  ({ settings, standalone }: SessionBarItemProps) => {
    const airTempC = useAirTempC();
    const airTemp = formatTemperature(
      airTempC,
      settings?.airTemperature?.unit ?? 'Metric'
    );

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
