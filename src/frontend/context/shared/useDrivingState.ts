import { useTelemetryValue } from '@irdashies/context';

export const useDrivingState = () => {
  const isOnTrack = useTelemetryValue<boolean>('IsOnTrack') ?? false;
  const inPitStall = useTelemetryValue<boolean>('PlayerCarInPitStall') ?? false;
  const onPitRoad = useTelemetryValue<boolean>('CarIdxOnPitRoad') ?? false;
  const isInGarage = useTelemetryValue<boolean>('IsInGarage') ?? false;
  const isReplayPlaying = useTelemetryValue<boolean>('IsReplayPlaying') ?? false;

  const isDriving =
    (isOnTrack || inPitStall || onPitRoad) && !isInGarage && !isReplayPlaying;

  return {
    isDriving,
  };
};
