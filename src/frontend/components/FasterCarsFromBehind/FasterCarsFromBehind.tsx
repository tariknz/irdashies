import { useMemo } from 'react';
import { useAutoAnimate } from '@formkit/auto-animate/react';
import { useCarBehind } from './hooks/useCarBehind';
import { useFasterCarsSettings } from './hooks/useFasterCarsSettings';

export const FasterCarsFromBehind = () => {
  const settings = useFasterCarsSettings();
  const carBehind = useCarBehind({distanceThreshold: settings?.distanceThreshold });
  const [parent] = useAutoAnimate();

  const layout = useMemo(() => {
    const hidden = carBehind.name === null || carBehind.name == undefined ? 'hidden' : '';  
    const animate = carBehind.distance > -0.3 ? 'animate-pulse' : '';
    const red = carBehind.percent;
    const green = 100 - carBehind.percent;

    return { hidden, animate, red, green };
  }, [
    carBehind.name,
    carBehind.distance,
    carBehind.percent
  ]);

  return (
    <div className={`w-full flex justify-between rounded-sm p-1 pb-2 font-bold relative ${layout.hidden} ${layout.animate} ${carBehind.background}`}
		     ref={parent}>
      <div className="rounded-sm bg-gray-700 p-1">{carBehind.name}</div>
	    <div className="rounded-sm bg-gray-700 p-1">{carBehind.distance}</div>
	    <div className={`absolute bottom-0 left-0 rounded-b-sm bg-white h-1 flex-none`} style={{width: carBehind.percent+'%', backgroundColor: `rgb(${layout.red}%, ${layout.green}%, 0%)`}}></div>
    </div>
  );
};
