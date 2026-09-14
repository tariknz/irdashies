import { useMemo } from 'react';
import type { LapTraceConfig } from '@irdashies/types';
import {
  DEFAULT_AUDIO_OUTPUT_DEVICE_ID,
  DEFAULT_LAP_TRACE_COLORS,
  DEFAULT_LAP_TRACE_SOUND,
} from '@irdashies/types';
import {
  trackStateSelectors,
  useDrivingState,
  useLapTraceRecordingProgress,
  useLapTraceStore,
  useSessionVisibility,
  useTrackStateSelector,
} from '@irdashies/context';
import { formatTime } from '@irdashies/utils/time';
import { resolveSpeedUnit, speedFromMs } from '@irdashies/utils/units';
import { selectBrakeCuePoints } from '../../domain/lapTrace/brakeCuePoints';
import { LapTracePlot } from './LapTracePlot';
import { BrakeCue } from './components/BrakeCue';
import {
  LastCornerPanel,
  LAST_CORNER_DEFAULT_FONT_SIZE,
} from './components/LastCornerPanel';
import { useLapTraceSettings } from './hooks/useLapTraceSettings';
import {
  useLastCornerComparison,
  useLastCornerLabels,
} from './hooks/useLastCornerComparison';

export type LapTraceProps = Partial<LapTraceConfig> & {
  /** Story/testing hook: pin the car to a fixed distance along the lap. */
  carDistanceMOverride?: number;
};

/** Stable identity so the countdown's effects do not restart every render. */
const EMPTY_CUE_POINTS = new Float32Array(0);

/**
 * Plots a saved reference lap's inputs against position on track, in a window
 * that slides with the car. The reference is drawn pastel, as a washed-out
 * background target; the lap currently being driven is overlaid as a bright
 * ghost so the two can be read against each other directly.
 */
