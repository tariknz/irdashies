import { useDashboard, SessionTimingStoreUpdater } from '@irdashies/context';

const SESSION_TIMING_WIDGET_IDS = new Set(['standings', 'relative', 'infobar']);

export const SessionTimingUpdater = () => {
  const { currentDashboard } = useDashboard();

  // sessionLaps defaults to enabled in both header/footer bars, so a
  // per-item settings check isn't meaningful — gate on whether any widget
  // that can render a SessionBar is present at all.
  const enabled = !!currentDashboard?.widgets.some(
    (widget) => widget.enabled && SESSION_TIMING_WIDGET_IDS.has(widget.id)
  );

  // Mount conditionally rather than always-mounting with enabled={false}:
  // useSessionLapCount/useTotalRaceValue run unconditionally once mounted
  // (React can't skip a hook call from inside), so the only way to actually
  // avoid the leader-car loop when nothing needs it is to not mount it.
  if (!enabled) return null;
  return <SessionTimingStoreUpdater enabled={enabled} />;
};
