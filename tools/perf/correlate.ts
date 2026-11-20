import type {
  NumericSampleStats,
  RendererPerfSample,
} from '../../src/types/performance.ts';
import {
  isTapeReplay,
  type AnalysisWindow,
  type PerfCapture,
} from './analyze.ts';
import { MIN_ANALYSIS_SECONDS } from './gates.ts';

export interface CorrelationFinding {
  id: string;
  severity: 'attention' | 'caution' | 'info';
  title: string;
  evidence: string[];
  nextStep: string;
}

export interface CorrelationOptions {
  warmupSeconds: number;
  analysisWindow: AnalysisWindow;
}

interface Interval {
  start: number;
  end: number;
}

const boundsOf = (sample: {
  timestamp: string;
  intervalMs?: number;
}): Interval => {
  const end = Date.parse(sample.timestamp);
  return { start: end - Math.max(0, sample.intervalMs ?? 0), end };
};

const overlaps = (left: Interval, right: Interval): boolean =>
  left.end > right.start && left.start < right.end;

const percentile = (values: readonly number[], fraction: number): number => {
  if (values.length === 0) return Number.NaN;
  const sorted = [...values].sort((left, right) => left - right);
  const index = Math.min(
    sorted.length - 1,
    Math.max(0, Math.ceil(sorted.length * fraction) - 1)
  );
  return sorted[index];
};

const formatMs = (value: number): string =>
  Number.isFinite(value) ? value.toFixed(2) : 'unavailable';

type RendererMeasure =
  | 'trackMapAnimationFrameMs'
  | 'inputTraceFrameMs'
  | 'radarFrameMs'
  | 'widgetRenderMs'
  | 'lapTraceFrameMs'
  | 'lapTraceBrakeCueMs';

const rendererMeasures: readonly RendererMeasure[] = [
  'trackMapAnimationFrameMs',
  'inputTraceFrameMs',
  'radarFrameMs',
  'widgetRenderMs',
  'lapTraceFrameMs',
  'lapTraceBrakeCueMs',
];

const rendererStats = (
  sample: RendererPerfSample,
  measure: RendererMeasure
): NumericSampleStats | undefined =>
  sample[measure] as NumericSampleStats | undefined;

