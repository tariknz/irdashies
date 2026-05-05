import { memo } from 'react';
import { DropHalfIcon } from '@phosphor-icons/react';
import { useThrottledWeather } from '@irdashies/context';

export const HumidityItem = memo(() => {
  const { humidity } = useThrottledWeather();
  if (humidity === undefined || humidity === null) return null;
  return (
    <div className="flex justify-center gap-1 items-center">
      <DropHalfIcon />
      <span>{Math.round(humidity * 100)}%</span>
    </div>
  );
});
HumidityItem.displayName = 'HumidityItem';
