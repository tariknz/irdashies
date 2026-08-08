import { useTrackStateSnapshot } from '../ChannelStore';

export const useDrivingState = () => {
  const snapshot = useTrackStateSnapshot();
  const isOnTrack = snapshot?.isOnTrack ?? false;
  const inPitStall = snapshot?.playerCarInPitStall ?? false;
  const focusCarIdx = snapshot?.focusCarIdx ?? -1;
  const onPitRoad = snapshot?.carIdxOnPitRoad[focusCarIdx] ?? false;
  const isInGarageDirect = snapshot?.isInGarage ?? false;
  const isGarageVisible = snapshot?.isGarageVisible ?? false;
  const isInGarage = isInGarageDirect || isGarageVisible;
  const isReplayPlaying = snapshot?.isReplayPlaying ?? false;

  const isDriving =
    (isOnTrack || inPitStall || onPitRoad) && !isInGarage && !isReplayPlaying;

  return {
    isDriving,
  };
};
