import { memo } from 'react';
import { WavesIcon } from '@phosphor-icons/react';
import { useSessionBarSnapshot } from '@irdashies/context';
import { sessionBarItemWrapperClass } from '../../sessionBarItemWrapperClass';
import type { SessionBarItemProps } from '../../sessionBarItemTypes';

export const TrackWetnessItem = memo(({ standalone }: SessionBarItemProps) => {
  const level = useSessionBarSnapshot()?.trackWetness ?? 0;
  const trackWetness =
    [
      '',
      'Dry',
      'Mostly Dry',
      'Very Lightly Wet',
      'Lightly Wet',
      'Moderately Wet',
      'Very Wet',
      'Extremely Wet',
    ][level] ?? '';

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
