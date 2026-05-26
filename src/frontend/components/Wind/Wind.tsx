import {
  useSessionVisibility,
  useTelemetryValue,
  useThrottledWeather,
} from '@irdashies/context';
import { useWindSettings } from './hooks/useWindSettings';
import { WindDirection } from './WindDirection/WindDirection';

export const Wind = () => {
  const settings = useWindSettings();
  const displayUnits = useTelemetryValue('DisplayUnits');
  const isOnTrack = useTelemetryValue('IsOnTrack');
  const isSessionVisible = useSessionVisibility(settings?.sessionVisibility);

  const unitSetting = settings?.units ?? 'auto';
  const isMetric =
    unitSetting === 'auto' ? displayUnits === 1 : unitSetting === 'Metric';

  const weather = useThrottledWeather();
  const relativeWindDirection =
    (weather.windDirection ?? 0) - (weather.windYaw ?? 0);

  if (settings?.showOnlyWhenOnTrack && !isOnTrack) {
    return null;
  }

  if (!isSessionVisible) return <></>;

  return (
    <div
      className="w-full rounded-sm p-2 bg-slate-800/(--bg-opacity)"
      style={{
        ['--bg-opacity' as string]: `${settings?.background?.opacity ?? 80}%`,
      }}
    >
      <WindDirection
        speedMs={weather.windVelocity}
        direction={relativeWindDirection}
        metric={isMetric}
      />
    </div>
  );
};
