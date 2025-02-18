import { useAutoAnimate } from '@formkit/auto-animate/react';
import { useTrackTemperature } from '../../Standings/hooks/useTrackTemperature';
import { useTrackWeather } from '../../Standings/hooks/useTrackWetness';
import { WindDirection } from '../WindDirection/WindDirection';
import { WeatherTemp } from '../WeatherTemp/WeatherTemp';
import { WeatherTrackWetness } from '../WeatherTrackWetness/WeatherTrackWetness';

export const WeatherContainer = () => {
  const [parent] = useAutoAnimate();
  const weather = useTrackWeather();
  const trackWetnessPct = Math.floor(
    (Number(weather.trackMoisture?.value) / 7) * 100
  );
  const trackTemp = useTrackTemperature();
  const windSpeed = weather.windVelo?.value[0] * (18 / 5);
  const windDirectionValue =
    weather.windDirection?.value[0] - weather.windYaw?.value[0];

  return (
    <div
      className="h-full inline-flex flex-row border-1 bg-slate-800 bg-opacity-25 rounded"
      ref={parent}
    >
      <div className="flex flex-col p-2 basis-full rounded gap-2">
        <WeatherTemp title="Track Temp" value={trackTemp.trackTemp} />
        <WeatherTemp title="Air Temp" value={trackTemp.airTemp} />
        <WeatherTrackWetness
          trackWetnessPct={trackWetnessPct}
          trackState={weather.trackState}
        />
        <WindDirection speed={windSpeed} direction={windDirectionValue} />
      </div>
    </div>
  );
};
