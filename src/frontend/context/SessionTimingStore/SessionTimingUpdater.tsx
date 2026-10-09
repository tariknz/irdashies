import { useDashboard } from '../DashboardContext/DashboardContext';
import { SessionTimingStoreUpdater } from './SessionTimingStoreUpdater';

const SESSION_TIMING_WIDGET_TYPES = new Set([
  'standings',
  'relative',
  'infobar',
]);

interface SessionTimingUpdaterProps {
  /**
   * Type of the one widget this renderer draws, for a single-widget page.
   *
   * Such a page draws its widget whether or not it is enabled for the desktop
   * overlays, so the enabled widgets in the dashboard say nothing about what
   * it needs.
   */
  soloWidgetType?: string;
}

export const SessionTimingUpdater = ({
  soloWidgetType,
}: SessionTimingUpdaterProps = {}) => {
  const { currentDashboard } = useDashboard();

  // sessionLaps defaults to enabled in both header/footer bars, so a
  // per-item settings check isn't meaningful — gate on whether any widget
  // that can render a SessionBar is present at all. A second instance of a
  // widget has its own id, so match on the type it names.
  const enabled = soloWidgetType
    ? SESSION_TIMING_WIDGET_TYPES.has(soloWidgetType)
    : !!currentDashboard?.widgets.some(
        (widget) =>
          widget.enabled &&
          SESSION_TIMING_WIDGET_TYPES.has(widget.type || widget.id)
      );

  // Only mount the channel subscriber when a widget needs session timing.
  if (!enabled) return null;
  return <SessionTimingStoreUpdater enabled={enabled} />;
};
