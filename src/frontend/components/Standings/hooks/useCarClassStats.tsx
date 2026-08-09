import { useSessionDrivers } from '@irdashies/context';
import type { Driver } from '@irdashies/types';
import { useMemo } from 'react';
import { getCarClassDisplayName } from './getCarClassDisplayName';

export interface CarClassStats {
  shortName: string;
  color: number;
  total: number;
  sof: number | undefined;
}

interface InternalStats {
  color: number;
  total: number;
  ratedDrivers: number;
  sumExp: number; // Σ 2^(-Ri / 1600)
  drivers: Driver[];
}

export const useCarClassStats = () => {
  const sessionDrivers = useSessionDrivers();

  return useMemo(() => {
    // Only include actual race participants
    const raceDrivers = sessionDrivers?.filter(
      (driver) => !driver.IsSpectator && !driver.CarIsPaceCar
    );

    const intermediate = raceDrivers?.reduce(
      (acc, driver) => {
        const hasIRating = driver.IRating > 0;
        const expValue = hasIRating ? Math.pow(2, -driver.IRating / 1600) : 0;

        if (acc[driver.CarClassID]) {
          acc[driver.CarClassID].total += 1;
          acc[driver.CarClassID].sumExp += expValue;
          if (hasIRating) acc[driver.CarClassID].ratedDrivers += 1;
          acc[driver.CarClassID].drivers.push(driver);
          return acc;
        }

        acc[driver.CarClassID] = {
          total: 1,
          ratedDrivers: hasIRating ? 1 : 0,
          sumExp: expValue,
          color: driver.CarClassColor,
          drivers: [driver],
        };

        return acc;
      },
      {} as Record<string, InternalStats>
    );

    return intermediate
      ? Object.fromEntries(
          Object.entries(intermediate).map(([classId, stats]) => {
            const sof =
              stats.ratedDrivers > 0
                ? Math.round(
                    (1600 / Math.log(2)) *
                      Math.log(stats.ratedDrivers / stats.sumExp)
                  )
                : undefined;

            return [
              classId,
              {
                shortName: getCarClassDisplayName(
                  Number(classId),
                  stats.drivers
                ),
                color: stats.color,
                total: stats.total,
                sof,
              } as CarClassStats,
            ];
          })
        )
      : undefined;
  }, [sessionDrivers]);
};
