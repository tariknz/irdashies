import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type {
  NumericSampleStats,
  RendererPerfSample,
} from '../../src/types/performance';
import { listArgument, numericArgument, parseArguments } from './args.ts';
import {
  MIN_ANALYSIS_SECONDS,
  PERF_GATES,
  comparisonCheckSatisfied,
  comparisonCheckStatus,
  contrastDescription,
  parseComparisonContrast,
  type ComparisonContrast,
} from './gates.ts';

const MAIN_PREFIX = '[PerfMetrics:JSON] ';
const RENDERER_PREFIX = '[PerfRenderer:JSON] ';
const VISIBILITY_PREFIX = '[PerfVisibility:JSON] ';
const ORIGIN_PREFIX = '[PerfRunOrigin:JSON] ';
const MIN_PRIVATE_OBSERVATIONS = 2;
const MIN_PRIVATE_SPAN_RATIO = 0.8;
const MAX_PRIVATE_SAMPLE_GAP_SECONDS = 60;
const WORKLOAD_TIMING_TOLERANCE_SECONDS = 1;

interface SectionStats {
  count: number;
  avgMs: number;
  maxMs: number;
  p99Ms: number;
}

export interface SdkWaitSummary {
  durationMs: NumericSampleStats;
  calls: number;
  reads: number;
  unsuccessful: number;
  totalMs: number;
  timeoutMs: number;
  targetHz: number;
}

interface MainPerfSample {
  timestamp: string;
  runId: string;
  scenario: string;
  overlayMode: string;
  intervalMs?: number;
  tickRateHz: number;
  sections: Record<string, SectionStats>;
  eventLoopDelayMs: { mean: number; max: number; p99: number };
  sdkWait?: {
    durationMs: NumericSampleStats;
    calls: number;
    reads: number;
    unsuccessful: number;
    totalMs: number;
    timeoutMs: number;
    targetHz: number;
  };
  iracing: {
    frameRate: NumericSampleStats;
    cpuUsageForeground: NumericSampleStats;
    cpuUsageBackground: NumericSampleStats;
    gpuUsage: NumericSampleStats;
  };
  totalAppCpuPercent?: number;
  totalAppMemoryMB?: number;
  totalAppPrivateMemoryMB?: number;
  privateMemoryReused?: boolean;
  scenarioMetadata?: Record<string, unknown>;
  channelMetrics?: {
    processorExecutions: Record<string, number>;
    publications: Record<string, number>;
    deliveries: Record<string, number>;
  };
  processes?: {
    pid: number;
    type: string;
    name?: string;
    cpuPercent: number;
    memoryMB: number;
    privateMemoryMB?: number;
  }[];
}

interface VisibilityMarker {
  timestamp: string;
  runId: string;
  index: number;
  visibility: 'visible' | 'hidden';
  durationSeconds: number;
}

interface RunOriginMarker {
  timestamp: string;
  runId: string;
}

export interface PerfCapture {
  main: MainPerfSample[];
  renderer: RendererPerfSample[];
  visibility?: VisibilityMarker[];
  origins?: RunOriginMarker[];
}

export interface AnalysisWindow {
  startSeconds?: number;
  endSeconds?: number;
}

export interface PerfSummary {
  runId: string;
  captureOrigin?: string;
  scenario: string;
  overlayMode: string;
  durationMinutes: number;
  sampleCount: number;
  analysisWindow: {
    startSeconds: number;
    endSeconds?: number;
    openEnded?: boolean;
  };
  scenarioMetadata: Record<string, unknown>;
  visibilityPhases: VisibilityMarker[];
  phaseEvidence: {
    index: number;
    visibility: 'visible' | 'hidden';
    startSeconds: number;
    durationSeconds: number;
    sampleCount: number;
    expectedBehaviorSatisfied: boolean;
    reasons: string[];
  }[];
  iracing: {
    fpsObservationCount?: number;
    averageFps: number;
    meanOnePercentLowFps: number;
    worstFps: number;
    averageCpuForeground: number;
    averageGpuUsage: number;
  };
  app: {
    averageCpuPercent: number;
    averageRendererCpuPercent: number;
    averageMainCpuPercent: number;
    averageGpuCpuPercent: number;
    peakMemoryMB: number;
    averageRendererMemoryMB: number;
    averageMainMemoryMB: number;
    averageGpuMemoryMB: number;
    peakRendererMemoryMB: number;
    peakMainMemoryMB: number;
    peakGpuMemoryMB: number;
    peakPrivateMemoryMB: number;
    averageRendererPrivateMemoryMB: number;
    averageMainPrivateMemoryMB: number;
    averageGpuPrivateMemoryMB: number;
    rendererProcessCount: number;
    memorySlopeMBPerMinute: number;
    privateMemorySlopeMBPerMinute: number;
  };
  processes: {
    pid: number;
    type: string;
    name: string;
    averageCpuPercent: number;
    averageMemoryMB: number;
    peakMemoryMB: number;
    memorySlopeMBPerMinute: number;
    averagePrivateMemoryMB: number;
    peakPrivateMemoryMB: number;
    privateMemorySlopeMBPerMinute: number;
  }[];
  sections: Record<
    string,
    {
      sampleCount: number;
      operationCount: number;
      averageMeanMs: number;
      p99MeanMs: number;
      p99WorstMs: number;
    }
  >;
  telemetry: {
    averageTickRateHz: number;
    minimumTickRateHz: number;
    processTelemetryObservationCount?: number;
    processTelemetryP99MeanMs: number;
    processTelemetryP99WorstMs: number;
    broadcastP99MeanMs: number;
  };
  sdkWait?: SdkWaitSummary;
  eventLoop: {
    p99MeanMs: number;
    p99WorstMs: number;
    worstStallMs: number;
  };
  renderer: {
    sampleCount: number;
    frameTimeP99MeanMs: number;
    worstFrameMs: number;
    telemetryCallbackRateHz: number;
    channelCallbackRateHz: number;
    totalWakeupRateHz: number;
    telemetryCallbackP99MeanMs: number;
    telemetryCallbackP99WorstMs: number;
    trackMapAnimationFrameRateHz: number;
    trackMapAnimationFrameP99MeanMs: number;
    trackMapAnimationFrameP99WorstMs: number;
    inputTraceFrameRateHz: number;
    inputTraceFrameP99MeanMs: number;
    inputTraceFrameP99WorstMs: number;
    radarFrameRateHz: number;
    radarFrameP99MeanMs: number;
    radarFrameP99WorstMs: number;
    widgetRenderRateHz: number | null;
    widgetRenderP99MeanMs: number | null;
    widgetRenderP99WorstMs: number | null;
    lapTraceFrameRateHz: number;
    lapTraceFrameP99MeanMs: number;
    lapTraceFrameP99WorstMs: number;
    lapTraceBrakeCueRateHz: number;
    lapTraceBrakeCueP99MeanMs: number;
    lapTraceBrakeCueP99WorstMs: number;
    framesOver25MsPercent: number;
    framesOver50MsPercent: number;
    frameCount: number;
  };
  channels: Record<
    string,
    {
      processorExecutions: number;
      publications: number;
      deliveries: number;
      processorRateHz: number;
      publicationRateHz: number;
      deliveryRateHz: number;
    }
  >;
  widgetInputs: Record<
    string,
    {
      covered: boolean;
      inputs: Record<
        string,
        {
          observed: boolean;
          changeRateHz: number;
          deliveryRateHz: number;
        }
      >;
    }
  >;
  evidence: {
    runOriginAvailable: boolean;
    privateMemoryAvailable: boolean;
    privateMemorySampleCount: number;
    privateMemorySpanSeconds: number;
    privateMemoryMaxGapSeconds: number;
    privateMemorySamplingAdequate: boolean;
    scenarioMetadataConsistent: boolean;
    inputCoverageAvailable: boolean;
    inputCoverageComplete: boolean;
    durationSufficient: boolean;
    conclusive: boolean;
    inconclusiveReasons: string[];
  };
}

export interface PerfComparison {
  baseline: PerfSummary;
  candidate: PerfSummary;
  contrast: ComparisonContrast;
  delta: {
    averageFpsPercent: number;
    onePercentLowFpsPercent: number;
    appCpuPercent: number;
    peakMemoryMB: number;
    processTelemetryP99Ms: number;
    eventLoopP99Ms: number;
    trackMapAnimationFrameRateHz: number;
    trackMapAnimationFrameP99Ms: number;
    inputTraceFrameRateHz: number;
    inputTraceFrameP99Ms: number;
    radarFrameRateHz: number;
    radarFrameP99Ms: number;
    widgetRenderRateHz: number | null;
    widgetRenderP99Ms: number | null;
    lapTraceFrameRateHz: number;
    lapTraceFrameP99Ms: number;
    lapTraceBrakeCueRateHz: number;
    lapTraceBrakeCueP99Ms: number;
  };
  checks: {
    name: string;
    passed: boolean | null;
    actual: number;
    target: string;
  }[];
}

function extractJson<T>(line: string, prefix: string): T | undefined {
  const prefixIndex = line.indexOf(prefix);
  if (prefixIndex < 0) return undefined;

  try {
    return JSON.parse(line.slice(prefixIndex + prefix.length)) as T;
  } catch {
    return undefined;
  }
}

export function parsePerfLog(contents: string): PerfCapture {
  const capture: PerfCapture = {
    main: [],
    renderer: [],
    visibility: [],
    origins: [],
  };
  for (const line of contents.split(/\r?\n/)) {
    const main = extractJson<MainPerfSample>(line, MAIN_PREFIX);
    if (main) {
      capture.main.push(main);
      continue;
    }

    const renderer = extractJson<RendererPerfSample>(line, RENDERER_PREFIX);
    if (renderer) {
      capture.renderer.push(renderer);
      continue;
    }

    const visibility = extractJson<VisibilityMarker>(line, VISIBILITY_PREFIX);
    if (visibility) {
      capture.visibility?.push(visibility);
      continue;
    }

    const origin = extractJson<RunOriginMarker>(line, ORIGIN_PREFIX);
    if (origin) capture.origins?.push(origin);
  }
  return capture;
}

