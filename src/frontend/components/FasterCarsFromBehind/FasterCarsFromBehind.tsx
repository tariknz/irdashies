import { useSessionVisibility, useDashboard } from '@irdashies/context';
import { useCarBehind } from './hooks/useCarBehind';
import { useFasterCarsSettings } from './hooks/useFasterCarsSettings';
import { getTailwindStyle } from '@irdashies/utils/colors';
import { DriverRatingBadge } from '../Standings/components/DriverRatingBadge/DriverRatingBadge';
import { getDemoCarsBehind } from './demoData';

export interface FasterCarsFromBehindProps {
  carIdx?: number;
  name?: string;
  license?: string;
  rating?: number;
  distance?: number;
  percent?: number;
  classColor?: number;
}

export const FasterCarsFromBehind = () => {
  const { isDemoMode } = useDashboard();
  const settings = useFasterCarsSettings();
  const carsBehind = useCarBehind({
    distanceThreshold: settings?.distanceThreshold,
  });

  if (!useSessionVisibility(settings?.sessionVisibility)) return <></>;

  // Generate demo data when in demo mode
  const demoCarsBehind = isDemoMode ? getDemoCarsBehind(settings?.numberDriversBehind || 1) : carsBehind;

  if (demoCarsBehind.length === 0) return null;

  // Apply alignment based on alignDriverBoxes setting
  const containerAlignment = settings.alignDriverBoxes === 'Bottom' ? 'justify-end' : 'justify-start';

  // Apply ordering based on closestDriverBox setting
  const orderedCars = settings.closestDriverBox === 'Reverse' ? [...demoCarsBehind].reverse() : demoCarsBehind;

  return (
    <div className={`flex flex-col gap-2 h-full ${containerAlignment}`}>
      {orderedCars.map((car) => (
        <FasterCarsFromBehindDisplay key={car.carIdx} {...car} />
      ))}
    </div>
  );
};



export const FasterCarsFromBehindDisplay = ({
  name,
  license,
  rating,
  distance,
  percent,
  classColor,
}: FasterCarsFromBehindProps) => {
  const settings = useFasterCarsSettings();

  if (!name) {
    return null;
  }

  const animate = distance && distance > -1.5 ? 'animate-pulse' : '';
  const red = percent || 0;
  const green = 100 - (percent || 0);
  const background = getTailwindStyle(classColor, undefined, true).classHeader;

  return (
    <div
      className={`w-full rounded-sm ${background} ${animate}`}
    >
      <div className={`flex p-1 ${(settings?.showName || settings?.showBadge) && settings?.showDistance ? 'justify-between' : settings?.showDistance ? 'justify-end' : 'justify-start'}`}>
        <div className="flex gap-1">
          {settings?.showName && (
            <div className="rounded-sm text-lg bg-gray-700 p-1 px-2">{name}</div>
          )}
          {settings?.showBadge && (
            <div className="flex align-center">
              <DriverRatingBadge
                license={license}
                rating={rating}
                format={settings.badgeFormat as 'license-color-fullrating-bw' | 'license-color-rating-bw' | 'license-color-rating-bw-no-license' | 'rating-color-no-license' | 'license-bw-rating-bw' | 'rating-only-bw-rating-bw' | 'license-bw-rating-bw-no-license' | 'rating-bw-no-license' | 'rating-only-color-rating-bw'}
              />
            </div>
          )}
        </div>
        {settings?.showDistance && (
          <div className="rounded-sm text-lg bg-gray-700 p-1 px-2">{distance?.toFixed(1)}</div>
        )}
      </div>

      <div
        className={`rounded-b-sm bg-white h-2 flex-none`}
        style={{
          width: `${percent ?? 0}%`,
          backgroundColor: `rgb(${red}%, ${green}%, 0%)`,
        }}
      ></div>
    </div>
  );
};
