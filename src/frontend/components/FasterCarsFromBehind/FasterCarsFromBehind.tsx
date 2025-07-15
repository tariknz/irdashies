import { useCurrentSessionType } from '@irdashies/context';
import { useCarBehind } from './hooks/useCarBehind';
import { useFasterCarsSettings } from './hooks/useFasterCarsSettings';
import { getTailwindStyle } from '@irdashies/utils/colors';

export interface FasterCarsFromBehindProps {
  name?: string | null;
  distance?: number;
  percent?: number;
  classColor?: number;
}

export const FasterCarsFromBehind = () => {
  const settings = useFasterCarsSettings();
  const sessionType = useCurrentSessionType();
  const carBehind = useCarBehind({
    distanceThreshold: settings?.distanceThreshold,
  });

  if (sessionType === 'Lone Qualify') {
    return null;
  }

  return <FasterCarsFromBehindDisplay {...carBehind} />;
};

export const FasterCarsFromBehindDisplay = ({
  name,
  distance,
  percent,
  classColor,
}: FasterCarsFromBehindProps) => {
  const hidden = name === null || name == undefined ? 'hidden' : '';
  const animate = distance && distance > -0.3 ? 'animate-pulse' : '';
  const red = percent || 0;
  const green = 100 - (percent || 0);
  const background = getTailwindStyle(classColor).classHeader;

  return (
    <div className={`w-full flex justify-between rounded-sm p-1 pb-2 font-bold relative ${hidden}`}>
      <div className="rounded-sm bg-gray-700 p-1">{name}</div>
      <div className="rounded-sm bg-gray-700 p-1">{distance}</div>
      <div
        className={`absolute inset-0 rounded-sm ${background} ${animate}`}
        style={{ zIndex: -1 }}
      ></div>
      <div
        className={`absolute bottom-0 left-0 rounded-b-sm bg-white h-1 flex-none transition-all`}
        style={{
          width: `${percent}%`,
          backgroundColor: `rgb(${red}%, ${green}%, 0%)`,
        }}
      ></div>
    </div>
  );
};
