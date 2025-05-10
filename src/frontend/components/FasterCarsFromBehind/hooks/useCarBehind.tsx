import { useMemo } from 'react';
import { useDriverRelatives } from '../../Standings/hooks/useDriverRelatives';
import { getTailwindStyle } from '../../../utils/colors';

export const useCarBehind = () => {
  const drivers = useDriverRelatives({ buffer: 1 });
  if(drivers.length ==  0) return;
  if(drivers[2].carClass.relativeSpeed >= drivers[1].carClass.relativeSpeed) return false;

  const carBehind = drivers[2];
  let background = getTailwindStyle(carBehind.carClass.color).classHeader;

  const FasterCarFromBehind = useMemo(() => {
    let blink = false;
    // Blink the background if the car is within 0.3s
    if(carBehind.delta > -0.3) {
      const blink = setInterval(() => {
        background = background === '' ? getTailwindStyle(carBehind.carClass.color).classHeader : '';
      }, 500)
    } else if(carBehind.delta < -0.3 || carBehind.delta > 0) {
      if(blink) clearInterval(blink);
    }
    const percent = Math.abs(carBehind.delta) / 3;

    return { name: carBehind.driver?.name, distance: carBehind?.delta.toFixed(1), background: background, percent : percent };
  }, [carBehind]);

  return FasterCarFromBehind;
};
