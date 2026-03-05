import { useMemo, useState, useEffect } from 'react';
import { useTelemetryValues, useTelemetryValue } from '@irdashies/context';
import { useDriverCarIdx, useTrackLength } from '@irdashies/context';
import { useBlindSpotMonitorSettings } from './useBlindSpotMonitorSettings';
import { CarLeftRight } from '@irdashies/types';

interface BlindSpotMonitorState {
  show: boolean;
  leftState: CarLeftRight;
  rightState: CarLeftRight;
  leftPercent: number;
  rightPercent: number;
  disableTransition: boolean;
}

export const useBlindSpotMonitor = (): BlindSpotMonitorState => {
  const carLeftRight = useTelemetryValue<CarLeftRight>('CarLeftRight');
  const lapDistPcts = useTelemetryValues<number[]>('CarIdxLapDistPct');
  const driverCarIdx = useDriverCarIdx();
  const trackLength = useTrackLength();
  const settings = useBlindSpotMonitorSettings();
  const isOnTrack = useTelemetryValue<boolean>('IsOnTrack') ?? false;
  const [lastPercent, setLastPercent] = useState<number | null>(null);

  const result = useMemo(() => {
    if (
      !carLeftRight ||
      !lapDistPcts ||
      driverCarIdx === undefined ||
      !trackLength ||
      !settings ||
      !isOnTrack
    ) {
      return {
        show: false,
        leftState: CarLeftRight.Off,
        rightState: CarLeftRight.Off,
        leftPercent: 0,
        rightPercent: 0,
        disableTransition: false,
      };
    }

    const carLeftRightValue = carLeftRight ?? CarLeftRight.Off;

    if (carLeftRightValue <= CarLeftRight.Clear) {
      return {
        show: false,
        leftState: CarLeftRight.Clear,
        rightState: CarLeftRight.Clear,
        leftPercent: 0,
        rightPercent: 0,
        disableTransition: false,
      };
    }

    const driverCarDistPct = lapDistPcts[driverCarIdx];
    if (driverCarDistPct === undefined || driverCarDistPct === -1) {
      return {
        show: false,
        leftState: CarLeftRight.Off,
        rightState: CarLeftRight.Off,
        leftPercent: 0,
        rightPercent: 0,
        disableTransition: false,
      };
    }

    const maxDistAhead = settings.distAhead ?? 4;
    const maxDistBehind = settings.distBehind ?? 4;
    const maxDistAPct = maxDistAhead / trackLength;
    const maxDistBPct = maxDistBehind / trackLength;

    const findClosestCar = (): number | null => {
      let closestDist = 1;
      let closestCarDistPct: number | null = null;

      for (let carIdx = 0; carIdx < lapDistPcts.length; carIdx++) {
        if (carIdx === driverCarIdx) continue;

        const dist = lapDistPcts[carIdx];
        if (dist === undefined || dist === -1) continue;

        let d = Math.abs(driverCarDistPct - dist);
        if (d > 0.5) {
          d = 1 - d;
        }

        if (d < closestDist) {
          closestDist = d;
          closestCarDistPct = dist;
        }
      }

      return closestCarDistPct;
    };

    const calculatePercent = (otherCarDistPct: number): number => {
      let diff = otherCarDistPct - driverCarDistPct;

      if (diff > 0.5) {
        diff -= 1;
      } else if (diff < -0.5) {
        diff += 1;
      }

      const percent = diff / (diff > 0 ? maxDistAPct : maxDistBPct);
      return Math.max(-1, Math.min(1, percent));
    };

    let leftState = CarLeftRight.Off;
    let rightState = CarLeftRight.Off;
    let leftPercent = 0;
    let rightPercent = 0;
    let disableTransition = false;

    const isMoving =
      carLeftRightValue === CarLeftRight.CarLeft ||
      carLeftRightValue === CarLeftRight.CarRight;
    const closestCarDistPct = isMoving ? findClosestCar() : null;

    if (carLeftRightValue === CarLeftRight.CarLeft) {
      leftState = CarLeftRight.CarLeft;
      if (closestCarDistPct !== null) {
        leftPercent = calculatePercent(closestCarDistPct);
        if (lastPercent !== null && Math.abs(lastPercent - leftPercent) > 0.5) {
          disableTransition = true;
        }
      }
    } else if (carLeftRightValue === CarLeftRight.CarRight) {
      rightState = CarLeftRight.CarRight;
      if (closestCarDistPct !== null) {
        rightPercent = calculatePercent(closestCarDistPct);
        if (
          lastPercent !== null &&
          Math.abs(lastPercent - rightPercent) > 0.5
        ) {
          disableTransition = true;
        }
      }
    } else if (carLeftRightValue === CarLeftRight.CarLeftRight) {
      leftState = CarLeftRight.CarLeft;
      rightState = CarLeftRight.CarRight;
      leftPercent = 0;
      rightPercent = 0;
    } else if (carLeftRightValue === CarLeftRight.Cars2Left) {
      leftState = CarLeftRight.Cars2Left;
      leftPercent = 0;
    } else if (carLeftRightValue === CarLeftRight.Cars2Right) {
      rightState = CarLeftRight.Cars2Right;
      rightPercent = 0;
    }

    return {
      show: true,
      leftState,
      rightState,
      leftPercent,
      rightPercent,
      disableTransition,
    };
  }, [
    carLeftRight,
    lapDistPcts,
    driverCarIdx,
    trackLength,
    settings,
    isOnTrack,
    lastPercent,
  ]);

  // Track previous percent to detect track wrap-around (when percent jumps > 0.5)
  // This requires setState in useEffect, which is necessary for tracking previous render values
  useEffect(() => {
    if (!result.show) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setLastPercent(null);
      return;
    }

    const currentPercent =
      result.leftPercent !== 0 ? result.leftPercent : result.rightPercent;
    const isMoving =
      result.leftState === CarLeftRight.CarLeft ||
      result.rightState === CarLeftRight.CarRight;

    if (isMoving && currentPercent !== 0) {
      setLastPercent(currentPercent);
    } else {
      setLastPercent(null);
    }
  }, [
    result.show,
    result.leftPercent,
    result.rightPercent,
    result.leftState,
    result.rightState,
  ]);

  return result;
};
