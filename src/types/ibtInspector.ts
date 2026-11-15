import type { IbtInspectorScenario } from './ibtInspectorScenario';
import type { ReplayWidgetCoverage } from './replayCoverage';
import type { TapeReplayCommand, TapeReplayStatus } from './tapeReplay';

export interface IbtFile {
  name: string;
  sizeBytes: number;
  modifiedAt: string;
}

export interface IbtInspectorProcessSample {
  key: string;
  pid: number;
  creationTime?: number;
  type: string;
  name?: string;
  cpuPercent: number | null;
  cpuTimeMsPerSecond: number | null;
  memoryMB: number | null;
  privateMemoryMB: number | null;
}

export interface IbtInspectorRendererHeapSample {
  key: string;
  pid: number;
  route: string;
  usedHeapMB: number | null;
  totalHeapMB: number | null;
}

export interface IbtInspectorFrameMetrics {
  timingSource?: 'present' | 'cpu-frame';
  frames: number;
  fps: number;
  frameTimeMs: number;
  p95FrameTimeMs: number;
  p99FrameTimeMs: number;
  low5Fps: number | null;
  low1Fps: number | null;
  cpuBusyMs: number | null;
  gpuTimeMs: number | null;
}

export interface IbtInspectorCaptureOptions {
  presentMon?: boolean;
  recordTelemetry?: boolean;
}

export interface IbtInspectorTelemetrySample {
  elapsedSeconds: number;
  intervalSeconds: number;
  gameFrames?: IbtInspectorFrameMetrics | null;
  appCpuPercent: number | null;
  appWorkingSetMB: number | null;
  appPrivateMemoryMB: number | null;
  mainV8HeapUsedMB: number | null;
  mainExternalMemoryMB: number | null;
  tickRateHz: number | null;
  eventLoopP99Ms: number | null;
  eventLoopMaxMs: number | null;
  processes: IbtInspectorProcessSample[];
  rendererHeaps: IbtInspectorRendererHeapSample[];
  channelActivity: IbtInspectorChannelTotal[];
}

export interface IbtInspectorMemoryCheckpoint {
  elapsedSeconds: number;
  appWorkingSetMB: number | null;
  appPrivateMemoryMB: number | null;
  mainV8HeapUsedMB: number | null;
  mainExternalMemoryMB: number | null;
  /** Live process measurements at checkpoint time; renderer GC does not collect main. */
  processes: IbtInspectorProcessSample[];
  /** Renderer V8 heap measurements taken immediately after explicit GC. */
  rendererHeaps: IbtInspectorRendererHeapSample[];
}

export interface IbtInspectorTrendPoint {
  elapsedSeconds: number;
  value: number | null;
}

export interface IbtInspectorTrendSummary {
  points: number;
  durationSeconds: number;
  first: number | null;
  last: number | null;
  delta: number | null;
  slopePerMinute: number | null;
}

/** A descriptive linear trend; short/noisy captures intentionally have no slope. */
export function summarizeIbtInspectorTrend(
  points: readonly IbtInspectorTrendPoint[]
): IbtInspectorTrendSummary {
  const valid = points
    .filter(
      (point): point is IbtInspectorTrendPoint & { value: number } =>
        Number.isFinite(point.elapsedSeconds) &&
        typeof point.value === 'number' &&
        Number.isFinite(point.value)
    )
    .sort((a, b) => a.elapsedSeconds - b.elapsedSeconds);
  if (valid.length < 2) {
    return {
      points: valid.length,
      durationSeconds: 0,
      first: valid[0]?.value ?? null,
      last: valid.at(-1)?.value ?? null,
      delta: null,
      slopePerMinute: null,
    };
  }
  const first = valid[0];
  const last = valid[valid.length - 1];
  const durationSeconds = last.elapsedSeconds - first.elapsedSeconds;
  const xMean =
    valid.reduce((sum, point) => sum + point.elapsedSeconds, 0) / valid.length;
  const yMean =
    valid.reduce((sum, point) => sum + point.value, 0) / valid.length;
  const xVariance = valid.reduce(
    (sum, point) => sum + (point.elapsedSeconds - xMean) ** 2,
    0
  );
  const covariance = valid.reduce(
    (sum, point) =>
      sum + (point.elapsedSeconds - xMean) * (point.value - yMean),
    0
  );
  return {
    points: valid.length,
    durationSeconds,
    first: first.value,
    last: last.value,
    delta: last.value - first.value,
    slopePerMinute:
      valid.length >= 3 && durationSeconds >= 30 && xVariance > 0
        ? (covariance / xVariance) * 60
        : null,
  };
}

export interface IbtInspectorSectionTotal {
  name: string;
  count: number;
  totalWallMs: number;
  averageMs: number;
  maxWallMs: number;
}

export interface IbtInspectorChannelTotal {
  name: string;
  processorExecutions: number;
  publications: number;
  deliveries: number;
}

export interface IbtInspectorBaselineCapture {
  label: string;
  telemetry: IbtInspectorTelemetrySample[];
  memoryCheckpoints: IbtInspectorMemoryCheckpoint[];
}

export interface IbtInspectorCaptureStatus {
  active: boolean;
  mode?: 'replay' | 'live';
  telemetryPath?: string | null;
  presentMonError?: string | null;
  samples: number;
  reportPath: string | null;
  error: string | null;
  /** Uniformly downsampled chart points; full one-second reports stay in NDJSON. */
  telemetry: IbtInspectorTelemetrySample[];
  memoryCheckpoints: IbtInspectorMemoryCheckpoint[];
  baseline: IbtInspectorBaselineCapture | null;
  heapSampling: { attachedTargets: number; skippedTargets: number };
  hottestSections: IbtInspectorSectionTotal[];
  channelActivity: IbtInspectorChannelTotal[];
}

export interface IbtInspectorStatus {
  file: string | null;
  playback: TapeReplayStatus | null;
  warnings: string[];
  coverage?: ReplayWidgetCoverage[];
  capture: IbtInspectorCaptureStatus;
}

export interface IbtInspectorBridge {
  getScenario: () => Promise<IbtInspectorScenario | null>;
  saveScenario: () => Promise<void>;
  open: () => Promise<void>;
  list: () => Promise<{
    directory: string;
    files: IbtFile[];
    truncated: boolean;
  }>;
  status: () => Promise<IbtInspectorStatus>;
  load: (name: string, speed: number | 'max') => Promise<void>;
  command: (command: TapeReplayCommand) => Promise<void>;
  stop: () => Promise<void>;
  selectPresentMon: () => Promise<boolean>;
  startCapture: (options?: IbtInspectorCaptureOptions) => Promise<void>;
  startLiveCapture: (options?: IbtInspectorCaptureOptions) => Promise<void>;
  stopCapture: () => Promise<void>;
  checkpointMemory: () => Promise<void>;
  showReport: () => Promise<void>;
}
