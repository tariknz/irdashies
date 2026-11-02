import type { RaceFinishTiming } from '@irdashies/types';
import type { Gap, Standings } from './createStandings';

/** Never combine an official result delta with an observed session timestamp. */
const finalGap = (
  driver: RaceFinishTiming,
  reference: RaceFinishTiming
): Gap => {
  const laps = reference.lapsComplete - driver.lapsComplete;
  if (laps !== 0) return { laps, value: undefined };
  const driverTime =
    driver.resultTime !== undefined && reference.resultTime !== undefined
      ? driver.resultTime
      : driver.crossingTime;
  const referenceTime =
    driver.resultTime !== undefined && reference.resultTime !== undefined
      ? reference.resultTime
      : reference.crossingTime;
  return {
    laps: 0,
    value:
      driverTime !== undefined && referenceTime !== undefined
        ? driverTime - referenceTime
        : undefined,
  };
};

/** Applied before row slicing; both Standings and Gantry consume this path. */
export const augmentStandingsWithFinalTiming = (
  grouped: [string, Standings[]][],
  timings: readonly (RaceFinishTiming | null)[],
  options: {
    gap: boolean;
    interval: boolean;
    playerReference: boolean;
    showLapDifferences?: boolean;
  }
): [string, Standings[]][] => {
  const player = options.playerReference
    ? grouped.flatMap(([, rows]) => rows).find((row) => row.isPlayer)
    : undefined;
  return grouped.map(([classId, rows]) => [
    classId,
    rows.map((row, index) => {
      const timing = timings[row.carIdx];
      if (!timing) return row;
      const reference = options.playerReference ? player : rows[0];
      const referenceTiming = reference && timings[reference.carIdx];
      const ahead = rows[index - 1];
      const aheadTiming = ahead && timings[ahead.carIdx];
      let gap = row.gap;
      let interval = row.interval;
      if (options.gap && referenceTiming) {
        const retained = finalGap(timing, referenceTiming);
        gap = options.playerReference
          ? retained
          : {
              value: index === 0 ? undefined : retained.value,
              // Existing class-leader gaps use negative laps; Player uses positive.
              laps: -retained.laps || 0,
            };
      }
      if (options.interval) {
        if (index === 0) interval = undefined;
        else if (aheadTiming) {
          const retained = finalGap(timing, aheadTiming);
          interval =
            options.showLapDifferences && retained.laps
              ? { value: undefined, laps: -retained.laps }
              : retained.value;
        }
      }
      return { ...row, gap, interval };
    }),
  ]);
};
