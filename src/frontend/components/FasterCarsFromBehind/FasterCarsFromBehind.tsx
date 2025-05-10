import { useAutoAnimate } from '@formkit/auto-animate/react';
import { useCarBehind } from './hooks/useCarBehind';

export const FasterCarsFromBehind = () => {
  const carBehind = useCarBehind();
  const [parent] = useAutoAnimate();
  if (!carBehind) return null;
console.log(carBehind);
  return (
    <div className={`w-full h-full flex justify-between rounded-sm p-1 font-bold ${carBehind.background} relative`}
		 ref={parent}>
      <div className="rounded-sm bg-gray-700 p-1">{carBehind.name}</div>
	  <div className="rounded-sm bg-gray-700 p-1">{carBehind.distance}</div>
	  <div className={`absolute bottom-0 left-0 bg-white h-1 w-8`}></div>
    </div>
  );
};
