import { useMemo } from 'react';
import type { TrackStateSnapshot } from '@irdashies/types';
import { shallow } from 'zustand/shallow';
import { useTrackStateSelector, useFocusCarIdx } from '@irdashies/context';

export interface PitlaneTrafficResult {
  carsAhead: number;
  carsBehind: number;
  totalCars: number;
}

const EMPTY_TRAFFIC: readonly [readonly boolean[], readonly number[]] = [
  [],
  [],
];

const selectTraffic = (snapshot: TrackStateSnapshot) =>
  [snapshot.carIdxOnPitRoad, snapshot.carIdxLapDistPct] as const;

const trafficEqual = (
  previous: ReturnType<typeof selectTraffic>,
  next: ReturnType<typeof selectTraffic>
) => shallow(previous[0], next[0]) && shallow(previous[1], next[1]);

export const usePitlaneTraffic = (enabled: boolean): PitlaneTrafficResult => {
  const focusCarIdx = useFocusCarIdx();
  const [carIdxOnPitRoadRaw, carIdxLapDistPctRaw] =
    useTrackStateSelector(selectTraffic, { equality: trafficEqual }) ??
    EMPTY_TRAFFIC;

  return useMemo(() => {
    const carIdxOnPitRoad = carIdxOnPitRoadRaw;
    const carIdxLapDistPct = carIdxLapDistPctRaw;

    if (!enabled || focusCarIdx === undefined) {
      return { carsAhead: 0, carsBehind: 0, totalCars: 0 };
    }

    const playerDistPct = carIdxLapDistPct[focusCarIdx] ?? 0;

    // Find all cars in pitlane (excluding player)
    const traffic = carIdxOnPitRoad
      .map((onPitRoad, idx) => ({
        idx,
        onPitRoad,
        dist: carIdxLapDistPct[idx] ?? 0,
      }))
      .filter((car) => car.onPitRoad && car.idx !== focusCarIdx)
      .map((car) => {
        // Calculate relative position with wrap-around
        let rel = car.dist - playerDistPct;
        if (rel > 0.5) {
          rel -= 1.0; // Car is behind but crosses start/finish
        } else if (rel < -0.5) {
          rel += 1.0; // Car is ahead but crosses start/finish
        }
        return { ...car, isAhead: rel > 0 };
      });

    const carsAhead = traffic.filter((c) => c.isAhead).length;
    const carsBehind = traffic.length - carsAhead;

    return {
      carsAhead,
      carsBehind,
      totalCars: traffic.length,
    };
  }, [enabled, focusCarIdx, carIdxOnPitRoadRaw, carIdxLapDistPctRaw]);
};
