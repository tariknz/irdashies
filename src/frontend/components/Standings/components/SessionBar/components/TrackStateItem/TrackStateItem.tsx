import { memo } from 'react';
import { PathIcon } from '@phosphor-icons/react';
import { useTrackRubberedState } from '@irdashies/domain/weather/useTrackRubberedState';
import { sessionBarItemWrapperClass } from '../../sessionBarItemWrapperClass';
import type { SessionBarItemProps } from '../../sessionBarItemTypes';

export const TrackStateItem = memo(({ standalone }: SessionBarItemProps) => {
  const trackState = useTrackRubberedState();
  if (!trackState) return null;

  return (
    <div className={sessionBarItemWrapperClass(standalone)}>
      <div
        className="flex justify-center gap-1 items-center text-nowrap"
        title="Track State"
      >
        <PathIcon />
        <span className="capitalize">{trackState}</span>
      </div>
    </div>
  );
});
TrackStateItem.displayName = 'TrackStateItem';
