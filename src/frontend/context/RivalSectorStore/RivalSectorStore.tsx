import { create } from 'zustand';
import { useStoreWithEqualityFn } from 'zustand/traditional';
import { shallow } from 'zustand/shallow';
import type { Sector } from '@irdashies/types';
import {
  getSectorIdx,
  interpolateCrossingTime,
} from '../SectorTimingStore/SectorTimingStore';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface CarSectorData {
  currentLap: number | null;
  currentSectorIdx: number;
  sectorEntryTime: number;
  lastLapDistPct: number;
  lastSessionTime: number;
  // Keeps last 2 laps of completed sector times per lap.
  // Map key = lap number; value = per-sector time array (null = not yet completed).
  sectorTimesByLap: Map<number, (number | null)[]>;
}

interface UpdateParams {
  carIdxLapDistPct: number[];
  carIdxLap: number[];
  sessionTime: number;
  sessionNum: number | null;
  sectors: Sector[];
}

interface RivalSectorStoreState {
  cars: Record<number, CarSectorData>;
  sessionNum: number | null;
  update: (params: UpdateParams) => void;
  reset: () => void;
}

/** Fresh numeric delta, pending (animation), stale (previous lap, italic), or no data yet. */
export type SectorDelta = number | { value: number; stale: true } | '...' | null;

// ---------------------------------------------------------------------------
// Constants (mirrors SectorTimingStore)
// ---------------------------------------------------------------------------

const MIN_PROGRESS = 0.00005;
const MAX_FORWARD_JUMP = 0.5;

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

export const useRivalSectorStore = create<RivalSectorStoreState>((set, get) => ({
  cars: {},
  sessionNum: null,

  update: ({ carIdxLapDistPct, carIdxLap, sessionTime, sectors }) => {
    if (!sectors.length || !carIdxLapDistPct?.length) return;

    const state = get();
    const updatedCars = { ...state.cars };
    let changed = false;

    for (let carIdx = 0; carIdx < carIdxLapDistPct.length; carIdx++) {
      const lapDistPct = carIdxLapDistPct[carIdx];
      const lapNum = carIdxLap?.[carIdx] ?? null;

      if (lapDistPct === undefined || lapDistPct < 0) continue;

      const prev = updatedCars[carIdx];

      // First tick for this car — initialise
      if (!prev) {
        const sectorIdx = getSectorIdx(lapDistPct, sectors);
        const lap = lapNum;
        const lapMap = new Map<number, (number | null)[]>();
        if (lap !== null) lapMap.set(lap, sectors.map(() => null));
        updatedCars[carIdx] = {
          currentLap: lap,
          currentSectorIdx: sectorIdx,
          sectorEntryTime: sessionTime,
          lastLapDistPct: lapDistPct,
          lastSessionTime: sessionTime,
          sectorTimesByLap: lapMap,
        };
        changed = true;
        continue;
      }

      const {
        lastLapDistPct,
        lastSessionTime,
        currentSectorIdx,
        sectorEntryTime,
        currentLap: prevLap,
        sectorTimesByLap,
      } = prev;

      const delta = lapDistPct - lastLapDistPct;

      // Detect S/F wrap-around: car was near the end and wrapped to near start
      const lastSectorStart = sectors[sectors.length - 1]?.SectorStartPct ?? 0;
      const firstSectorEnd = sectors[1]?.SectorStartPct ?? 1;
      const isWrapAround =
        delta < 0 &&
        lastLapDistPct >= lastSectorStart &&
        lapDistPct < firstSectorEnd;

      if (isWrapAround) {
        const crossingTime = interpolateCrossingTime(
          1.0,
          lastLapDistPct,
          lastSessionTime,
          lapDistPct + 1.0,
          sessionTime
        );
        const sectorTime = crossingTime - sectorEntryTime;

        // Save last sector of the completing lap
        const newSectorTimes = new Map(sectorTimesByLap);
        if (prevLap !== null) {
          const lapTimes = newSectorTimes.get(prevLap) ?? sectors.map(() => null);
          const updated = [...lapTimes];
          updated[currentSectorIdx] = sectorTime;
          newSectorTimes.set(prevLap, updated);
        }

        // Prepare new lap
        const newLap = lapNum ?? (prevLap !== null ? prevLap + 1 : null);
        if (newLap !== null) {
          newSectorTimes.set(newLap, sectors.map(() => null));
          // Prune: keep only the 2 most recent laps
          if (newSectorTimes.size > 2) {
            const minKey = Math.min(...newSectorTimes.keys());
            newSectorTimes.delete(minKey);
          }
        }

        updatedCars[carIdx] = {
          ...prev,
          currentLap: newLap,
          currentSectorIdx: 0,
          sectorEntryTime: crossingTime,
          lastLapDistPct: lapDistPct,
          lastSessionTime: sessionTime,
          sectorTimesByLap: newSectorTimes,
        };
        changed = true;
        continue;
      }

      // Skip backward jumps / teleports
      if (delta < 0 || delta > MAX_FORWARD_JUMP) {
        const newSectorIdx = getSectorIdx(lapDistPct, sectors);
        updatedCars[carIdx] = {
          ...prev,
          currentSectorIdx: newSectorIdx,
          sectorEntryTime: sessionTime,
          lastLapDistPct: lapDistPct,
          lastSessionTime: sessionTime,
        };
        changed = true;
        continue;
      }

      // Update last seen position even if below MIN_PROGRESS
      const baseUpdate = {
        lastLapDistPct: lapDistPct,
        lastSessionTime: sessionTime,
      };

      if (delta < MIN_PROGRESS) {
        if (delta !== 0) {
          updatedCars[carIdx] = { ...prev, ...baseUpdate };
          changed = true;
        }
        continue;
      }

      const newSectorIdx = getSectorIdx(lapDistPct, sectors);
      if (newSectorIdx === currentSectorIdx) {
        updatedCars[carIdx] = { ...prev, ...baseUpdate };
        changed = true;
        continue;
      }

      // Crossed into a new sector
      const boundary = sectors[newSectorIdx].SectorStartPct;
      const crossingTime = interpolateCrossingTime(
        boundary,
        lastLapDistPct,
        lastSessionTime,
        lapDistPct,
        sessionTime
      );
      const sectorTime = crossingTime - sectorEntryTime;

      const newSectorTimes = new Map(sectorTimesByLap);
      const lap = prevLap;
      if (lap !== null) {
        const lapTimes = newSectorTimes.get(lap) ?? sectors.map(() => null);
        const updated = [...lapTimes];
        updated[currentSectorIdx] = sectorTime;
        newSectorTimes.set(lap, updated);
      }

      updatedCars[carIdx] = {
        ...prev,
        currentSectorIdx: newSectorIdx,
        sectorEntryTime: crossingTime,
        lastLapDistPct: lapDistPct,
        lastSessionTime: sessionTime,
        sectorTimesByLap: newSectorTimes,
      };
      changed = true;
    }

    if (changed) set({ cars: updatedCars });
  },

  reset: () => set({ cars: {}, sessionNum: null }),
}));

