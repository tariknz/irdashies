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

export interface RendererPerfSample {
  schemaVersion: 1;
  timestamp: string;
  runId: string;
  scenario: string;
  pid: number;
  route: string;
  visibilityState: DocumentVisibilityState;
  intervalMs: number;
  frameTimeMs: NumericSampleStats;
  telemetryCallbackMs?: NumericSampleStats;
  channelCallbackMs?: NumericSampleStats;
  trackMapAnimationFrameMs?: NumericSampleStats;
  standingsPlayerGapsMs?: NumericSampleStats;
  standingsFinalTimingMs?: NumericSampleStats;
  lapTraceFrameMs?: NumericSampleStats;
  lapTraceBrakeCueMs?: NumericSampleStats;
  telemetryWakeups?: number;
  channelWakeups?: number;
  framesOver25Ms: number;
  framesOver50Ms: number;
}

/** Every measure the renderer may report; the preload bridge drops any other. */
export const RENDERER_PERF_MEASURE_NAMES = [
  'trackMapAnimationFrame',
  'standingsPlayerGaps',
  'standingsFinalTiming',
  'lapTraceFrame',
  'lapTraceBrakeCue',
] as const;

export type RendererPerfMeasureName =
  (typeof RENDERER_PERF_MEASURE_NAMES)[number];

export interface RendererPerfBridge {
  recordMeasure: (name: RendererPerfMeasureName, durationMs: number) => void;
}
