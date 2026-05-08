import { useSessionDrivers } from '@irdashies/context';

export interface CarClassStats {
  shortName: string;
  color: number;
  total: number;
  sof: number;
}

interface InternalStats {
  shortName: string;
  color: number;
  total: number;
  sumExp: number; // Σ 2^(-Ri / 1600)
}

export const useCarClassStats = () => {
  const sessionDrivers = useSessionDrivers();

  // Only include actual race participants
  const raceDrivers = sessionDrivers?.filter(
    driver =>
      !driver.IsSpectator &&
      !driver.CarIsPaceCar &&
      driver.IRating > 0
  );

  const intermediate = raceDrivers?.reduce(
    (acc, driver) => {
      const expValue = Math.pow(2, -driver.IRating / 1600);

      if (acc[driver.CarClassID]) {
        acc[driver.CarClassID].total += 1;
        acc[driver.CarClassID].sumExp += expValue;
        return acc;
      }

      acc[driver.CarClassID] = {
        total: 1,
        sumExp: expValue,
        color: driver.CarClassColor,
        shortName: driver.CarClassShortName,
      };

      return acc;
    },
    {} as Record<string, InternalStats>
  );

  const classStats = intermediate
    ? Object.fromEntries(
        Object.entries(intermediate).map(([classId, stats]) => {
          const sof =
            Math.round(
              (1600 / Math.log(2)) *
            Math.log(stats.total / stats.sumExp)
        );

          return [
            classId,
            {
              shortName: stats.shortName,
              color: stats.color,
              total: stats.total,
              sof,
            } as CarClassStats,
          ];
        })
      )
    : undefined;

  return classStats;
};