function average(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function weightedAverage(values: { value: number; weight: number }[]): number {
  const totalWeight = values.reduce((sum, item) => sum + item.weight, 0);
  if (totalWeight === 0) return 0;
  return (
    values.reduce((sum, item) => sum + item.value * item.weight, 0) /
    totalWeight
  );
}

function minimum(values: number[]): number {
  return values.length > 0 ? Math.min(...values) : 0;
}

function maximum(values: number[]): number {
  return values.length > 0 ? Math.max(...values) : 0;
}

/**
 * Rate and p99 of one renderer measure, over the intervals that reported it.
 * A loop's rate is its own: a frame loop measured on every animation frame
 * reads at the display's refresh rate, one driven by telemetry at its rate.
 */
function summarizeRendererMeasure(
  renderer: RendererPerfSample[],
  select: (sample: RendererPerfSample) => NumericSampleStats | undefined
): { rateHz: number; p99MeanMs: number; p99WorstMs: number } {
  // A window may register a widget's counter during startup, then keep
  // reporting zero after the widget moves to another display. Only windows
  // observed painting this measure belong in its rate denominator. Retain
  // their zero-count intervals so actual pauses still reduce the rate.
  const painters = new Set(
    renderer
      .filter((sample) => (select(sample)?.count ?? 0) > 0)
      .map((sample) => sample.pid)
  );
  const participating = renderer.filter((sample) => painters.has(sample.pid));
  const stats = participating
    .map(select)
    .filter((entry): entry is NumericSampleStats => entry !== undefined);
  const seconds =
    participating
      .filter((sample) => select(sample) !== undefined)
      .reduce((sum, sample) => sum + sample.intervalMs, 0) / 1000;
  return {
    rateHz:
      seconds === 0
        ? 0
        : stats.reduce((sum, entry) => sum + entry.count, 0) / seconds,
    p99MeanMs: weightedAverage(
      stats.map((entry) => ({ value: entry.p99, weight: entry.count }))
    ),
    p99WorstMs: maximum(stats.map((entry) => entry.p99)),
  };
}

function linearSlopePerMinute(
  samples: { timestamp: string; value: number }[]
): number {
  if (samples.length < 2) return Number.NaN;
  const start = Date.parse(samples[0].timestamp);
  const points = samples.map((sample) => ({
    x: (Date.parse(sample.timestamp) - start) / 60_000,
    y: sample.value,
  }));
  const xMean = average(points.map((point) => point.x));
  const yMean = average(points.map((point) => point.y));
  let numerator = 0;
  let denominator = 0;
  for (const point of points) {
    numerator += (point.x - xMean) * (point.y - yMean);
    denominator += (point.x - xMean) ** 2;
  }
  return denominator === 0 ? Number.NaN : numerator / denominator;
}

interface IntervalBounds {
  start: number;
  end: number;
}

const sampleBounds = (sample: {
  timestamp: string;
  intervalMs?: number;
}): IntervalBounds => {
  const end = Date.parse(sample.timestamp);
  return {
    start: end - Math.max(0, sample.intervalMs ?? 0),
    end,
  };
};

const overlaps = (
  bounds: IntervalBounds,
  start: number,
  end: number
): boolean =>
  bounds.start === bounds.end
    ? bounds.end >= start && bounds.end < end
    : bounds.end > start && bounds.start < end;

export const coveredDurationSeconds = (
  samples: readonly MainPerfSample[],
  start: number,
  end: number
): number => {
  const intervals = samples
    .map(sampleBounds)
    .map((bounds) => ({
      start: Math.max(start, bounds.start),
      end: Math.min(end, bounds.end),
    }))
    .filter((bounds) => bounds.end > bounds.start)
    .sort((left, right) => left.start - right.start);
  let coveredMs = 0;
  let currentStart: number | undefined;
  let currentEnd: number | undefined;
  for (const interval of intervals) {
    if (currentStart === undefined || currentEnd === undefined) {
      currentStart = interval.start;
      currentEnd = interval.end;
      continue;
    }
    if (interval.start <= currentEnd) {
      currentEnd = Math.max(currentEnd, interval.end);
      continue;
    }
    coveredMs += currentEnd - currentStart;
    currentStart = interval.start;
    currentEnd = interval.end;
  }
  if (currentStart !== undefined && currentEnd !== undefined) {
    coveredMs += currentEnd - currentStart;
  }
  return coveredMs / 1000;
};

type ChannelMetricField = keyof NonNullable<MainPerfSample['channelMetrics']>;

const isMetricMap = (value: unknown): value is Record<string, number> =>
  typeof value === 'object' &&
  value !== null &&
  !Array.isArray(value) &&
  Object.values(value).every(
    (metric) => typeof metric === 'number' && Number.isFinite(metric)
  );

const hasCompleteChannelMetrics = (sample: MainPerfSample): boolean => {
  const metrics = sample.channelMetrics;
  return (
    metrics !== undefined &&
    isMetricMap(metrics.processorExecutions) &&
    isMetricMap(metrics.publications) &&
    isMetricMap(metrics.deliveries)
  );
};

const channelCount = (
  samples: readonly MainPerfSample[],
  field: ChannelMetricField,
  channel: string
): number =>
  samples.reduce((sum, sample) => {
    const metrics = sample.channelMetrics?.[field];
    return sum + (isMetricMap(metrics) ? (metrics[channel] ?? 0) : 0);
  }, 0);

const summarizeChannels = (
  samples: readonly MainPerfSample[],
  durationSeconds: number
): PerfSummary['channels'] => {
  const channelNames = new Set<string>();
  for (const sample of samples) {
    for (const metric of [
      sample.channelMetrics?.processorExecutions,
      sample.channelMetrics?.publications,
      sample.channelMetrics?.deliveries,
    ]) {
      for (const channel of Object.keys(metric ?? {})) {
        channelNames.add(channel);
      }
    }
  }
  const divisor = durationSeconds > 0 ? durationSeconds : 1;
  return Object.fromEntries(
    [...channelNames].sort().map((channel) => {
      const processorExecutions = channelCount(
        samples,
        'processorExecutions',
        channel
      );
      const publications = channelCount(samples, 'publications', channel);
      const deliveries = channelCount(samples, 'deliveries', channel);
      return [
        channel,
        {
          processorExecutions,
          publications,
          deliveries,
          processorRateHz: processorExecutions / divisor,
          publicationRateHz: publications / divisor,
          deliveryRateHz: deliveries / divisor,
        },
      ];
    })
  );
};

/** Reduce a parsed capture to warmup-trimmed summary statistics. */
export function summarizeCapture(
  capture: PerfCapture,
  warmupSeconds = 30,
  analysisWindow: AnalysisWindow = {}
): PerfSummary {
  if (capture.main.length === 0) {
    throw new Error('No structured PerfMetrics samples were found in the log.');
  }

  const validOrigins = (capture.origins ?? []).filter((origin) =>
    Number.isFinite(Date.parse(origin.timestamp))
  );
  const runId = capture.main[0].runId;
  if (
    capture.main.some((sample) => sample.runId !== runId) ||
    capture.renderer.some((sample) => sample.runId !== runId) ||
    capture.visibility?.some((marker) => marker.runId !== runId)
  ) {
    throw new Error('Capture log contains samples from multiple runs.');
  }
  const runOriginAvailable =
    validOrigins.length === 1 && validOrigins[0].runId === runId;
  const originTimestamp = runOriginAvailable
    ? Date.parse(validOrigins[0].timestamp)
    : Date.parse(capture.main[0].timestamp);
  const startSeconds = Math.max(
    warmupSeconds,
    analysisWindow.startSeconds ?? 0
  );
  const analysisStart = originTimestamp + startSeconds * 1000;
  const configuredAnalysisEnd =
    analysisWindow.endSeconds === undefined
      ? undefined
      : originTimestamp + analysisWindow.endSeconds * 1000;
  if (
    configuredAnalysisEnd !== undefined &&
    configuredAnalysisEnd <= analysisStart
  ) {
    throw new Error('Analysis end must be later than the analysis start.');
  }
  const lastSampleEnd = Math.max(
    ...capture.main.map((sample) => Date.parse(sample.timestamp))
  );
  const analysisEnd = configuredAnalysisEnd ?? lastSampleEnd + 1;
  const main = capture.main.filter((sample) =>
    overlaps(sampleBounds(sample), analysisStart, analysisEnd)
  );
  if (main.length === 0) {
    throw new Error('No PerfMetrics samples fall inside the analysis window.');
  }
  const effectiveMain = main;
  const pointMain = effectiveMain.filter((sample) => {
    const timestamp = Date.parse(sample.timestamp);
    return timestamp >= analysisStart && timestamp <= analysisEnd;
  });
  const earliest = Math.max(
    analysisStart,
    Math.min(...effectiveMain.map((sample) => sampleBounds(sample).start))
  );
  const latest = Math.min(
    analysisEnd,
    Math.max(...effectiveMain.map((sample) => sampleBounds(sample).end))
  );
  const renderer = capture.renderer.filter((sample) => {
    return overlaps(sampleBounds(sample), analysisStart, analysisEnd);
  });

  const iracingStats = effectiveMain.map((sample) => sample.iracing.frameRate);
  const rendererFrameCount = renderer.reduce(
    (sum, sample) => sum + sample.frameTimeMs.count,
    0
  );
  const rendererTelemetryCallbacks = renderer
    .map((sample) => sample.telemetryCallbackMs)
    .filter((stats): stats is NumericSampleStats => stats !== undefined);
  const rendererTelemetrySeconds =
    renderer
      .filter((sample) => sample.telemetryCallbackMs !== undefined)
      .reduce((sum, sample) => sum + sample.intervalMs, 0) / 1000;
  const trackMapAnimationFrame = summarizeRendererMeasure(
    renderer,
    (sample) => sample.trackMapAnimationFrameMs
  );
  const inputTraceFrame = summarizeRendererMeasure(
    renderer,
    (sample) => sample.inputTraceFrameMs
  );
  const radarFrame = summarizeRendererMeasure(
    renderer,
    (sample) => sample.radarFrameMs
  );
  const widgetRender = renderer.some((sample) => sample.widgetRenderMs?.count)
    ? summarizeRendererMeasure(renderer, (sample) => sample.widgetRenderMs)
    : undefined;
  const lapTraceFrame = summarizeRendererMeasure(
    renderer,
    (sample) => sample.lapTraceFrameMs
  );
  const lapTraceBrakeCue = summarizeRendererMeasure(
    renderer,
    (sample) => sample.lapTraceBrakeCueMs
  );
  const rendererSeconds =
    renderer.reduce((sum, sample) => sum + sample.intervalMs, 0) / 1000;
  const telemetryWakeups = renderer.reduce(
    (sum, sample) =>
      sum + (sample.telemetryWakeups ?? sample.telemetryCallbackMs?.count ?? 0),
    0
  );
  const channelWakeups = renderer.reduce(
    (sum, sample) =>
      sum + (sample.channelWakeups ?? sample.channelCallbackMs?.count ?? 0),
    0
  );
  const processTelemetry = effectiveMain
    .map((sample) => sample.sections.processTelemetry)
    .filter((value): value is SectionStats => (value?.count ?? 0) > 0);
  const broadcast = effectiveMain
    .map((sample) => sample.sections.broadcast)
    .filter((value): value is SectionStats => value !== undefined);
  const sectionLabels = [
    ...new Set(
      effectiveMain.flatMap((sample) => Object.keys(sample.sections ?? {}))
    ),
  ].sort();
  const processGroups = new Map<
    number,
    {
      type: string;
      name: string;
      samples: {
        timestamp: string;
        cpuPercent: number;
        memoryMB: number;
        privateMemoryMB: number;
      }[];
    }
  >();
  for (const sample of effectiveMain) {
    for (const process of sample.processes ?? []) {
      let group = processGroups.get(process.pid);
      if (!group) {
        group = {
          type: process.type,
          name: process.name ?? process.type,
          samples: [],
        };
        processGroups.set(process.pid, group);
      }
      group.samples.push({
        timestamp: sample.timestamp,
        cpuPercent: process.cpuPercent,
        memoryMB: process.memoryMB,
        privateMemoryMB: process.privateMemoryMB ?? 0,
      });
    }
  }

  const reportedDurationSeconds = coveredDurationSeconds(
    effectiveMain,
    analysisStart,
    analysisEnd
  );
  const durationSeconds =
    reportedDurationSeconds > 0
      ? reportedDurationSeconds
      : Math.max(0, (latest - earliest) / 1000);
  const metadataEntries = effectiveMain
    .map((sample) => sample.scenarioMetadata)
    .filter(
      (metadata): metadata is Record<string, unknown> => metadata !== undefined
    );
  const serializedMetadata = new Set(
    metadataEntries.map((metadata) => JSON.stringify(metadata))
  );
  const scenarioMetadataConsistent =
    metadataEntries.length === effectiveMain.length &&
    serializedMetadata.size === 1;
  const scenarioMetadata = metadataEntries[0] ?? {};
  const activeWidgetTypes = Array.isArray(scenarioMetadata.activeWidgetTypes)
    ? scenarioMetadata.activeWidgetTypes.filter(
        (value): value is string => typeof value === 'string'
      )
    : [];
  const rawRequirements = scenarioMetadata.widgetInputRequirements;
  const widgetInputRequirements =
    typeof rawRequirements === 'object' && rawRequirements !== null
      ? (rawRequirements as Record<string, unknown>)
      : undefined;
  const channels = summarizeChannels(effectiveMain, durationSeconds);
  const configuredPhases = (capture.visibility ?? [])
    .map((marker) => {
      const start = Date.parse(marker.timestamp);
      return {
        marker,
        start,
        end: start + marker.durationSeconds * 1000,
      };
    })
    .filter(
      (phase) =>
        Number.isFinite(phase.start) &&
        phase.end > analysisStart &&
        phase.start < analysisEnd
    );
  const hasVisibilitySchedule = (capture.visibility ?? []).length > 0;
  const phaseWindows = hasVisibilitySchedule
    ? configuredPhases.map((phase) => ({
        index: phase.marker.index,
        visibility: phase.marker.visibility,
        start: Math.max(analysisStart, phase.start),
        end: Math.min(analysisEnd, phase.end),
      }))
    : [
        {
          index: 0,
          visibility: 'visible' as const,
          start: analysisStart,
          end: analysisEnd,
        },
      ];
  const samplesForPhase = (phase: (typeof phaseWindows)[number]) =>
    effectiveMain.filter((sample) => {
      const bounds = sampleBounds(sample);
      return bounds.start >= phase.start && bounds.end <= phase.end;
    });
  const requiredChannels = [
    ...new Set(
      activeWidgetTypes.flatMap((widget) => {
        const configured = widgetInputRequirements?.[widget];
        return Array.isArray(configured)
          ? configured.filter(
              (value): value is string => typeof value === 'string'
            )
          : [];
      })
    ),
  ];
  const phaseEvidence = phaseWindows.map((phase) => {
    const samples = samplesForPhase(phase);
    const phaseDurationSeconds = Math.max(0, (phase.end - phase.start) / 1000);
    const phaseChannels = summarizeChannels(samples, phaseDurationSeconds);
    const hasMetrics =
      samples.length > 0 && samples.every(hasCompleteChannelMetrics);
    const visibleInputsChanged = requiredChannels.every(
      (channel) => (phaseChannels[channel]?.publications ?? 0) > 0
    );
    const hiddenProcessorExecutions = Object.values(phaseChannels).reduce(
      (sum, channel) => sum + channel.processorExecutions,
      0
    );
    const hiddenDeliveries = Object.values(phaseChannels).reduce(
      (sum, channel) => sum + channel.deliveries,
      0
    );
    const reasons = [
      ...(samples.length === 0
        ? ['phase has no fully-contained metric intervals']
        : []),
      ...(!hasMetrics ? ['phase channel metrics are incomplete'] : []),
      ...(phase.visibility === 'visible' && !visibleInputsChanged
        ? ['one or more active widget inputs did not publish']
        : []),
      ...(phase.visibility === 'hidden' && hiddenProcessorExecutions > 0
        ? ['hidden phase executed demand-driven processors']
        : []),
      ...(phase.visibility === 'hidden' && hiddenDeliveries > 0
        ? ['hidden phase delivered channel snapshots']
        : []),
    ];
    return {
      index: phase.index,
      visibility: phase.visibility,
      startSeconds: (phase.start - originTimestamp) / 1000,
      durationSeconds: phaseDurationSeconds,
      sampleCount: samples.length,
      expectedBehaviorSatisfied: reasons.length === 0,
      reasons,
    };
  });
  const visiblePhaseSamples = [
    ...new Set(
      phaseWindows
        .filter((phase) => phase.visibility === 'visible')
        .flatMap(samplesForPhase)
    ),
  ];
  const visibleDurationSeconds = phaseWindows
    .filter((phase) => phase.visibility === 'visible')
    .reduce((sum, phase) => sum + (phase.end - phase.start) / 1000, 0);
  const visibleChannels = summarizeChannels(
    visiblePhaseSamples,
    visibleDurationSeconds
  );
  const widgetInputs: PerfSummary['widgetInputs'] = Object.fromEntries(
    activeWidgetTypes.map((widget) => {
      const configuredInputs = widgetInputRequirements?.[widget];
      const inputs = Array.isArray(configuredInputs)
        ? configuredInputs.filter(
            (value): value is string => typeof value === 'string'
          )
        : [];
      const inputCoverage = Object.fromEntries(
        inputs.map((channel) => {
          const metrics = visibleChannels[channel];
          return [
            channel,
            {
              observed: (metrics?.publications ?? 0) > 0,
              changeRateHz: metrics?.publicationRateHz ?? 0,
              deliveryRateHz: metrics?.deliveryRateHz ?? 0,
            },
          ];
        })
      );
      return [
        widget,
        {
          covered:
            visiblePhaseSamples.length === 0 ||
            inputs.length === 0 ||
            Object.values(inputCoverage).every((input) => input.observed),
          inputs: inputCoverage,
        },
      ];
    })
  );
  const privateMemoryAvailable =
    pointMain.length > 0 &&
    pointMain.every(
      (sample) =>
        typeof sample.totalAppPrivateMemoryMB === 'number' &&
        Number.isFinite(sample.totalAppPrivateMemoryMB)
    );
  const privateSamples = pointMain.filter(
    (sample) =>
      !sample.privateMemoryReused &&
      typeof sample.totalAppPrivateMemoryMB === 'number' &&
      Number.isFinite(sample.totalAppPrivateMemoryMB)
  );
  const privateTimestamps = [
    ...new Set(
      privateSamples
        .map((sample) => Date.parse(sample.timestamp))
        .filter(Number.isFinite)
    ),
  ].sort((left, right) => left - right);
  const privateMemorySampleCount = privateTimestamps.length;
  const firstPrivateTimestamp = privateTimestamps[0] ?? 0;
  const lastPrivateTimestamp = privateTimestamps.at(-1) ?? 0;
  const privateMemorySpanSeconds =
    privateMemorySampleCount >= 2
      ? (lastPrivateTimestamp - firstPrivateTimestamp) / 1000
      : 0;
  const privateMemoryMaxGapSeconds = maximum(
    privateTimestamps
      .slice(1)
      .map((timestamp, index) => (timestamp - privateTimestamps[index]) / 1000)
  );
  const requiredPrivateSpanSeconds =
    Math.min(durationSeconds, MIN_ANALYSIS_SECONDS) * MIN_PRIVATE_SPAN_RATIO;
  const privateMemorySamplingAdequate =
    privateMemoryAvailable &&
    privateMemorySampleCount >= MIN_PRIVATE_OBSERVATIONS &&
    privateMemorySpanSeconds >= requiredPrivateSpanSeconds &&
    privateMemoryMaxGapSeconds <= MAX_PRIVATE_SAMPLE_GAP_SECONDS;
  const inputCoverageAvailable =
    scenarioMetadataConsistent &&
    Array.isArray(scenarioMetadata.activeWidgetTypes) &&
    widgetInputRequirements !== undefined &&
    activeWidgetTypes.every((widget) =>
      Object.prototype.hasOwnProperty.call(widgetInputRequirements, widget)
    ) &&
    phaseWindows.length > 0 &&
    phaseWindows.every((phase) => samplesForPhase(phase).length > 0) &&
    effectiveMain.every(hasCompleteChannelMetrics);
  const inputCoverageComplete =
    inputCoverageAvailable &&
    phaseEvidence.every((phase) => phase.expectedBehaviorSatisfied);
  const durationSufficient = durationSeconds >= MIN_ANALYSIS_SECONDS;
  const inconclusiveReasons = [
    ...(!runOriginAvailable
      ? ['a single explicit capture origin is unavailable']
      : []),
    ...(!scenarioMetadataConsistent
      ? ['scenario metadata is missing or inconsistent']
      : []),
    ...(!durationSufficient
      ? ['analysis duration is shorter than five minutes']
      : []),
    ...(!privateMemoryAvailable
      ? ['private-memory samples are unavailable or incomplete']
      : !privateMemorySamplingAdequate
        ? ['private-memory sampling span or cadence is insufficient']
        : []),
    ...(!inputCoverageAvailable
      ? ['widget input coverage metadata is unavailable']
      : !inputCoverageComplete
        ? ['one or more visibility phases violated workload expectations']
        : []),
  ];

  const sdkWaitSamples = effectiveMain
    .map((sample) => sample.sdkWait)
    .filter(
      (wait): wait is NonNullable<MainPerfSample['sdkWait']> =>
        wait !== undefined
    );
  for (const wait of sdkWaitSamples) {
    if (
      !wait ||
      typeof wait !== 'object' ||
      !wait.durationMs ||
      !['count', 'avg', 'min', 'max', 'p1', 'p50', 'p95', 'p99'].every((key) =>
        Number.isFinite(wait.durationMs[key as keyof NumericSampleStats])
      ) ||
      ![
        wait.calls,
        wait.reads,
        wait.unsuccessful,
        wait.totalMs,
        wait.timeoutMs,
        wait.targetHz,
      ].every(Number.isFinite)
    ) {
      throw new Error('Malformed SDK wait instrumentation in performance log.');
    }
  }
  const sdkWait: SdkWaitSummary | undefined =
    sdkWaitSamples.length > 0
      ? {
          durationMs: {
            count: sdkWaitSamples.reduce(
              (sum, wait) => sum + wait.durationMs.count,
              0
            ),
            avg: weightedAverage(
              sdkWaitSamples.map((wait) => ({
                value: wait.durationMs.avg,
                weight: wait.durationMs.count,
              }))
            ),
            min: minimum(sdkWaitSamples.map((wait) => wait.durationMs.min)),
            max: maximum(sdkWaitSamples.map((wait) => wait.durationMs.max)),
            p1: weightedAverage(
              sdkWaitSamples.map((wait) => ({
                value: wait.durationMs.p1,
                weight: wait.durationMs.count,
              }))
            ),
            p50: weightedAverage(
              sdkWaitSamples.map((wait) => ({
                value: wait.durationMs.p50,
                weight: wait.durationMs.count,
              }))
            ),
            p95: weightedAverage(
              sdkWaitSamples.map((wait) => ({
                value: wait.durationMs.p95,
                weight: wait.durationMs.count,
              }))
            ),
            p99: weightedAverage(
              sdkWaitSamples.map((wait) => ({
                value: wait.durationMs.p99,
                weight: wait.durationMs.count,
              }))
            ),
          },
          calls: sdkWaitSamples.reduce((sum, wait) => sum + wait.calls, 0),
          reads: sdkWaitSamples.reduce((sum, wait) => sum + wait.reads, 0),
          unsuccessful: sdkWaitSamples.reduce(
            (sum, wait) => sum + wait.unsuccessful,
            0
          ),
          totalMs: sdkWaitSamples.reduce((sum, wait) => sum + wait.totalMs, 0),
          timeoutMs: sdkWaitSamples.at(-1)?.timeoutMs ?? 0,
          targetHz: average(sdkWaitSamples.map((wait) => wait.targetHz)),
        }
      : undefined;

  return {
    runId,
    captureOrigin: runOriginAvailable ? validOrigins[0].timestamp : undefined,
    scenario: effectiveMain[0].scenario,
    overlayMode: effectiveMain[0].overlayMode,
    durationMinutes: durationSeconds / 60,
    sampleCount: effectiveMain.length,
    analysisWindow: {
      startSeconds,
      endSeconds:
        analysisWindow.endSeconds ?? (lastSampleEnd - originTimestamp) / 1000,
      ...(analysisWindow.endSeconds === undefined ? { openEnded: true } : {}),
    },
    scenarioMetadata,
    // Keep the complete schedule in the summary. The first visibility marker
    // is normally emitted before the first interval report, so filtering by
    // sample timestamps would incorrectly drop the opening phase.
    visibilityPhases: capture.visibility ?? [],
    phaseEvidence,
    iracing: {
      fpsObservationCount: iracingStats.reduce(
        (sum, stats) => sum + stats.count,
        0
      ),
      averageFps: weightedAverage(
        iracingStats.map((stats) => ({
          value: stats.avg,
          weight: stats.count,
        }))
      ),
      meanOnePercentLowFps: weightedAverage(
        iracingStats.map((stats) => ({
          value: stats.p1,
          weight: stats.count,
        }))
      ),
      worstFps: minimum(iracingStats.map((stats) => stats.min)),
      averageCpuForeground: weightedAverage(
        effectiveMain.map((sample) => ({
          value: sample.iracing.cpuUsageForeground.avg,
          weight: sample.iracing.cpuUsageForeground.count,
        }))
      ),
      averageGpuUsage: weightedAverage(
        effectiveMain.map((sample) => ({
          value: sample.iracing.gpuUsage.avg,
          weight: sample.iracing.gpuUsage.count,
        }))
      ),
    },
    app: {
      averageCpuPercent: average(
        effectiveMain.map((sample) => sample.totalAppCpuPercent ?? 0)
      ),
      averageRendererCpuPercent: average(
        effectiveMain.map((sample) =>
          (sample.processes ?? [])
            .filter((process) => process.type === 'Tab')
            .reduce((sum, process) => sum + process.cpuPercent, 0)
        )
      ),
      averageMainCpuPercent: average(
        effectiveMain.map((sample) =>
          (sample.processes ?? [])
            .filter((process) => process.type === 'Browser')
            .reduce((sum, process) => sum + process.cpuPercent, 0)
        )
      ),
      averageGpuCpuPercent: average(
        effectiveMain.map((sample) =>
          (sample.processes ?? [])
            .filter((process) => process.type === 'GPU')
            .reduce((sum, process) => sum + process.cpuPercent, 0)
        )
      ),
      peakMemoryMB: maximum(
        effectiveMain.map((sample) => sample.totalAppMemoryMB ?? 0)
      ),
      averageRendererMemoryMB: average(
        effectiveMain.map((sample) =>
          (sample.processes ?? [])
            .filter((process) => process.type === 'Tab')
            .reduce((sum, process) => sum + process.memoryMB, 0)
        )
      ),
      averageMainMemoryMB: average(
        effectiveMain.map((sample) =>
          (sample.processes ?? [])
            .filter((process) => process.type === 'Browser')
            .reduce((sum, process) => sum + process.memoryMB, 0)
        )
      ),
      averageGpuMemoryMB: average(
        effectiveMain.map((sample) =>
          (sample.processes ?? [])
            .filter((process) => process.type === 'GPU')
            .reduce((sum, process) => sum + process.memoryMB, 0)
        )
      ),
      peakPrivateMemoryMB: maximum(
        effectiveMain.map((sample) => sample.totalAppPrivateMemoryMB ?? 0)
      ),
      averageRendererPrivateMemoryMB: average(
        effectiveMain.map((sample) =>
          (sample.processes ?? [])
            .filter((process) => process.type === 'Tab')
            .reduce((sum, process) => sum + (process.privateMemoryMB ?? 0), 0)
        )
      ),
      averageMainPrivateMemoryMB: average(
        effectiveMain.map((sample) =>
          (sample.processes ?? [])
            .filter((process) => process.type === 'Browser')
            .reduce((sum, process) => sum + (process.privateMemoryMB ?? 0), 0)
        )
      ),
      averageGpuPrivateMemoryMB: average(
        effectiveMain.map((sample) =>
          (sample.processes ?? [])
            .filter((process) => process.type === 'GPU')
            .reduce((sum, process) => sum + (process.privateMemoryMB ?? 0), 0)
        )
      ),
      peakRendererMemoryMB: maximum(
        effectiveMain.map((sample) =>
          (sample.processes ?? [])
            .filter((process) => process.type === 'Tab')
            .reduce((sum, process) => sum + process.memoryMB, 0)
        )
      ),
      peakMainMemoryMB: maximum(
        effectiveMain.flatMap((sample) =>
          (sample.processes ?? [])
            .filter((process) => process.type === 'Browser')
            .map((process) => process.memoryMB)
        )
      ),
      peakGpuMemoryMB: maximum(
        effectiveMain.flatMap((sample) =>
          (sample.processes ?? [])
            .filter((process) => process.type === 'GPU')
            .map((process) => process.memoryMB)
        )
      ),
      rendererProcessCount: maximum(
        effectiveMain.map(
          (sample) =>
            (sample.processes ?? []).filter((process) => process.type === 'Tab')
              .length
        )
      ),
      memorySlopeMBPerMinute: linearSlopePerMinute(
        effectiveMain.map((sample) => ({
          timestamp: sample.timestamp,
          value: sample.totalAppMemoryMB ?? 0,
        }))
      ),
      privateMemorySlopeMBPerMinute: linearSlopePerMinute(
        privateMemorySamplingAdequate
          ? privateSamples.map((sample) => ({
              timestamp: sample.timestamp,
              value: sample.totalAppPrivateMemoryMB as number,
            }))
          : []
      ),
    },
    processes: [...processGroups.entries()]
      .map(([pid, group]) => ({
        pid,
        type: group.type,
        name: group.name,
        averageCpuPercent: average(
          group.samples.map((sample) => sample.cpuPercent)
        ),
        averageMemoryMB: average(
          group.samples.map((sample) => sample.memoryMB)
        ),
        peakMemoryMB: maximum(group.samples.map((sample) => sample.memoryMB)),
        memorySlopeMBPerMinute: linearSlopePerMinute(
          group.samples.map((sample) => ({
            timestamp: sample.timestamp,
            value: sample.memoryMB,
          }))
        ),
        averagePrivateMemoryMB: average(
          group.samples.map((sample) => sample.privateMemoryMB)
        ),
        peakPrivateMemoryMB: maximum(
          group.samples.map((sample) => sample.privateMemoryMB)
        ),
        privateMemorySlopeMBPerMinute: linearSlopePerMinute(
          group.samples.map((sample) => ({
            timestamp: sample.timestamp,
            value: sample.privateMemoryMB,
          }))
        ),
      }))
      .sort((a, b) => b.averageCpuPercent - a.averageCpuPercent),
    sections: Object.fromEntries(
      sectionLabels.map((label) => {
        const samples = effectiveMain
          .map((sample) => sample.sections[label])
          .filter((value): value is SectionStats => value !== undefined);
        return [
          label,
          {
            sampleCount: samples.length,
            operationCount: samples.reduce(
              (sum, sample) => sum + sample.count,
              0
            ),
            averageMeanMs: weightedAverage(
              samples.map((sample) => ({
                value: sample.avgMs,
                weight: sample.count,
              }))
            ),
            p99MeanMs: average(samples.map((sample) => sample.p99Ms)),
            p99WorstMs: maximum(samples.map((sample) => sample.p99Ms)),
          },
        ];
      })
    ),
    telemetry: {
      averageTickRateHz: average(
        effectiveMain.map((sample) => sample.tickRateHz)
      ),
      minimumTickRateHz: minimum(
        effectiveMain.map((sample) => sample.tickRateHz)
      ),
      processTelemetryObservationCount: processTelemetry.reduce(
        (sum, stats) => sum + stats.count,
        0
      ),
      processTelemetryP99MeanMs: average(
        processTelemetry.map((stats) => stats.p99Ms)
      ),
      processTelemetryP99WorstMs: maximum(
        processTelemetry.map((stats) => stats.p99Ms)
      ),
      broadcastP99MeanMs: average(broadcast.map((stats) => stats.p99Ms)),
    },
    sdkWait,
    eventLoop: {
      p99MeanMs: average(
        effectiveMain.map((sample) => sample.eventLoopDelayMs.p99)
      ),
      p99WorstMs: maximum(
        effectiveMain.map((sample) => sample.eventLoopDelayMs.p99)
      ),
      worstStallMs: maximum(
        effectiveMain.map((sample) => sample.eventLoopDelayMs.max)
      ),
    },
    renderer: {
      sampleCount: renderer.length,
      frameTimeP99MeanMs: weightedAverage(
        renderer.map((sample) => ({
          value: sample.frameTimeMs.p99,
          weight: sample.frameTimeMs.count,
        }))
      ),
      worstFrameMs: maximum(renderer.map((sample) => sample.frameTimeMs.max)),
      telemetryCallbackRateHz:
        rendererTelemetrySeconds === 0
          ? 0
          : rendererTelemetryCallbacks.reduce(
              (sum, stats) => sum + stats.count,
              0
            ) / rendererTelemetrySeconds,
      channelCallbackRateHz:
        rendererSeconds === 0 ? 0 : channelWakeups / rendererSeconds,
      totalWakeupRateHz:
        rendererSeconds === 0
          ? 0
          : (telemetryWakeups + channelWakeups) / rendererSeconds,
      telemetryCallbackP99MeanMs: weightedAverage(
        rendererTelemetryCallbacks.map((stats) => ({
          value: stats.p99,
          weight: stats.count,
        }))
      ),
      telemetryCallbackP99WorstMs: maximum(
        rendererTelemetryCallbacks.map((stats) => stats.p99)
      ),
      trackMapAnimationFrameRateHz: trackMapAnimationFrame.rateHz,
      trackMapAnimationFrameP99MeanMs: trackMapAnimationFrame.p99MeanMs,
      trackMapAnimationFrameP99WorstMs: trackMapAnimationFrame.p99WorstMs,
      inputTraceFrameRateHz: inputTraceFrame.rateHz,
      inputTraceFrameP99MeanMs: inputTraceFrame.p99MeanMs,
      inputTraceFrameP99WorstMs: inputTraceFrame.p99WorstMs,
      radarFrameRateHz: radarFrame.rateHz,
      radarFrameP99MeanMs: radarFrame.p99MeanMs,
      radarFrameP99WorstMs: radarFrame.p99WorstMs,
      widgetRenderRateHz: widgetRender?.rateHz ?? null,
      widgetRenderP99MeanMs: widgetRender?.p99MeanMs ?? null,
      widgetRenderP99WorstMs: widgetRender?.p99WorstMs ?? null,
      lapTraceFrameRateHz: lapTraceFrame.rateHz,
      lapTraceFrameP99MeanMs: lapTraceFrame.p99MeanMs,
      lapTraceFrameP99WorstMs: lapTraceFrame.p99WorstMs,
      lapTraceBrakeCueRateHz: lapTraceBrakeCue.rateHz,
      lapTraceBrakeCueP99MeanMs: lapTraceBrakeCue.p99MeanMs,
      lapTraceBrakeCueP99WorstMs: lapTraceBrakeCue.p99WorstMs,
      frameCount: rendererFrameCount,
      framesOver25MsPercent:
        rendererFrameCount === 0
          ? 0
          : (renderer.reduce((sum, sample) => sum + sample.framesOver25Ms, 0) /
              rendererFrameCount) *
            100,
      framesOver50MsPercent:
        rendererFrameCount === 0
          ? 0
          : (renderer.reduce((sum, sample) => sum + sample.framesOver50Ms, 0) /
              rendererFrameCount) *
            100,
    },
    channels,
    widgetInputs,
    evidence: {
      runOriginAvailable,
      privateMemoryAvailable,
      privateMemorySampleCount,
      privateMemorySpanSeconds,
      privateMemoryMaxGapSeconds,
      privateMemorySamplingAdequate,
      scenarioMetadataConsistent,
      inputCoverageAvailable,
      inputCoverageComplete,
      durationSufficient,
      conclusive: inconclusiveReasons.length === 0,
      inconclusiveReasons,
    },
  };
}

function percentChange(baseline: number, candidate: number): number {
  if (baseline === 0) return 0;
  return ((candidate - baseline) / baseline) * 100;
}

function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`;
  if (typeof value === 'object' && value !== null) {
    return `{${Object.entries(value)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => `${JSON.stringify(key)}:${stableJson(item)}`)
      .join(',')}}`;
  }
  return JSON.stringify(value) ?? 'undefined';
}

const contrastExcludedKeys = (
  contrast: ComparisonContrast
): ReadonlySet<string> => {
  const keys = new Set<string>();
  if (contrast.includes('overlay')) {
    [
      'activeWidgetTypes',
      'requestedWidgetTypes',
      'overlayWindowMode',
      'widgetInputRequirements',
    ].forEach((key) => keys.add(key));
  }
  if (contrast.includes('widgets')) {
    [
      'activeWidgetTypes',
      'requestedWidgetTypes',
      'widgetInputRequirements',
    ].forEach((key) => keys.add(key));
  }
  if (contrast.includes('channels')) {
    ['channelDelivery', 'telemetryDelivery', 'telemetryPayload'].forEach(
      (key) => keys.add(key)
    );
  }
  return keys;
};

export function isTapeReplay(
  metadata: Record<string, unknown> | undefined
): boolean {
  return (
    metadata?.simulatorMode === 'replay' &&
    typeof metadata.tapeSha256 === 'string'
  );
}

function workloadMetadata(
  summary: PerfSummary,
  contrast: ComparisonContrast
): string | undefined {
  if (
    !summary.evidence.scenarioMetadataConsistent ||
    Object.keys(summary.scenarioMetadata).length === 0
  )
    return undefined;
  const excluded = contrastExcludedKeys(contrast);
  const metadata = Object.fromEntries(
    Object.entries(summary.scenarioMetadata).filter(
      ([key]) =>
        key !== 'sourceCommit' && key !== 'sourceDirty' && !excluded.has(key)
    )
  );
  const { activeWidgetTypes, widgetInputRequirements } = metadata;
  if (
    Array.isArray(activeWidgetTypes) &&
    widgetInputRequirements !== null &&
    typeof widgetInputRequirements === 'object'
  ) {
    const active = new Set(activeWidgetTypes);
    metadata.widgetInputRequirements = Object.fromEntries(
      Object.entries(widgetInputRequirements).filter(([widget]) =>
        active.has(widget)
      )
    );
  }
  return stableJson({
    ...(contrast.includes('overlay')
      ? {}
      : { overlayMode: summary.overlayMode }),

    visibilitySchedule: (summary.visibilityPhases ?? [])
      .map(({ index, visibility, durationSeconds }) => ({
        index,
        visibility,
        durationSeconds,
      }))
      .sort((left, right) => left.index - right.index),
    metadata,
  });
}

function workloadMetadataMatch(
  baseline: PerfSummary,
  candidate: PerfSummary,
  contrast: ComparisonContrast
): boolean | undefined {
  const baselineMetadata = workloadMetadata(baseline, contrast);
  const candidateMetadata = workloadMetadata(candidate, contrast);
  if (baselineMetadata === undefined || candidateMetadata === undefined)
    return undefined;
  if (baselineMetadata !== candidateMetadata) return false;

  const left = baseline.analysisWindow;
  const right = candidate.analysisWindow;
  if (
    !left ||
    !right ||
    left.startSeconds !== right.startSeconds ||
    Boolean(left.openEnded) !== Boolean(right.openEnded)
  )
    return false;
  if (left.openEnded) {
    if (
      left.endSeconds === undefined ||
      right.endSeconds === undefined ||
      Math.abs(left.endSeconds - right.endSeconds) >
        WORKLOAD_TIMING_TOLERANCE_SECONDS
    )
      return false;
  } else if (left.endSeconds !== right.endSeconds) {
    return false;
  }

  const transitionOffsets = (summary: PerfSummary): number[] =>
    [...(summary.visibilityPhases ?? [])]
      .sort((a, b) => a.index - b.index)
      .map(
        (phase) =>
          (Date.parse(phase.timestamp) -
            Date.parse(summary.captureOrigin ?? '')) /
          1000
      );
  const leftOffsets = transitionOffsets(baseline);
  const rightOffsets = transitionOffsets(candidate);
  return leftOffsets.every(
    (offset, index) =>
      Math.abs(offset - rightOffsets[index]) <=
      WORKLOAD_TIMING_TOLERANCE_SECONDS
  );
}

function coreEvidenceReasons(summary: PerfSummary, label: string): string[] {
  return [
    ...(!summary.evidence.runOriginAvailable
      ? [`${label} lacks a single explicit capture origin`]
      : []),
    ...(!summary.evidence.durationSufficient
      ? [`${label} analysis duration is shorter than five minutes`]
      : []),
    ...(!summary.evidence.scenarioMetadataConsistent
      ? [`${label} scenario metadata is inconsistent`]
      : []),
    ...(!summary.evidence.inputCoverageAvailable
      ? [`${label} widget input coverage is unavailable`]
      : !summary.evidence.inputCoverageComplete
        ? [`${label} visibility phases violated widget input expectations`]
        : []),
  ];
}

export function coreEvidenceComplete(summary: PerfSummary): boolean {
  return (
    summary.evidence.runOriginAvailable &&
    summary.evidence.durationSufficient &&
    summary.evidence.scenarioMetadataConsistent &&
    summary.evidence.inputCoverageComplete
  );
}

export function comparisonCoreComplete(
  baseline: PerfSummary,
  candidate: PerfSummary,
  contrast: ComparisonContrast = []
): boolean {
  return (
    coreEvidenceComplete(baseline) &&
    coreEvidenceComplete(candidate) &&
    workloadMetadataMatch(baseline, candidate, contrast) === true
  );
}

/** Compute candidate-minus-baseline deltas for the summary metrics. */
export function compareSummaries(
  baseline: PerfSummary,
  candidate: PerfSummary,
  contrast: ComparisonContrast = [],
  ignoredGates: readonly string[] = []
): PerfComparison {
  const widgetRenderDelta = (
    metric: 'widgetRenderRateHz' | 'widgetRenderP99MeanMs'
  ): number | null => {
    const before = baseline.renderer[metric];
    const after = candidate.renderer[metric];
    return typeof before === 'number' && typeof after === 'number'
      ? after - before
      : null;
  };
  const averageFpsPercent = percentChange(
    baseline.iracing.averageFps,
    candidate.iracing.averageFps
  );
  const onePercentLowFpsPercent = percentChange(
    baseline.iracing.meanOnePercentLowFps,
    candidate.iracing.meanOnePercentLowFps
  );
  const workloadMatch = workloadMetadataMatch(baseline, candidate, contrast);
  const workloadReasons =
    workloadMatch === false
      ? ['baseline and candidate workload metadata differ']
      : workloadMatch === undefined
        ? ['workload metadata is unavailable or inconsistent']
        : [];
  const comparableReasons = [
    ...coreEvidenceReasons(baseline, 'baseline'),
    ...coreEvidenceReasons(candidate, 'candidate'),
    ...workloadReasons,
  ];
  const memoryReasons = [
    ...(!baseline.evidence.privateMemorySamplingAdequate
      ? ['baseline private-memory samples are unavailable or incomplete']
      : []),
    ...(!candidate.evidence.privateMemorySamplingAdequate
      ? ['candidate private-memory samples are unavailable or incomplete']
      : []),
  ];
  const gameFpsReasons =
    isTapeReplay(baseline.scenarioMetadata) ||
    isTapeReplay(candidate.scenarioMetadata)
      ? ['game FPS is historical in an isolated replay tape']
      : [];
  const fpsEvidenceReasons = [baseline, candidate].flatMap((summary, index) =>
    (summary.iracing.fpsObservationCount ?? 0) > 0
      ? []
      : [
          `${index === 0 ? 'baseline' : 'candidate'} FPS observations are unavailable`,
        ]
  );
  const telemetryEvidenceReasons = [baseline, candidate].flatMap(
    (summary, index) =>
      (summary.telemetry.processTelemetryObservationCount ?? 0) > 0
        ? []
        : [
            `${index === 0 ? 'baseline' : 'candidate'} telemetry timing observations are unavailable`,
          ]
  );
  const rendererNotApplicable = [baseline, candidate].some(
    (summary) =>
      summary.overlayMode === 'observer' ||
      summary.overlayMode === 'empty' ||
      (Array.isArray(summary.scenarioMetadata.activeWidgetTypes) &&
        summary.scenarioMetadata.activeWidgetTypes.length === 0)
  )
    ? ['no dashboard widgets were active on one or both sides']
    : [];
  const rendererReasons =
    rendererNotApplicable.length === 0
      ? [baseline, candidate].flatMap((summary, index) =>
          summary.renderer.frameCount > 0
            ? []
            : [
                `${index === 0 ? 'baseline' : 'candidate'} renderer frame observations are unavailable`,
              ]
        )
      : [];
  const gate = (
    name: string,
    actual: number,
    passed: boolean,
    evidenceReasons: string[],
    notApplicableReasons: string[],
    target: string
  ) => {
    const ignored = ignoredGates.some((flag) =>
      name.toLowerCase().includes(flag.toLowerCase())
    );
    const reasons = [
      ...evidenceReasons,
      ...notApplicableReasons,
      ...(ignored ? ['ignored by --ignore-gates'] : []),
    ];
    const applicable =
      evidenceReasons.length === 0 &&
      notApplicableReasons.length === 0 &&
      !ignored;
    return {
      passed: applicable ? passed : null,
      actual,
      target: applicable
        ? target
        : `${!ignored && notApplicableReasons.length === 0 ? 'inconclusive:' : 'not-applicable:'} ${reasons.join('; ')}`,
    };
  };

  return {
    baseline,
    candidate,
    contrast,
    delta: {
      averageFpsPercent,
      onePercentLowFpsPercent,
      appCpuPercent:
        candidate.app.averageCpuPercent - baseline.app.averageCpuPercent,
      peakMemoryMB: candidate.app.peakMemoryMB - baseline.app.peakMemoryMB,
      processTelemetryP99Ms:
        candidate.telemetry.processTelemetryP99MeanMs -
        baseline.telemetry.processTelemetryP99MeanMs,
      eventLoopP99Ms:
        candidate.eventLoop.p99MeanMs - baseline.eventLoop.p99MeanMs,
      trackMapAnimationFrameRateHz:
        candidate.renderer.trackMapAnimationFrameRateHz -
        baseline.renderer.trackMapAnimationFrameRateHz,
      trackMapAnimationFrameP99Ms:
        candidate.renderer.trackMapAnimationFrameP99MeanMs -
        baseline.renderer.trackMapAnimationFrameP99MeanMs,
      inputTraceFrameRateHz:
        candidate.renderer.inputTraceFrameRateHz -
        baseline.renderer.inputTraceFrameRateHz,
      inputTraceFrameP99Ms:
        candidate.renderer.inputTraceFrameP99MeanMs -
        baseline.renderer.inputTraceFrameP99MeanMs,
      radarFrameRateHz:
        candidate.renderer.radarFrameRateHz -
        baseline.renderer.radarFrameRateHz,
      radarFrameP99Ms:
        candidate.renderer.radarFrameP99MeanMs -
        baseline.renderer.radarFrameP99MeanMs,
      widgetRenderRateHz: widgetRenderDelta('widgetRenderRateHz'),
      widgetRenderP99Ms: widgetRenderDelta('widgetRenderP99MeanMs'),
      lapTraceFrameRateHz:
        candidate.renderer.lapTraceFrameRateHz -
        baseline.renderer.lapTraceFrameRateHz,
      lapTraceFrameP99Ms:
        candidate.renderer.lapTraceFrameP99MeanMs -
        baseline.renderer.lapTraceFrameP99MeanMs,
      lapTraceBrakeCueRateHz:
        candidate.renderer.lapTraceBrakeCueRateHz -
        baseline.renderer.lapTraceBrakeCueRateHz,
      lapTraceBrakeCueP99Ms:
        candidate.renderer.lapTraceBrakeCueP99MeanMs -
        baseline.renderer.lapTraceBrakeCueP99MeanMs,
    },
    checks: [
      {
        name: 'Matched workload metadata',
        passed: workloadMatch ?? null,
        actual:
          workloadMatch === undefined ? Number.NaN : Number(!workloadMatch),
        target:
          workloadMatch === undefined
            ? 'n/a: workload metadata unavailable or inconsistent'
            : 'same scenario settings, excluding source commit and worktree state',
      },
      {
        name: 'iRacing average FPS regression',
        ...gate(
          'iRacing average FPS regression',
          averageFpsPercent,
          averageFpsPercent >= PERF_GATES.averageFpsPercent.minimum,
          [...comparableReasons, ...fpsEvidenceReasons],
          gameFpsReasons,
          `>= ${PERF_GATES.averageFpsPercent.minimum}%`
        ),
      },
      {
        name: 'iRacing sampled FPS p1 regression',
        ...gate(
          'iRacing sampled FPS p1 regression',
          onePercentLowFpsPercent,
          onePercentLowFpsPercent >= PERF_GATES.onePercentLowFpsPercent.minimum,
          [...comparableReasons, ...fpsEvidenceReasons],
          gameFpsReasons,
          `>= ${PERF_GATES.onePercentLowFpsPercent.minimum}%`
        ),
      },
      {
        name: 'Telemetry processing p99',
        ...gate(
          'Telemetry processing p99',
          candidate.telemetry.processTelemetryP99MeanMs,
          candidate.telemetry.processTelemetryP99MeanMs <
            PERF_GATES.processTelemetryP99Ms.maximum,
          [...comparableReasons, ...telemetryEvidenceReasons],
          [],
          `< ${PERF_GATES.processTelemetryP99Ms.maximum} ms`
        ),
      },
      {
        name: 'Telemetry tick rate',
        ...gate(
          'Telemetry tick rate',
          candidate.telemetry.minimumTickRateHz,
          candidate.telemetry.minimumTickRateHz >=
            PERF_GATES.minimumTickRateHz.minimum,
          comparableReasons,
          [],
          `>= ${PERF_GATES.minimumTickRateHz.minimum} Hz`
        ),
      },
      {
        name: 'Steady-state private-memory slope',
        ...gate(
          'Steady-state private-memory slope',
          candidate.app.privateMemorySlopeMBPerMinute,
          Number.isFinite(candidate.app.privateMemorySlopeMBPerMinute) &&
            candidate.app.privateMemorySlopeMBPerMinute <
              PERF_GATES.privateMemorySlopeMBPerMinute.maximum,
          [...comparableReasons, ...memoryReasons],
          [],
          `< ${PERF_GATES.privateMemorySlopeMBPerMinute.maximum} MB/min`
        ),
      },
      {
        name: 'Renderer frames over 50 ms',
        ...gate(
          'Renderer frames over 50 ms',
          candidate.renderer.framesOver50MsPercent,
          candidate.renderer.framesOver50MsPercent <
            PERF_GATES.framesOver50MsPercent.maximum,
          [...comparableReasons, ...rendererReasons],
          rendererNotApplicable,
          `< ${PERF_GATES.framesOver50MsPercent.maximum}%`
        ),
      },
    ],
  };
}

function format(value: number | null, digits = 2): string {
  return value !== null && Number.isFinite(value)
    ? value.toFixed(digits)
    : 'n/a';
}

/** Format the summary as a Markdown report. */
export function summaryMarkdown(summary: PerfSummary): string {
  const sections = Object.entries(summary.sections)
    .map(
      ([name, stats]) =>
        `| ${name} | ${stats.operationCount} | ${format(stats.averageMeanMs, 3)} | ${format(stats.p99MeanMs, 3)} | ${format(stats.p99WorstMs, 3)} |`
    )
    .join('\n');
  const processes = summary.processes
    .map(
      (process) =>
        `| ${process.name} | ${format(process.averageCpuPercent)}% | ${format(process.averageMemoryMB)} | ${format(process.memorySlopeMBPerMinute)} | ${format(process.averagePrivateMemoryMB)} | ${format(process.privateMemorySlopeMBPerMinute)} |`
    )
    .join('\n');
  const channels = Object.entries(summary.channels)
    .map(
      ([channel, metrics]) =>
        `| ${channel} | ${metrics.processorExecutions} | ${metrics.publications} | ${metrics.deliveries} | ${format(metrics.processorRateHz)} | ${format(metrics.publicationRateHz)} | ${format(metrics.deliveryRateHz)} |`
    )
    .join('\n');
  const widgetInputs = Object.entries(summary.widgetInputs)
    .flatMap(([widget, coverage]) => {
      const entries = Object.entries(coverage.inputs);
      if (entries.length === 0) {
        return [
          `| ${widget} | n/a | ${coverage.covered ? 'YES' : 'NO'} | 0 | 0 |`,
        ];
      }
      return entries.map(
        ([channel, input]) =>
          `| ${widget} | ${channel} | ${input.observed ? 'YES' : 'NO'} | ${format(input.changeRateHz)} | ${format(input.deliveryRateHz)} |`
      );
    })
    .join('\n');
  const visibility = summary.visibilityPhases
    .map(
      (phase) =>
        `| ${phase.index} | ${phase.visibility} | ${phase.durationSeconds} | ${phase.timestamp} |`
    )
    .join('\n');
  const phaseEvidence = summary.phaseEvidence
    .map(
      (phase) =>
        `| ${phase.index} | ${phase.visibility} | ${format(phase.startSeconds)} | ${format(phase.durationSeconds)} | ${phase.sampleCount} | ${phase.expectedBehaviorSatisfied ? 'PASS' : 'INCONCLUSIVE'} | ${phase.reasons.join('; ')} |`
    )
    .join('\n');
  const evidenceStatus = summary.evidence.conclusive
    ? 'CONCLUSIVE'
    : `INCONCLUSIVE — ${summary.evidence.inconclusiveReasons.join('; ')}`;

  return `# irDashies performance run

