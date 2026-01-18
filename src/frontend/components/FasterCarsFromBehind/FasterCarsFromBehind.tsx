import { useSessionVisibility } from '@irdashies/context';
import { useCarBehind } from './hooks/useCarBehind';
import { useFasterCarsSettings } from './hooks/useFasterCarsSettings';
import { getTailwindStyle } from '@irdashies/utils/colors';

export interface FasterCarsFromBehindProps {
  name?: string;
  distance?: number;
  percent?: number;
  classColor?: number;
}

export const FasterCarsFromBehind = () => {
  const settings = useFasterCarsSettings();
  const carsBehind = useCarBehind({
    distanceThreshold: settings?.distanceThreshold,
  });

  if (!useSessionVisibility(settings?.sessionVisibility)) return <></>;

  if (carsBehind.length === 0) return null;

  // Apply alignment based on alignDriverBoxes setting
  const containerAlignment = settings.alignDriverBoxes === 'Bottom' ? 'justify-end' : 'justify-start';

  // Apply ordering based on closestDriverBox setting
  const orderedCars = settings.closestDriverBox === 'Reverse' ? [...carsBehind].reverse() : carsBehind;

  return (
    <div className={`flex flex-col gap-1 h-full ${containerAlignment}`}>
      {orderedCars.map((car, index) => (
        <FasterCarsFromBehindDisplay key={index} {...car} />
      ))}
    </div>
  );
};

export const FasterCarsFromBehindDisplay = ({
  name,
  distance,
  percent,
  classColor,
}: FasterCarsFromBehindProps) => {
  if (!name) {
    return null;
  }

  const animate = distance && distance > -0.3 ? 'animate-pulse' : '';
  const red = percent || 0;
  const green = 100 - (percent || 0);
  const background = getTailwindStyle(classColor, undefined, true).classHeader;

  return (
    <div className={`w-full flex justify-between rounded-sm p-1 pb-2 font-bold relative ${background} ${animate}`}>
      <div className="rounded-sm bg-gray-700 p-1">{name}</div>
      <div className="rounded-sm bg-gray-700 p-1">{distance}</div>
      <div
        className={`absolute bottom-0 left-0 rounded-b-sm bg-white h-1 flex-none`}
        style={{
          width: `${percent ?? 0}%`,
          backgroundColor: `rgb(${red}%, ${green}%, 0%)`,
        }}
      ></div>
    </div>
  );
};
