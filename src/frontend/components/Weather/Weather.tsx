import { useTelemetryValue } from '@irdashies/context';
import { useTrackTemperature } from '../Standings/hooks/useTrackTemperature';
import { useTrackWeather } from './hooks/useTrackWeather';
import { WeatherTemp } from './WeatherTemp/WeatherTemp';
import { WeatherTrackWetness } from './WeatherTrackWetness/WeatherTrackWetness';
import { WeatherTrackRubbered } from './WeatherTrackRubbered/WeatherTrackRubbered';
import { WindDirection } from './WindDirection/WindDirection';
import { useTrackRubberedState } from './hooks/useTrackRubberedState';
import { useWeatherSettings } from './hooks/useWeatherSettings';

export const Weather = () => {
  const weather = useTrackWeather();
  const settings = useWeatherSettings();
  const displayUnits = useTelemetryValue('DisplayUnits'); // 0 = imperial, 1 = metric

  // Determine actual unit to use: auto uses iRacing's DisplayUnits setting
  const unitSetting = settings?.units ?? 'auto';
  const isMetric = unitSetting === 'auto'
    ? displayUnits === 1
    : unitSetting === 'Metric';
  const actualUnit = isMetric ? 'Metric' : 'Imperial';

  const { trackTemp, airTemp } = useTrackTemperature({
    airTempUnit: actualUnit,
    trackTempUnit: actualUnit,
  });
  const windSpeed = weather.windVelocity;
  const relativeWindDirection =  (weather.windDirection ?? 0) - (weather.windYaw ?? 0);
  const trackRubbered = useTrackRubberedState();

  return (
    <div
      className="w-full inline-flex flex-row bg-slate-800/[var(--bg-opacity)] rounded-sm"
      style={{
        ['--bg-opacity' as string]: `${settings?.background?.opacity ?? 25}%`,
      }}
    >
      <div className="flex flex-col p-2 w-full rounded-sm gap-2">
        <WeatherTemp title="Track" value={trackTemp} />
        <WeatherTemp title="Air" value={airTemp} />
        <WindDirection speedMs={windSpeed} direction={relativeWindDirection} metric={isMetric} />
        <WeatherTrackWetness trackMoisture={weather.trackMoisture} />
        <WeatherTrackRubbered trackRubbered={trackRubbered} />
      </div>
    </div>
  );
};
