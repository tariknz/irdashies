import { useMemo, useState, useEffect } from 'react';
import {
  useTelemetryValues,
  useTelemetryValue,
  useDriverCarIdx,
} from '@irdashies/context';
import { useTrackLength } from '@irdashies/context';
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
  const carLeftRight =
    useTelemetryValue<CarLeftRight>('CarLeftRight') ?? CarLeftRight.Off;
  const lapDistPcts = useTelemetryValues<number[]>('CarIdxLapDistPct');
  const driverCarIdx = useDriverCarIdx() ?? 0;
  const trackLength = useTrackLength();
  const settings = useBlindSpotMonitorSettings();
  const isOnTrack = useTelemetryValue<boolean>('IsOnTrack') ?? false;

  const [leftCarIdx, setLeftCarIdx] = useState<number | null>(null);
  const [rightCarIdx, setRightCarIdx] = useState<number | null>(null);
  const [prevPercents, setPrevPercents] = useState<{
    left: number | null;
    right: number | null;
  }>({
    left: null,
    right: null,
  });

  const result = useMemo(() => {
    const defaultState = {
      show: false,
      leftState: CarLeftRight.Off,
      rightState: CarLeftRight.Off,
      leftPercent: 0,
      rightPercent: 0,
      disableTransition: false,
    };

    if (
      !lapDistPcts ||
      driverCarIdx === undefined ||
      !trackLength ||
      !settings ||
      !isOnTrack ||
      carLeftRight <= CarLeftRight.Clear
    ) {
      return defaultState;
    }

    const driverCarDistPct = lapDistPcts[driverCarIdx];
    if (driverCarDistPct === undefined || driverCarDistPct === -1)
      return defaultState;

    const maxDistAPct = (settings.distAhead ?? 4) / trackLength;
    const maxDistBPct = (settings.distBehind ?? 4) / trackLength;

    const calculatePercent = (idx: number | null): number => {
      if (
        idx === null ||
        lapDistPcts[idx] === undefined ||
        lapDistPcts[idx] === -1
      )
        return 0;
      let diff = lapDistPcts[idx] - driverCarDistPct;
      if (diff > 0.5) diff -= 1;
      else if (diff < -0.5) diff += 1;
      const percent = diff / (diff > 0 ? maxDistAPct : maxDistBPct);
      return Math.round(Math.max(-1, Math.min(1, percent)) * 1000) / 1000;
    };

    let leftState = CarLeftRight.Off;
    let rightState = CarLeftRight.Off;
    let leftPercent = 0;
    let rightPercent = 0;
    let disableTransition = false;

    const is3Wide = carLeftRight === CarLeftRight.CarLeftRight;
    const hasLeft =
      is3Wide ||
      carLeftRight === CarLeftRight.CarLeft ||
      carLeftRight === CarLeftRight.Cars2Left;
    const hasRight =
      is3Wide ||
      carLeftRight === CarLeftRight.CarRight ||
      carLeftRight === CarLeftRight.Cars2Right;

    // Logic for Left Slot
    if (hasLeft) {
      leftState =
        carLeftRight === CarLeftRight.Cars2Left
          ? CarLeftRight.Cars2Left
          : CarLeftRight.CarLeft;
      // If 3-wide but we don't have a locked ID, keep it centered (0)
      leftPercent =
        is3Wide && leftCarIdx === null ? 0 : calculatePercent(leftCarIdx);

      if (
        prevPercents.left !== null &&
        Math.abs(prevPercents.left - leftPercent) > 0.5
      ) {
        disableTransition = true;
      }
    }

    // Logic for Right Slot
    if (hasRight) {
      rightState =
        carLeftRight === CarLeftRight.Cars2Right
          ? CarLeftRight.Cars2Right
          : CarLeftRight.CarRight;
      // If 3-wide but we don't have a locked ID, keep it centered (0)
      rightPercent =
        is3Wide && rightCarIdx === null ? 0 : calculatePercent(rightCarIdx);

      if (
        prevPercents.right !== null &&
        Math.abs(prevPercents.right - rightPercent) > 0.5
      ) {
        disableTransition = true;
      }
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
    leftCarIdx,
    rightCarIdx,
    prevPercents,
  ]);

  useEffect(() => {
    if (carLeftRight <= CarLeftRight.Clear) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setLeftCarIdx(null);
      setRightCarIdx(null);
      setPrevPercents({ left: null, right: null });
      return;
    }

    const driverDist = lapDistPcts[driverCarIdx];
    const findClosestExcluding = (excludeIdx: number | null) => {
      let closestDist = 1;
      let closestIdx = null;
      for (let i = 0; i < lapDistPcts.length; i++) {
        if (i === driverCarIdx || i === excludeIdx || lapDistPcts[i] === -1)
          continue;
        let d = Math.abs(driverDist - lapDistPcts[i]);
        if (d > 0.5) d = 1 - d;
        if (d < closestDist) {
          closestDist = d;
          closestIdx = i;
        }
      }
      return closestIdx;
    };

    const is3Wide = carLeftRight === CarLeftRight.CarLeftRight;
    const isLeftOnly =
      carLeftRight === CarLeftRight.CarLeft ||
      carLeftRight === CarLeftRight.Cars2Left;
    const isRightOnly =
      carLeftRight === CarLeftRight.CarRight ||
      carLeftRight === CarLeftRight.Cars2Right;

    if (isLeftOnly) {
      // ALWAYS find the closest car for the active side to ensure it's not stale
      const closest = findClosestExcluding(null);
      setLeftCarIdx(closest);
      setRightCarIdx(null); // Clear opposite
    } else if (isRightOnly) {
      const closest = findClosestExcluding(null);
      setRightCarIdx(closest);
      setLeftCarIdx(null); // Clear opposite
    } else if (is3Wide) {
      // If we have one, find the other.
      if (leftCarIdx !== null && rightCarIdx === null) {
        setRightCarIdx(findClosestExcluding(leftCarIdx));
      } else if (rightCarIdx !== null && leftCarIdx === null) {
        setLeftCarIdx(findClosestExcluding(rightCarIdx));
      }
      // If BOTH are null (fresh 3-wide), we stay at 0%
    }

    setPrevPercents({
      left: result.leftPercent !== 0 ? result.leftPercent : null,
      right: result.rightPercent !== 0 ? result.rightPercent : null,
    });
  }, [
    result.show,
    carLeftRight,
    lapDistPcts,
    driverCarIdx,
    result.leftPercent,
    result.rightPercent,
    leftCarIdx,
    rightCarIdx,
  ]);

  return result;
};
