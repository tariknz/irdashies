import { useMemo } from 'react';
import type { LapTraceConfig, LapTraceSource } from '@irdashies/types';
import {
  useLapTraceRecorder,
  useWidgetsForThisDisplay,
} from '@irdashies/context';

/**
 * Runs the lap-trace recorder for this window. Renders nothing.
 *
 * Mounted outside the hide wrapper, unlike the widgets themselves. Alt+H
 * unmounts everything it wraps, and unmounting the recorder resets its store,
 * which throws away the lap being driven and leaves the reference blank until
 * iRacing next republishes its session — in a solo stint, possibly never.
 * Hiding the overlay should hide the overlay, not stop recording.
 *
 * Still scoped to the display that hosts the widget: the recorder persists
 * laps, so one per window would have every window writing the same lap.
 */
const RECORDER_OFF: LapTraceSource | null = null;

export const LapTraceUpdater = () => {
  const widgets = useWidgetsForThisDisplay();

  const referenceSource = useMemo<LapTraceSource | null>(() => {
    const widget = widgets.find((w) => w.id === 'laptrace');
    if (!widget) return RECORDER_OFF;
    const config = widget.config as LapTraceConfig | undefined;
    return config?.referenceSource ?? 'best';
  }, [widgets]);

  return referenceSource ? (
    <Recorder referenceSource={referenceSource} />
  ) : null;
};

/**
 * The hook itself, behind a component so it is only called when the widget is
 * enabled — a hook cannot be called conditionally, and a disabled Lap Trace
 * should cost nothing at all.
 */
const Recorder = ({ referenceSource }: { referenceSource: LapTraceSource }) => {
  useLapTraceRecorder(referenceSource);
  return null;
};
