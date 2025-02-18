import { Drop, Sun } from '@phosphor-icons/react';

export interface WeatherTrackWetnessProps {
  trackWetnessPct: number;
  trackState: string;
}

export const WeatherTrackWetness = ({
  trackWetnessPct,
  trackState,
}: WeatherTrackWetnessProps) => {
  return (
    <div className="font-extrabold text-xl uppercase text-center bg-opacity-100 bg-slate-800 p-2 rounded items-center">
      TRACK WETNESS
      <div className="font-bold text-lg text-center">
        <div className="flex flex-row gap-x-1">
          <Sun />
          <div className="w-full bg-gray-200 rounded-full h-2.5 dark:bg-gray-700 align-center">
            <div
              className={`bg-blue-600 h-2.5 rounded-full w-[${trackWetnessPct}%]`}
            ></div>
          </div>
          <Drop />
        </div>
        <div className="font-normal">{trackState ?? 'Unknown'}</div>
      </div>
    </div>
  );
};
