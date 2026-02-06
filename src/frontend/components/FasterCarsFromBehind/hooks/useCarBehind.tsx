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
  const drivers = allDrivers.filter((driver) => !driver.onPitRoad);
  // Find the player car (delta should be 0 for player)
  const myCar = drivers.find((driver) => driver.delta === 0);
  const threshold = distanceThreshold ?? -3;

  const fasterCarsFromBehind = useMemo(() => {
    // Get all cars behind the player (negative delta means behind: other - player < 0)
    const carsBehind = drivers.filter((driver) => driver.delta < 0);

    const filtered = carsBehind.filter((car) => {
      // Check distance threshold
      if (car.delta < threshold) return false;

      // If onlyShowFasterClasses is enabled, only show cars from faster classes
      if (settings.onlyShowFasterClasses) {
        return (
          (car.carClass?.relativeSpeed ?? 0) >
          (myCar?.carClass?.relativeSpeed ?? 0)
        );
      }

      // Otherwise show all cars (including same class)
      return true;
    });

    return filtered
      .sort((a, b) => b.delta - a.delta) // Sort by closest first (least negative delta)
      .slice(0, settings.numberDriversBehind) // Take only the configured number
      .map((car) => {
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
  }, [
    drivers,
    myCar,
    threshold,
    settings.numberDriversBehind,
    settings.onlyShowFasterClasses,
  ]);

  return fasterCarsFromBehind;
};