- Run: \`${summary.runId}\`
- Scenario: \`${summary.scenario}\`
- Overlay mode: \`${summary.overlayMode}\`
- Analysed duration: ${format(summary.durationMinutes)} min
- Analysis window: ${format(summary.analysisWindow.startSeconds)}s to ${summary.analysisWindow.endSeconds === undefined ? 'end' : `${format(summary.analysisWindow.endSeconds)}s`}
- Main samples: ${summary.sampleCount}
- Evidence: **${evidenceStatus}**
- Scenario metadata: \`${JSON.stringify(summary.scenarioMetadata)}\`

| Metric | Result |
| --- | ---: |
| iRacing average FPS | ${format(summary.iracing.averageFps)} |
| iRacing sampled FPS p1 mean | ${format(summary.iracing.meanOnePercentLowFps)} |
| iRacing worst sampled FPS | ${format(summary.iracing.worstFps)} |
| iRacing foreground CPU | ${format(summary.iracing.averageCpuForeground)}% |
| iRacing GPU usage | ${format(summary.iracing.averageGpuUsage)}% |
| irDashies app CPU | ${format(summary.app.averageCpuPercent)}% |
| Average renderer / main / GPU CPU | ${format(summary.app.averageRendererCpuPercent)}% / ${format(summary.app.averageMainCpuPercent)}% / ${format(summary.app.averageGpuCpuPercent)}% |
| irDashies peak memory | ${format(summary.app.peakMemoryMB)} MB |
| Average renderer / main / GPU memory | ${format(summary.app.averageRendererMemoryMB)} / ${format(summary.app.averageMainMemoryMB)} / ${format(summary.app.averageGpuMemoryMB)} MB |
| irDashies peak private memory | ${format(summary.app.peakPrivateMemoryMB)} MB |
| Average renderer / main / GPU private memory | ${format(summary.app.averageRendererPrivateMemoryMB)} / ${format(summary.app.averageMainPrivateMemoryMB)} / ${format(summary.app.averageGpuPrivateMemoryMB)} MB |
| Peak renderer memory (${summary.app.rendererProcessCount} processes) | ${format(summary.app.peakRendererMemoryMB)} MB |
| Peak main / GPU memory | ${format(summary.app.peakMainMemoryMB)} / ${format(summary.app.peakGpuMemoryMB)} MB |
| irDashies memory slope | ${format(summary.app.memorySlopeMBPerMinute)} MB/min |
| irDashies private-memory slope | ${format(summary.app.privateMemorySlopeMBPerMinute)} MB/min |
| Telemetry tick rate, average / minimum | ${format(summary.telemetry.averageTickRateHz)} / ${format(summary.telemetry.minimumTickRateHz)} Hz |
| processTelemetry p99, mean / worst interval | ${format(summary.telemetry.processTelemetryP99MeanMs)} / ${format(summary.telemetry.processTelemetryP99WorstMs)} ms |
| broadcast p99 mean | ${format(summary.telemetry.broadcastP99MeanMs)} ms |
| Main event-loop p99, mean / worst interval | ${format(summary.eventLoop.p99MeanMs)} / ${format(summary.eventLoop.p99WorstMs)} ms |
| Worst main event-loop stall | ${format(summary.eventLoop.worstStallMs)} ms |
${summary.sdkWait ? `| SDK wait p50/p95/p99, mean | ${format(summary.sdkWait.durationMs.p50, 3)} / ${format(summary.sdkWait.durationMs.p95, 3)} / ${format(summary.sdkWait.durationMs.p99, 3)} ms (${format(summary.sdkWait.targetHz)} Hz target, ${summary.sdkWait.unsuccessful}/${summary.sdkWait.calls} unsuccessful) |\n` : ''}| Renderer frame-time p99 mean | ${format(summary.renderer.frameTimeP99MeanMs)} ms |
| Renderer telemetry callbacks / second | ${format(summary.renderer.telemetryCallbackRateHz)} |
| Renderer telemetry callback p99, mean / worst interval | ${format(summary.renderer.telemetryCallbackP99MeanMs, 3)} / ${format(summary.renderer.telemetryCallbackP99WorstMs, 3)} ms |
| Input trace frames / second | ${format(summary.renderer.inputTraceFrameRateHz)} |
| Input trace frame p99, mean / worst interval | ${format(summary.renderer.inputTraceFrameP99MeanMs, 3)} / ${format(summary.renderer.inputTraceFrameP99WorstMs, 3)} ms |
| Radar frames / second | ${format(summary.renderer.radarFrameRateHz)} |
| Radar frame p99, mean / worst interval | ${format(summary.renderer.radarFrameP99MeanMs, 3)} / ${format(summary.renderer.radarFrameP99WorstMs, 3)} ms |
| Widget React commits / second | ${format(summary.renderer.widgetRenderRateHz)} |
| Widget React commit p99, mean / worst interval | ${format(summary.renderer.widgetRenderP99MeanMs, 3)} / ${format(summary.renderer.widgetRenderP99WorstMs, 3)} ms |
| Track-map animation frames / second | ${format(summary.renderer.trackMapAnimationFrameRateHz)} |
| Track-map animation-frame p99, mean / worst interval | ${format(summary.renderer.trackMapAnimationFrameP99MeanMs, 3)} / ${format(summary.renderer.trackMapAnimationFrameP99WorstMs, 3)} ms |
| Lap Trace plot frames / second | ${format(summary.renderer.lapTraceFrameRateHz)} |
| Lap Trace plot frame p99, mean / worst interval | ${format(summary.renderer.lapTraceFrameP99MeanMs, 3)} / ${format(summary.renderer.lapTraceFrameP99WorstMs, 3)} ms |
| Lap Trace brake-cue steps / second | ${format(summary.renderer.lapTraceBrakeCueRateHz)} |
| Lap Trace brake-cue step p99, mean / worst interval | ${format(summary.renderer.lapTraceBrakeCueP99MeanMs, 3)} / ${format(summary.renderer.lapTraceBrakeCueP99WorstMs, 3)} ms |
| Renderer frames over 25 / 50 ms | ${format(summary.renderer.framesOver25MsPercent, 3)}% / ${format(summary.renderer.framesOver50MsPercent, 3)}% |
| Worst renderer frame | ${format(summary.renderer.worstFrameMs)} ms |

## Channel activity

| Channel | Processor executions | Publications | Deliveries | Processor Hz | Change Hz | Delivery Hz |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
${channels}

## Widget input coverage

| Widget | Input channel | Observed | Change Hz | Delivery Hz |
| --- | --- | --- | ---: | ---: |
${widgetInputs}

## Visibility phases

| Phase | Visibility | Duration seconds | Marker timestamp |
| ---: | --- | ---: | --- |
${visibility}

## Visibility evidence

| Phase | Visibility | Start seconds | Duration seconds | Complete intervals | Expected behavior | Reasons |
| ---: | --- | ---: | ---: | ---: | --- | --- |
${phaseEvidence}

## Timed hot-path sections

| Section | Operations | Average | Mean interval p99 | Worst interval p99 |
| --- | ---: | ---: | ---: | ---: |
${sections}

## Process breakdown

| Process | Average CPU | Average working set MB | Working-set slope MB/min | Average private MB | Private slope MB/min |
| --- | ---: | ---: | ---: | ---: | ---: |
${processes}
`;
}

