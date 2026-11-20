import { promises as fs } from 'node:fs';
import path from 'node:path';
import {
  comparisonEvidenceReasons,
  parsePerfLog,
  summarizeCapture,
  type AnalysisWindow,
  type PerfComparison,
  type PerfSummary,
} from './analyze.ts';
import { choiceArgument, numericArgument, parseArguments } from './args.ts';
import { correlateCapture, type CorrelationFinding } from './correlate.ts';
import {
  COMPARISON_CONTRASTS,
  PERF_GATES,
  comparisonCheckSatisfied,
  contrastDescription,
} from './gates.ts';

const MAIN_EVENT_LOOP_STALL_SIGNAL_MS = 50;

export const DIAGNOSE_USAGE = `Usage: npm run perf -- diagnose <run.log|report.json|summary.json> [options]
  --warmup-seconds N           Ignore startup samples in a raw log (default 30)
  --analysis-start-seconds N   Start raw-log analysis after capture origin
  --analysis-end-seconds N     End raw-log analysis after capture origin
  --output <path-prefix>       Write <prefix>.json and <prefix>.md
  --format paths|md|json      stdout format (default paths); sidecars are always written
  --fail-on never|info|caution|attention  Exit non-zero at or above severity
  --no-correlate              Skip timestamped anomaly correlation on raw logs
  JSON inputs may be replay reports or analyzer summaries/comparisons
`;

export interface PerfDiagnosisFinding {
  id: string;
  severity: 'attention' | 'caution' | 'info';
  title: string;
  evidence: string[];
  nextStep: string;
}

export interface PerfDiagnosis {
  schemaVersion: 1;
  source: 'perf-log' | 'perf-summary' | 'perf-comparison' | 'replay-report';
  run: {
    runId: string;
    scenario: string;
    durationMinutes: number;
    evidenceConclusive: boolean;
    inconclusiveReasons: string[];
  };
  findings: PerfDiagnosisFinding[];
  conclusion: string;
}

export type DiagnosisOutputFormat = 'paths' | 'md' | 'json';

export type DiagnosisFailureThreshold =
  | 'never'
  | 'info'
  | 'caution'
  | 'attention';

export interface DiagnoseOptions {
  inputPath: string;
  outputPrefix: string;
  warmupSeconds: number;
  analysisWindow: AnalysisWindow;
  analysisOptionsProvided: boolean;
  format: DiagnosisOutputFormat;
  failOn: DiagnosisFailureThreshold;
  correlateRawLog: boolean;
}

