import type { TrackStateSnapshot } from '@irdashies/types';
import { useTrackStateSelector } from '../ChannelStore';

const selectIsDriving = (snapshot: TrackStateSnapshot): boolean => {
  // A frame the sim has stopped writing cannot say the player is driving,
  // whatever it holds. Checked first because the three terms below are ORed:
  // a session that ended with the player in the pits left `onPitRoad` true in
  // the last frame, and that alone kept every widget gated on this on screen
  // after the session was over.
  if (snapshot.dataStale) return false;
  // Nor while the sim says the player is out of the car. A car left in the
  // pit lane or stall keeps the pit terms below true while the player sits at
  // LMU's monitor, and IsOnTrack being false does not stop an OR.
  if (snapshot.outOfCar) return false;

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
