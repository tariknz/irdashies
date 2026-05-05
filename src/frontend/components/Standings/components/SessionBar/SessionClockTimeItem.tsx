import { memo } from 'react';
import { ClockIcon } from '@phosphor-icons/react';
import { useSessionCurrentTime } from '../../hooks/useSessionCurrentTime';

export const SessionClockTimeItem = memo(() => {
  const sessionClockTime = useSessionCurrentTime();
  return (
    <div className="flex justify-center gap-1 items-center">
      <ClockIcon />
      <span>{sessionClockTime}</span>
    </div>
  );
});
SessionClockTimeItem.displayName = 'SessionClockTimeItem';
