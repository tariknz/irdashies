import { memo } from 'react';
import { ClockUserIcon } from '@phosphor-icons/react';
import { useCurrentTime } from '../../hooks/useCurrentTime';

export const LocalTimeItem = memo(() => {
  const localTime = useCurrentTime();
  return (
    <div className="flex justify-center gap-1 items-center">
      <ClockUserIcon />
      <span>{localTime}</span>
    </div>
  );
});
LocalTimeItem.displayName = 'LocalTimeItem';
