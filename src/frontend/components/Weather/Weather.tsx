import { useTrackTemperature } from './hooks/useTrackTemperature';
import { useTrackWeather } from './hooks/useTrackWeather';
import { WeatherTemp } from './WeatherTemp/WeatherTemp';
import { WeatherTrackWetness } from './WeatherTrackWetness/WeatherTrackWetness';
import { WeatherTrackRubbered } from './WeatherTrackRubbered/WeatherTrackRubbered';
import { WindDirection } from './WindDirection/WindDirection';
import { useTrackRubberedState } from './hooks/useTrackRubberedState';
import { useWeatherSettings } from './hooks/useWeatherSettings';
import { useTelemetryValue } from '@irdashies/context';

export const Weather = () => {
  const weather = useTrackWeather();
  const trackTemp = useTrackTemperature();
  const windSpeed = weather.windVelocity;
  const relativeWindDirection =  (weather.windDirection ?? 0) - (weather.windYaw ?? 0);
  const trackRubbered = useTrackRubberedState();
  const settings = useWeatherSettings();
  const unit = useTelemetryValue('DisplayUnits');

  return (
    <div
      className="w-full inline-flex flex-row bg-slate-800/[var(--bg-opacity)] rounded-sm"
      style={{
        ['--bg-opacity' as string]: `${settings?.background?.opacity ?? 25}%`,
      }}
    >
      <div className="flex flex-col p-2 w-full rounded-sm gap-2">
        <WeatherTemp title="Track" value={trackTemp.trackTemp} />
        <WeatherTemp title="Air" value={trackTemp.airTemp} />
        <WindDirection speedMs={windSpeed} direction={relativeWindDirection} metric={unit === 1} />
        <WeatherTrackWetness trackMoisture={weather.trackMoisture} />
        <WeatherTrackRubbered trackRubbered={trackRubbered} />
      </div>
    </div>
  );
};
