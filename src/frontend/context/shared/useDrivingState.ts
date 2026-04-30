import { useTelemetryValue } from '@irdashies/context';

export const useDrivingState = () => {
  const isOnTrack = useTelemetryValue<boolean>('IsOnTrack') ?? false;
  const inPitStall = useTelemetryValue<boolean>('PlayerCarInPitStall') ?? false;
  const onPitRoad = useTelemetryValue<boolean>('CarIdxOnPitRoad') ?? false;
  const isInGarageDirect = useTelemetryValue<boolean>('IsInGarage') ?? false;
  const isGarageVisible =
    useTelemetryValue<boolean>('IsGarageVisible') ?? false;
  const isInGarage = isInGarageDirect || isGarageVisible;
  const isReplayPlaying =
    useTelemetryValue<boolean>('IsReplayPlaying') ?? false;

  const isDriving =
    (isOnTrack || inPitStall || onPitRoad) && !isInGarage && !isReplayPlaying;

  return {
    isDriving,
  };
};
