import { useTelemetryValue, useSessionVisibility } from '@irdashies/context';
import { useTrackTemperature } from '../Standings/hooks/useTrackTemperature';
import { WeatherTemp } from './WeatherTemp/WeatherTemp';
import { WeatherTrackWetness } from './WeatherTrackWetness/WeatherTrackWetness';
import { WeatherTrackRubbered } from './WeatherTrackRubbered/WeatherTrackRubbered';
import { WindDirection } from './WindDirection/WindDirection';
import { useTrackRubberedState } from './hooks/useTrackRubberedState';
import { useWeatherSettings } from './hooks/useWeatherSettings';
import { WeatherHumidity } from './WeatherHumidity/WeatherHumidity';
import { useThrottledWeather } from './hooks/useThrottledWeather';
import { useMemo } from 'react';

type WeatherColumnId =
  | 'trackTemp'
  | 'airTemp'
  | 'wind'
  | 'humidity'
  | 'wetness'
  | 'trackState';

export const Weather = () => {
  const settings = useWeatherSettings();
  const displayUnits = useTelemetryValue('DisplayUnits'); // 0 = imperial, 1 = metric
  const isOnTrack = useTelemetryValue('IsOnTrack');
  const isSessionVisible = useSessionVisibility(settings?.sessionVisibility);

  // Determine actual unit to use: auto uses iRacing's DisplayUnits setting
  const unitSetting = settings?.units ?? 'auto';
  const isMetric =
    unitSetting === 'auto' ? displayUnits === 1 : unitSetting === 'Metric';
  const actualUnit = isMetric ? 'Metric' : 'Imperial';

  // Weather telemetry - throttled to ~1 update/sec since weather data
  // changes slowly and doesn't need 60 FPS updates
  const weather = useThrottledWeather();

  const { trackTemp, airTemp } = useTrackTemperature({
    airTempUnit: actualUnit,
    trackTempUnit: actualUnit,
  });
  const trackRubbered = useTrackRubberedState();

  // Derived values
  const relativeWindDirection =
    (weather.windDirection ?? 0) - (weather.windYaw ?? 0);

  // Column ordering: depends ONLY on settings, NOT on telemetry data.
  // Settings change when the user edits config (very rare during a session).
  const displayOrder = settings?.displayOrder as string[] | undefined;

  const visibleColumnIds = useMemo(() => {
    const allColumns: { id: WeatherColumnId; enabled: boolean }[] = [
      { id: 'trackTemp', enabled: settings?.trackTemp?.enabled ?? true },
      { id: 'airTemp', enabled: settings?.airTemp?.enabled ?? true },
      { id: 'wind', enabled: settings?.wind?.enabled ?? true },
      { id: 'humidity', enabled: settings?.humidity?.enabled ?? true },
      { id: 'wetness', enabled: settings?.wetness?.enabled ?? true },
      { id: 'trackState', enabled: settings?.trackState?.enabled ?? true },
    ];

    const enabledColumns = allColumns.filter((c) => c.enabled);

    if (!displayOrder) {
      return enabledColumns.map((c) => c.id);
    }

    const ordered = displayOrder.filter((id): id is WeatherColumnId =>
      enabledColumns.some((c) => c.id === id)
    );

    const remaining = enabledColumns
      .filter((c) => !displayOrder.includes(c.id))
      .map((c) => c.id);

    return [...ordered, ...remaining];
  }, [
    settings?.trackTemp?.enabled,
    settings?.airTemp?.enabled,
    settings?.wind?.enabled,
    settings?.humidity?.enabled,
    settings?.wetness?.enabled,
    settings?.trackState?.enabled,
    displayOrder,
  ]);

  // Maps column ID to its memoized sub-component.
  // Sub-components are wrapped in React.memo(), so they bail out of
  // re-rendering unless their specific primitive props have changed.
  const renderColumn = (id: WeatherColumnId) => {
    switch (id) {
      case 'trackTemp':
        return <WeatherTemp key={id} title="Track" value={trackTemp} />;
      case 'airTemp':
        return <WeatherTemp key={id} title="Air" value={airTemp} />;
      case 'wind':
        return (
          <WindDirection
            key={id}
            speedMs={weather.windVelocity}
            direction={relativeWindDirection}
            metric={isMetric}
          />
        );
      case 'humidity':
        return <WeatherHumidity key={id} humidity={weather.humidity} />;
      case 'wetness':
        return (
          <WeatherTrackWetness key={id} trackMoisture={weather.trackMoisture} />
        );
      case 'trackState':
        return <WeatherTrackRubbered key={id} trackRubbered={trackRubbered} />;
    }
  };

  // Hide if showOnlyWhenOnTrack is enabled and player is not on track
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
      <div className="flex flex-col w-full gap-2">
        {visibleColumnIds.map(renderColumn)}
      </div>
    </div>
  );
};
