import { useMemo } from 'react';
import { useDriverRelatives } from '../../Standings/hooks/useDriverRelatives';

export const useCarBehind = ({
  distanceThreshold,
}: {
  distanceThreshold?: number;
}) => {
  const drivers = useDriverRelatives({ buffer: 1 });
  const carBehind = drivers[2];
  const myCar = drivers[1];
  const threshold = distanceThreshold ?? -3;
  const classColor = carBehind?.carClass?.color;

  const fasterCarFromBehind = useMemo(() => {
    const percent = parseInt(
      (100 - (Math.abs(carBehind?.delta) / 3) * 100).toFixed(0)
    );

    return {
      name: carBehind?.driver?.name,
      distance: parseFloat(carBehind?.delta.toFixed(1)),
      classColor,
      percent: percent,
    };
  }, [carBehind?.delta, carBehind?.driver?.name, classColor]);

  if (
    carBehind?.carClass?.relativeSpeed <= myCar?.carClass?.relativeSpeed ||
    carBehind?.delta < threshold
  ) {
    return { name: null, distance: 0, classColor: undefined, percent: 0 };
  }

  return fasterCarFromBehind;
};