export function correlateCapture(
  capture: PerfCapture,
  options: CorrelationOptions
): CorrelationFinding[] {
  if (capture.main.length === 0) return [];

  const validOrigins = (capture.origins ?? []).filter((origin) =>
    Number.isFinite(Date.parse(origin.timestamp))
  );
  if (validOrigins.length !== 1) return [];
  const origin = Date.parse(validOrigins[0].timestamp);
  const startSeconds = Math.max(
    options.warmupSeconds,
    options.analysisWindow.startSeconds ?? 0
  );
  const analysisStart = origin + startSeconds * 1000;
  const analysisEnd =
    options.analysisWindow.endSeconds === undefined
      ? Math.max(...capture.main.map((sample) => Date.parse(sample.timestamp))) +
        1
      : origin + options.analysisWindow.endSeconds * 1000;
  if (analysisEnd - analysisStart < MIN_ANALYSIS_SECONDS * 1000) return [];

  const main = capture.main.filter((sample) => {
    const bounds = boundsOf(sample);
    return (
      bounds.end > analysisStart &&
      bounds.start < analysisEnd &&
      !isTapeReplay(sample.scenarioMetadata) &&
      Number.isFinite(sample.iracing.frameRate.avg)
    );
  });
  if (main.length < 3) return [];

  const rendererSamples = (capture.renderer ?? []).filter((sample) => {
    const bounds = boundsOf(sample);
    return bounds.end > analysisStart && bounds.start < analysisEnd;
  });
  const fpsValues = main.map((sample) => sample.iracing.frameRate.avg);
  const medianFps = percentile(fpsValues, 0.5);
  if (!Number.isFinite(medianFps) || medianFps <= 0) return [];
  const dipThreshold = Math.min(medianFps * 0.85, medianFps - 3);
  if (dipThreshold <= 0) return [];

  const sectionValues = new Map<string, number[]>();
  for (const sample of main) {
    for (const [name, section] of Object.entries(sample.sections)) {
      const values = sectionValues.get(name) ?? [];
      values.push(section.p99Ms);
      sectionValues.set(name, values);
    }
  }
  const sectionBaselines = new Map(
    [...sectionValues].map(([name, values]) => [name, percentile(values, 0.75)])
  );
  const eventLoopBaseline = percentile(
    main.map((sample) => sample.eventLoopDelayMs.p99),
    0.75
  );
  const channelValues = new Map<string, number[]>();
  for (const sample of main) {
    const intervalSeconds = Math.max(0.001, (sample.intervalMs ?? 5000) / 1000);
    for (const [channel, count] of Object.entries(
      sample.channelMetrics?.publications ?? {}
    )) {
      const values = channelValues.get(channel) ?? [];
      values.push(count / intervalSeconds);
      channelValues.set(channel, values);
    }
  }
  const channelBaselines = new Map(
    [...channelValues].map(([name, values]) => [name, percentile(values, 0.75)])
  );
  const rendererBaselines = new Map<RendererMeasure, number>();
  for (const measure of rendererMeasures) {
    rendererBaselines.set(
      measure,
      percentile(
        rendererSamples
          .map((sample) => rendererStats(sample, measure)?.p95)
          .filter((value): value is number => value !== undefined),
        0.75
      )
    );
  }

  const candidates = main
    .filter((sample) => sample.iracing.frameRate.avg <= dipThreshold)
    .sort((left, right) => left.iracing.frameRate.avg - right.iracing.frameRate.avg);

  const findings: CorrelationFinding[] = [];
  const selectedTimes: number[] = [];
  for (const sample of candidates) {
    const timestamp = Date.parse(sample.timestamp);
    if (selectedTimes.some((time) => Math.abs(time - timestamp) < 10_000))
      continue;
    selectedTimes.push(timestamp);
    const offsetSeconds = (timestamp - origin) / 1000;
    const contributors: string[] = [];

    for (const [name, section] of Object.entries(sample.sections)) {
      const baseline = sectionBaselines.get(name) ?? Number.NaN;
      if (section.p99Ms > Math.max(baseline * 1.5, baseline + 1))
        contributors.push(
          `${name} interval p99 ${formatMs(section.p99Ms)} ms vs ${formatMs(baseline)} ms baseline`
        );
    }
    if (
      sample.eventLoopDelayMs.max >
      Math.max(eventLoopBaseline * 1.5, eventLoopBaseline + 2)
    )
      contributors.push(
        `main event-loop max ${formatMs(sample.eventLoopDelayMs.max)} ms vs ${formatMs(eventLoopBaseline)} ms p95 baseline`
      );

    const intervalSeconds = Math.max(0.001, (sample.intervalMs ?? 5000) / 1000);
    for (const [channel, count] of Object.entries(
      sample.channelMetrics?.publications ?? {}
    )) {
      const rate = count / intervalSeconds;
      const baseline = channelBaselines.get(channel) ?? Number.NaN;
      if (rate > Math.max(baseline * 2, baseline + 5))
        contributors.push(
          `${channel} publications ${rate.toFixed(1)}/s vs ${Number.isFinite(baseline) ? baseline.toFixed(1) : 'unavailable'}/s baseline`
        );
    }

    const candidateBounds = boundsOf(sample);
    for (const measure of rendererMeasures) {
      const stats = rendererSamples
        .filter((renderer) => overlaps(boundsOf(renderer), candidateBounds))
        .map((renderer) => rendererStats(renderer, measure)?.p95)
        .filter((value): value is number => value !== undefined);
      if (stats.length === 0) continue;
      const value = Math.max(...stats);
      const baseline = rendererBaselines.get(measure) ?? Number.NaN;
      if (value > Math.max(baseline * 1.5, baseline + 1))
        contributors.push(
          `${measure} p95 ${formatMs(value)} ms vs ${formatMs(baseline)} ms baseline`
        );
    }

    contributors.sort((left, right) => right.length - left.length);
    findings.push({
      id: 'correlated-frame-rate-dip',
      severity: 'attention',
      title: `Frame-rate dip at T+${offsetSeconds.toFixed(0)}s`,
      evidence: [
        `iRacing sampled FPS ${sample.iracing.frameRate.avg.toFixed(1)} vs ${medianFps.toFixed(1)} median.`,
        ...contributors.slice(0, 4),
        ...(contributors.length === 0
          ? ['No instrumented section, channel or renderer measure peaked in the same interval.']
          : []),
      ],
      nextStep:
        contributors.length > 0
          ? `Capture a short trace covering T+${Math.max(0, offsetSeconds - 5).toFixed(0)}s to ${(offsetSeconds + 5).toFixed(0)}s and inspect the listed measures; isolate the matching widget or channel afterwards.`
          : 'Check game, GPU and host saturation for this interval. The absence of an instrumented peak does not rule out an unmeasured path.',
    });
    if (findings.length >= 5) break;
  }

  return findings;
}
