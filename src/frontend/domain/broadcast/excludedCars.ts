import type { Standings } from '@irdashies/domain';
import type { Driver, ExcludedCar, SessionResults } from '@irdashies/types';

export const EMPTY_EXCLUDED_IDXS: ReadonlySet<number> = new Set<number>();

export const sanitizeExcludedCars = (value: unknown): ExcludedCar[] => {
  if (!Array.isArray(value)) return [];
  const seen = new Set<number>();
  const cars: ExcludedCar[] = [];
  for (const entry of value) {
    if (typeof entry !== 'object' || entry === null) continue;
    const { carId, name } = entry as { carId?: unknown; name?: unknown };
    if (typeof carId !== 'number' || !Number.isInteger(carId)) continue;
    if (typeof name !== 'string') continue;
    if (seen.has(carId)) continue;
    seen.add(carId);
    cars.push({ carId, name });
  }
  return cars;
};

export const excludedCarIdxs = (
  drivers: readonly Driver[] | undefined,
  excluded: readonly ExcludedCar[]
): ReadonlySet<number> => {
  if (!drivers?.length || excluded.length === 0) return EMPTY_EXCLUDED_IDXS;
  const carIds = new Set(excluded.map((car) => car.carId));
  const idxs = new Set<number>();
  for (const driver of drivers) {
    if (carIds.has(driver.CarID)) idxs.add(driver.CarIdx);
  }
  return idxs.size > 0 ? idxs : EMPTY_EXCLUDED_IDXS;
};

export const withoutExcluded = <
  T extends { CarIdx: number; Position: number; ClassPosition: number },
>(
  results: readonly T[],
  excludedIdxs: ReadonlySet<number>,
  classOf: (carIdx: number) => number | undefined
): T[] => {
  const classCounts = new Map<number | undefined, number>();
  return results
    .filter((result) => !excludedIdxs.has(result.CarIdx))
    .map((result, index) => {
      const classId = classOf(result.CarIdx);
      const classPosition = classCounts.get(classId) ?? 0;
      classCounts.set(classId, classPosition + 1);
      return { ...result, Position: index + 1, ClassPosition: classPosition };
    });
};

export const competitorsOnly = (
  results: SessionResults[] | undefined,
  excludedIdxs: ReadonlySet<number> | undefined,
  drivers: readonly Driver[] | undefined
): SessionResults[] | undefined => {
  if (!results || !excludedIdxs?.size) return results;
  const classByCarIdx = new Map(
    (drivers ?? []).map((driver) => [driver.CarIdx, driver.CarClassID])
  );
  return withoutExcluded(results, excludedIdxs, (carIdx) =>
    classByCarIdx.get(carIdx)
  );
};

export const reRankClassPositions = (
  grouped: [string, Standings[]][]
): [string, Standings[]][] =>
  grouped.map(([classId, classStandings]) => [
    classId,
    classStandings.map((standing, index) =>
      standing.classPosition === index + 1
        ? standing
        : { ...standing, classPosition: index + 1 }
    ),
  ]);

export const excludedStandings = (rows: readonly Standings[]): Standings[] =>
  rows.map((row) => ({
    ...row,
    position: undefined,
    classPosition: undefined,
    delta: undefined,
    hasFastestTime: false,
    lastTimeState:
      row.lastTimeState === 'session-fastest'
        ? 'personal-best'
        : row.lastTimeState,
  }));
