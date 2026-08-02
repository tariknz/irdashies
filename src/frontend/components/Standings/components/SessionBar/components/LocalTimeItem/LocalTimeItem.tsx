import { memo } from 'react';
import { ClockUserIcon } from '@phosphor-icons/react';
import { useCurrentTime } from '../../../../hooks/useCurrentTime';
import { sessionBarItemWrapperClass } from '../../sessionBarItemWrapperClass';
import type { SessionBarItemProps } from '../../sessionBarItemTypes';

export const LocalTimeItem = memo(({ standalone }: SessionBarItemProps) => {
  const localTime = useCurrentTime();

  return (
    <div className={sessionBarItemWrapperClass(standalone)}>
      <div className="flex justify-center gap-1 items-center">
        <ClockUserIcon />
        <span>{localTime}</span>
      </div>
    </div>
  );
});
LocalTimeItem.displayName = 'LocalTimeItem';
