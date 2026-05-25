import {
  useTelemetryValue,
  useSessionVisibility,
  useThrottledWeather,
} from '@irdashies/context';
import { RoadHorizonIcon, ThermometerIcon } from '@phosphor-icons/react';
import { useWeatherHorizontalSettings } from './hooks/useWeatherHorizontalSettings';
import { useTrackTemperature } from './hooks/useTrackTemperature';
import { useTrackRubberedState } from './hooks/useTrackRubberedState';
import { WeatherTemp } from './WeatherTemp/WeatherTemp';
import { WeatherTrackWetness } from './WeatherTrackWetness/WeatherTrackWetness';
import { WeatherTrackRubbered } from './WeatherTrackRubbered/WeatherTrackRubbered';

export const WeatherHorizontal = () => {
  const settings = useWeatherHorizontalSettings();
  const displayUnits = useTelemetryValue('DisplayUnits');
  const isOnTrack = useTelemetryValue('IsOnTrack');
  const isSessionVisible = useSessionVisibility(settings?.sessionVisibility);

  const unitSetting = settings?.units ?? 'auto';
  const isMetric =
    unitSetting === 'auto' ? displayUnits === 1 : unitSetting === 'Metric';
  const actualUnit = isMetric ? 'Metric' : 'Imperial';

  const { trackTemp, airTemp } = useTrackTemperature({
    airTempUnit: actualUnit,
    trackTempUnit: actualUnit,
  });

  const weather = useThrottledWeather();
  const trackRubbered = useTrackRubberedState();

  if (settings?.showOnlyWhenOnTrack && !isOnTrack) {
    return null;
  }

  if (!isSessionVisible) return <></>;

  return (
    <div
      className="@container w-full rounded-sm p-2 bg-slate-800/(--bg-opacity)"
      style={{
        ['--bg-opacity' as string]: `${settings?.background?.opacity ?? 80}%`,
      }}
    >
      <div className="flex flex-col gap-2">
        <div className="grid grid-cols-2 gap-2">
          <WeatherTemp title="Track" value={trackTemp} icon={RoadHorizonIcon} />
          <WeatherTemp title="Air" value={airTemp} icon={ThermometerIcon} />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <WeatherTrackWetness trackMoisture={weather.trackMoisture} />
          <WeatherTrackRubbered trackRubbered={trackRubbered} />
        </div>
      </div>
    </div>
  );
};
