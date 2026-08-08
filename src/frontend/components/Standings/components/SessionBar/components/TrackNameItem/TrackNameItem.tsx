import { memo } from 'react';
import { useSessionBarSnapshot } from '@irdashies/context';
import { sessionBarItemWrapperClass } from '../../sessionBarItemWrapperClass';
import type { SessionBarItemProps } from '../../sessionBarItemTypes';

export const TrackNameItem = memo(({ standalone }: SessionBarItemProps) => {
  const trackDisplayName = useSessionBarSnapshot()?.trackDisplayName;

  return (
    <div className={sessionBarItemWrapperClass(standalone)}>
      <div className="flex">{trackDisplayName}</div>
    </div>
  );
});
TrackNameItem.displayName = 'TrackNameItem';
