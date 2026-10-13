import { useMemo, useState, useEffect, useRef } from 'react';
import type { BlindSpotSnapshot } from '@irdashies/types';
import { shallow } from 'zustand/shallow';
import {
  useBlindSpotSelector,
  useDriverCarIdx,
  useTrackLength,
} from '@irdashies/context';
import { useBlindSpotMonitorSettings } from './useBlindSpotMonitorSettings';
import { CarLeftRight } from '@irdashies/types';

interface BlindSpotMonitorState {
  isOnTrack: boolean;
  show: boolean;
  leftState: CarLeftRight;
  rightState: CarLeftRight;
  leftPercent: number;
  rightPercent: number;
  disableTransition: boolean;
}

const EMPTY_POSITIONS: readonly number[] = [];
const TELEPORT_THRESHOLD = 0.5;
const DEFAULT_DIST_M = 4;

const selectBlindSpotTelemetry = (snapshot: BlindSpotSnapshot) =>
  [
    snapshot.carLeftRight as CarLeftRight,
    snapshot.carIdxLapDistPct,
    snapshot.isOnTrack,
    snapshot.leftLongitudinalM,
    snapshot.rightLongitudinalM,
  ] as const;

/**
 * Scalars first, deliberately. The lap-fraction array is over a hundred
 * elements and `shallow` walks all of it, so comparing it last means a tick
 * where a scalar moved never pays for the walk -- and a sim supplying true
 * offsets leaves that array empty, so it never pays at all.
 */
const blindSpotTelemetryEqual = (
  previous: ReturnType<typeof selectBlindSpotTelemetry>,
  next: ReturnType<typeof selectBlindSpotTelemetry>
) =>
  previous[0] === next[0] &&
  previous[2] === next[2] &&
  previous[3] === next[3] &&
  previous[4] === next[4] &&
  shallow(previous[1], next[1]);

export const useBlindSpotMonitor = (): BlindSpotMonitorState => {
  const [
    carLeftRight,
    lapDistPcts,
    isOnTrack,
    leftLongitudinalM,
    rightLongitudinalM,
  ] = useBlindSpotSelector(selectBlindSpotTelemetry, {
    equality: blindSpotTelemetryEqual,
  }) ?? [CarLeftRight.Off, EMPTY_POSITIONS, false, null, null];
  const driverCarIdx = useDriverCarIdx() ?? 0;
  const trackLength = useTrackLength();
  const settings = useBlindSpotMonitorSettings();

  const [leftCarIdx, setLeftCarIdx] = useState<number | null>(null);
  const [rightCarIdx, setRightCarIdx] = useState<number | null>(null);
  const prevPercentsRef = useRef<{
    left: number | null;
    right: number | null;
  }>({ left: null, right: null });

  /**
   * Whether the sim reports a true relative position.
   *
   * At least one side carries a number whenever a car is alongside, because
   * the producer picks the offsets from the very cars that set the state. So
   * both being null while the state says otherwise means this sim does not
   * report them, and the lap-fraction reconstruction applies.
   */
  const hasOffsets = leftLongitudinalM !== null || rightLongitudinalM !== null;

  const result = useMemo(() => {
    const defaultState = {
      isOnTrack,
      show: false,
      leftState: CarLeftRight.Off,
      rightState: CarLeftRight.Off,
      leftPercent: 0,
      rightPercent: 0,
      disableTransition: false,
    };

    if (!settings || !isOnTrack || carLeftRight <= CarLeftRight.Clear) {
      return defaultState;
    }

    const distAhead = settings.distAhead ?? DEFAULT_DIST_M;
    const distBehind = settings.distBehind ?? DEFAULT_DIST_M;
    const clampToBar = (ratio: number) =>
      Math.round(Math.max(-1, Math.min(1, ratio)) * 1000) / 1000;

    /** Metres fore or aft, straight to a bar position. */
    const percentFromMetres = (metres: number | null): number =>
      metres === null
        ? 0
        : clampToBar(metres / (metres > 0 ? distAhead : distBehind));

    /**
     * The fallback: reconstruct a fore/aft offset by subtracting lap
     * fractions. Only as good as the rate the sim updates them at.
     */
    const percentFromLapDist = (idx: number | null): number => {
      if (
        idx === null ||
        !trackLength ||
        lapDistPcts[idx] === undefined ||
        lapDistPcts[idx] === -1
      ) {
        return 0;
      }
      const driverCarDistPct = lapDistPcts[driverCarIdx];
      if (driverCarDistPct === undefined || driverCarDistPct === -1) return 0;
      let diff = lapDistPcts[idx] - driverCarDistPct;
      if (diff > 0.5) diff -= 1;
      else if (diff < -0.5) diff += 1;
      return clampToBar(
        diff / ((diff > 0 ? distAhead : distBehind) / trackLength)
      );
    };

    if (!hasOffsets && !trackLength) return defaultState;

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

    if (hasLeft) {
      leftState =
        carLeftRight === CarLeftRight.Cars2Left
          ? CarLeftRight.Cars2Left
          : CarLeftRight.CarLeft;
      leftPercent = hasOffsets
        ? percentFromMetres(leftLongitudinalM)
        : is3Wide && leftCarIdx === null
          ? 0
          : percentFromLapDist(leftCarIdx);

      const previousLeft = prevPercentsRef.current.left;
      if (
        previousLeft !== null &&
        Math.abs(previousLeft - leftPercent) > TELEPORT_THRESHOLD
      ) {
        disableTransition = true;
      }
    }

    if (hasRight) {
      rightState =
        carLeftRight === CarLeftRight.Cars2Right
          ? CarLeftRight.Cars2Right
          : CarLeftRight.CarRight;
      rightPercent = hasOffsets
        ? percentFromMetres(rightLongitudinalM)
        : is3Wide && rightCarIdx === null
          ? 0
          : percentFromLapDist(rightCarIdx);

      const previousRight = prevPercentsRef.current.right;
      if (
        previousRight !== null &&
        Math.abs(previousRight - rightPercent) > TELEPORT_THRESHOLD
      ) {
        disableTransition = true;
      }
    }

    return {
      isOnTrack,
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
    hasOffsets,
    leftLongitudinalM,
    rightLongitudinalM,
  ]);

  useEffect(() => {
    if (carLeftRight <= CarLeftRight.Clear) {
      setLeftCarIdx(null);
      setRightCarIdx(null);
      prevPercentsRef.current = { left: null, right: null };
      return;
    }

    prevPercentsRef.current = {
      left: result.leftPercent !== 0 ? result.leftPercent : null,
      right: result.rightPercent !== 0 ? result.rightPercent : null,
    };

    // Nothing to search for. The producer already named the car alongside, so
    // tracking indices here would cost two state updates -- and a re-render --
    // per tick to arrive at the number already in hand.
    if (hasOffsets) return;

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
  }, [
    result.show,
    carLeftRight,
    lapDistPcts,
    driverCarIdx,
    result.leftPercent,
    result.rightPercent,
    leftCarIdx,
    rightCarIdx,
    hasOffsets,
  ]);

  return result;
};
