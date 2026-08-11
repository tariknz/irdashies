import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type {
  NumericSampleStats,
  RendererPerfSample,
} from '../../src/types/performance';

const MAIN_PREFIX = '[PerfMetrics:JSON] ';
const RENDERER_PREFIX = '[PerfRenderer:JSON] ';
const VISIBILITY_PREFIX = '[PerfVisibility:JSON] ';
const ORIGIN_PREFIX = '[PerfRunOrigin:JSON] ';
const MIN_ANALYSIS_SECONDS = 300;
const MIN_PRIVATE_OBSERVATIONS = 2;
const MIN_PRIVATE_SPAN_RATIO = 0.8;
const MAX_PRIVATE_SAMPLE_GAP_SECONDS = 60;

interface SectionStats {
  count: number;
  avgMs: number;
  maxMs: number;
  p99Ms: number;
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
  iracing: {
    frameRate: NumericSampleStats;
    cpuUsageForeground: NumericSampleStats;
    cpuUsageBackground: NumericSampleStats;
    gpuUsage: NumericSampleStats;
  };
  totalAppCpuPercent?: number;
  totalAppMemoryMB?: number;
  totalAppPrivateMemoryMB?: number;
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
  scenario: string;
  overlayMode: string;
  durationMinutes: number;
  sampleCount: number;
  analysisWindow: {
    startSeconds: number;
    endSeconds?: number;
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
    processTelemetryP99MeanMs: number;
    processTelemetryP99WorstMs: number;
    broadcastP99MeanMs: number;
  };
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
    framesOver25MsPercent: number;
    framesOver50MsPercent: number;
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
  delta: {
    averageFpsPercent: number;
    onePercentLowFpsPercent: number;
    appCpuPercent: number;
    peakMemoryMB: number;
    processTelemetryP99Ms: number;
    eventLoopP99Ms: number;
    trackMapAnimationFrameRateHz: number;
    trackMapAnimationFrameP99Ms: number;
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

const coveredDurationSeconds = (
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
  const runOriginAvailable = validOrigins.length === 1;
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
  const trackMapAnimationFrames = renderer
    .map((sample) => sample.trackMapAnimationFrameMs)
    .filter((stats): stats is NumericSampleStats => stats !== undefined);
  const trackMapAnimationSeconds =
    renderer
      .filter((sample) => sample.trackMapAnimationFrameMs !== undefined)
      .reduce((sum, sample) => sum + sample.intervalMs, 0) / 1000;
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
    .filter((value): value is SectionStats => value !== undefined);
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
  const privateTimestamps = pointMain
    .filter(
      (sample) =>
        typeof sample.totalAppPrivateMemoryMB === 'number' &&
        Number.isFinite(sample.totalAppPrivateMemoryMB)
    )
    .map((sample) => Date.parse(sample.timestamp))
    .filter(Number.isFinite)
    .sort((left, right) => left - right);
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

  return {
    runId: effectiveMain[0].runId,
    scenario: effectiveMain[0].scenario,
    overlayMode: effectiveMain[0].overlayMode,
    durationMinutes: durationSeconds / 60,
    sampleCount: effectiveMain.length,
    analysisWindow: {
      startSeconds,
      endSeconds: analysisWindow.endSeconds,
    },
    scenarioMetadata,
    // Keep the complete schedule in the summary. The first visibility marker
    // is normally emitted before the first interval report, so filtering by
    // sample timestamps would incorrectly drop the opening phase.
    visibilityPhases: capture.visibility ?? [],
    phaseEvidence,
    iracing: {
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
          ? pointMain.map((sample) => ({
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
      processTelemetryP99MeanMs: average(
        processTelemetry.map((stats) => stats.p99Ms)
      ),
      processTelemetryP99WorstMs: maximum(
        processTelemetry.map((stats) => stats.p99Ms)
      ),
      broadcastP99MeanMs: average(broadcast.map((stats) => stats.p99Ms)),
    },
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
      trackMapAnimationFrameRateHz:
        trackMapAnimationSeconds === 0
          ? 0
          : trackMapAnimationFrames.reduce(
              (sum, stats) => sum + stats.count,
              0
            ) / trackMapAnimationSeconds,
      trackMapAnimationFrameP99MeanMs: weightedAverage(
        trackMapAnimationFrames.map((stats) => ({
          value: stats.p99,
          weight: stats.count,
        }))
      ),
      trackMapAnimationFrameP99WorstMs: maximum(
        trackMapAnimationFrames.map((stats) => stats.p99)
      ),
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

export function compareSummaries(
  baseline: PerfSummary,
  candidate: PerfSummary
): PerfComparison {
  const averageFpsPercent = percentChange(
    baseline.iracing.averageFps,
    candidate.iracing.averageFps
  );
  const onePercentLowFpsPercent = percentChange(
    baseline.iracing.meanOnePercentLowFps,
    candidate.iracing.meanOnePercentLowFps
  );
  const comparisonConclusive =
    baseline.evidence.conclusive && candidate.evidence.conclusive;
  const verdict = (passed: boolean): boolean | null =>
    comparisonConclusive ? passed : null;
  const evidenceTarget = (target: string): string =>
    comparisonConclusive
      ? target
      : `inconclusive: ${[
          ...baseline.evidence.inconclusiveReasons.map(
            (reason) => `baseline ${reason}`
          ),
          ...candidate.evidence.inconclusiveReasons.map(
            (reason) => `candidate ${reason}`
          ),
        ].join('; ')}`;

  return {
    baseline,
    candidate,
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
    },
    checks: [
      {
        name: 'iRacing average FPS regression',
        passed: verdict(averageFpsPercent >= -2),
        actual: averageFpsPercent,
        target: evidenceTarget('>= -2%'),
      },
      {
        name: 'iRacing sampled FPS p1 regression',
        passed: verdict(onePercentLowFpsPercent >= -5),
        actual: onePercentLowFpsPercent,
        target: evidenceTarget('>= -5%'),
      },
      {
        name: 'Telemetry processing p99',
        passed: verdict(candidate.telemetry.processTelemetryP99MeanMs < 3),
        actual: candidate.telemetry.processTelemetryP99MeanMs,
        target: evidenceTarget('< 3 ms'),
      },
      {
        name: 'Telemetry tick rate',
        passed: verdict(candidate.telemetry.minimumTickRateHz >= 20),
        actual: candidate.telemetry.minimumTickRateHz,
        target: evidenceTarget('>= 20 Hz'),
      },
      {
        name: 'Steady-state private-memory slope',
        passed: verdict(candidate.app.privateMemorySlopeMBPerMinute < 5),
        actual: candidate.app.privateMemorySlopeMBPerMinute,
        target: evidenceTarget('< 5 MB/min'),
      },
      {
        name: 'Renderer frames over 50 ms',
        passed: verdict(candidate.renderer.framesOver50MsPercent < 0.1),
        actual: candidate.renderer.framesOver50MsPercent,
        target: evidenceTarget('< 0.1%'),
      },
    ],
  };
}

function format(value: number, digits = 2): string {
  return Number.isFinite(value) ? value.toFixed(digits) : 'n/a';
}

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
| Renderer frame-time p99 mean | ${format(summary.renderer.frameTimeP99MeanMs)} ms |
| Renderer telemetry callbacks / second | ${format(summary.renderer.telemetryCallbackRateHz)} |
| Renderer telemetry callback p99, mean / worst interval | ${format(summary.renderer.telemetryCallbackP99MeanMs, 3)} / ${format(summary.renderer.telemetryCallbackP99WorstMs, 3)} ms |
| Track-map animation frames / second | ${format(summary.renderer.trackMapAnimationFrameRateHz)} |
| Track-map animation-frame p99, mean / worst interval | ${format(summary.renderer.trackMapAnimationFrameP99MeanMs, 3)} / ${format(summary.renderer.trackMapAnimationFrameP99WorstMs, 3)} ms |
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

export function comparisonMarkdown(comparison: PerfComparison): string {
  const { baseline, candidate, delta } = comparison;
  const evidenceStatus =
    baseline.evidence.conclusive && candidate.evidence.conclusive
      ? 'CONCLUSIVE'
      : 'INCONCLUSIVE';
  const checks = comparison.checks
    .map(
      (check) =>
        `| ${check.name} | ${check.passed === null ? 'INCONCLUSIVE' : check.passed ? 'PASS' : 'FAIL'} | ${format(check.actual, 3)} | ${check.target} |`
    )
    .join('\n');

  return `# irDashies performance comparison

- Baseline: \`${baseline.runId}\` (${baseline.scenario})
- Candidate: \`${candidate.runId}\` (${candidate.scenario})
- Evidence: **${evidenceStatus}**

| Delta | Result |
| --- | ---: |
| iRacing average FPS | ${format(delta.averageFpsPercent)}% |
| iRacing sampled FPS p1 mean | ${format(delta.onePercentLowFpsPercent)}% |
| irDashies app CPU | ${format(delta.appCpuPercent)} percentage points |
| irDashies peak memory | ${format(delta.peakMemoryMB)} MB |
| processTelemetry p99 mean | ${format(delta.processTelemetryP99Ms)} ms |
| Main event-loop p99 mean | ${format(delta.eventLoopP99Ms)} ms |
| Track-map animation frames / second | ${format(delta.trackMapAnimationFrameRateHz)} Hz |
| Track-map animation-frame p99 mean | ${format(delta.trackMapAnimationFrameP99Ms, 3)} ms |

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
  requireConclusive: boolean
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

  if (baselinePath) {
    baseline = await readSummary(baselinePath, warmupSeconds, analysisWindow);
    const comparison = compareSummaries(baseline, candidate);
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
  if (
    requireConclusive &&
    (!candidate.evidence.conclusive ||
      (baseline !== undefined && !baseline.evidence.conclusive))
  ) {
    const reasons = [
      ...candidate.evidence.inconclusiveReasons.map(
        (reason) => `candidate: ${reason}`
      ),
      ...(baseline?.evidence.inconclusiveReasons ?? []).map(
        (reason) => `baseline: ${reason}`
      ),
    ];
    throw new Error(
      `Performance evidence is inconclusive: ${reasons.join('; ')}`
    );
  }
}

export function parseCliArgs(args: string[]): {
  candidatePath: string;
  baselinePath?: string;
  warmupSeconds: number;
  analysisWindow: AnalysisWindow;
  requireConclusive: boolean;
} {
  const valueFlags = new Set([
    '--baseline',
    '--warmup-seconds',
    '--analysis-start-seconds',
    '--analysis-end-seconds',
  ]);
  const positional = args.filter(
    (arg, index) =>
      !arg.startsWith('--') && !valueFlags.has(args[index - 1] ?? '')
  );
  const baselineIndex = args.indexOf('--baseline');
  const warmupIndex = args.indexOf('--warmup-seconds');
  const startIndex = args.indexOf('--analysis-start-seconds');
  const endIndex = args.indexOf('--analysis-end-seconds');
  if (!positional[0]) {
    throw new Error(
      'Usage: npm run perf:analyze -- <candidate.log> [--baseline <baseline.log>] [--warmup-seconds 30] [--analysis-start-seconds 60] [--analysis-end-seconds 420] [--allow-inconclusive]'
    );
  }

  return {
    candidatePath: path.resolve(positional[0]),
    baselinePath:
      baselineIndex >= 0 && args[baselineIndex + 1]
        ? path.resolve(args[baselineIndex + 1])
        : undefined,
    warmupSeconds:
      warmupIndex >= 0 && Number.isFinite(Number(args[warmupIndex + 1]))
        ? Number(args[warmupIndex + 1])
        : 30,
    analysisWindow: {
      startSeconds:
        startIndex >= 0 && Number.isFinite(Number(args[startIndex + 1]))
          ? Number(args[startIndex + 1])
          : undefined,
      endSeconds:
        endIndex >= 0 && Number.isFinite(Number(args[endIndex + 1]))
          ? Number(args[endIndex + 1])
          : undefined,
    },
    requireConclusive: !args.includes('--allow-inconclusive'),
  };
}

const isCli =
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isCli) {
  const options = parseCliArgs(process.argv.slice(2));
  await writeAnalysis(
    options.candidatePath,
    options.baselinePath,
    options.warmupSeconds,
    options.analysisWindow,
    options.requireConclusive
  );
}
