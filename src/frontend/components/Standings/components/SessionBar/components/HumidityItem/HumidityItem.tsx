import { memo } from 'react';
import { DropIcon } from '@phosphor-icons/react';
import { useSessionBarSnapshot } from '@irdashies/context';
import { sessionBarItemWrapperClass } from '../../sessionBarItemWrapperClass';
import type { SessionBarItemProps } from '../../sessionBarItemTypes';

export const HumidityItem = memo(({ standalone }: SessionBarItemProps) => {
  const humidity = useSessionBarSnapshot()?.relativeHumidity;
  const validHumidity =
    typeof humidity === 'number' &&
    Number.isFinite(humidity) &&
    humidity >= 0 &&
    humidity <= 1;

  return (
    <div className={sessionBarItemWrapperClass(standalone)}>
      <div
        className="flex justify-center gap-1 items-center text-nowrap"
        title="Humidity"
      >
        <DropIcon />
        <span>{validHumidity ? `${Math.round(humidity * 100)}%` : '- %'}</span>
      </div>
    </div>
  );
});
HumidityItem.displayName = 'HumidityItem';
