import { Clock, Drop, RoadHorizon, Thermometer } from '@phosphor-icons/react';
import { useCurrentTime } from '../hooks/useCurrentTime';
import { useTrackWeather } from '../hooks/useTrackWetness';
import { useTrackTemperature } from '../hooks/useTrackTemperature';

export const SessionFooter = () => {
  const time = useCurrentTime();
  const { trackState } = useTrackWeather();
  const { trackTemp, airTemp } = useTrackTemperature();
  return (
    <div className="bg-slate-900/70 text-sm px-3 py-1 flex justify-between">
      <div className="flex flex-1 flex-grow gap-1 items-center">
        <Clock />
        <span>{time}</span>
      </div>
      <div className="flex flex-1 flex-grow gap-1 items-center justify-center text-nowrap">
        <Drop />
        <span>{trackState}</span>
      </div>
      <div className="flex flex-1 flex-grow gap-1 items-center justify-center">
        <Thermometer />
        <span>{airTemp}</span>
      </div>
      <div className="flex flex-1 flex-grow gap-1 items-center justify-end">
        <RoadHorizon />
        <span>{trackTemp}</span>
      </div>
    </div>
  );
};
