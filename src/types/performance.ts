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
  /** Per-measure timings, keyed by {@link RendererPerfMeasureName}. */
  measures?: RendererPerfMeasureStats;
  telemetryWakeups?: number;
  channelWakeups?: number;
  framesOver25Ms: number;
  framesOver50Ms: number;
}

/**
 * Renderer-side measurements a widget can time. Declared as data so the
 * recorder allocates a buffer per name and the bridge validates against the
 * same list, rather than each site naming the measures it happens to know.
 */
export const RENDERER_PERF_MEASURES = [
  'trackMapAnimationFrame',
  'radarAnimationFrame',
] as const;

export type RendererPerfMeasureName = (typeof RENDERER_PERF_MEASURES)[number];

export type RendererPerfMeasureStats = Partial<
  Record<RendererPerfMeasureName, NumericSampleStats>
>;

export const isRendererPerfMeasureName = (
  name: string
): name is RendererPerfMeasureName =>
  (RENDERER_PERF_MEASURES as readonly string[]).includes(name);

export interface RendererPerfBridge {
  recordMeasure: (name: RendererPerfMeasureName, durationMs: number) => void;
}
