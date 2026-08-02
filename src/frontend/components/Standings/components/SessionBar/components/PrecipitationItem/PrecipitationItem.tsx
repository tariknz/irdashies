import { memo } from 'react';
import { CloudRainIcon } from '@phosphor-icons/react';
import { useThrottledWeather } from '@irdashies/context';
import { sessionBarItemWrapperClass } from '../../sessionBarItemWrapperClass';
import type { SessionBarItemProps } from '../../sessionBarItemTypes';

export const PrecipitationItem = memo(({ standalone }: SessionBarItemProps) => {
  const { precipitation } = useThrottledWeather();
  const hasPrecipitation =
    precipitation !== undefined && precipitation !== null;
  const precipitationPercent = hasPrecipitation
    ? Math.round(precipitation * 100)
    : 0;

  return (
    <div className={sessionBarItemWrapperClass(standalone)}>
      <div className="flex justify-center gap-1 items-center text-nowrap">
        <CloudRainIcon />
        <span>{hasPrecipitation ? `${precipitationPercent}%` : '- %'}</span>
      </div>
    </div>
  );
});
PrecipitationItem.displayName = 'PrecipitationItem';
