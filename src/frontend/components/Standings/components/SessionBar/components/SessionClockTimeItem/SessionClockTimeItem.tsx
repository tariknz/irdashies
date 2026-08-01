import { memo } from 'react';
import { ClockIcon } from '@phosphor-icons/react';
import { useSessionCurrentTime } from '../../../../hooks/useSessionCurrentTime';
import { sessionBarItemWrapperClass } from '../../sessionBarItemWrapperClass';
import type { SessionBarItemProps } from '../../sessionBarItemTypes';

export const SessionClockTimeItem = memo(
  ({ standalone }: SessionBarItemProps) => {
    const sessionClockTime = useSessionCurrentTime();

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
