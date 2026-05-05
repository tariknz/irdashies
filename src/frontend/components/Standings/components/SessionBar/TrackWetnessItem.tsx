import { memo } from 'react';
import { WavesIcon } from '@phosphor-icons/react';
import { useTrackWetness } from '../../hooks/useTrackWetness';

export const TrackWetnessItem = memo(() => {
  const { trackWetness } = useTrackWetness();
  return (
    <div className="flex justify-center gap-1 items-center text-nowrap">
      <WavesIcon />
      <span>{trackWetness}</span>
    </div>
  );
});
TrackWetnessItem.displayName = 'TrackWetnessItem';
