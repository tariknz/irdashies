import { useDashboard } from '../DashboardContext/DashboardContext';
import { SessionTimingStoreUpdater } from './SessionTimingStoreUpdater';

const SESSION_TIMING_WIDGET_IDS = new Set(['standings', 'relative', 'infobar']);

export const SessionTimingUpdater = () => {
  const { currentDashboard } = useDashboard();

  // sessionLaps defaults to enabled in both header/footer bars, so a
  // per-item settings check isn't meaningful — gate on whether any widget
  // that can render a SessionBar is present at all.
  const enabled = !!currentDashboard?.widgets.some(
    (widget) => widget.enabled && SESSION_TIMING_WIDGET_IDS.has(widget.id)
  );

  // Only mount the channel subscriber when a widget needs session timing.
  if (!enabled) return null;
  return <SessionTimingStoreUpdater enabled={enabled} />;
};
