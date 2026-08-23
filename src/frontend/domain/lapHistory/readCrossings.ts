import type { LapHistorySnapshot } from '@irdashies/types';
import {
  LAP_CROSSING_IN_PIT,
  LAP_CROSSING_LAPPED,
  LAP_CROSSING_OFF_TRACK,
} from '@irdashies/types';
import type { LapCrossing } from './types';

/** Decodes one car's ring buffer into crossings ordered oldest-first. */
export const readCrossings = (
  snapshot: LapHistorySnapshot,
  carIdx: number
): LapCrossing[] => {
  if (!Number.isInteger(carIdx) || carIdx < 0 || carIdx >= snapshot.carCount) {
    return [];
  }

  const capacity = snapshot.capacity;
  // A restored snapshot can carry a count from a build with a larger capacity.
  // Without the clamp the ring wraps and repeats crossings, which then feed lap
  // times and gaps.
  const count = Math.min(snapshot.count[carIdx] ?? 0, capacity);
  if (count <= 0 || capacity <= 0) return [];

  const start = snapshot.start[carIdx] ?? 0;
  const base = carIdx * capacity;
  const crossings: LapCrossing[] = new Array<LapCrossing>(count);

  for (let i = 0; i < count; i += 1) {
    const slot = base + ((start + i) % capacity);
    const flags = snapshot.flags[slot];
    crossings[i] = {
      lap: snapshot.lap[slot],
      sessionTime: snapshot.sessionTime[slot],
      classPosition: snapshot.classPosition[slot],
      inPit: (flags & LAP_CROSSING_IN_PIT) !== 0,
      offTrack: (flags & LAP_CROSSING_OFF_TRACK) !== 0,
      lapped: (flags & LAP_CROSSING_LAPPED) !== 0,
    };
  }

  return crossings;
};
