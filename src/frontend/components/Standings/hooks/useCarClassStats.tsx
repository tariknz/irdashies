import { useSessionDrivers } from '@irdashies/context';

export type CarClassStats = {
  shortName: string;
  color: number;
  total: number;
  sof: number;
};

export const useCarClassStats = () => {
  const sessionDrivers = useSessionDrivers();
  const classStats = sessionDrivers?.reduce(
    (acc, driver) => {
      if (acc[driver.CarClassID]) {
        return {
          ...acc,
          [driver.CarClassID]: {
            ...acc[driver.CarClassID],
            total: acc[driver.CarClassID].total + 1,
            sof:
              (acc[driver.CarClassID].sof * acc[driver.CarClassID].total +
                driver.IRating) /
              (acc[driver.CarClassID].total + 1),
          },
        };
      }

      return {
        ...acc,
        [driver.CarClassID]: {
          total: 1,
          color: driver.CarClassColor,
          shortName: driver.CarClassShortName,
          sof: driver.IRating,
        },
      };
    },
    {} as Record<string, CarClassStats>
  );

  return classStats;
};