function sourceProvenance(summary: PerfSummary): string {
  const commit = summary.scenarioMetadata.sourceCommit;
  const dirty = summary.scenarioMetadata.sourceDirty;
  const revision = typeof commit === 'string' ? commit : 'not recorded';
  const worktree =
    typeof dirty === 'boolean' ? (dirty ? 'dirty' : 'clean') : 'unknown';
  return `${revision} (${worktree} worktree)`;
}

function workloadConditions(summary: PerfSummary): string {
  const metadata = Object.fromEntries(
    Object.entries(summary.scenarioMetadata).filter(
      ([key]) => key !== 'sourceCommit' && key !== 'sourceDirty'
    )
  );
  return stableJson({
    scenario: summary.scenario,
    overlayMode: summary.overlayMode,
    metadata,
  });
}

export function comparisonEvidenceReasons(
  comparison: PerfComparison
): string[] {
  const { baseline, candidate, checks } = comparison;
  const matched = checks.find(
    (check) => check.name === 'Matched workload metadata'
  );
  return [
    ...coreEvidenceReasons(candidate, 'candidate'),
    ...coreEvidenceReasons(baseline, 'baseline'),
    ...(matched?.passed === true
      ? []
      : ['workload metadata differs or is unavailable']),
    ...checks
      .filter(
        (check) =>
          check.passed === null &&
          !comparisonCheckSatisfied(check) &&
          check !== matched
      )
      .map((check) => `${check.name}: ${check.target}`),
  ];
}

