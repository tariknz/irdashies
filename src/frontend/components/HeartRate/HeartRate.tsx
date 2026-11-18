import { useDashboard } from '@irdashies/context';
import { useHeartRateSettings } from './hooks/useHeartRateSettings';
import { HeartRateEmbed } from './components/HeartRateEmbed';
import { HeartRatePreview } from './HeartRatePreview';

// Registered widget roots are plain function components (see WIDGET_MAP's type
// and the other widgets); they are not memo-wrapped.
export const HeartRate = () => {
  const { isDemoMode } = useDashboard();
  const { enabled, config } = useHeartRateSettings();

  if (isDemoMode) return <HeartRatePreview />;
  if (!enabled || !config.deviceId.trim()) return null;

  return (
    <HeartRateEmbed deviceId={config.deviceId} widgetUrl={config.widgetUrl} />
  );
};