// ---------------------------------------------------------------------------
// Selectors
// ---------------------------------------------------------------------------

export const useRivalSectorDeltas = (
  playerCarIdx: number,
  rivalCarIdx: number
): { sectorDeltas: SectorDelta[]; lapDelta: SectorDelta } => {
  return useStoreWithEqualityFn(
    useRivalSectorStore,
    (s) => {
      const player = s.cars[playerCarIdx];
      const rival = s.cars[rivalCarIdx];

      if (!player || !rival || player.currentLap === null || rival.currentLap === null) {
        return { sectorDeltas: [], lapDelta: null };
      }

      const lapGap = Math.abs(rival.currentLap - player.currentLap);
      if (lapGap > 1) {
        return { sectorDeltas: [], lapDelta: null };
      }

      // Use the earlier lap as the comparison basis (see plan: compareLap trick)
      const compareLap = Math.min(player.currentLap, rival.currentLap);
      const playerTimes = player.sectorTimesByLap.get(compareLap);
      const rivalTimes = rival.sectorTimesByLap.get(compareLap);

      if (!playerTimes && !rivalTimes) return { sectorDeltas: [], lapDelta: null };

      const numSectors = playerTimes?.length ?? rivalTimes?.length ?? 0;
      const sectorDeltas: SectorDelta[] = [];
      let lapDeltaSum = 0;
      let anyPending = false;
      let allNull = true;

      const prevLap = compareLap - 1;
      const prevPlayerTimes = player.sectorTimesByLap.get(prevLap);
      const prevRivalTimes = rival.sectorTimesByLap.get(prevLap);

      for (let n = 0; n < numSectors; n++) {
        const pt = playerTimes?.[n] ?? null;
        const rt = rivalTimes?.[n] ?? null;

        if (pt !== null && rt !== null) {
          // Both completed this sector — fresh delta (positive = rival faster = red)
          const d = pt - rt;
          sectorDeltas.push(d);
          lapDeltaSum += d;
          allNull = false;
        } else {
          // At least one car hasn't finished this sector yet — try previous lap as stale fallback
          const prevPt = prevPlayerTimes?.[n] ?? null;
          const prevRt = prevRivalTimes?.[n] ?? null;
          if (prevPt !== null && prevRt !== null) {
            sectorDeltas.push({ value: prevPt - prevRt, stale: true });
            anyPending = true;
            allNull = false;
          } else if (pt !== null || rt !== null) {
            sectorDeltas.push('...');
            anyPending = true;
            allNull = false;
          } else {
            sectorDeltas.push(null);
          }
        }
      }

      const lapDelta: SectorDelta = allNull
        ? null
        : anyPending
          ? '...'
          : lapDeltaSum;

      return { sectorDeltas, lapDelta };
    },
    shallow
  );
};