/** Format the comparison as a Markdown table. */
export function comparisonMarkdown(comparison: PerfComparison): string {
  const { baseline, candidate, delta } = comparison;
  const workloadMatch = comparison.checks.find(
    (check) => check.name === 'Matched workload metadata'
  )?.passed;
  const evidenceStatus =
    comparisonEvidenceReasons(comparison).length === 0
      ? 'CONCLUSIVE'
      : 'INCONCLUSIVE';
  const checks = comparison.checks
    .map(
      (check) =>
        `| ${check.name} | ${comparisonCheckStatus(check)} | ${format(check.actual, 3)} | ${check.target} |`
    )
    .join('\n');

  return `# irDashies performance comparison

- Baseline: \`${baseline.runId}\` (${baseline.scenario})
- Candidate: \`${candidate.runId}\` (${candidate.scenario})
- Evidence: **${evidenceStatus}**
- Declared contrast: ${contrastDescription(comparison.contrast)}

## Provenance and workload

- Baseline source: \`${sourceProvenance(baseline)}\`
- Candidate source: \`${sourceProvenance(candidate)}\`
- Workload metadata excluding source revision/state: **${workloadMatch === true ? 'MATCH' : workloadMatch === false ? 'DIFFERENT' : 'UNAVAILABLE'}**
- Baseline conditions: \`${workloadConditions(baseline)}\`
- Candidate conditions: \`${workloadConditions(candidate)}\`

| Delta | Result |
| --- | ---: |
| iRacing average FPS | ${format(delta.averageFpsPercent)}% |
| iRacing sampled FPS p1 mean | ${format(delta.onePercentLowFpsPercent)}% |
| irDashies app CPU | ${format(delta.appCpuPercent)} percentage points |
| irDashies peak memory | ${format(delta.peakMemoryMB)} MB |
| processTelemetry p99 mean | ${format(delta.processTelemetryP99Ms)} ms |
| Main event-loop p99 mean | ${format(delta.eventLoopP99Ms)} ms |
| Input trace frames / second | ${format(delta.inputTraceFrameRateHz)} Hz |
| Input trace frame p99 mean | ${format(delta.inputTraceFrameP99Ms, 3)} ms |
| Radar frames / second | ${format(delta.radarFrameRateHz)} Hz |
| Radar frame p99 mean | ${format(delta.radarFrameP99Ms, 3)} ms |
| Widget React commits / second | ${format(delta.widgetRenderRateHz)} Hz |
| Widget React commit p99 mean | ${format(delta.widgetRenderP99Ms, 3)} ms |
| Track-map animation frames / second | ${format(delta.trackMapAnimationFrameRateHz)} Hz |
| Track-map animation-frame p99 mean | ${format(delta.trackMapAnimationFrameP99Ms, 3)} ms |
| Lap Trace plot frames / second | ${format(delta.lapTraceFrameRateHz)} Hz |
| Lap Trace plot frame p99 mean | ${format(delta.lapTraceFrameP99Ms, 3)} ms |
| Lap Trace brake-cue steps / second | ${format(delta.lapTraceBrakeCueRateHz)} Hz |
| Lap Trace brake-cue step p99 mean | ${format(delta.lapTraceBrakeCueP99Ms, 3)} ms |

| Check | Status | Actual | Target |
| --- | --- | ---: | ---: |
${checks}
`;
}

