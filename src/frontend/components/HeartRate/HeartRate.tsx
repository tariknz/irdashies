import { HeartIcon } from '@phosphor-icons/react';
import { useDashboard } from '@irdashies/context';
import { useHeartRateSettings } from './hooks/useHeartRateSettings';
import { HeartRateEmbed } from './components/HeartRateEmbed';

export const HeartRate = () => {
  const { isDemoMode } = useDashboard();
  const { enabled, config } = useHeartRateSettings();

  if (!isDemoMode && !enabled) return null;

  if (!config.deviceId) {
    // Nothing to show on a live overlay until configured; in edit/preview show
    // a hint so the widget isn't invisible.
    if (!isDemoMode) return null;
    return (
      <div className="flex h-full w-full items-center justify-center gap-2 rounded-md bg-slate-800/70 px-3 text-center text-sm text-slate-300">
        <HeartIcon size={20} weight="fill" className="text-rose-500" />
        Set a HypeRate Session ID in settings
      </div>
    );
  }

  return (
    <HeartRateEmbed deviceId={config.deviceId} widgetUrl={config.widgetUrl} />
  );
};