export const LapTrace = (props: LapTraceProps) => {
  const settings = useLapTraceSettings();
  const config = { ...settings, ...props };

  const { isDriving } = useDrivingState();
  const isSessionVisible = useSessionVisibility(config.sessionVisibility);

  const referenceLap = useLapTraceStore((s) => s.referenceLap);
  const referenceError = useLapTraceStore((s) => s.referenceError);
  const trackLengthM = useLapTraceStore((s) => s.trackLengthM);
  const recordingProgress = useLapTraceRecordingProgress();

  // Changes essentially never, so this costs no per-frame renders.
  const displayUnits = useTrackStateSelector(trackStateSelectors.displayUnits);
  const speedUnit = resolveSpeedUnit(config.lastCornerSpeedUnit, displayUnits);
  const lastCornerLabelStyle = config.lastCornerLabelStyle ?? 'name';
  const lastCornerEnabled =
    !!config.showLastCorner && !!referenceLap && isSessionVisible;
  const lastCorners = useLastCornerComparison(
    lastCornerEnabled,
    lastCornerLabelStyle
  );
  // Every corner name this circuit can produce, so the panel's name column is
  // one fixed width for the session rather than resizing as history builds.
  const cornerLabels = useLastCornerLabels(
    lastCornerEnabled,
    lastCornerLabelStyle
  );
  const lastCornerPosition = config.lastCornerPosition ?? 'bottom';
  const lastCornerEntries = useMemo(
    () =>
      lastCorners.map((entry) => ({
        sectionId: entry.sectionId,
        label: entry.label,
        timeDeltaSec: entry.timeDeltaSec,
        brakePointDeltaM: entry.brakePointDeltaM,
        apexSpeedDelta: speedFromMs(entry.apexSpeedDeltaMs, speedUnit),
        completedAt: entry.completedAt,
      })),
    [lastCorners, speedUnit]
  );

  // Filtered once per reference lap: the store swaps the whole object on
  // promotion, so its identity is a safe memo key.
  const brakeCuePointsM = useMemo(
    () =>
      referenceLap ? selectBrakeCuePoints(referenceLap) : EMPTY_CUE_POINTS,
    [referenceLap]
  );
  const brakeCueActive =
    !!referenceLap && (!!config.brakeCueBars || !!config.brakeCueAudio);
  const barSide = config.brakeCueBarSide ?? 'right';
  const barsOnLeft = barSide === 'left';
  const barsHorizontal = barSide === 'top' || barSide === 'bottom';

  // One element, placed on whichever edge is configured. Only ever rendered in
  // one of the four slots below.
  const lastCornerPanel = config.showLastCorner ? (
    <LastCornerPanel
      entries={lastCornerEntries}
      count={config.lastCornerCount ?? 3}
      placement={lastCornerPosition}
      speedUnit={speedUnit}
      showTime={config.showLastCornerTime}
      showBrakeDelta={config.showLastCornerBrakeDelta}
      showApexSpeed={config.showLastCornerApexSpeed}
      displayOrder={config.lastCornerDisplayOrder}
      cornerLabels={cornerLabels}
      fontSize={config.lastCornerFontSize ?? LAST_CORNER_DEFAULT_FONT_SIZE}
      latestScale={config.lastCornerLatestScale ?? 1.4}
    />
  ) : null;

  // One element, placed on whichever edge is configured. Only ever rendered in
  // one of the four slots below.
  const brakeCue = brakeCueActive ? (
    <BrakeCue
      cuePointsM={brakeCuePointsM}
      showBars={!!config.brakeCueBars}
      barSide={barSide}
      lastBar={config.brakeCueLastBar ?? 'top'}
      playAudio={!!config.brakeCueAudio}
      volume={config.brakeCueVolume ?? 0.6}
      audioCueLeadSec={config.brakeCueLeadSec ?? 0}
      audioDeviceId={
        config.brakeCueOutputDeviceId ?? DEFAULT_AUDIO_OUTPUT_DEVICE_ID
      }
      cues={config.sound ?? DEFAULT_LAP_TRACE_SOUND}
      colors={config.colors ?? DEFAULT_LAP_TRACE_COLORS}
      carDistanceMOverride={props.carDistanceMOverride}
    />
  ) : null;

  if (!isSessionVisible) return null;
  if (config.showOnlyWhenOnTrack && !isDriving) return null;

  return (
    <div
      // overflow-hidden keeps everything inside the layout rectangle: the
      // header and the panels are fixed-height, so a widget resized shorter
      // than their total would otherwise spill the trace outside its box.
      className="flex h-full flex-col overflow-hidden rounded-sm p-1.5 text-white"
      style={{
        backgroundColor: `rgba(15, 23, 42, ${config.background.opacity})`,
      }}
    >
      <div className="flex-none flex items-baseline gap-2 text-[11px] leading-none mb-1">
        {/* An imported lap (Garage 61 or .ibt) is labelled with its driver - car - track
            info, which can be longer than the widget. Use a smaller font size and cap
            width so lap time stays readable. */}
        <span
          className="text-slate-400 uppercase tracking-wide max-w-[65%] truncate text-[9px]"
          title={referenceLap?.source.label ?? undefined}
        >
          {referenceLap?.source.label ?? 'Lap Trace'}
        </span>
        {referenceLap && referenceLap.lapTimeSec > 0 && (
          <span className="text-amber-300 font-semibold tabular-nums">
            {formatTime(referenceLap.lapTimeSec)}
          </span>
        )}
      </div>

      {referenceLap ? (
        <>
          {lastCornerPosition === 'top' && lastCornerPanel}
          {/* The countdown bars sit beside/above/below the trace, not as an
              overlay on it, so they never cover the plot. Where the
              last-corner panel shares an edge with them, the bars sit
              inboard, closer to the plot: they are a live cue tied to what
              the trace is showing, while the panel is history. */}
          <div className="flex min-h-0 min-w-0 flex-1 flex-row gap-1.5 overflow-hidden">
            {lastCornerPosition === 'left' && lastCornerPanel}
            {!barsHorizontal && barsOnLeft && brakeCue}
            {/* The plot and its top/bottom countdown strip share one column so
                the horizontal strip spans only the trace width, not the whole
                widget: a left/right last-corner panel takes its width from
                this column, and the live cue stays aligned to the trace it
                belongs to rather than running on across the history panel. */}
            <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
              {barsHorizontal && barSide === 'top' && brakeCue}
              <div className="min-h-0 min-w-0 flex-1">
                <LapTracePlot
                  metersBehind={config.metersBehind}
                  metersAhead={config.metersAhead}
                  showThrottle={config.showThrottle}
                  showBrake={config.showBrake}
                  showSpeed={config.showSpeed}
                  showGhost={config.showGhost}
                  showGearLabels={config.showGearLabels}
                  showBrakePointMarkers={config.showBrakePointMarkers}
                  showThrottlePointMarkers={config.showThrottlePointMarkers}
                  showAbs={config.showAbs ?? true}
                  absStyle={config.absStyle ?? 'bar'}
                  showAbsBar={config.showAbsBar ?? false}
                  ghostOpacity={config.ghostOpacity ?? 1}
                  driverOpacity={config.driverOpacity ?? 1}
                  referenceFilled={config.referenceFilled}
                  strokeWidth={config.strokeWidth}
                  carLineColor={config.carLineColor ?? '#ffffff'}
                  colors={config.colors ?? DEFAULT_LAP_TRACE_COLORS}
                  carDistanceMOverride={props.carDistanceMOverride}
                />
              </div>
              {barsHorizontal && barSide === 'bottom' && brakeCue}
            </div>
            {!barsHorizontal && !barsOnLeft && brakeCue}
            {lastCornerPosition === 'right' && lastCornerPanel}
          </div>
          {lastCornerPosition === 'bottom' && lastCornerPanel}
        </>
      ) : (
        <div className="flex-1 min-h-0 flex flex-col items-center justify-center gap-1 text-center">
          <span className="text-slate-400 text-xs">
            {referenceError ?? 'Drive a clean lap to record a reference'}
          </span>
          {!referenceError && trackLengthM > 0 && (
            <>
              <div className="w-2/3 h-1 bg-slate-700/60 rounded-full overflow-hidden">
                <div
                  className="h-full bg-amber-400 rounded-full"
                  style={{ width: `${Math.round(recordingProgress * 100)}%` }}
                />
              </div>
              <span className="text-slate-500 text-[10px] tabular-nums">
                Recording {Math.round(recordingProgress * 100)}%
              </span>
            </>
          )}
        </div>
      )}
    </div>
  );
};
