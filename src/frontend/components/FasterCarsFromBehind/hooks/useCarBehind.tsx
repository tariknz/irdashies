import { useMemo } from 'react';
import { useDriverRelatives } from '../../Standings/hooks/useDriverRelatives';
import { useDriverStandings } from '../../Standings/hooks/useDriverPositions';
import { useFasterCarsSettings } from './useFasterCarsSettings';

export const useCarBehind = ({
  distanceThreshold,
}: {
  distanceThreshold?: number;
}) => {
  const settings = useFasterCarsSettings();
  const driversStandings = useDriverStandings();

  // Use total driver count as buffer to get all cars behind
  const allDrivers = useDriverRelatives({ buffer: driversStandings.length });

  // Filter out drivers who are in the pits
  const drivers = allDrivers.filter(driver => !driver.onPitRoad);
  const myCar = drivers[1];
  const threshold = distanceThreshold ?? -3;

  const fasterCarsFromBehind = useMemo(() => {
    // Get all cars behind the player (negative delta)
    const carsBehind = drivers.filter(driver => driver.delta < 0);

    return carsBehind
      .filter(car =>
        car.carClass?.relativeSpeed > myCar?.carClass?.relativeSpeed &&
        car.delta >= threshold // delta is negative, so >= threshold means within threshold distance
      )
      .sort((a, b) => a.delta - b.delta) // Sort by closest first (most negative delta)
      .slice(0, settings.numberDriversBehind) // Take only the configured number
      .map(car => {
        const percent = parseInt(
          (100 - (Math.abs(car.delta) / 3) * 100).toFixed(0)
        );

        return {
          carIdx: car.carIdx,
          name: car.driver?.name,
          license: car.driver?.license,
          rating: car.driver?.rating,
          distance: parseFloat(car.delta?.toFixed(1) ?? '0'),
          classColor: car.carClass?.color,
          percent: percent,
        };
      });
  }, [drivers, myCar, threshold, settings.numberDriversBehind]);

  return fasterCarsFromBehind;
};
