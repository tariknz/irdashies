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
  framesOver25Ms: number;
  framesOver50Ms: number;
}
