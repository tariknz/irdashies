import { useMemo } from 'react';
import {
  useCarSpeeds,
  useDriverCarIdx,
  useSessionStore,
  useTelemetryValues,
} from '@irdashies/context';
import { useDriverStandings } from './useDriverPositions';

export const useDriverRelatives = ({ buffer }: { buffer: number }) => {
  const drivers = useDriverStandings();
  const carIdxLapDistPct = useTelemetryValues('CarIdxLapDistPct');
  const carIdxLap = useTelemetryValues('CarIdxLap');
  const trackLength = useSessionStore((s) => {
    const lengthStr = s.session?.WeekendInfo?.TrackLength;
    let trackLength = 0;
    if (lengthStr) {
      const [value, unit] = lengthStr.split(' ');
      trackLength =
        unit === 'km' ? parseFloat(value) * 1000 : parseFloat(value);
    }
    return trackLength;
  });
  const speeds = useCarSpeeds();

  const playerIndex = useDriverCarIdx();
  const driverCarEstLapTime = useSessionStore(
    (s) => s.session?.DriverInfo?.DriverCarEstLapTime ?? 0
  );

  const standings = useMemo(() => {
    const calculateDeltaV2 = (otherCarIdx: number) => {
      const playerCarIdx = playerIndex ?? 0;

      const playerLapNum = carIdxLap?.[playerCarIdx];
      const playerDistPct = carIdxLapDistPct?.[playerCarIdx];
      const playerSpeed = speeds?.[playerCarIdx];

      const otherLapNum = carIdxLap?.[otherCarIdx];
      const otherDistPct = carIdxLapDistPct?.[otherCarIdx];
      const otherSpeed = speeds?.[otherCarIdx];

      if (
        playerLapNum === undefined ||
        playerLapNum < 0 ||
        playerDistPct === undefined ||
        playerDistPct < 0 ||
        playerDistPct > 1 ||
        otherLapNum === undefined ||
        otherLapNum < 0 ||
        otherDistPct === undefined ||
        otherDistPct < 0 ||
        otherDistPct > 1 ||
        playerSpeed === undefined ||
        playerSpeed <= 0 ||
        otherSpeed === undefined ||
        otherSpeed <= 0
      ) {
        return NaN;
      }

      // Calculate distance difference in percentage
      let distPctDifference = otherDistPct - playerDistPct;
      if (distPctDifference > 0.5) {
        distPctDifference -= 1.0;
      } else if (distPctDifference < -0.5) {
        distPctDifference += 1.0;
      }

      // Calculate time delta based on speed difference
      // If cars are moving at different speeds, calculate how long it would take
      // to close the distance gap at the current speed difference
      const speedDifference = otherSpeed - playerSpeed;
      if (speedDifference === 0) {
        // If speeds are equal, use the position-based calculation
        return distPctDifference * driverCarEstLapTime;
      }

      // Calculate time to close the gap based on speed difference
      // Convert distance percentage to meters (assuming average track length of 5000m)
      const distanceMeters = distPctDifference * trackLength;

      // Time = Distance / Speed
      // Speed difference is in m/s
      return distanceMeters / speedDifference;
    };

    // const calculateDelta = (otherCarIdx: number) => {
    //   const playerCarIdx = playerIndex ?? 0;

    //   const playerLapNum = carIdxLap?.[playerCarIdx];
    //   const playerDistPct = carIdxLapDistPct?.[playerCarIdx];

    //   const otherLapNum = carIdxLap?.[otherCarIdx];
    //   const otherDistPct = carIdxLapDistPct?.[otherCarIdx];

    //   if (
    //     playerLapNum === undefined || playerLapNum < 0 ||
    //     playerDistPct === undefined || playerDistPct < 0 || playerDistPct > 1 ||
    //     otherLapNum === undefined || otherLapNum < 0 ||
    //     otherDistPct === undefined || otherDistPct < 0 || otherDistPct > 1 ||
    //     driverCarEstLapTime <= 0
    //   ) {
    //     return NaN;
    //   }

    //   let distPctDifference = otherDistPct - playerDistPct;

    //   if (distPctDifference > 0.5) {
    //     distPctDifference -= 1.0;
    //   } else if (distPctDifference < -0.5) {
    //     distPctDifference += 1.0;
    //   }

    //   const timeDelta = distPctDifference * driverCarEstLapTime;

    //   return timeDelta;
    // };

    const isHalfLapDifference = (car1: number, car2: number) => {
      const diff = (car1 - car2 + 1) % 1;
      return diff <= 0.5;
    };

    const filterAndMapDrivers = (isAhead: boolean) => {
      return drivers
        .filter((driver) => driver.onTrack || driver.carIdx === playerIndex)
        .filter((result) => {
          const playerDistPct = carIdxLapDistPct?.[playerIndex ?? 0];
          const carDistPct = carIdxLapDistPct?.[result.carIdx];
          return isAhead
            ? isHalfLapDifference(carDistPct, playerDistPct)
            : isHalfLapDifference(playerDistPct, carDistPct);
        })
        .map((result) => ({
          ...result,
          delta: calculateDeltaV2(result.carIdx),
        }))
        .filter((result) => (isAhead ? result.delta > 0 : result.delta < 0))
        .sort((a, b) => (isAhead ? a.delta - b.delta : b.delta - a.delta))
        .slice(0, buffer)
        .sort((a, b) => b.delta - a.delta);
    };

    const carsAhead = filterAndMapDrivers(true);
    const player = drivers.find((result) => result.carIdx === playerIndex);
    const carsBehind = filterAndMapDrivers(false);

    if (!player) {
      return [];
    }

    const relatives = [...carsAhead, { ...player, delta: 0 }, ...carsBehind];

    return relatives;
  }, [
    drivers,
    playerIndex,
    carIdxLap,
    carIdxLapDistPct,
    speeds,
    trackLength,
    driverCarEstLapTime,
    buffer,
  ]);

  return standings;
};
