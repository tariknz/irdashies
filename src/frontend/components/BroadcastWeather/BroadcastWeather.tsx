import { useSessionVisibility } from '@irdashies/context';
import { clampSetting } from '@irdashies/utils/clampSetting';
import { useBroadcastWeatherSettings } from './hooks/useBroadcastWeatherSettings';
import { WeatherCard } from './WeatherCard';

/** Broadcast weather card, placed on its own next to the tower. */
export const BroadcastWeather = () => {
  const settings = useBroadcastWeatherSettings();
  const isSessionVisible = useSessionVisibility(settings?.sessionVisibility);
  if (!isSessionVisible) return null;
  return (
    <div
      className="w-full text-sm"
      style={{
        ['--bg-opacity' as string]: `${settings?.background?.opacity ?? 85}%`,
      }}
    >
      <WeatherCard
        intervalMinutes={clampSetting(settings?.intervalMinutes, 0, 30, 10)}
        showSeconds={clampSetting(settings?.showSeconds, 5, 30, 12)}
      />
    </div>
  );
};
