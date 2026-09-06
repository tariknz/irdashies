import { useMemo } from 'react';
import {
  useSessionQualifyingResults,
  useSessionQualifyPositions,
  useStandingsSnapshot,
} from '@irdashies/context';
import type { SessionQualifyPosition, SessionResults } from '@irdashies/types';

/**
 * Normalises qualifying results the same way for every consumer.
 *
 * In heat race formats `QualifyResultsInfo.Results` is null; the race
 * session's `QualifyPositions` then holds the real starting grid order
 * instead, so this falls back to mapping that shape onto `SessionResults`.
 */
export const normalizeQualifyingResults = (
  raw: SessionResults[] | undefined,
  qualifyPositions: SessionQualifyPosition[] | undefined
): SessionResults[] | undefined => {
  if (raw?.length) return raw;
  return qualifyPositions?.map((q) => ({
    Position: q.Position + 1,
    ClassPosition: q.ClassPosition,
    CarIdx: q.CarIdx,
    Lap: q.FastestLap,
    Time: q.FastestTime,
    FastestLap: q.FastestLap,
    FastestTime: q.FastestTime,
    LastTime: -1,
    LapsLed: 0,
    LapsComplete: 0,
    JokerLapsComplete: 0,
    LapsDriven: 0,
    Incidents: 0,
    ReasonOutId: 0,
    ReasonOutStr: 'Running',
  }));
};

/**
 * Qualifying results, with the heat-race `QualifyPositions` fallback applied.
 *
 * Memoised on the two source arrays: the fallback branch used to allocate a
 * brand-new array on every render, and that array fed the big
 * `standingsWithGain` memo in `useDriverStandings` as a dependency — so heat
 * races rebuilt the whole standings tree on every render for no reason. This
 * keeps the identity stable when neither source array has actually changed.
 */
export const useQualifyingResults = (): SessionResults[] | undefined => {
  const standingsSnapshot = useStandingsSnapshot();
  const sessionNum = standingsSnapshot?.sessionNum ?? undefined;
  const raw = useSessionQualifyingResults();
  const qualifyPositions = useSessionQualifyPositions(sessionNum);

  return useMemo(
    () => normalizeQualifyingResults(raw, qualifyPositions),
    [raw, qualifyPositions]
  );
};

/**
 * carIdx -> 1-based qualifying grid slot, for one class's roster.
 *
 * A driver with a qualifying result gets `ClassPosition + 1` — the same
 * convention `augmentStandingsWithPositionChange` in `createStandings.ts`
 * already uses.
 *
 * A driver with no result (no qualifying data at all, or just missing from
 * it) is placed past the qualified field by their carIdx. Both halves depend
 * only on session data and the car's own index, never on who else is in
 * `carIdxs` — a driver retiring must not restyle everyone else's line
 * mid-race, which is exactly what ranking the unqualified cars against the
 * current roster would do.
 */
export const qualifyingGridSlots = (
  results: SessionResults[] | undefined,
  carIdxs: readonly number[]
): ReadonlyMap<number, number> => {
  const qualifiedSlotByCarIdx = new Map<number, number>();
  let highestQualifiedSlot = 0;

  for (const result of results ?? []) {
    // Rejects null and non-integers too: `isFinite(null)` is true, which
    // would silently hand that car the pole sitter's identity.
    if (!Number.isInteger(result.ClassPosition) || result.ClassPosition < 0) {
      continue;
    }
    const slot = result.ClassPosition + 1;
    qualifiedSlotByCarIdx.set(result.CarIdx, slot);
    if (slot > highestQualifiedSlot) highestQualifiedSlot = slot;
  }

  const slots = new Map<number, number>();
  for (const carIdx of carIdxs) {
    slots.set(
      carIdx,
      qualifiedSlotByCarIdx.get(carIdx) ?? highestQualifiedSlot + 1 + carIdx
    );
  }

  return slots;
};

/** `qualifyingGridSlots`, held stable across renders for the same class roster. */
export const useQualifyingGrid = (
  carIdxs: readonly number[]
): ReadonlyMap<number, number> => {
  const results = useQualifyingResults();
  const carIdxsKey = carIdxs.join(',');

  return useMemo(
    () => qualifyingGridSlots(results, carIdxs),
    // Deliberately keyed on the carIdx signature, not list identity — callers
    // commonly pass a freshly derived array every render.
    // eslint-disable-next-line @eslint-react/exhaustive-deps
    [results, carIdxsKey]
  );
};
