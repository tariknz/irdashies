import { memo } from 'react';
import { ThermometerIcon } from '@phosphor-icons/react';
import type { TemperatureUnit } from '@irdashies/types';
import { useTrackTemperature } from '../../hooks/useTrackTemperature';

interface AirTemperatureItemProps {
  unit: TemperatureUnit;
}

export const AirTemperatureItem = memo(({ unit }: AirTemperatureItemProps) => {
  const { airTemp } = useTrackTemperature({ airTempUnit: unit });
  return (
    <div className="flex justify-center gap-1 items-center">
      <ThermometerIcon />
      <span>{airTemp}</span>
    </div>
  );
});
AirTemperatureItem.displayName = 'AirTemperatureItem';
