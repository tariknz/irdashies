import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type {
  NumericSampleStats,
  RendererPerfSample,
} from '../../src/types/performance';

const MAIN_PREFIX = '[PerfMetrics:JSON] ';
const RENDERER_PREFIX = '[PerfRenderer:JSON] ';

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
  processes?: {
    pid: number;
    type: string;
    name?: string;
    cpuPercent: number;
    memoryMB: number;
  }[];
}

export interface PerfCapture {
  main: MainPerfSample[];
  renderer: RendererPerfSample[];
}

export interface PerfSummary {
  runId: string;
  scenario: string;
  overlayMode: string;
  durationMinutes: number;
  sampleCount: number;
  iracing: {
    averageFps: number;
    meanOnePercentLowFps: number;
    worstFps: number;
    averageCpuForeground: number;
    averageGpuUsage: number;
  };
  app: {
    averageCpuPercent: number;
    peakMemoryMB: number;
    peakRendererMemoryMB: number;
    peakMainMemoryMB: number;
    peakGpuMemoryMB: number;
    rendererProcessCount: number;
    memorySlopeMBPerMinute: number;
  };
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
    framesOver25MsPercent: number;
    framesOver50MsPercent: number;
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
  const capture: PerfCapture = { main: [], renderer: [] };
  for (const line of contents.split(/\r?\n/)) {
    const main = extractJson<MainPerfSample>(line, MAIN_PREFIX);
    if (main) {
      capture.main.push(main);
      continue;
    }

    const renderer = extractJson<RendererPerfSample>(line, RENDERER_PREFIX);
    if (renderer) capture.renderer.push(renderer);
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
  if (samples.length < 2) return 0;
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
  return denominator === 0 ? 0 : numerator / denominator;
}

export function summarizeCapture(
  capture: PerfCapture,
  warmupSeconds = 30
): PerfSummary {
  if (capture.main.length === 0) {
    throw new Error('No structured PerfMetrics samples were found in the log.');
  }

  const firstTimestamp = Date.parse(capture.main[0].timestamp);
  const warmupCutoff = firstTimestamp + warmupSeconds * 1000;
  const main = capture.main.filter(
    (sample) => Date.parse(sample.timestamp) >= warmupCutoff
  );
  const effectiveMain = main.length > 0 ? main : capture.main;
  const earliest = Date.parse(effectiveMain[0].timestamp);
  const latest = Date.parse(effectiveMain[effectiveMain.length - 1].timestamp);
  const renderer = capture.renderer.filter((sample) => {
    const timestamp = Date.parse(sample.timestamp);
    return timestamp >= earliest && timestamp <= latest;
  });

  const iracingStats = effectiveMain.map((sample) => sample.iracing.frameRate);
  const rendererFrameCount = renderer.reduce(
    (sum, sample) => sum + sample.frameTimeMs.count,
    0
  );
  const processTelemetry = effectiveMain
    .map((sample) => sample.sections.processTelemetry)
    .filter((value): value is SectionStats => value !== undefined);
  const broadcast = effectiveMain
    .map((sample) => sample.sections.broadcast)
    .filter((value): value is SectionStats => value !== undefined);

  return {
    runId: effectiveMain[0].runId,
    scenario: effectiveMain[0].scenario,
    overlayMode: effectiveMain[0].overlayMode,
    durationMinutes: (latest - earliest) / 60_000,
    sampleCount: effectiveMain.length,
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
      peakMemoryMB: maximum(
        effectiveMain.map((sample) => sample.totalAppMemoryMB ?? 0)
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
    },
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
    },
    checks: [
      {
        name: 'iRacing average FPS regression',
        passed: averageFpsPercent >= -2,
        actual: averageFpsPercent,
        target: '>= -2%',
      },
      {
        name: 'iRacing sampled FPS p1 regression',
        passed: onePercentLowFpsPercent >= -5,
        actual: onePercentLowFpsPercent,
        target: '>= -5%',
      },
      {
        name: 'Telemetry processing p99',
        passed: candidate.telemetry.processTelemetryP99MeanMs < 3,
        actual: candidate.telemetry.processTelemetryP99MeanMs,
        target: '< 3 ms',
      },
      {
        name: 'Telemetry tick rate',
        passed: candidate.telemetry.minimumTickRateHz >= 20,
        actual: candidate.telemetry.minimumTickRateHz,
        target: '>= 20 Hz',
      },
      {
        name: 'Steady-state memory slope',
        passed:
          candidate.durationMinutes >= 5
            ? candidate.app.memorySlopeMBPerMinute < 5
            : null,
        actual: candidate.app.memorySlopeMBPerMinute,
        target:
          candidate.durationMinutes >= 5 ? '< 5 MB/min' : 'requires >= 5 min',
      },
      {
        name: 'Renderer frames over 50 ms',
        passed: candidate.renderer.framesOver50MsPercent < 0.1,
        actual: candidate.renderer.framesOver50MsPercent,
        target: '< 0.1%',
      },
    ],
  };
}

function format(value: number, digits = 2): string {
  return Number.isFinite(value) ? value.toFixed(digits) : 'n/a';
}

