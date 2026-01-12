import { useMemo, useState, useEffect } from 'react';
import { useTelemetryValues, useTelemetryValue } from '@irdashies/context';
import { useDriverCarIdx, useTrackLength } from '@irdashies/context';
import { useBlindSpotMonitorSettings } from './useBlindSpotMonitorSettings';

export type BlindSpotState = 'Off' | 'Clear' | 'CarLeft' | 'CarRight' | 'Cars2Left' | 'Cars2Right';

interface BlindSpotMonitorState {
  show: boolean;
  leftState: BlindSpotState;
  rightState: BlindSpotState;
  leftPercent: number;
  rightPercent: number;
  disableTransition: boolean;
}

export const useBlindSpotMonitor = (): BlindSpotMonitorState => {
  const carLeftRight = useTelemetryValues<number[]>('CarLeftRight');
  const lapDistPcts = useTelemetryValues<number[]>('CarIdxLapDistPct');
  const driverCarIdx = useDriverCarIdx();
  const trackLength = useTrackLength();
  const settings = useBlindSpotMonitorSettings();
  const isOnTrack = useTelemetryValue<boolean>('IsOnTrack') ?? false;
  const [lastPercent, setLastPercent] = useState<number | null>(null);

  const result = useMemo(() => {
    if (!carLeftRight || !lapDistPcts || driverCarIdx === undefined || !trackLength || !settings || !isOnTrack) {
      return {
        show: false,
        leftState: 'Off' as BlindSpotState,
        rightState: 'Off' as BlindSpotState,
        leftPercent: 0,
        rightPercent: 0,
        disableTransition: false,
      };
    }

    const carLeftRightValue = carLeftRight[0] ?? 0;
    
    if (carLeftRightValue <= 1) {
      return {
        show: false,
        leftState: 'Clear' as BlindSpotState,
        rightState: 'Clear' as BlindSpotState,
        leftPercent: 0,
        rightPercent: 0,
        disableTransition: false,
      };
    }

    const driverCarDistPct = lapDistPcts[driverCarIdx];
    if (driverCarDistPct === undefined || driverCarDistPct === -1) {
      return {
        show: false,
        leftState: 'Off' as BlindSpotState,
        rightState: 'Off' as BlindSpotState,
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

    let leftState: BlindSpotState = 'Off';
    let rightState: BlindSpotState = 'Off';
    let leftPercent = 0;
    let rightPercent = 0;
    let disableTransition = false;

    const isMoving = carLeftRightValue === 2 || carLeftRightValue === 3;
    const closestCarDistPct = isMoving ? findClosestCar() : null;

    if (carLeftRightValue === 2) {
      leftState = 'CarLeft';
      if (closestCarDistPct !== null) {
        leftPercent = calculatePercent(closestCarDistPct);
        if (lastPercent !== null && Math.abs(lastPercent - leftPercent) > 0.5) {
          disableTransition = true;
        }
      }
    } else if (carLeftRightValue === 3) {
      rightState = 'CarRight';
      if (closestCarDistPct !== null) {
        rightPercent = calculatePercent(closestCarDistPct);
        if (lastPercent !== null && Math.abs(lastPercent - rightPercent) > 0.5) {
          disableTransition = true;
        }
      }
    } else if (carLeftRightValue === 4) {
      leftState = 'CarLeft';
      rightState = 'CarRight';
      leftPercent = 0;
      rightPercent = 0;
    } else if (carLeftRightValue === 5) {
      leftState = 'Cars2Left';
      leftPercent = 0;
    } else if (carLeftRightValue === 6) {
      rightState = 'Cars2Right';
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
  }, [carLeftRight, lapDistPcts, driverCarIdx, trackLength, settings, isOnTrack, lastPercent]);

  // Track previous percent to detect track wrap-around (when percent jumps > 0.5)
  // This requires setState in useEffect, which is necessary for tracking previous render values
  useEffect(() => {
    if (!result.show) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setLastPercent(null);
      return;
    }

    const currentPercent = result.leftPercent !== 0 ? result.leftPercent : result.rightPercent;
    const isMoving = result.leftState === 'CarLeft' || result.rightState === 'CarRight';

    if (isMoving && currentPercent !== 0) {
      setLastPercent(currentPercent);
    } else {
      setLastPercent(null);
    }
  }, [result.show, result.leftPercent, result.rightPercent, result.leftState, result.rightState]);

  return result;
};

