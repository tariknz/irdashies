import { memo } from 'react';
import { useTrackDisplayName } from '@irdashies/context';

export const TrackNameItem = memo(() => {
  const trackDisplayName = useTrackDisplayName();
  return <div className="flex">{trackDisplayName}</div>;
});
TrackNameItem.displayName = 'TrackNameItem';
