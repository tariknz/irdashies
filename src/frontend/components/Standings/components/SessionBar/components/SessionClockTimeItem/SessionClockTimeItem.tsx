import { memo } from 'react';
import { ClockIcon } from '@phosphor-icons/react';
import { useSessionBarSnapshot } from '@irdashies/context';
import { sessionBarItemWrapperClass } from '../../sessionBarItemWrapperClass';
import type { SessionBarItemProps } from '../../sessionBarItemTypes';

export const SessionClockTimeItem = memo(
  ({ standalone }: SessionBarItemProps) => {
    const seconds = useSessionBarSnapshot()?.sessionTimeOfDay;
    const date = new Date();
    date.setHours(0, 0, 0, 0);
    if (seconds !== undefined) date.setSeconds(seconds);
    const sessionClockTime =
      seconds === undefined
        ? ''
        : date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });

    return (
      <div className={sessionBarItemWrapperClass(standalone)}>
        <div className="flex justify-center gap-1 items-center">
          <ClockIcon />
          <span>{sessionClockTime}</span>
        </div>
      </div>
    );
  }
);
SessionClockTimeItem.displayName = 'SessionClockTimeItem';
