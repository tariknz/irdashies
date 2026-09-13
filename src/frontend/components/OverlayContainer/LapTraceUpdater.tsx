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
 *
 * `browser` is the OBS/browser-source renderer, which has no display bounds to
 * scope by and no lap-trace bridge behind it. The recorder runs there all the
 * same: it is what allocates the active lap and feeds it, so without it that
 * view draws no trace at all, however many laps are driven. Nothing is read
 * from or written to disk in that mode — a reference appears once a clean lap
 * has been driven in the browser view itself, and the imported sources stay
 * out of reach (see setReferenceFromSource).
 */
const RECORDER_OFF: LapTraceSource | null = null;

export const LapTraceUpdater = ({ browser = false }: { browser?: boolean }) => {
  const widgets = useWidgetsForThisDisplay(browser);

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
