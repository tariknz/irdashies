import { useDashboard, TrackTemperatureStoreUpdater } from '@irdashies/context';

const TRACK_TEMPERATURE_WIDGET_IDS = new Set([
  'standings',
  'relative',
  'infobar',
]);

export const TrackTemperatureUpdater = () => {
  const { currentDashboard } = useDashboard();

  // airTemperature/trackTemperature default to enabled in footer bars, so a
  // per-item settings check isn't meaningful — gate on whether any widget
  // that can render a SessionBar is present at all.
  const enabled = !!currentDashboard?.widgets.some(
    (widget) => widget.enabled && TRACK_TEMPERATURE_WIDGET_IDS.has(widget.id)
  );

  if (!enabled) return null;
  return <TrackTemperatureStoreUpdater enabled={enabled} />;
};