const markdownText = (value: string): string =>
  value.replace(/[\\`*_{}\x5B\x5D<>|~]/g, '\\$&').replace(/\r?\n/g, ' ');

const format = (value: number, digits = 2): string =>
  Number.isFinite(value) ? value.toFixed(digits) : 'unavailable';

function sourceDescription(summary: PerfSummary): string {
  const commit = summary.scenarioMetadata.sourceCommit;
  const dirty = summary.scenarioMetadata.sourceDirty;
  const revision = typeof commit === 'string' ? commit : 'not recorded';
  const worktree =
    typeof dirty === 'boolean' ? (dirty ? 'dirty' : 'clean') : 'unknown';
  return `${revision} (${worktree} worktree)`;
}

function workloadDescription(summary: PerfSummary): string {
  const keys = [
    'target',
    'simulatorMode',
    'sourceKind',
    'fieldCount',
    'classCount',
    'displayGeometry',
    'fpsCap',
    'syncMode',
    'overlayWindowMode',
    'activeWidgetTypes',
    'requestedWidgetTypes',
    'telemetryDelivery',
    'telemetryPayload',
    'channelDelivery',
    'replayVisibleWidgets',
    'windowMode',
  ];
  const metadata = Object.fromEntries(
    keys
      .filter((key) =>
        Object.prototype.hasOwnProperty.call(summary.scenarioMetadata, key)
      )
      .map((key) => [key, summary.scenarioMetadata[key]])
  );
  return `overlay=${summary.overlayMode}; ${JSON.stringify(metadata)}`;
}

export function diagnosePerfSummary(summary: PerfSummary): PerfDiagnosis {
  const findings: PerfDiagnosisFinding[] = [];
  const add = (finding: PerfDiagnosisFinding) => findings.push(finding);

  if (!summary.evidence.conclusive) {
    add({
      id: 'incomplete-evidence',
      severity: 'caution',
      title: 'Run evidence is inconclusive',
      evidence: summary.evidence.inconclusiveReasons,
      nextStep:
        'Repeat with the workload and analysis window described in docs/PERFORMANCE_BENCHMARKS.md before treating any signal as a regression.',
    });
  }

  const mainHotspots = Object.entries(summary.sections)
    .filter(
      ([, section]) => section.operationCount > 0 && section.p99MeanMs > 0
    )
    .sort((left, right) => right[1].p99MeanMs - left[1].p99MeanMs)
    .slice(0, 5);
  if (mainHotspots.length > 0) {
    findings.push({
      id: 'main-section-hotspots',
      severity: 'info',
      title: 'Main-process sections with the highest measured interval p99',
      evidence: mainHotspots.map(
        ([name, section], index) =>
          `${index + 1}. ${name}: p99 mean ${format(section.p99MeanMs)} ms; worst interval p99 ${format(section.p99WorstMs)} ms; average operation ${format(section.averageMeanMs, 3)} ms across ${section.operationCount} operations.`
      ),
      nextStep:
        'Start with the highest-ranked section, then measure it under a matched workload. Timed sections may be nested, so their durations are not additive and the ranking alone does not establish a bottleneck.',
    });
  }

  const cumulativeSectionHotspots = Object.entries(summary.sections)
    .map(([name, section]) => ({
      name,
      ...section,
      estimatedTotalMs: section.averageMeanMs * section.operationCount,
    }))
    .filter(
      (section) =>
        section.operationCount > 0 &&
        Number.isFinite(section.estimatedTotalMs) &&
        section.estimatedTotalMs > 0
    )
    .sort((left, right) => right.estimatedTotalMs - left.estimatedTotalMs)
    .slice(0, 5);
  if (cumulativeSectionHotspots.length > 0) {
    findings.push({
      id: 'main-section-cumulative-work',
      severity: 'info',
      title: 'Sections with the most estimated measured work',
      evidence: cumulativeSectionHotspots.map(
        (section, index) =>
          `${index + 1}. ${section.name}: approximately ${format(section.estimatedTotalMs)} ms across ${section.operationCount} operations (${format(section.averageMeanMs, 3)} ms average per operation).`
      ),
      nextStep:
        'Use this ranking to find frequently executed work, not as a total CPU breakdown: nested sections overlap, so do not sum these values across rows.',
    });
  }

  const rendererHotspots = [
    {
      name: 'Radar draw',
      rateHz: summary.renderer.radarFrameRateHz,
      p99MeanMs: summary.renderer.radarFrameP99MeanMs,
      p99WorstMs: summary.renderer.radarFrameP99WorstMs,
    },
    {
      name: 'Input Trace draw',
      rateHz: summary.renderer.inputTraceFrameRateHz,
      p99MeanMs: summary.renderer.inputTraceFrameP99MeanMs,
      p99WorstMs: summary.renderer.inputTraceFrameP99WorstMs,
    },
    {
      name: 'Widget React commit',
      rateHz: summary.renderer.widgetRenderRateHz,
      p99MeanMs: summary.renderer.widgetRenderP99MeanMs,
      p99WorstMs: summary.renderer.widgetRenderP99WorstMs,
    },
    {
      name: 'Lap Trace plot',
      rateHz: summary.renderer.lapTraceFrameRateHz,
      p99MeanMs: summary.renderer.lapTraceFrameP99MeanMs,
      p99WorstMs: summary.renderer.lapTraceFrameP99WorstMs,
    },
    {
      name: 'Lap Trace brake-cue step',
      rateHz: summary.renderer.lapTraceBrakeCueRateHz,
      p99MeanMs: summary.renderer.lapTraceBrakeCueP99MeanMs,
      p99WorstMs: summary.renderer.lapTraceBrakeCueP99WorstMs,
    },
    {
      name: 'Track Map animation callback',
      rateHz: summary.renderer.trackMapAnimationFrameRateHz,
      p99MeanMs: summary.renderer.trackMapAnimationFrameP99MeanMs,
      p99WorstMs: summary.renderer.trackMapAnimationFrameP99WorstMs,
    },
  ]
    .filter(
      (
        measure
      ): measure is typeof measure & {
        rateHz: number;
        p99MeanMs: number;
      } =>
        typeof measure.rateHz === 'number' &&
        measure.rateHz > 0 &&
        typeof measure.p99MeanMs === 'number' &&
        measure.p99MeanMs > 0
    )
    .sort((left, right) => right.p99MeanMs - left.p99MeanMs)
    .slice(0, 5);
  if (rendererHotspots.length > 0) {
    findings.push({
      id: 'renderer-measure-hotspots',
      severity: 'info',
      title: 'Instrumented renderer callbacks with the highest p99 cost',
      evidence: rendererHotspots.map(
        (measure, index) =>
          `${index + 1}. ${measure.name}: ${format(measure.p99MeanMs)} ms p99 mean, ${format(measure.p99WorstMs ?? Number.NaN)} ms worst interval p99 at ${format(measure.rateHz)} Hz.`
      ),
      nextStep:
        'Use the highest-ranked measurement to choose a widget for isolation. These are instrumented callback timings, not complete React render costs or game presentation times.',
    });
  }

  if (
    summary.evidence.privateMemorySamplingAdequate &&
    summary.app.privateMemorySlopeMBPerMinute >=
      PERF_GATES.privateMemorySlopeMBPerMinute.maximum
  ) {
    add({
      id: 'private-memory-growth',
      severity: 'attention',
      title: 'Private-memory growth is at or above the project target',
      evidence: [
        `${format(summary.app.privateMemorySlopeMBPerMinute)} MB/min; target is below ${PERF_GATES.privateMemorySlopeMBPerMinute.maximum} MB/min.`,
        `${summary.evidence.privateMemorySampleCount} private-memory samples over ${format(summary.evidence.privateMemorySpanSeconds)} seconds.`,
      ],
      nextStep:
        'Repeat the same workload with a matched widget subset. For a retained-memory hypothesis, use the replay memory checkpoints or perf:ibt-memory and inspect the heap evidence; a positive slope alone does not prove a leak.',
    });
  }

  if (
    summary.telemetry.processTelemetryP99MeanMs >=
    PERF_GATES.processTelemetryP99Ms.maximum
  ) {
    add({
      id: 'telemetry-processing-latency',
      severity: 'attention',
      title: 'Telemetry processing p99 is at or above its target',
      evidence: [
        `processTelemetry p99 mean: ${format(summary.telemetry.processTelemetryP99MeanMs)} ms; target is below ${PERF_GATES.processTelemetryP99Ms.maximum} ms.`,
      ],
      nextStep:
        'Inspect the timed main-process sections in the summary and repeat a matched replay with the relevant workload isolated before attributing the cost to a particular processor or widget.',
    });
  }

  if (
    summary.telemetry.minimumTickRateHz > 0 &&
    summary.telemetry.minimumTickRateHz < PERF_GATES.minimumTickRateHz.minimum
  ) {
    add({
      id: 'telemetry-tick-rate',
      severity: 'caution',
      title: 'Telemetry tick rate fell below the project target',
      evidence: [
        `Minimum observed tick rate: ${format(summary.telemetry.minimumTickRateHz)} Hz; target is at least ${PERF_GATES.minimumTickRateHz.minimum} Hz.`,
      ],
      nextStep:
        'Correlate the low-rate interval with processTelemetry, event-loop delay, and CPU measurements; repeat the same scenario to distinguish a code path from host load.',
    });
  }

  if (summary.sdkWait && summary.sdkWait.durationMs.count > 0) {
    add({
      id: 'sdk-wait-duration',
      severity:
        summary.sdkWait.unsuccessful > 0 ? 'caution' : 'info',
      title: 'SDK wait durations were recorded',
      evidence: [
        `wait p50/p95/p99: ${format(summary.sdkWait.durationMs.p50, 3)} / ${format(summary.sdkWait.durationMs.p95, 3)} / ${format(summary.sdkWait.durationMs.p99, 3)} ms across ${summary.sdkWait.durationMs.count} samples.`,
        `${summary.sdkWait.unsuccessful} unsuccessful reads of ${summary.sdkWait.calls} waits; timeout ${summary.sdkWait.timeoutMs} ms, target ${format(summary.sdkWait.targetHz)} Hz.`,
      ],
      nextStep:
        'Compare matched runs with the same replay speed and polling configuration. An unsuccessful native read is not by itself evidence of an OS timeout.',
    });
  }

  if (
    summary.renderer.framesOver50MsPercent >=
    PERF_GATES.framesOver50MsPercent.maximum
  ) {
    add({
      id: 'renderer-long-frames',
      severity: 'attention',
      title: 'Renderer frames over 50 ms reached the project limit',
      evidence: [
        `${format(summary.renderer.framesOver50MsPercent, 3)}% of observed renderer frames exceeded 50 ms; target is below ${PERF_GATES.framesOver50MsPercent.maximum}%.`,
        `Worst observed renderer frame: ${format(summary.renderer.worstFrameMs)} ms.`,
      ],
      nextStep:
        'Repeat the same workload with a reduced widget set using perf:run -- --widgets <type>, then use a trace if the hitch remains. These renderer callback timings are not game presentation frame times.',
    });
  }

  if (summary.eventLoop.worstStallMs >= MAIN_EVENT_LOOP_STALL_SIGNAL_MS) {
    const slowestSection = Object.entries(summary.sections)
      .filter(([, section]) => Number.isFinite(section.p99WorstMs))
      .sort((left, right) => right[1].p99WorstMs - left[1].p99WorstMs)[0];
    add({
      id: 'main-event-loop-stall',
      severity: 'caution',
      title: 'A long main-process event-loop stall was observed',
      evidence: [
        `Worst observed event-loop stall: ${format(summary.eventLoop.worstStallMs)} ms.`,
        ...(slowestSection
          ? [
              `Largest timed main section by worst-interval p99: ${slowestSection[0]} (${format(slowestSection[1].p99WorstMs)} ms).`,
            ]
          : []),
      ],
      nextStep:
        'Use a CPU trace or targeted section instrumentation around the measured interval; the event-loop sample locates a stall but does not identify its cause.',
    });
  }

  const uncoveredWidgets = Object.entries(summary.widgetInputs)
    .filter(([, widget]) => !widget.covered)
    .map(([widget]) => widget);
  if (uncoveredWidgets.length > 0) {
    add({
      id: 'widget-input-coverage',
      severity: 'caution',
      title: 'Some active widget inputs were not exercised',
      evidence: uncoveredWidgets.map(
        (widget) => `${widget} has incomplete input coverage.`
      ),
      nextStep:
        'Choose a replay recording that changes the missing widget inputs, or limit the claim to the widgets and channels that were observed.',
    });
  }

  if (findings.length === 0) {
    findings.push({
      id: 'no-configured-gate-exceeded',
      severity: 'info',
      title: 'No configured performance gate was exceeded',
      evidence: [
        'The available summary did not cross the diagnostic thresholds used by this command.',
      ],
      nextStep:
        'This is not a performance clearance. Check workload coverage and compare against a matched baseline before concluding that a change is neutral.',
    });
  }

  return {
    schemaVersion: 1,
    source: 'perf-summary',
    run: {
      runId: summary.runId,
      scenario: summary.scenario,
      durationMinutes: summary.durationMinutes,
      evidenceConclusive: summary.evidence.conclusive,
      inconclusiveReasons: summary.evidence.inconclusiveReasons,
    },
    findings,
    conclusion:
      'These are evidence-based investigation leads, not root-cause findings. A failed gate or correlation does not prove that a particular widget or code path caused the result.',
  };
}

interface ReplayDiagnosticReport {
  finished: boolean;
  mode: string;
  requestedSpeed: number | 'max';
  input: {
    format: string;
    durationSeconds: number;
    warnings?: string[];
  };
  playback: {
    elapsedSeconds: number;
    sourceFramesConsumed: number | null;
    sdkFramesReturned: number | null;
    sourceFramesSuperseded: number | null;
    sourceFailed: boolean | null;
  };
  resources: {
    completeProcessCoverage: boolean;
    totalCpuMsPerSecond: number | null;
    processes: { type: string; cpuMsPerSecond: number | null }[];
  };
  observations: {
    processingSections: Record<
      string,
      { count: number; totalWallMs: number; maxWallMs: number }
    >;
  };
  coverage: { widget: string; status: string; missing: string[] }[];
  widgets: { id: string; wrapperObserved: boolean; coverage: string }[];
  limitations: string[];
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value);

const isNumberOrNull = (value: unknown): value is number | null =>
  value === null || isFiniteNumber(value);

const isStringArray = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every((item) => typeof item === 'string');

function isPerfSummary(value: unknown): value is PerfSummary {
  if (!isRecord(value)) return false;
  const app = value.app;
  const telemetry = value.telemetry;
  const renderer = value.renderer;
  const eventLoop = value.eventLoop;
  const evidence = value.evidence;
  return (
    typeof value.runId === 'string' &&
    typeof value.scenario === 'string' &&
    isRecord(value.scenarioMetadata) &&
    isFiniteNumber(value.durationMinutes) &&
    isRecord(app) &&
    (isFiniteNumber(app.privateMemorySlopeMBPerMinute) ||
      app.privateMemorySlopeMBPerMinute === null) &&
    isRecord(telemetry) &&
    isFiniteNumber(telemetry.processTelemetryP99MeanMs) &&
    isFiniteNumber(telemetry.minimumTickRateHz) &&
    isRecord(renderer) &&
    isFiniteNumber(renderer.framesOver50MsPercent) &&
    isFiniteNumber(renderer.worstFrameMs) &&
    isRecord(eventLoop) &&
    isFiniteNumber(eventLoop.worstStallMs) &&
    isRecord(value.sections) &&
    Object.values(value.sections).every(
      (section) =>
        isRecord(section) &&
        isFiniteNumber(section.operationCount) &&
        isFiniteNumber(section.averageMeanMs) &&
        isFiniteNumber(section.p99MeanMs) &&
        isFiniteNumber(section.p99WorstMs)
    ) &&
    isRecord(value.widgetInputs) &&
    Object.values(value.widgetInputs).every(
      (widget) => isRecord(widget) && typeof widget.covered === 'boolean'
    ) &&
    isRecord(evidence) &&
    typeof evidence.conclusive === 'boolean' &&
    typeof evidence.privateMemorySamplingAdequate === 'boolean' &&
    isFiniteNumber(evidence.privateMemorySampleCount) &&
    isFiniteNumber(evidence.privateMemorySpanSeconds) &&
    isStringArray(evidence.inconclusiveReasons) &&
    (value.sdkWait === undefined ||
      (isRecord(value.sdkWait) &&
        isRecord(value.sdkWait.durationMs) &&
        isFiniteNumber(value.sdkWait.durationMs.count) &&
        isFiniteNumber(value.sdkWait.durationMs.p50) &&
        isFiniteNumber(value.sdkWait.durationMs.p95) &&
        isFiniteNumber(value.sdkWait.durationMs.p99) &&
        isFiniteNumber(value.sdkWait.calls) &&
        isFiniteNumber(value.sdkWait.unsuccessful) &&
        isFiniteNumber(value.sdkWait.timeoutMs) &&
        isFiniteNumber(value.sdkWait.targetHz)))
  );
}

function isPerfComparison(value: unknown): value is PerfComparison {
  if (!isRecord(value)) return false;
  return (
    isPerfSummary(value.baseline) &&
    isPerfSummary(value.candidate) &&
    Array.isArray(value.checks) &&
    value.checks.every(
      (check) =>
        isRecord(check) &&
        typeof check.name === 'string' &&
        (typeof check.passed === 'boolean' || check.passed === null) &&
        isNumberOrNull(check.actual) &&
        typeof check.target === 'string'
    ) &&
    (value.contrast === undefined ||
      (Array.isArray(value.contrast) &&
        value.contrast.every(
          (item) =>
            typeof item === 'string' &&
            (COMPARISON_CONTRASTS as readonly string[]).includes(item)
        )))
  );
}

function isReplayDiagnosticReport(
  value: unknown
): value is ReplayDiagnosticReport {
  if (!isRecord(value)) return false;
  const input = value.input;
  const playback = value.playback;
  const resources = value.resources;
  const observations = value.observations;
  return (
    typeof value.finished === 'boolean' &&
    typeof value.mode === 'string' &&
    (value.requestedSpeed === 'max' || isFiniteNumber(value.requestedSpeed)) &&
    isRecord(input) &&
    typeof input.format === 'string' &&
    isFiniteNumber(input.durationSeconds) &&
    (input.warnings === undefined || isStringArray(input.warnings)) &&
    isRecord(playback) &&
    isFiniteNumber(playback.elapsedSeconds) &&
    isNumberOrNull(playback.sourceFramesConsumed) &&
    isNumberOrNull(playback.sdkFramesReturned) &&
    isNumberOrNull(playback.sourceFramesSuperseded) &&
    (typeof playback.sourceFailed === 'boolean' ||
      playback.sourceFailed === null) &&
    isRecord(resources) &&
    typeof resources.completeProcessCoverage === 'boolean' &&
    isNumberOrNull(resources.totalCpuMsPerSecond) &&
    Array.isArray(resources.processes) &&
    resources.processes.every(
      (process) =>
        isRecord(process) &&
        typeof process.type === 'string' &&
        isNumberOrNull(process.cpuMsPerSecond)
    ) &&
    isRecord(observations) &&
    isRecord(observations.processingSections) &&
    Object.values(observations.processingSections).every(
      (section) =>
        isRecord(section) &&
        isFiniteNumber(section.count) &&
        isFiniteNumber(section.totalWallMs) &&
        isFiniteNumber(section.maxWallMs)
    ) &&
    Array.isArray(value.coverage) &&
    value.coverage.every(
      (item) =>
        isRecord(item) &&
        typeof item.widget === 'string' &&
        typeof item.status === 'string' &&
        isStringArray(item.missing)
    ) &&
    Array.isArray(value.widgets) &&
    value.widgets.every(
      (widget) =>
        isRecord(widget) &&
        typeof widget.id === 'string' &&
        typeof widget.wrapperObserved === 'boolean' &&
        typeof widget.coverage === 'string'
    ) &&
    isStringArray(value.limitations)
  );
}

export function diagnosePerfComparison(
  comparison: PerfComparison
): PerfDiagnosis {
  const diagnosis = diagnosePerfSummary(comparison.candidate);
  diagnosis.source = 'perf-comparison';
  const workloadCheck = comparison.checks.find(
    (check) => check.name === 'Matched workload metadata'
  );
  const workloadMatches = workloadCheck?.passed === true;
  const contrast = comparison.contrast ?? [];
  const sourceProvenanceComplete =
    typeof comparison.baseline.scenarioMetadata.sourceCommit === 'string' &&
    typeof comparison.baseline.scenarioMetadata.sourceDirty === 'boolean' &&
    typeof comparison.candidate.scenarioMetadata.sourceCommit === 'string' &&
    typeof comparison.candidate.scenarioMetadata.sourceDirty === 'boolean';
  const failed = comparison.checks.filter(
    (check) =>
      check.passed === false && check.name !== 'Matched workload metadata'
  );
  const inconclusive = comparison.checks.filter(
    (check) => check.passed === null && !comparisonCheckSatisfied(check)
  );
  diagnosis.run.inconclusiveReasons = comparisonEvidenceReasons(comparison);
  diagnosis.run.evidenceConclusive = diagnosis.run.inconclusiveReasons.length === 0;
  diagnosis.findings.push({
    id: 'comparison-provenance',
    severity: workloadMatches && sourceProvenanceComplete ? 'info' : 'caution',
    title: 'Baseline and candidate provenance',
    evidence: [
      `Baseline source: ${sourceDescription(comparison.baseline)}.`,
      `Candidate source: ${sourceDescription(comparison.candidate)}.`,
      `Workload metadata: ${workloadCheck?.passed === true ? 'matched' : workloadCheck?.passed === false ? 'different' : 'unavailable'}.`,
      `Declared contrast: ${contrastDescription(contrast)}.`,
      `Baseline conditions: ${workloadDescription(comparison.baseline)}.`,
      `Candidate conditions: ${workloadDescription(comparison.candidate)}.`,
    ],
    nextStep: !workloadMatches
      ? contrast.length > 0
        ? 'Conditions still differ outside the declared contrast. Align the remaining workload metadata before treating metric deltas as a code effect.'
        : 'Make the benchmark conditions match, or rerun with complete scenario metadata before treating metric deltas as a code effect.'
      : !sourceProvenanceComplete
        ? 'Repeat the captures with the updated perf:run so both source commits and worktree states are recorded.'
        : 'Confirm both revisions and worktree states are the intended before/after builds; then interpret the metric deltas.',
  });
  if (workloadCheck?.passed === false) {
    diagnosis.findings.push({
      id: 'comparison-workload-mismatch',
      severity: 'caution',
      title: 'Baseline and candidate used different workload conditions',
      evidence: [workloadCheck.target],
      nextStep:
        'Repeat both runs with the same target, replay source, active widgets, delivery settings, and window configuration. Source revision and worktree state may differ.',
    });
  }
  if (failed.length > 0) {
    diagnosis.findings.push({
      id: 'baseline-checks-failed',
      severity: 'attention',
      title: 'One or more candidate-vs-baseline gates failed',
      evidence: failed.map(
        (check) =>
          `${check.name}: ${format(check.actual, 3)}; target ${check.target}.`
      ),
      nextStep:
        'Repeat the matched baseline/candidate pair, reverse the run order, and inspect the full comparison before attributing the regression to a code change.',
    });
  }
  if (inconclusive.length > 0) {
    const explanations = [
      ...new Set(
        inconclusive.map((check) =>
          check.target.replace(/^inconclusive:\s*/i, '')
        )
      ),
    ];
    diagnosis.findings.push({
      id: 'baseline-checks-inconclusive',
      severity: 'caution',
      title: 'Some baseline comparison gates are inconclusive',
      evidence: [
        `${inconclusive.length} gates: ${inconclusive.map((check) => check.name).join(', ')}.`,
        ...explanations.map((explanation) => `Evidence: ${explanation}.`),
      ],
      nextStep:
        'Address the comparison evidence limitations and repeat both workloads under matched conditions.',
    });
  }
  return diagnosis;
}

export function diagnoseReplayReport(
  report: ReplayDiagnosticReport,
  runId: string
): PerfDiagnosis {
  const findings: PerfDiagnosisFinding[] = [
    {
      id: 'descriptive-replay-run',
      severity: 'caution',
      title: 'Replay observations are descriptive, not a performance verdict',
      evidence: [
        'A single replay run does not establish an improvement, regression, or game-frame impact.',
        ...report.limitations,
      ],
      nextStep:
        'Use repeated, matched runs for comparisons. Treat accelerated replay as throughput/stress evidence, not real-time smoothness evidence.',
    },
  ];

  if (report.playback.sourceFailed === true) {
    findings.push({
      id: 'replay-source-failed',
      severity: 'attention',
      title: 'Telemetry replay reported a source failure',
      evidence: ['The replay source ended in a failed state.'],
      nextStep:
        'Check the capture warnings and console.log, then rerun with --check smoke before interpreting performance observations.',
    });
  }

  if ((report.input.warnings?.length ?? 0) > 0) {
    findings.push({
      id: 'replay-input-warnings',
      severity: 'caution',
      title: 'Replay input reported data warnings',
      evidence: report.input.warnings ?? [],
      nextStep:
        'Review the recording warnings and confirm that the selected telemetry variables cover the workload before interpreting widget behavior.',
    });
  }

  if (!report.finished) {
    findings.push({
      id: 'replay-incomplete',
      severity: 'caution',
      title: 'Replay did not complete',
      evidence: [
        `Observed wall time: ${format(report.playback.elapsedSeconds)} seconds.`,
        `SDK frames returned: ${report.playback.sdkFramesReturned ?? 'unavailable'}.`,
      ],
      nextStep:
        'Rerun without --limit-seconds or increase the limit, and use --check complete when the test requires the full recording.',
    });
  }

  if ((report.playback.sourceFramesSuperseded ?? 0) > 0) {
    findings.push({
      id: 'replay-source-frames-superseded',
      severity: 'caution',
      title: 'Some source frames were superseded before SDK return',
      evidence: [
        `${report.playback.sourceFramesSuperseded} source frames were not returned to the SDK.`,
        `Requested replay mode: ${report.mode} at ${report.requestedSpeed}.`,
      ],
      nextStep:
        'Use --check complete to require lossless source delivery. This counter describes replay-to-SDK throughput, not one UI draw per source frame.',
    });
  }

  if (!report.resources.completeProcessCoverage) {
    findings.push({
      id: 'replay-resource-coverage',
      severity: 'caution',
      title: 'Replay CPU totals lack complete process coverage',
      evidence: [
        'One or more process snapshots were unavailable or process identities did not match.',
      ],
      nextStep:
        'Repeat the run and inspect process snapshots in report.json; do not treat the partial CPU total as an app-wide measurement.',
    });
  }

  const largestSection = Object.entries(
    report.observations.processingSections
  ).sort((left, right) => right[1].totalWallMs - left[1].totalWallMs)[0];
  if (largestSection && largestSection[1].count > 0) {
    findings.push({
      id: 'largest-replay-processing-section',
      severity: 'info',
      title: 'Largest measured main-process section in this replay',
      evidence: [
        `${largestSection[0]}: ${format(largestSection[1].totalWallMs)} ms total across ${largestSection[1].count} observations; maximum ${format(largestSection[1].maxWallMs)} ms.`,
      ],
      nextStep:
        'Use this as a profiling lead, not proof of a bottleneck; compare the same section under a matched workload or inspect a CPU trace.',
    });
  }

  const missingFieldCoverage = report.coverage.filter(
    (item) => item.status === 'missing-fields'
  );
  if (missingFieldCoverage.length > 0) {
    findings.push({
      id: 'replay-recording-field-coverage',
      severity: 'caution',
      title: 'The recording lacks fields required by selected widgets',
      evidence: missingFieldCoverage.map(
        (item) => `${item.widget}: missing ${item.missing.join(', ')}.`
      ),
      nextStep:
        'Choose a recording with the missing telemetry fields before assessing those widgets; field presence alone still does not prove active behavior.',
    });
  }

  const unobservedWidgets = report.widgets.filter(
    (widget) => !widget.wrapperObserved
  );
  if (unobservedWidgets.length > 0) {
    findings.push({
      id: 'replay-widget-mount-coverage',
      severity: 'caution',
      title: 'Some selected widgets were not observed as mounted',
      evidence: unobservedWidgets.map((widget) => widget.id),
      nextStep:
        'Check the selected profile, widget type filter, and startup output; mounted-widget coverage must be established before drawing widget-level conclusions.',
    });
  }

  const topCpuProcess = report.resources.processes
    .filter(
      (process): process is typeof process & { cpuMsPerSecond: number } =>
        process.cpuMsPerSecond !== null
    )
    .sort((left, right) => right.cpuMsPerSecond - left.cpuMsPerSecond)[0];
  if (report.resources.completeProcessCoverage && topCpuProcess) {
    findings.push({
      id: 'largest-replay-cpu-process',
      severity: 'info',
      title: 'Highest sampled CPU process in this replay',
      evidence: [
        `${topCpuProcess.type}: ${format(topCpuProcess.cpuMsPerSecond)} CPU ms/s.`,
        `Complete-process app total: ${format(report.resources.totalCpuMsPerSecond ?? Number.NaN)} CPU ms/s.`,
      ],
      nextStep:
        'Use process attribution to choose the next subsystem to inspect; it does not identify the responsible function or widget.',
    });
  }

  return {
    schemaVersion: 1,
    source: 'replay-report',
    run: {
      runId,
      scenario: `${report.input.format} replay`,
      durationMinutes: report.playback.elapsedSeconds / 60,
      evidenceConclusive: false,
      inconclusiveReasons: [
        'Replay reports are single-run descriptive observations, not statistical A/B evidence.',
      ],
    },
    findings,
    conclusion:
      'Replay diagnostics summarize measured observations and coverage. They do not establish a root cause, UI smoothness, or game-frame impact.',
  };
}

export function diagnosisMarkdown(diagnosis: PerfDiagnosis): string {
  return [
    '# irDashies performance diagnosis',
    '',
    `- Run: \`${markdownText(diagnosis.run.runId)}\``,
    `- Scenario: \`${markdownText(diagnosis.run.scenario)}\``,
    `- Input: ${diagnosis.source}`,
    `- Analysed duration: ${format(diagnosis.run.durationMinutes)} min`,
    `- Evidence: **${diagnosis.run.evidenceConclusive ? 'CONCLUSIVE' : 'INCONCLUSIVE'}**`,
    '',
    diagnosis.run.inconclusiveReasons.length
      ? `Evidence limitations: ${diagnosis.run.inconclusiveReasons.map(markdownText).join('; ')}`
      : 'No evidence limitations were reported by the analyzer.',
    '',
    ...diagnosis.findings.flatMap((finding) => [
      `## ${finding.severity.toUpperCase()}: ${markdownText(finding.title)}`,
      '',
      ...finding.evidence.map((item) => `- ${markdownText(item)}`),
      '',
      `**Next step:** ${markdownText(finding.nextStep)}`,
      '',
    ]),
    '## Interpretation',
    '',
    markdownText(diagnosis.conclusion),
    '',
  ].join('\n');
}

