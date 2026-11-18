export interface NumericSampleStats {
  count: number;
  avg: number;
  min: number;
  max: number;
  p1: number;
  p50: number;
  p95: number;
  p99: number;
}

export const PERF_RENDERER_LOG_PREFIX = '[PerfRenderer:JSON] ';

export interface RendererPerfSample {
  schemaVersion: 1;
  timestamp: string;
  runId: string;
  scenario: string;
  /** Preload process.pid may be namespace-local; use osPid for OS attribution. */
  pid: number;
  osPid?: number;
  webContentsId?: number;
  windowId?: number;
  route: string;
  /** DOM wrapper IDs at report time; does not prove visible pixels or active input. */
  widgetDomIds?: string[];
  visibilityState: DocumentVisibilityState;
  intervalMs: number;
  frameTimeMs: NumericSampleStats;
  telemetryCallbackMs?: NumericSampleStats;
  channelCallbackMs?: NumericSampleStats;
  trackMapAnimationFrameMs?: NumericSampleStats;
  trackMapCommitDrawMs?: NumericSampleStats;
  trackMapRafDrawMs?: NumericSampleStats;
  inputTraceFrameMs?: NumericSampleStats;
  radarFrameMs?: NumericSampleStats;
  standingsPlayerGapsMs?: NumericSampleStats;
  standingsFinalTimingMs?: NumericSampleStats;
  lapTraceFrameMs?: NumericSampleStats;
  lapTraceBrakeCueMs?: NumericSampleStats;
  widgetDragMs?: NumericSampleStats;
  telemetryWakeups?: number;
  channelWakeups?: number;
  framesOver25Ms: number;
  framesOver50Ms: number;
}

/** Every measure the renderer may report; the preload bridge drops any other. */
export const RENDERER_PERF_MEASURE_NAMES = [
  'trackMapAnimationFrame',
  'trackMapCommitDraw',
  'trackMapRafDraw',
  'inputTraceFrame',
  'radarFrame',
  'standingsPlayerGaps',
  'standingsFinalTiming',
  'lapTraceFrame',
  'lapTraceBrakeCue',
  'widgetDrag',
] as const;

export type RendererPerfMeasureName =
  (typeof RENDERER_PERF_MEASURE_NAMES)[number];

export interface RendererPerfBridge {
  recordMeasure: (name: RendererPerfMeasureName, durationMs: number) => void;
}
