import type { TrackStateSnapshot } from '@irdashies/types';
import { useTrackStateSelector } from '../ChannelStore';

const selectIsDriving = (snapshot: TrackStateSnapshot): boolean => {
  const focusCarIdx = snapshot.focusCarIdx ?? -1;
  const onPitRoad = snapshot.carIdxOnPitRoad[focusCarIdx] ?? false;
  const isInGarage = snapshot.isInGarage || snapshot.isGarageVisible;
  return (
    (snapshot.isOnTrack || snapshot.playerCarInPitStall || onPitRoad) &&
    !isInGarage &&
    !snapshot.isReplayPlaying
  );
};

export const useDrivingState = () => {
  const isDriving = useTrackStateSelector(selectIsDriving) ?? false;

  return {
    isDriving,
  };
};
