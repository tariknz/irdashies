import type { Standings } from '@irdashies/domain';
import { SessionState } from '@irdashies/types';

export type BroadcastRow =
  | { kind: 'class'; key: string; name: string; color: number }
  | { kind: 'driver'; key: string; standing: Standings };

/**
 * Flattens class groups into one row list: a header per class, its top
 * `perClass` drivers, and the focus car when it sits further down.
 */
export const buildBroadcastRows = (
  groups: readonly [string, Standings[]][],
  perClass: number,
  focusCarIdx?: number
): BroadcastRow[] => {
  const rows: BroadcastRow[] = [];
  for (const [classId, drivers] of groups) {
    const first = drivers[0];
    if (!first) continue;
    rows.push({
      kind: 'class',
      key: `class-${classId}`,
      name: first.carClass.name,
      color: first.carClass.color,
    });
    drivers.forEach((standing, index) => {
      if (index < perClass || standing.carIdx === focusCarIdx) {
        rows.push({ kind: 'driver', key: `car-${standing.carIdx}`, standing });
      }
    });
  }
  return rows;
};

/** Class places gained (positive) or lost (negative) per carIdx. */
export const diffClassPositions = (
  prev: readonly Standings[],
  next: readonly Standings[]
): Map<number, number> => {
  const before = new Map(prev.map((s) => [s.carIdx, s.classPosition]));
  const changes = new Map<number, number>();
  for (const { carIdx, classPosition } of next) {
    const was = before.get(carIdx);
    if (!was || !classPosition || was === classPosition) continue;
    changes.set(carIdx, was - classPosition);
  }
  return changes;
};

/**
 * The closest pair among a class's first `perClass` cars, if they are within
 * `maxGap` seconds. Returns [ahead, behind].
 */
export const findBattle = (
  drivers: readonly Standings[],
  perClass: number,
  maxGap: number
): [Standings, Standings] | undefined => {
  let best: [Standings, Standings] | undefined;
  for (let i = 1; i < Math.min(drivers.length, perClass); i++) {
    const behind = drivers[i];
    const interval = behind.interval;
    if (interval === undefined || interval > maxGap || behind.onPitRoad) {
      continue;
    }
    if (!best || interval < (best[1].interval ?? Infinity)) {
      best = [drivers[i - 1], behind];
    }
  }
  return best;
};

type RacePhase = 'grid' | 'podium';

/** The grid before the green flag of a race, the podium after the checkered. */
/** The flag has fallen: the session clock no longer means anything. */
export const isSessionFinished = (state: number): boolean =>
  state === SessionState.Checkered || state === SessionState.CoolDown;

export const racePhase = (
  sessionType: string | undefined,
  state: number
): RacePhase | undefined => {
  if (sessionType !== 'Race') return undefined;
  if (
    state === SessionState.GetInCar ||
    state === SessionState.Warmup ||
    state === SessionState.ParadeLaps
  ) {
    return 'grid';
  }
  if (isSessionFinished(state)) return 'podium';
  return undefined;
};
