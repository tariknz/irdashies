import { useAutoAnimate } from '@formkit/auto-animate/react';
import { useCarBehind } from './hooks/useCarBehind';

export const FasterCarsFromBehind = () => {
  const carBehind = useCarBehind();
  const [parent] = useAutoAnimate();
  
  const hidden = carBehind.name === null ? 'hidden' : '';
  const distanceMarkerWidth = (400-400*carBehind.percent).toFixed(0);
  const dist = typeof carBehind.distance === 'string' ? parseFloat(carBehind.distance) : carBehind.distance;
  const animate = dist > -0.3 ? 'animate-pulse' : '';
  
  return (
    <div className={`w-[400px] flex justify-between rounded-sm p-1 pb-2 font-bold relative ${hidden} ${animate} ${carBehind.background}`}
		     ref={parent}>
      <div className="rounded-sm bg-gray-700 p-1">{carBehind.name}</div>
	    <div className="rounded-sm bg-gray-700 p-1">{carBehind.distance}</div>
	    <div className={`absolute bottom-0 left-0 rounded-b-sm bg-white h-1 flex-none`} style={{width: distanceMarkerWidth+'px'}}></div>
    </div>
  );
};
