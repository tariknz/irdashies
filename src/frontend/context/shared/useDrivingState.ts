import { useTelemetryValue } from '@irdashies/context';

export const useDrivingState = () => {
  const isOnTrack = useTelemetryValue<boolean>('IsOnTrack');
  const inPitStall = useTelemetryValue<boolean>('PlayerCarInPitStall');
  const onPitRoad = useTelemetryValue<boolean>('CarIdxOnPitRoad');
  const isInGarage = useTelemetryValue<boolean>('IsInGarage');
  const isReplayPlaying = useTelemetryValue<boolean>('IsReplayPlaying');

  const isDriving =
    (isOnTrack || inPitStall || onPitRoad) && !isInGarage && !isReplayPlaying;

  return {
    isDriving,
  };
};