async function readSummary(
  filePath: string,
  warmupSeconds: number,
  analysisWindow: AnalysisWindow
): Promise<PerfSummary> {
  const contents = await fs.readFile(filePath, 'utf8');
  return summarizeCapture(
    parsePerfLog(contents),
    warmupSeconds,
    analysisWindow
  );
}

async function writeAnalysis(
  candidatePath: string,
  baselinePath: string | undefined,
  warmupSeconds: number,
  analysisWindow: AnalysisWindow,
  requireConclusive: boolean,
  contrast: ComparisonContrast,
  ignoredGates: readonly string[]
): Promise<void> {
  const candidate = await readSummary(
    candidatePath,
    warmupSeconds,
    analysisWindow
  );
  const outputBase = candidatePath.replace(/\.[^.]+$/, '');
  const summaryPath = `${outputBase}.summary.json`;
  const markdownPath = `${outputBase}.summary.md`;
  let baseline: PerfSummary | undefined;
  let inconclusiveReasons = candidate.evidence.inconclusiveReasons;

  if (baselinePath) {
    baseline = await readSummary(baselinePath, warmupSeconds, analysisWindow);
    const comparison = compareSummaries(
      baseline,
      candidate,
      contrast,
      ignoredGates
    );
    inconclusiveReasons = comparisonEvidenceReasons(comparison);
    await Promise.all([
      fs.writeFile(summaryPath, JSON.stringify(comparison, null, 2), 'utf8'),
      fs.writeFile(markdownPath, comparisonMarkdown(comparison), 'utf8'),
    ]);
  } else {
    await Promise.all([
      fs.writeFile(summaryPath, JSON.stringify(candidate, null, 2), 'utf8'),
      fs.writeFile(markdownPath, summaryMarkdown(candidate), 'utf8'),
    ]);
  }

  process.stdout.write(`${markdownPath}\n`);
  if (requireConclusive && inconclusiveReasons.length > 0) {
    throw new Error(
      `Performance evidence is inconclusive: ${inconclusiveReasons.join('; ')}`
    );
  }
}

