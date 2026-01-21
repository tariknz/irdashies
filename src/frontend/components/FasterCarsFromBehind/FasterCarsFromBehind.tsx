import { useSessionVisibility, useDashboard } from '@irdashies/context';
import { useCarBehind } from './hooks/useCarBehind';
import { useFasterCarsSettings } from './hooks/useFasterCarsSettings';
import { getTailwindStyle } from '@irdashies/utils/colors';
import { DriverRatingBadge } from '../Standings/components/DriverRatingBadge/DriverRatingBadge';

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

// Generate demo data for faster cars behind
const getDemoCarsBehind = (numberDriversBehind: number) => {
  const demoDrivers = [
    {
      carIdx: 1001,
      name: 'Tarik Alani',
      license: 'A 2.49',
      rating: 1281,
      distance: -1.2,
      percent: 85,
      classColor: 16767577, // BMW M4 GT4 color
    },
    {
      carIdx: 1002,
      name: 'Bjørn Andersen',
      license: 'B 2.70',
      rating: 1256,
      distance: -2.5,
      percent: 65,
      classColor: 16734344, // Toyota GR86 color
    },
    {
      carIdx: 1003,
      name: 'Ethan D Wilson',
      license: 'C 3.37',
      rating: 1300,
      distance: -3.8,
      percent: 45,
      classColor: 11430911, // MX-5 Cup color
    },
    {
      carIdx: 1004,
      name: 'Ben Schmid',
      license: 'D 3.39',
      rating: 1510,
      distance: -4.1,
      percent: 35,
      classColor: 16767577, // BMW M4 GT4 color
    },
    {
      carIdx: 1005,
      name: 'Zoltán Szakács',
      license: 'C 3.71',
      rating: 1490,
      distance: -4.8,
      percent: 28,
      classColor: 16767577, // BMW M4 GT4 color
    },
    {
      carIdx: 1006,
      name: 'Jack Tomlinson2',
      license: 'D 3.59',
      rating: 1271,
      distance: -5.2,
      percent: 22,
      classColor: 16767577, // BMW M4 GT4 color
    },
    {
      carIdx: 1007,
      name: 'Romain Vergeon',
      license: 'D 2.95',
      rating: 1512,
      distance: -5.9,
      percent: 18,
      classColor: 16734344, // Toyota GR86 color
    },
    {
      carIdx: 1008,
      name: 'Anguiano Perez',
      license: 'B 2.37',
      rating: 1505,
      distance: -6.5,
      percent: 15,
      classColor: 16734344, // Toyota GR86 color
    },
    {
      carIdx: 1009,
      name: 'Liu Hang3',
      license: 'D 3.92',
      rating: 1444,
      distance: -7.1,
      percent: 12,
      classColor: 16734344, // Toyota GR86 color
    },
    {
      carIdx: 1010,
      name: 'Thomas Searle',
      license: 'A 2.18',
      rating: 2401,
      distance: -7.8,
      percent: 8,
      classColor: 11430911, // MX-5 Cup color
    },
  ];

  // Return only the number of drivers the user has configured
  return demoDrivers.slice(0, numberDriversBehind);
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
      className={`w-full rounded-sm font-bold ${background} ${animate}`}
    >
      <div className={`flex p-1 ${(settings?.showName || settings?.showBadge) && settings?.showDistance ? 'justify-between' : settings?.showDistance ? 'justify-end' : 'justify-start'}`}>
        <div className="flex gap-1">
          {settings?.showName && (
            <div className="rounded-sm bg-gray-700 p-1">{name}</div>
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
          <div className="rounded-sm bg-gray-700 p-1">{distance}</div>
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
