import { memo } from 'react';
import {
  useDashboard,
  sessionBarSelectors,
  trackStateSelectors,
  useSessionBarSelector,
  useSessionStore,
  useTrackStateSelector,
  useSessionVisibility,
  useActiveSimulator,
  useThrottledWeather,
} from '@irdashies/context';
import { useStore } from 'zustand';
import { speedFromMs } from '@irdashies/utils/units';
import { useWindDemoData } from '../../domain/weather/useWindDemoData';
import { getWindIntensityClass } from '../../domain/weather/wind';
import { useWeatherSettings } from './hooks/useWeatherSettings';
import { useWeatherForecast } from './hooks/useWeatherForecast';
import {
  DEMO_FORECAST,
  formatRainAlertLead,
  rainAlertIn,
  rainTileClass,
  surfaceStatus,
  tempTrend,
} from './hooks/weatherStatus';
import { WindArrow } from './WindArrow';

const toDisplayTemp = (c: number, metric: boolean) =>
  Math.round(metric ? c : (c * 9) / 5 + 32);

const hourLabel = (hour: number) => `${String(hour).padStart(2, '0')}:00`;

export const Weather = memo(() => {
  const { isDemoMode } = useDashboard();
  const settings = useWeatherSettings();
  const displayUnits = useSessionBarSelector(sessionBarSelectors.displayUnits);
  const isOnTrack = useTrackStateSelector(trackStateSelectors.isOnTrack);
  const isSessionVisible = useSessionVisibility(settings?.sessionVisibility);
  const simulatesWind = useActiveSimulator() !== 'lmu';
  const sessionSkies = useStore(
    useSessionStore,
    (state) => state.session?.WeekendInfo?.TrackSkies
  );
  const skies = sessionSkies ?? (isDemoMode ? 'Partly Cloudy' : undefined);
  const temps = useSessionBarSelector(
    (s) => [s.airTemp, s.trackTemp] as const,
    { equality: (a, b) => a?.[0] === b?.[0] && a?.[1] === b?.[1] }
  );

  const unitSetting = settings?.units ?? 'auto';
  const isMetric =
    unitSetting === 'auto' ? displayUnits === 1 : unitSetting === 'Metric';

  const weather = useThrottledWeather();
  const showForecast = settings?.forecast?.enabled !== false;
  const liveForecast = useWeatherForecast(showForecast);
  const forecast = isDemoMode ? DEMO_FORECAST : liveForecast;
  const currentTimeOfDay = useSessionBarSelector((s) =>
    s.sessionTimeOfDay === undefined
      ? undefined
      : Math.floor(s.sessionTimeOfDay / 60) * 60
  );

  const demoWind = useWindDemoData(isDemoMode, isMetric);
  const windMs = demoWind?.speedMs ?? weather.windVelocity;
  const windRelative =
    demoWind?.direction ??
    (weather.windDirection === undefined
      ? undefined
      : weather.windDirection - (weather.windYaw ?? 0));
  const windSpeed =
    windMs === undefined
      ? undefined
      : speedFromMs(windMs, isMetric ? 'km/h' : 'mph');

  const [airTemp, trackTemp] = temps ?? [];
  const surface = surfaceStatus(weather.trackMoisture);
  const trend = tempTrend(airTemp, forecast);
  const alertIn = showForecast
    ? rainAlertIn(forecast, isDemoMode ? undefined : currentTimeOfDay)
    : undefined;

  if (settings?.showOnlyWhenOnTrack && !isOnTrack) return null;
  if (!isSessionVisible) return <></>;

  return (
    // pt-3 keeps the badge that overlaps the card's top edge inside the window
    <div className="@container w-full pt-3">
      <div
        className="relative w-full rounded-[10px] p-2.5 bg-[#0f1319]/(--bg-opacity) text-white flex flex-col gap-2 font-[Barlow_Condensed,sans-serif]"
        style={{
          ['--bg-opacity' as string]: `${settings?.background?.opacity ?? 80}%`,
        }}
      >
        {alertIn !== undefined && (
          <div className="absolute -top-2.5 right-3 rounded-full bg-blue-600 px-2.5 py-0.5 text-xs font-bold tracking-wider">
            RAIN IN ~{formatRainAlertLead(alertIn)}
          </div>
        )}
        <div className="flex items-center gap-3">
          <div
            className={`rounded-lg px-3 py-1.5 text-center min-w-[76px] ${surface.className}`}
          >
            <div className="text-[30px] font-bold leading-none">
              {surface.label}
            </div>
            {skies && (
              <div className="text-[11px] font-semibold tracking-[.06em] whitespace-nowrap">
                {skies}
              </div>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[46px] font-bold leading-none tabular-nums">
              {airTemp === undefined
                ? '--'
                : `${toDisplayTemp(airTemp, isMetric)}°`}
              <span className={`ml-1 text-2xl ${trend.className}`}>
                {trend.arrow}
              </span>
            </div>
            {trackTemp !== undefined && (
              <div className="text-[13px] text-slate-400 tabular-nums">
                track {toDisplayTemp(trackTemp, isMetric)}&deg;
              </div>
            )}
          </div>
          {simulatesWind && (
            <div
              className={`flex flex-col items-center ${getWindIntensityClass(windSpeed)}`}
            >
              <WindArrow relative={windRelative} />
              <div className="text-[15px] font-semibold leading-none tabular-nums">
                {windSpeed === undefined ? '--' : Math.round(windSpeed)}
              </div>
            </div>
          )}
        </div>
        {showForecast && forecast.length > 0 && (
          <div className="flex gap-1.5">
            {forecast.map((h) => (
              <div
                key={h.hour}
                className={`flex flex-1 items-baseline justify-between rounded-md px-2 py-1 text-[13px] ${rainTileClass(h.precipitationPct)}`}
              >
                <span className="opacity-80 tabular-nums">
                  {hourLabel(h.hour)}
                </span>
                <b className="tabular-nums">
                  {h.precipitationPct > 0
                    ? `${h.precipitationPct}%`
                    : `~${toDisplayTemp(h.airTemp, isMetric)}°`}
                </b>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
});
Weather.displayName = 'Weather';