export function parseDiagnoseOptions(args: string[]): DiagnoseOptions {
  const parsed = parseArguments(args, {
    usage: DIAGNOSE_USAGE,
    values: [
      '--warmup-seconds',
      '--analysis-start-seconds',
      '--analysis-end-seconds',
      '--output',
      '--format',
      '--fail-on',
    ],
    booleans: ['--no-correlate'],
    positional: 'one',
  });
  const warmupSeconds = numericArgument(parsed, '--warmup-seconds', 30, {
    min: 0,
  });
  const startSeconds = parsed.has('--analysis-start-seconds')
    ? numericArgument(parsed, '--analysis-start-seconds', 0, { min: 0 })
    : undefined;
  const endSeconds = parsed.has('--analysis-end-seconds')
    ? numericArgument(parsed, '--analysis-end-seconds', 0, { min: 0 })
    : undefined;
  if (
    startSeconds !== undefined &&
    endSeconds !== undefined &&
    endSeconds <= startSeconds
  )
    throw new Error(
      '--analysis-end-seconds must be greater than --analysis-start-seconds.'
    );
  const format = choiceArgument(
    parsed,
    '--format',
    ['paths', 'md', 'json'] as const,
    'paths'
  );
  const failOn = choiceArgument(
    parsed,
    '--fail-on',
    ['never', 'info', 'caution', 'attention'] as const,
    'never'
  );
  const inputPath = path.resolve(parsed.positionals[0]);
  const outputPrefix = path.resolve(
    parsed.value('--output') ??
      inputPath.replace(/\.[^.]+$/, '') + '.diagnosis'
  );
  return {
    inputPath,
    outputPrefix,
    warmupSeconds,
    analysisWindow: { startSeconds, endSeconds },
    analysisOptionsProvided: [
      '--warmup-seconds',
      '--analysis-start-seconds',
      '--analysis-end-seconds',
    ].some((flag) => parsed.has(flag)),
    format,
    failOn,
    correlateRawLog: !parsed.flag('--no-correlate'),
  };
}

