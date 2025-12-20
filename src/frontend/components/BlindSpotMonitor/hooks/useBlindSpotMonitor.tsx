import { useMemo } from 'react';
import { useTelemetryValues, useTelemetryValue } from '@irdashies/context';
import { useDriverCarIdx, useTrackLength } from '@irdashies/context';
import { useBlindSpotMonitorSettings } from './useBlindSpotMonitorSettings';

interface BlindSpotMonitorState {
  show: boolean;
  leftState: number;
  rightState: number;
  leftPercent: number;
  rightPercent: number;
}

export const useBlindSpotMonitor = (): BlindSpotMonitorState => {
  const carLeftRight = useTelemetryValues<number[]>('CarLeftRight');
  const lapDistPcts = useTelemetryValues<number[]>('CarIdxLapDistPct');
  const driverCarIdx = useDriverCarIdx();
  const trackLength = useTrackLength();
  const settings = useBlindSpotMonitorSettings();
  const isOnTrack = useTelemetryValue<boolean>('IsOnTrack') ?? false;

  return useMemo(() => {
    if (!carLeftRight || !lapDistPcts || driverCarIdx === undefined || !trackLength || !settings || !isOnTrack) {
      return {
        show: false,
        leftState: 0,
        rightState: 0,
        leftPercent: 0,
        rightPercent: 0,
      };
    }

    const carLeftRightValue = carLeftRight[0] ?? 0;
    
    if (carLeftRightValue <= 1) {
      return {
        show: false,
        leftState: 0,
        rightState: 0,
        leftPercent: 0,
        rightPercent: 0,
      };
    }

    const driverCarDistPct = lapDistPcts[driverCarIdx];
    if (driverCarDistPct === undefined || driverCarDistPct === -1) {
      return {
        show: false,
        leftState: 0,
        rightState: 0,
        leftPercent: 0,
        rightPercent: 0,
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

    let leftState = 0;
    let rightState = 0;
    let leftPercent = 0;
    let rightPercent = 0;

    const closestCarDistPct = findClosestCar();

    if (carLeftRightValue === 2) {
      leftState = 1;
      if (closestCarDistPct !== null) {
        leftPercent = calculatePercent(closestCarDistPct);
      }
    } else if (carLeftRightValue === 3) {
      rightState = 1;
      if (closestCarDistPct !== null) {
        rightPercent = calculatePercent(closestCarDistPct);
      }
    } else if (carLeftRightValue === 4) {
      leftState = 1;
      rightState = 1;
      if (closestCarDistPct !== null) {
        const percent = calculatePercent(closestCarDistPct);
        leftPercent = percent;
        rightPercent = percent;
      }
    } else if (carLeftRightValue === 5) {
      leftState = 2;
      if (closestCarDistPct !== null) {
        leftPercent = calculatePercent(closestCarDistPct);
      }
    } else if (carLeftRightValue === 6) {
      rightState = 2;
      if (closestCarDistPct !== null) {
        rightPercent = calculatePercent(closestCarDistPct);
      }
    }

    return {
      show: true,
      leftState,
      rightState,
      leftPercent,
      rightPercent,
    };
  }, [carLeftRight, lapDistPcts, driverCarIdx, trackLength, settings, isOnTrack]);
};

