import { memo } from 'react';
import { WavesIcon } from '@phosphor-icons/react';
import { useTrackWetness } from '../../../../hooks/useTrackWetness';
import { sessionBarItemWrapperClass } from '../../sessionBarItemWrapperClass';
import type { SessionBarItemProps } from '../../sessionBarItemTypes';

export const TrackWetnessItem = memo(({ standalone }: SessionBarItemProps) => {
  const { trackWetness } = useTrackWetness();

  return (
    <div className={sessionBarItemWrapperClass(standalone)}>
      <div className="flex justify-center gap-1 items-center text-nowrap">
        <WavesIcon />
        <span>{trackWetness}</span>
      </div>
    </div>
  );
});
TrackWetnessItem.displayName = 'TrackWetnessItem';
