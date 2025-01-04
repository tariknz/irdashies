import {
  useDriverCarIdx,
  useSessionDrivers,
  useTelemetryValuesMapped,
} from '@irdashies/context';

export const useDriverProgress = () => {
  const driverIdx = useDriverCarIdx();
  const drivers = useSessionDrivers();
  const driversLapDist = useTelemetryValuesMapped<number[]>(
    'CarIdxLapDistPct',
    (val) => Math.round(val * 1000) / 1000
  );

  const driversTrackData =
    drivers
      ?.map((driver) => ({
        driver: driver,
        progress: driversLapDist[driver.CarIdx],
        isPlayer: driver.CarIdx === driverIdx,
      }))
      .filter((d) => d.progress > -1) // ignore drivers not on track
      .filter((d) => d.driver.CarIdx > 0) ?? []; // ignore pace car for now

  return driversTrackData;
};