export async function runDiagnosisCli(args: string[]): Promise<void> {
  if (args.includes('--help') || args.includes('-h')) {
    process.stdout.write(DIAGNOSE_USAGE);
    return;
  }
  const options = parseDiagnoseOptions(args);
  const input = await fs.readFile(options.inputPath, 'utf8');
  let diagnosis: PerfDiagnosis;

  if (path.extname(options.inputPath).toLowerCase() === '.json') {
    if (options.analysisOptionsProvided)
      throw new Error(
        'Warmup and analysis-window options apply only to raw .log inputs.'
      );
    const report: unknown = JSON.parse(input);
    if (isReplayDiagnosticReport(report)) {
      diagnosis = diagnoseReplayReport(
        report,
        path.basename(options.inputPath)
      );
    } else if (isPerfComparison(report)) {
      diagnosis = diagnosePerfComparison(report);
    } else if (isPerfSummary(report)) {
      diagnosis = diagnosePerfSummary(report);
    } else {
      throw new Error(
        'JSON input is not a recognized replay report, performance summary, or comparison.'
      );
    }
  } else {
    const capture = parsePerfLog(input);
    const summary = summarizeCapture(
      capture,
      options.warmupSeconds,
      options.analysisWindow
    );
    diagnosis = diagnosePerfSummary(summary);
    diagnosis.source = 'perf-log';
    if (options.correlateRawLog) {
      const correlations: CorrelationFinding[] = correlateCapture(capture, {
        warmupSeconds: options.warmupSeconds,
        analysisWindow: options.analysisWindow,
      });
      const firstIndex = diagnosis.findings.length;
      diagnosis.findings.push(
        ...correlations.map((finding, index) => ({
          ...finding,
          id: `${finding.id}-${firstIndex + index}`,
        }))
      );
    }
  }

  const jsonPath = `${options.outputPrefix}.json`;
  const markdownPath = `${options.outputPrefix}.md`;
  const comparablePath = (value: string) =>
    process.platform === 'win32' ? value.toLowerCase() : value;
  if (
    [jsonPath, markdownPath].some(
      (outputPath) =>
        comparablePath(path.resolve(outputPath)) ===
        comparablePath(options.inputPath)
    )
  )
    throw new Error('Diagnosis output must not overwrite its input file.');
  const inputStat = await fs.stat(options.inputPath, { bigint: true });
  for (const outputPath of [jsonPath, markdownPath]) {
    const outputStat = await fs
      .stat(outputPath, { bigint: true })
      .catch((error: NodeJS.ErrnoException) => {
        if (error.code !== 'ENOENT') throw error;
        return undefined;
      });
    if (
      outputStat &&
      outputStat.dev === inputStat.dev &&
      outputStat.ino === inputStat.ino
    ) {
      throw new Error('Diagnosis output must not overwrite its input file.');
    }
  }
  await fs.mkdir(path.dirname(jsonPath), { recursive: true });
  await Promise.all([
    fs.writeFile(jsonPath, JSON.stringify(diagnosis, null, 2), 'utf8'),
    fs.writeFile(markdownPath, diagnosisMarkdown(diagnosis), 'utf8'),
  ]);
  if (options.format === 'json') {
    process.stdout.write(`${JSON.stringify(diagnosis, null, 2)}\n`);
  } else if (options.format === 'md') {
    process.stdout.write(diagnosisMarkdown(diagnosis));
  } else {
    process.stdout.write(`Diagnosis: ${markdownPath}\nData: ${jsonPath}\n`);
  }

  if (options.failOn !== 'never') {
    const rank = { info: 1, caution: 2, attention: 3 };
    const threshold = rank[options.failOn];
    if (diagnosis.findings.some((finding) => rank[finding.severity] >= threshold))
      process.exitCode = 1;
  }
}