export function summaryMarkdown(summary: PerfSummary): string {
  return `# irDashies performance run

- Run: \`${summary.runId}\`
- Scenario: \`${summary.scenario}\`
- Overlay mode: \`${summary.overlayMode}\`
- Analysed duration: ${format(summary.durationMinutes)} min
- Main samples: ${summary.sampleCount}

| Metric | Result |
| --- | ---: |
| iRacing average FPS | ${format(summary.iracing.averageFps)} |
| iRacing sampled FPS p1 mean | ${format(summary.iracing.meanOnePercentLowFps)} |
| iRacing worst sampled FPS | ${format(summary.iracing.worstFps)} |
| iRacing foreground CPU | ${format(summary.iracing.averageCpuForeground)}% |
| iRacing GPU usage | ${format(summary.iracing.averageGpuUsage)}% |
| irDashies app CPU | ${format(summary.app.averageCpuPercent)}% |
| irDashies peak memory | ${format(summary.app.peakMemoryMB)} MB |
| Peak renderer memory (${summary.app.rendererProcessCount} processes) | ${format(summary.app.peakRendererMemoryMB)} MB |
| Peak main / GPU memory | ${format(summary.app.peakMainMemoryMB)} / ${format(summary.app.peakGpuMemoryMB)} MB |
| irDashies memory slope | ${format(summary.app.memorySlopeMBPerMinute)} MB/min |
| Telemetry tick rate, average / minimum | ${format(summary.telemetry.averageTickRateHz)} / ${format(summary.telemetry.minimumTickRateHz)} Hz |
| processTelemetry p99, mean / worst interval | ${format(summary.telemetry.processTelemetryP99MeanMs)} / ${format(summary.telemetry.processTelemetryP99WorstMs)} ms |
| broadcast p99 mean | ${format(summary.telemetry.broadcastP99MeanMs)} ms |
| Main event-loop p99, mean / worst interval | ${format(summary.eventLoop.p99MeanMs)} / ${format(summary.eventLoop.p99WorstMs)} ms |
| Worst main event-loop stall | ${format(summary.eventLoop.worstStallMs)} ms |
| Renderer frame-time p99 mean | ${format(summary.renderer.frameTimeP99MeanMs)} ms |
| Renderer frames over 25 / 50 ms | ${format(summary.renderer.framesOver25MsPercent, 3)}% / ${format(summary.renderer.framesOver50MsPercent, 3)}% |
| Worst renderer frame | ${format(summary.renderer.worstFrameMs)} ms |
`;
}

export function comparisonMarkdown(comparison: PerfComparison): string {
  const { baseline, candidate, delta } = comparison;
  const checks = comparison.checks
    .map(
      (check) =>
        `| ${check.name} | ${check.passed === null ? 'SKIP' : check.passed ? 'PASS' : 'FAIL'} | ${format(check.actual, 3)} | ${check.target} |`
    )
    .join('\n');

  return `# irDashies performance comparison

- Baseline: \`${baseline.runId}\` (${baseline.scenario})
- Candidate: \`${candidate.runId}\` (${candidate.scenario})

| Delta | Result |
| --- | ---: |
| iRacing average FPS | ${format(delta.averageFpsPercent)}% |
| iRacing sampled FPS p1 mean | ${format(delta.onePercentLowFpsPercent)}% |
| irDashies app CPU | ${format(delta.appCpuPercent)} percentage points |
| irDashies peak memory | ${format(delta.peakMemoryMB)} MB |
| processTelemetry p99 mean | ${format(delta.processTelemetryP99Ms)} ms |
| Main event-loop p99 mean | ${format(delta.eventLoopP99Ms)} ms |

| Check | Status | Actual | Target |
| --- | --- | ---: | ---: |
${checks}
`;
}

async function readSummary(
  filePath: string,
  warmupSeconds: number
): Promise<PerfSummary> {
  const contents = await fs.readFile(filePath, 'utf8');
  return summarizeCapture(parsePerfLog(contents), warmupSeconds);
}

async function writeAnalysis(
  candidatePath: string,
  baselinePath: string | undefined,
  warmupSeconds: number
): Promise<void> {
  const candidate = await readSummary(candidatePath, warmupSeconds);
  const outputBase = candidatePath.replace(/\.[^.]+$/, '');
  const summaryPath = `${outputBase}.summary.json`;
  const markdownPath = `${outputBase}.summary.md`;

  if (baselinePath) {
    const baseline = await readSummary(baselinePath, warmupSeconds);
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
}

function parseCliArgs(args: string[]): {
  candidatePath: string;
  baselinePath?: string;
  warmupSeconds: number;
} {
  const positional = args.filter((arg) => !arg.startsWith('--'));
  const baselineIndex = args.indexOf('--baseline');
  const warmupIndex = args.indexOf('--warmup-seconds');
  if (!positional[0]) {
    throw new Error(
      'Usage: npm run perf:analyze -- <candidate.log> [--baseline <baseline.log>] [--warmup-seconds 30]'
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
    options.warmupSeconds
  );
}