export const ANALYZE_USAGE = `Usage: npm run perf:analyze -- <candidate.log> [options]
  --baseline <file>            Baseline raw performance log
  --warmup-seconds N           Ignore startup samples (default 30)
  --analysis-start-seconds N   Start analysis after capture origin
  --analysis-end-seconds N     End analysis after capture origin
  --contrast overlay,widgets   Declare intentional A/B differences
  --ignore-gates a,b           Skip selected gate names explicitly
  --allow-inconclusive         Write reports for partial evidence
`;

export function parseCliArgs(args: string[]): {
  candidatePath: string;
  baselinePath?: string;
  warmupSeconds: number;
  analysisWindow: AnalysisWindow;
  requireConclusive: boolean;
  contrast: ComparisonContrast;
  ignoredGates: string[];
} {
  const parsed = parseArguments(args, {
    usage: ANALYZE_USAGE,
    values: [
      '--baseline',
      '--warmup-seconds',
      '--analysis-start-seconds',
      '--analysis-end-seconds',
      '--contrast',
      '--ignore-gates',
    ],
    booleans: ['--allow-inconclusive'],
    positional: 'one',
  });
  const baselinePath = parsed.value('--baseline');
  const analysisWindow: AnalysisWindow = {
    startSeconds: numericArgument(parsed, '--analysis-start-seconds', 0, {
      min: 0,
    }),
    endSeconds: numericArgument(parsed, '--analysis-end-seconds', 0, {
      min: 0,
    }),
  };
  if (!parsed.has('--analysis-start-seconds'))
    analysisWindow.startSeconds = undefined;
  if (!parsed.has('--analysis-end-seconds'))
    analysisWindow.endSeconds = undefined;
  if (
    analysisWindow.startSeconds !== undefined &&
    analysisWindow.endSeconds !== undefined &&
    analysisWindow.endSeconds <= analysisWindow.startSeconds
  )
    throw new Error(
      '--analysis-end-seconds must be greater than --analysis-start-seconds.'
    );

  return {
    candidatePath: path.resolve(parsed.positionals[0]),
    baselinePath: baselinePath ? path.resolve(baselinePath) : undefined,
    warmupSeconds: numericArgument(parsed, '--warmup-seconds', 30, { min: 0 }),
    analysisWindow,
    requireConclusive: !parsed.flag('--allow-inconclusive'),
    contrast: parseComparisonContrast(listArgument(parsed, '--contrast')),
    ignoredGates: listArgument(parsed, '--ignore-gates'),
  };
}

const isCli =
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isCli) {
  const args = process.argv.slice(2);
  if (args.includes('--help') || args.includes('-h')) {
    process.stdout.write(ANALYZE_USAGE);
  } else {
    const options = parseCliArgs(args);
    await writeAnalysis(
      options.candidatePath,
      options.baselinePath,
      options.warmupSeconds,
      options.analysisWindow,
      options.requireConclusive,
      options.contrast,
      options.ignoredGates
    );
  }
}
