import { useTelemetryValue } from '@irdashies/context';
import { useTrackTemperature } from '../Standings/hooks/useTrackTemperature';
import { useTrackWeather } from './hooks/useTrackWeather';
import { WeatherTemp } from './WeatherTemp/WeatherTemp';
import { WeatherTrackWetness } from './WeatherTrackWetness/WeatherTrackWetness';
import { WeatherTrackRubbered } from './WeatherTrackRubbered/WeatherTrackRubbered';
import { WindDirection } from './WindDirection/WindDirection';
import { useTrackRubberedState } from './hooks/useTrackRubberedState';
import { useWeatherSettings } from './hooks/useWeatherSettings';
import { WeatherHumidity } from './WeatherHumidity/WeatherHumidity';
import { Fragment, useMemo } from 'react';

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
  const relativeWindDirection = (weather.windDirection ?? 0) - (weather.windYaw ?? 0);
  const trackRubbered = useTrackRubberedState();
  const displayOrder = settings?.displayOrder as string[] | undefined;

  const columnDefinitions = useMemo(() => {
    const columns = [
      {
        id: 'trackTemp' as const,
        shouldRender: settings?.trackTemp?.enabled ?? true,
        component: (
          <WeatherTemp title="Track" value={trackTemp} />
        ),
      },
      {
        id: 'airTemp' as const,
        shouldRender: settings?.airTemp?.enabled ?? true,
        component: (
          <WeatherTemp title="Air" value={airTemp} />
        )
      },
      {
        id: 'wind' as const,
        shouldRender: settings?.wind?.enabled ?? true,
        component: (<WindDirection speedMs={windSpeed} direction={relativeWindDirection} metric={isMetric} />)
      },
      {
        id: 'humidity' as const,
        shouldRender: settings?.humidity?.enabled ?? true,
        component: (<WeatherHumidity humidity={weather.humidity} />)
      },
      {
        id: 'wetness' as const,
        shouldRender: settings?.wetness?.enabled ?? true,
        component: (<WeatherTrackWetness trackMoisture={weather.trackMoisture} />)
      },
      {
        id: 'trackState' as const,
        shouldRender: settings?.trackState?.enabled ?? true,
        component: (<WeatherTrackRubbered trackRubbered={trackRubbered} />)
      },
    ];

    if (!displayOrder) {
      return columns.filter((column) => column.shouldRender);
    }

    const orderedColumns = displayOrder
      .map((orderId) => columns.find((column) => column.id === orderId))
      .filter(
        (column): column is NonNullable<typeof column> =>
          column !== undefined && column.shouldRender
      );

    const remainingColumns = columns.filter(
      (column) => column.shouldRender && !displayOrder.includes(column.id)
    );

    return [...orderedColumns, ...remainingColumns];
  }, [settings?.trackTemp?.enabled, 
    settings?.airTemp?.enabled, 
    settings?.wind?.enabled, 
    settings?.humidity?.enabled, 
    settings?.wetness?.enabled, 
    settings?.trackState?.enabled, 
    trackTemp, 
    airTemp, 
    windSpeed, 
    relativeWindDirection, 
    isMetric, 
    weather.humidity, weather.trackMoisture, trackRubbered, displayOrder]);

  return (
    <div
      className="w-full rounded-sm p-2 bg-slate-800/(--bg-opacity)"
      style={{
        ['--bg-opacity' as string]: `${settings?.background?.opacity ?? 80}%`,
      }}
    >
      <div className="flex flex-col w-full gap-2">
        {columnDefinitions.map((column) => (
          <Fragment key={column.id}>{column.component}</Fragment>
        ))}
      </div>
    </div>
  );
};
