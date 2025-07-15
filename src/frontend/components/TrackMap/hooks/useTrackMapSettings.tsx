import { useDashboard } from '@irdashies/context';

interface TrackMapSettings {
  enabled: boolean;
  config: {
    enableTurnNames: boolean;
  };
}

export const useTrackMapSettings = () => {
  const { currentDashboard } = useDashboard();

  const settings = currentDashboard?.widgets.find(
    (widget) => widget.id === 'map'
  )?.config;

  // Add type guard to ensure settings matches expected shape
  if (
    settings &&
    typeof settings === 'object' &&
    'enableTurnNames' in settings &&
    typeof settings.enableTurnNames === 'boolean'
  ) {
    return settings as TrackMapSettings['config'];
  }

  return undefined;
};
