import { spawn } from 'node:child_process';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import {
  compareSummaries,
  comparisonCoreComplete,
  parsePerfLog,
  summarizeCapture,
  type PerfSummary,
} from './analyze.ts';
import {
  choiceArgument,
  listArgument,
  numericArgument,
  parseArguments,
} from './args.ts';
import { comparisonCheckSatisfied } from './gates.ts';

const DEFAULT_DURATION_SECONDS = 420;
const DEFAULT_WARMUP_SECONDS = 60;
const NATIVE_FILE_PATTERN = /^(binding\.gyp|src\/app\/irsdk\/native\/)/;
const DEPENDENCY_FILE_PATTERN = /(^|\t)(package\.json|package-lock\.json)$/;

export const BRANCHES_USAGE = `Usage: npm run perf:branches [options]
  --baseline <ref>           Baseline git ref (default main)
  --candidate <ref>          Candidate git ref (default HEAD)
  --diff <range>             A...B, A..B or a single commit instead of both refs
  --baseline-dir <path>      Existing checkout instead of a baseline worktree
  --candidate-dir <path>     Existing checkout instead of a candidate worktree
  --input <file>             Required .irdt/.ibt recording to replay
  --replay-speed N           Tape playback speed, 0.25–100
  --sdk-wait                 Record opt-in SDK wait metrics
  --duration-seconds N       Capture length per side (default ${DEFAULT_DURATION_SECONDS})
  --warmup-seconds N         Ignored startup window (default ${DEFAULT_WARMUP_SECONDS})
  --profile <directory>      Seed profile copied for every side
  --output <directory>       Result directory (default perf-results/branches-<timestamp>)
  --target dev|packaged      Build to benchmark (default dev)
  --widgets <a,b>            Widget type filter for both sides
  --window-mode display|widget
  --channel-delivery on|off
  --telemetry-delivery on|off
  --replay-visible-widgets
  --install                  Run npm ci in generated worktrees
  --rebuild-native           Rebuild the native addon in generated worktrees
  --keep-worktrees           Leave generated worktrees on disk
  --pairs N                  ABBA repetitions (default 1, four runs per pair)
  --order abba|ab            Run order; ab keeps the old two-run behaviour
  --smoke                    Short harness check: 60s, ab, inconclusive allowed
  --coverage-probe-seconds N Probe widget coverage before the measured runs
  --pr <number>              Use a GitHub PR base/head from tariknz/irdashies
  --dry-run                  Resolve refs and show the plan without running
  --allow-inconclusive       Write reports for inconclusive evidence
  --ignore-gates a,b         Skip selected gate names explicitly
  --reuse                    Reuse cached worktrees/native builds (default)
  --no-reuse                 Always create fresh worktrees
  --clean-cache              Remove cached worktrees and exit
`;

export interface BranchRefs {
  baseline: string;
  candidate: string;
}

export interface BranchesOptions {
  refs: BranchRefs;
  baselineDir?: string;
  candidateDir?: string;
  inputPath: string;
  replaySpeed?: number;
  sdkWait: boolean;
  durationSeconds: number;
  warmupSeconds: number;
  seedProfile?: string;
  outputDirectory: string;
  target: 'dev' | 'packaged';
  widgets?: string;
  windowMode?: 'display' | 'widget';
  channelDelivery?: 'on' | 'off';
  telemetryDelivery?: 'on' | 'off';
  replayVisibleWidgets: boolean;
  install: boolean;
  rebuildNative: boolean;
  keepWorktrees: boolean;
  pairs: number;
  order: 'abba' | 'ab';
  smoke: boolean;
  coverageProbeSeconds: number;
  pr?: number;
  dryRun: boolean;
  allowInconclusive: boolean;
  ignoreGates: string[];
  reuse: boolean;
  cleanCache: boolean;
}

export interface BranchSideResult {
  label: 'baseline' | 'candidate';
  ref: string;
  commit: string;
  directory: string;
  generatedWorktree: boolean;
  logPath: string;
}

export interface ComparisonCheck {
  name: string;
  passed: boolean | null;
  actual: number;
  target: string;
}

export interface BranchesReport {
  options: BranchesOptions;
  baseline: BranchSideResult;
  candidate: BranchSideResult;
  aggregate: BranchAggregate;
  effectiveWidgets?: string;
  pr?: PrInfo;
  changedFiles: string[];
  nativeChanged: boolean;
  dependenciesChanged: boolean;
  comparisonPath: string;
  diagnosisPath: string;
  conclusive: boolean;
  inconclusiveRunIds?: string[];
}

export function parseDiffSpec(value: string): BranchRefs {
  const separator = value.includes('...') ? '...' : value.includes('..') ? '..' : undefined;
  if (!separator) return { baseline: `${value}^`, candidate: value };
  const [baseline, candidate, ...extra] = value.split(separator);
  if (!baseline || !candidate || extra.length > 0)
    throw new Error(`Invalid --diff: ${value}`);
  return { baseline, candidate };
}

export function parseBranchesOptions(args: string[]): BranchesOptions {
  const parsed = parseArguments(args, {
    usage: BRANCHES_USAGE,
    values: [
      '--baseline',
      '--candidate',
      '--diff',
      '--baseline-dir',
      '--candidate-dir',
      '--input',
      '--duration-seconds',
      '--replay-speed',
      '--warmup-seconds',
      '--profile',
      '--output',
      '--target',
      '--widgets',
      '--window-mode',
      '--channel-delivery',
      '--telemetry-delivery',
      '--pairs',
      '--order',
      '--coverage-probe-seconds',
      '--pr',
      '--ignore-gates',
    ],
    booleans: [
      '--replay-visible-widgets',
      '--sdk-wait',
      '--install',
      '--rebuild-native',
      '--keep-worktrees',
      '--smoke',
      '--reuse',
      '--no-reuse',
      '--clean-cache',
      '--dry-run',
      '--allow-inconclusive',
    ],
  });
  const inputPath = parsed.value('--input');
  const replaySpeed = parsed.has('--replay-speed')
    ? numericArgument(parsed, '--replay-speed', 1, { min: 0.25, max: 100 })
    : undefined;
  if (!inputPath && !parsed.flag('--clean-cache'))
    throw new Error(`--input is required\n${BRANCHES_USAGE}`);
  const diffRefs = parsed.has('--diff')
    ? parseDiffSpec(parsed.value('--diff') as string)
    : { baseline: 'main', candidate: 'HEAD' };
  const refs: BranchRefs = {
    baseline: parsed.value('--baseline') ?? diffRefs.baseline,
    candidate: parsed.value('--candidate') ?? diffRefs.candidate,
  };
  const requestedWindowMode = parsed.value('--window-mode');
  const smoke = parsed.flag('--smoke');
  const durationSeconds = smoke
    ? 60
    : numericArgument(parsed, '--duration-seconds', DEFAULT_DURATION_SECONDS, {
        min: 30,
        integer: true,
      });
  const warmupSeconds = smoke
    ? 0
    : numericArgument(parsed, '--warmup-seconds', DEFAULT_WARMUP_SECONDS, {
        min: 0,
        integer: true,
      });
  if (warmupSeconds >= durationSeconds)
    throw new Error(`Invalid A/B option\n${BRANCHES_USAGE}`);
  const pairs = numericArgument(parsed, '--pairs', 1, {
    min: 1,
    integer: true,
  });
  const prRaw = parsed.value('--pr');
  const pr = prRaw === undefined ? undefined : Number(prRaw);
  if (prRaw !== undefined && (!Number.isInteger(pr) || (pr ?? 0) <= 0))
    throw new Error(`Invalid --pr: ${prRaw}`);
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const seedProfile = parsed.value('--profile');
  return {
    refs,
    baselineDir: parsed.value('--baseline-dir')
      ? path.resolve(parsed.value('--baseline-dir') as string)
      : undefined,
    candidateDir: parsed.value('--candidate-dir')
      ? path.resolve(parsed.value('--candidate-dir') as string)
      : undefined,
    inputPath: inputPath ? path.resolve(inputPath) : '',
    replaySpeed,
    sdkWait: parsed.flag('--sdk-wait'),
    durationSeconds,
    warmupSeconds,
    seedProfile: seedProfile ? path.resolve(seedProfile) : undefined,
    outputDirectory: path.resolve(
      parsed.value('--output') ??
        path.join('perf-results', `branches-${timestamp}`)
    ),
    target: choiceArgument(
      parsed,
      '--target',
      ['dev', 'packaged'] as const,
      'dev'
    ),
    widgets: parsed.value('--widgets'),
    windowMode:
      requestedWindowMode === 'display' || requestedWindowMode === 'widget'
        ? requestedWindowMode
        : undefined,
    channelDelivery: parsed.has('--channel-delivery')
      ? choiceArgument(
          parsed,
          '--channel-delivery',
          ['on', 'off'] as const,
          'on'
        )
      : undefined,
    telemetryDelivery: parsed.has('--telemetry-delivery')
      ? choiceArgument(
          parsed,
          '--telemetry-delivery',
          ['on', 'off'] as const,
          'on'
        )
      : undefined,
    replayVisibleWidgets: parsed.flag('--replay-visible-widgets'),
    install: parsed.flag('--install'),
    rebuildNative: parsed.flag('--rebuild-native'),
    keepWorktrees: parsed.flag('--keep-worktrees'),
    pairs,
    order: smoke ? 'ab' : choiceArgument(parsed, '--order', ['abba', 'ab'] as const, 'abba'),
    smoke,
    coverageProbeSeconds: numericArgument(
      parsed,
      '--coverage-probe-seconds',
      0,
      { min: 0, integer: true }
    ),
    pr,
    dryRun: parsed.flag('--dry-run'),
    allowInconclusive: smoke || parsed.flag('--allow-inconclusive'),
    ignoreGates: listArgument(parsed, '--ignore-gates'),
    reuse:
      !parsed.flag('--no-reuse') &&
      !parsed.flag('--clean-cache') &&
      !parsed.flag('--install') &&
      !parsed.flag('--rebuild-native'),
    cleanCache: parsed.flag('--clean-cache'),
  };
}

export interface PrInfo {
  number: number;
  title: string;
  url: string;
  base: string;
  head: string;
}

export function resolvePrRefs(number: number, cwd: string): PrInfo {
  const raw = execFileSync(
    'gh',
    [
      'pr',
      'view',
      String(number),
      '--repo',
      'tariknz/irdashies',
      '--json',
      'number,title,url,baseRefName,baseRefOid,headRefOid',
    ],
    { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }
  );
  const info = JSON.parse(raw) as {
    number: number;
    title: string;
    url: string;
    baseRefName: string;
    baseRefOid: string;
    headRefOid: string;
  };
  const remotes = execFileSync('git', ['remote', '-v'], {
    cwd,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const remote =
    remotes
      .split('\n')
      .find(
        (line) => line.includes('tariknz/irdashies') && line.includes('(fetch)')
      )
      ?.split(/\s+/)[0] ?? 'origin';
  for (const ref of [
    `refs/pull/${number}/head`,
    `refs/heads/${info.baseRefName}`,
  ]) {
    try {
      execFileSync('git', ['fetch', remote, ref], {
        cwd,
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
      });
    } catch (error) {
      void error;
    }
  }
  const ensureCommit = (label: string, oid: string): void => {
    try {
      execFileSync('git', ['cat-file', '-e', `${oid}^{commit}`], {
        cwd,
        stdio: 'ignore',
      });
    } catch {
      try {
        execFileSync('git', ['fetch', remote, oid], {
          cwd,
          stdio: 'ignore',
        });
      } catch {
        throw new Error(`Cannot fetch PR ${number} ${label} ${oid}`);
      }
    }
  };
  ensureCommit('base', info.baseRefOid);
  ensureCommit('head', info.headRefOid);
  return {
    number: info.number,
    title: info.title,
    url: info.url,
    base: info.baseRefOid,
    head: info.headRefOid,
  };
}

const gitValue = (args: string[], cwd: string): string =>
  execFileSync('git', args, {
    cwd,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim();

const resolveCommit = (ref: string, cwd: string): string => {
  try {
    return gitValue(['rev-parse', '--verify', `${ref}^{commit}`], cwd);
  } catch {
    throw new Error(`Cannot resolve git ref: ${ref}`);
  }
};

const changedFiles = (
  baseline: string,
  candidate: string,
  cwd: string
): string[] =>
  gitValue(['diff', '--name-status', baseline, candidate], cwd)
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

const linkDirectory = async (
  target: string,
  linkPath: string
): Promise<void> => {
  try {
    await fs.lstat(linkPath);
    return;
  } catch {
    await fs.symlink(
      target,
      linkPath,
      process.platform === 'win32' ? 'junction' : 'dir'
    );
  }
};

const runTool = async (
  command: string,
  args: string[],
  cwd: string,
  logPath: string,
  shell = false,
  env: NodeJS.ProcessEnv = process.env
): Promise<void> => {
  let stderr = '';
  const child = spawn(command, args, {
    cwd,
    shell,
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...env, NODE_OPTIONS: '' },
  });
  child.stderr?.on('data', (chunk: Buffer) => {
    stderr += chunk.toString();
  });
  const stdoutChunks: Buffer[] = [];
  child.stdout?.on('data', (chunk: Buffer) => stdoutChunks.push(chunk));
  const waitForClose = new Promise<number | null>((resolve, reject) => {
    child.once('error', reject);
    child.once('close', resolve);
  });
  await fs.mkdir(path.dirname(logPath), { recursive: true });
  const exitCode = await waitForClose;
  await fs.writeFile(
    logPath,
    `${Buffer.concat(stdoutChunks).toString()}\n${stderr}`,
    'utf8'
  );
  if (exitCode !== 0)
    throw new Error(
      `${command} ${args.slice(0, 2).join(' ')} failed (${exitCode}): ${stderr.slice(-1200)}`
    );
};

const npmCommand = (): string =>
  process.platform === 'win32' ? 'npm.cmd' : 'npm';

const prepareWorktree = async (
  directory: string,
  options: BranchesOptions,
  rootDirectory: string,
  nativeChanged: boolean,
  logDirectory: string,
  label: string
): Promise<void> => {
  if (options.install) {
    await runTool(
      npmCommand(),
      ['ci'],
      directory,
      path.join(logDirectory, `${label}.install.log`),
      process.platform === 'win32'
    );
  } else {
    await linkDirectory(
      path.join(rootDirectory, 'node_modules'),
      path.join(directory, 'node_modules')
    );
  }
  if (options.target === 'packaged') {
    await runTool(
      npmCommand(),
      ['run', 'package'],
      directory,
      path.join(logDirectory, `${label}.package.log`),
      process.platform === 'win32'
    );
    return;
  }
  if (options.rebuildNative || nativeChanged) {
    await runTool(
      npmCommand(),
      ['run', 'irsdk:build'],
      directory,
      path.join(logDirectory, `${label}.native.log`),
      process.platform === 'win32'
    );
  } else {
    await linkDirectory(
      path.join(rootDirectory, 'build'),
      path.join(directory, 'build')
    );
  }
};

const captureSide = async (
  side: Pick<BranchSideResult, 'label' | 'ref' | 'commit' | 'directory'>,
  options: BranchesOptions,
  runnerPath: string,
  runId: string,
  logDirectory: string
): Promise<string> => {
  const profile = path.join(
    options.outputDirectory,
    `profile-${runId}`
  );
  if (options.seedProfile) {
    await fs.cp(options.seedProfile, profile, { recursive: true });
  } else {
    await fs.mkdir(profile, { recursive: true });
  }
  const args = [
    '--mode',
    'full',
    '--scenario',
    `branches-${side.label}`,
    '--run-id',
    runId,
    '--duration-seconds',
    String(options.durationSeconds),
    '--replay-input',
    options.inputPath,
    ...(options.replaySpeed !== undefined
      ? ['--replay-speed', String(options.replaySpeed)]
      : []),
    ...(options.sdkWait ? ['--sdk-wait'] : []),
    '--user-data-dir',
    profile,
    '--output-directory',
    options.outputDirectory,
    '--target',
    options.target,
  ];
  if (options.widgets) args.push('--widgets', options.widgets);
  if (options.windowMode)
    args.push('--window-mode', options.windowMode);
  if (options.channelDelivery)
    args.push('--channel-delivery', options.channelDelivery);
  if (options.telemetryDelivery)
    args.push('--telemetry-delivery', options.telemetryDelivery);
  if (options.replayVisibleWidgets)
    args.push('--replay-visible-widgets');
  await runTool(
    process.execPath,
    [
      '--disable-warning=MODULE_TYPELESS_PACKAGE_JSON',
      runnerPath,
      ...args,
    ],
    side.directory,
    path.join(logDirectory, `${runId}.run.log`),
    false,
    { ...process.env, PERF_FORCE_PROCESSOR_DEMAND: '0' }
  );
  return path.join(options.outputDirectory, `${runId}.log`);
};

const formatCheckRows = (checks: ComparisonCheck[]): string[] =>
  checks.map(
    (check) =>
      `| ${check.name} | ${check.passed === null ? 'INCONCLUSIVE' : check.passed ? 'PASS' : 'FAIL'} | ${Number.isFinite(check.actual) ? check.actual.toFixed(3) : 'n/a'} | ${check.target} |`
  );

export function branchesReportMarkdown(report: BranchesReport): string {
  const files = report.changedFiles
    .slice(0, 50)
    .map((file) => `- \`${file}\``)
    .join('\n');
  const header = [
    '# Branch performance comparison',
    '',
    ...(report.pr
      ? [`- PR: #${report.pr.number} ${report.pr.title}`, `- URL: ${report.pr.url}`]
      : []),
    `- Baseline: \`${report.baseline.ref}\` at \`${report.baseline.commit}\``,
    `- Candidate: \`${report.candidate.ref}\` at \`${report.candidate.commit}\``,
    `- Target: ${report.options.target}`,
    `- Widget filter: ${report.effectiveWidgets ?? 'saved dashboard'}`,
    `- Verdict: **${report.aggregate.verdict}**`,
    `- Native files changed: ${report.nativeChanged}`,
    `- Dependency files changed: ${report.dependenciesChanged}`,
    `- Evidence: **${report.conclusive ? 'CONCLUSIVE' : 'INCONCLUSIVE'}**`,
    ...(report.inconclusiveRunIds?.length
      ? [`- Runs with incomplete or mismatched evidence: ${report.inconclusiveRunIds.join(', ')}`]
      : []),
    `- First pair comparison: \`${report.comparisonPath}\``,
    `- First pair diagnosis: \`${report.diagnosisPath}\``,
    '',
    '## Changed files',
    '',
    files || '- No file differences between the two commits.',
    report.changedFiles.length > 50
      ? `\n... ${report.changedFiles.length - 50} more files omitted.`
      : '',
    '',
    '## Interpretation',
    '',
    'Both sides replay the same recording with the same profile and analysis window.',
    'Source revision and worktree state are the expected difference; every other',
    'workload condition must match for the gates to be conclusive.',
    '',
  ];
  return header.join('\n');
}

const writeBranchReport = async (
  report: BranchesReport,
  comparison: { checks: ComparisonCheck[] }
): Promise<string> => {
  const reportPath = path.join(report.options.outputDirectory, 'BRANCH_REPORT.md');
  const checks = `\n## Gates\n\n| Check | Status | Actual | Target |\n| --- | --- | ---: | --- |\n${formatCheckRows(comparison.checks).join('\n')}\n`;
  const aggregate = branchAggregateMarkdown(report.aggregate, report.options.order);
  await fs.writeFile(
    reportPath,
    branchesReportMarkdown(report) + aggregate + checks,
    'utf8'
  );
  return reportPath;
};

export type SideLabel = 'baseline' | 'candidate';

interface BranchRun {
  label: SideLabel;
  cycle: number;
  position: number;
  runId: string;
  logPath: string;
}

interface MetricSpec {
  key: string;
  label: string;
  unit: string;
  floor: number;
  value: (summary: PerfSummary) => number;
}

export const BRANCH_METRICS: readonly MetricSpec[] = [
  {
    key: 'appCpuPercent',
    label: 'App CPU',
    unit: 'pp',
    floor: 0.5,
    value: (summary) => summary.app.averageCpuPercent,
  },
  {
    key: 'peakMemoryMB',
    label: 'Peak working set',
    unit: 'MB',
    floor: 20,
    value: (summary) => summary.app.peakMemoryMB,
  },
  {
    key: 'averageRendererMemoryMB',
    label: 'Avg renderer memory',
    unit: 'MB',
    floor: 20,
    value: (summary) => summary.app.averageRendererMemoryMB,
  },
  {
    key: 'processTelemetryP99Ms',
    label: 'processTelemetry p99',
    unit: 'ms',
    floor: 0.25,
    value: (summary) => summary.telemetry.processTelemetryP99MeanMs,
  },
  {
    key: 'eventLoopP99Ms',
    label: 'Main event-loop p99',
    unit: 'ms',
    floor: 0.5,
    value: (summary) => summary.eventLoop.p99MeanMs,
  },
  {
    key: 'trackMapFrameP99Ms',
    label: 'Track-map frame p99',
    unit: 'ms',
    floor: 0.3,
    value: (summary) => summary.renderer.trackMapAnimationFrameP99MeanMs,
  },
  {
    key: 'framesOver50MsPercent',
    label: 'Frames over 50 ms',
    unit: '%',
    floor: 0.02,
    value: (summary) => summary.renderer.framesOver50MsPercent,
  },
];

export interface BranchMetricAggregate {
  key: string;
  label: string;
  unit: string;
  baselineMedian: number;
  baselineRange: string;
  candidateMedian: number;
  candidateRange: string;
  effect: number;
  noise: number;
  reproducible: boolean;
}

export interface BranchAggregate {
  runsPerSide: number;
  metrics: BranchMetricAggregate[];
  verdict: string;
}

const median = (values: readonly number[]): number => {
  if (values.length === 0) return Number.NaN;
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[middle - 1] + sorted[middle]) / 2
    : sorted[middle];
};

const rangeText = (values: readonly number[], unit: string): string => {
  if (values.length === 0) return 'n/a';
  const digits = unit === 'pp' || unit === '%' ? 3 : 2;
  return `${Math.min(...values).toFixed(digits)}–${Math.max(...values).toFixed(digits)} ${unit}`;
};

export function aggregateBranchRuns(
  runs: readonly (BranchRun & { summary: PerfSummary })[],
  metrics: readonly MetricSpec[] = BRANCH_METRICS
): BranchAggregate {
  const aggregated = metrics.map((metric) => {
    const baseline = runs
      .filter((run) => run.label === 'baseline')
      .map((run) => metric.value(run.summary))
      .filter(Number.isFinite);
    const candidate = runs
      .filter((run) => run.label === 'candidate')
      .map((run) => metric.value(run.summary))
      .filter(Number.isFinite);
    const baselineMedian = median(baseline);
    const candidateMedian = median(candidate);
    const effect = candidateMedian - baselineMedian;
    const noise = Math.max(
      baseline.length > 0 ? Math.max(...baseline) - Math.min(...baseline) : 0,
      candidate.length > 0 ? Math.max(...candidate) - Math.min(...candidate) : 0
    );
    return {
      key: metric.key,
      label: metric.label,
      unit: metric.unit,
      baselineMedian,
      baselineRange: rangeText(baseline, metric.unit),
      candidateMedian,
      candidateRange: rangeText(candidate, metric.unit),
      effect,
      noise,
      reproducible: Number.isFinite(effect) && Math.abs(effect) > Math.max(noise, metric.floor),
    };
  });
  const reproducible = aggregated.filter((metric) => metric.reproducible);
  return {
    runsPerSide: Math.min(
      runs.filter((run) => run.label === 'baseline').length,
      runs.filter((run) => run.label === 'candidate').length
    ),
    metrics: aggregated,
    verdict:
      reproducible.length === 0
        ? 'NO REPRODUCIBLE EFFECT'
        : `REPRODUCIBLE DIFFERENCE: ${reproducible.map((metric) => metric.key).join(', ')}`,
  };
}

export function evaluateBranchRuns(
  runs: readonly (BranchRun & { summary: PerfSummary })[],
  ignoredGates: readonly string[]
): {
  aggregate: BranchAggregate;
  checks: ComparisonCheck[];
  inconclusiveRunIds: string[];
} {
  const baselines = runs.filter((run) => run.label === 'baseline');
  const candidates = runs.filter((run) => run.label === 'candidate');
  const reference = baselines[0];
  if (!reference || baselines.length !== candidates.length)
    throw new Error('Each baseline capture requires a candidate capture.');

  const inconclusiveRunIds = runs
    .filter((run) => !comparisonCoreComplete(reference.summary, run.summary))
    .map((run) => run.runId);
  const checks = baselines.flatMap((baseline, index) => {
    const candidate = candidates[index];
    const comparison = compareSummaries(
      baseline.summary,
      candidate.summary,
      [],
      ignoredGates
    );
    return comparison.checks.map((check) => ({
      ...check,
      name: `${baseline.runId} / ${candidate.runId} — ${check.name}`,
    }));
  });
  const incomplete = checks.some(
    (check) => check.passed === null && !comparisonCheckSatisfied(check)
  );
  const aggregate = inconclusiveRunIds.length || incomplete
    ? { runsPerSide: baselines.length, metrics: [], verdict: 'INCONCLUSIVE' }
    : aggregateBranchRuns(runs);
  return { aggregate, checks, inconclusiveRunIds };
}

export function branchAggregateMarkdown(
  aggregate: BranchAggregate,
  order: 'abba' | 'ab'
): string {
  const rows = aggregate.metrics
    .map(
      (metric) =>
        `| ${metric.label} | ${metric.baselineMedian.toFixed(3)} ${metric.unit} (${metric.baselineRange}) | ${metric.candidateMedian.toFixed(3)} ${metric.unit} (${metric.candidateRange}) | ${metric.effect >= 0 ? '+' : ''}${metric.effect.toFixed(3)} ${metric.unit} | ${metric.noise.toFixed(3)} ${metric.unit} | ${metric.reproducible ? 'YES' : 'no'} |`
    )
    .join('\n');
  return `## Order-controlled aggregate

- Order: ${order}; ${aggregate.runsPerSide} runs per side.
- Verdict: **${aggregate.verdict}**

| Metric | Base median (range) | Candidate median (range) | Effect | Run noise | Above noise |
| --- | --- | --- | ---: | ---: | --- |
${rows}

`;
}

interface WorktreeCacheEntry {
  commit: string;
  directory: string;
  createdAt: string;
  native: boolean;
  dependenciesInstalled: boolean;
  dependencyFingerprint: string;
}

const hashFiles = async (filePaths: readonly string[]): Promise<string> => {
  const hash = createHash('sha256');
  for (const filePath of filePaths) {
    try {
      hash.update(await fs.readFile(filePath));
    } catch {
      hash.update('missing');
    }
  }
  return hash.digest('hex');
};

const cacheRootOf = (rootDirectory: string): string =>
  path.join(rootDirectory, 'perf-results', '.cache', 'branches');

const cacheEntryPath = (rootDirectory: string, commit: string): string =>
  path.join(cacheRootOf(rootDirectory), `${commit}.json`);

const readCacheEntry = async (
  rootDirectory: string,
  commit: string,
  dependencyFingerprint: string
): Promise<WorktreeCacheEntry | undefined> => {
  try {
    const raw = await fs.readFile(cacheEntryPath(rootDirectory, commit), 'utf8');
    const entry = JSON.parse(raw) as WorktreeCacheEntry;
    return entry.commit === commit &&
      entry.dependencyFingerprint === dependencyFingerprint &&
      isRegisteredWorktree(rootDirectory, entry.directory)
      ? entry
      : undefined;
  } catch {
    return undefined;
  }
};

const writeCacheEntry = async (
  rootDirectory: string,
  entry: WorktreeCacheEntry
): Promise<void> => {
  const root = cacheRootOf(rootDirectory);
  await fs.mkdir(root, { recursive: true });
  await fs.writeFile(
    cacheEntryPath(rootDirectory, entry.commit),
    JSON.stringify(entry, null, 2),
    'utf8'
  );
};

function isRegisteredWorktree(rootDirectory: string, directory: string): boolean {
  try {
    const list = gitValue(['worktree', 'list', '--porcelain'], rootDirectory);
    return list
      .split('\n')
      .some((line) => line.trim() === `worktree ${path.resolve(directory)}`);
  } catch {
    return false;
  }
}

export const cleanBranchCache = async (rootDirectory: string): Promise<number> => {
  const root = cacheRootOf(rootDirectory);
  let entries: string[];
  try {
    entries = (await fs.readdir(root)).filter((name) => name.endsWith('.json'));
  } catch {
    return 0;
  }
  let removed = 0;
  for (const name of entries) {
    let directory: string | undefined;
    try {
      const entry = JSON.parse(
        await fs.readFile(path.join(root, name), 'utf8')
      ) as WorktreeCacheEntry;
      directory = entry.directory;
      await gitValue(
        ['worktree', 'remove', '--force', entry.directory],
        rootDirectory
      );
    } catch {
      await fs.rm(path.join(root, name), { force: true });
    }
    if (directory)
      await fs.rm(directory, { recursive: true, force: true });
    await fs.rm(path.join(root, name), { force: true });
    removed++;
  }
  return removed;
};

const toolDirectory = path.dirname(fileURLToPath(import.meta.url));

const readRunSummary = async (
  logPath: string,
  options: BranchesOptions
): Promise<PerfSummary> =>
  summarizeCapture(parsePerfLog(await fs.readFile(logPath, 'utf8')), options.warmupSeconds, {
    startSeconds: options.warmupSeconds,
    endSeconds: options.durationSeconds,
  });

export const runBranchesCli = async (args: string[]): Promise<void> => {
  const options = parseBranchesOptions(args);
  const rootDirectory = gitValue(['rev-parse', '--show-toplevel'], process.cwd());
  const dependencyFingerprint = await hashFiles([
    path.join(rootDirectory, 'package.json'),
    path.join(rootDirectory, 'package-lock.json'),
  ]);
  if (options.cleanCache) {
    const removed = await cleanBranchCache(rootDirectory);
    process.stdout.write(`Removed ${removed} cached branch worktrees.\n`);
    return;
  }
  await fs.access(options.inputPath);
  await fs.mkdir(options.outputDirectory, { recursive: true });
  const prInfo = options.pr
    ? resolvePrRefs(options.pr, rootDirectory)
    : undefined;
  if (prInfo) options.refs = { baseline: prInfo.base, candidate: prInfo.head };
  const baselineCommit = resolveCommit(options.refs.baseline, rootDirectory);
  const candidateCommit = resolveCommit(options.refs.candidate, rootDirectory);
  const files = changedFiles(baselineCommit, candidateCommit, rootDirectory);
  const filePath = (line: string): string => line.split('\t').at(-1) ?? '';
  const nativeChanged = files.some((line) =>
    NATIVE_FILE_PATTERN.test(filePath(line))
  );
  const dependenciesChanged = files.some((line) =>
    DEPENDENCY_FILE_PATTERN.test(filePath(line))
  );
  if (options.dryRun) {
    process.stdout.write(
      [
        ...(prInfo
          ? [`PR: #${prInfo.number} ${prInfo.title}`, `URL: ${prInfo.url}`]
          : []),
        `Baseline: ${options.refs.baseline} (${baselineCommit})`,
        `Candidate: ${options.refs.candidate} (${candidateCommit})`,
        `Replay: ${options.inputPath}`,
        `Replay speed: ${options.replaySpeed ?? 1}`,
        `SDK wait instrumentation: ${options.sdkWait}`,
        `Duration: ${options.durationSeconds}s; warmup: ${options.warmupSeconds}s`,
        `Order: ${options.order}; pairs: ${options.pairs}`,
        `Output: ${options.outputDirectory}`,
        `Native files changed: ${nativeChanged}`,
        `Dependency files changed: ${dependenciesChanged}`,
        `Changed files: ${files.length}`,
        ...files.slice(0, 20),
        ...(files.length > 20 ? [`... ${files.length - 20} more`] : []),
        ...(nativeChanged && !options.rebuildNative && !options.install
          ? ['WARNING: add --rebuild-native or --install before running.']
          : []),
        ...(dependenciesChanged && !options.install
          ? ['WARNING: dependency files differ; consider --install.']
          : []),
      ]
        .join('\n') + '\n'
    );
    return;
  }
  if (nativeChanged && !options.rebuildNative && !options.install)
    throw new Error(
      'The branches change native SDK files. Re-run with --rebuild-native or --install.'
    );
  if (dependenciesChanged && !options.install)
    process.stderr.write(
      'WARNING: dependency files differ between commits; consider --install.\n'
    );

  const worktreeRoot = await fs.mkdtemp(
    path.join(path.dirname(options.outputDirectory), 'irdashies-branches-')
  );
  const logDirectory = path.join(options.outputDirectory, 'logs');
  const prefix = path.basename(options.outputDirectory);
  const sides = new Map<SideLabel, BranchSideResult>();
  const temporaryWorktrees = new Set<string>();
  const runs: (BranchRun & { summary: PerfSummary })[] = [];

  try {
    const commitDirectories = new Map<string, string>();
    for (const label of ['baseline', 'candidate'] as const) {
      const ref = options.refs[label];
      const commit = label === 'baseline' ? baselineCommit : candidateCommit;
      const configuredDirectory =
        label === 'baseline' ? options.baselineDir : options.candidateDir;
      const sharedDirectory = commitDirectories.get(commit);
      const cached =
        options.reuse &&
        !options.rebuildNative &&
        !options.install &&
        !sharedDirectory
          ? await readCacheEntry(rootDirectory, commit, dependencyFingerprint)
          : undefined;
      const directory =
        configuredDirectory ??
        sharedDirectory ??
        cached?.directory ??
        (options.reuse
          ? path.join(cacheRootOf(rootDirectory), 'worktrees', commit)
          : path.join(worktreeRoot, label));
      if (!configuredDirectory && !sharedDirectory && !cached) {
        await fs.mkdir(path.dirname(directory), { recursive: true });
        gitValue(['worktree', 'add', '--detach', directory, commit], rootDirectory);
        temporaryWorktrees.add(directory);
        await prepareWorktree(
          directory,
          options,
          rootDirectory,
          nativeChanged,
          logDirectory,
          label
        );
        if (options.reuse) {
          await writeCacheEntry(rootDirectory, {
            commit,
            directory,
            createdAt: new Date().toISOString(),
            native: options.rebuildNative || nativeChanged,
            dependenciesInstalled: options.install,
            dependencyFingerprint,
          });
          temporaryWorktrees.delete(directory);
        }
      }
      commitDirectories.set(commit, directory);
      sides.set(label, {
        label,
        ref,
        commit,
        directory,
        generatedWorktree: !configuredDirectory && !cached && !sharedDirectory,
        logPath: '',
      });
      if (cached || sharedDirectory)
        process.stdout.write(`Reused worktree ${label}: ${directory}\n`);
      else if (options.keepWorktrees)
        process.stdout.write(`Worktree ${label}: ${directory}\n`);
    }

    let effectiveWidgets = options.widgets;
    if (options.coverageProbeSeconds > 0) {
      const candidate = sides.get('candidate');
      if (!candidate) throw new Error('Missing candidate checkout.');
      const probeOptions: BranchesOptions = {
        ...options,
        durationSeconds: options.coverageProbeSeconds,
        warmupSeconds: 0,
        allowInconclusive: true,
      };
      const probeLog = await captureSide(
        candidate,
        probeOptions,
        path.join(toolDirectory, 'run.ts'),
        `${prefix}-coverage-probe`,
        logDirectory
      );
      await runTool(
        process.execPath,
        [
          '--disable-warning=MODULE_TYPELESS_PACKAGE_JSON',
          path.join(toolDirectory, 'analyze.ts'),
          probeLog,
          '--warmup-seconds',
          '0',
          '--allow-inconclusive',
        ],
        rootDirectory,
        path.join(logDirectory, 'coverage-probe.analyze.log')
      );
      const probeSummary = await readRunSummary(probeLog, probeOptions);
      const covered = Object.entries(probeSummary.widgetInputs)
        .filter(([, coverage]) => coverage.covered)
        .map(([widget]) => widget);
      if (covered.length > 0) {
        effectiveWidgets = covered.join(',');
        process.stdout.write(`Coverage probe selected widgets: ${effectiveWidgets}\n`);
      } else {
        process.stderr.write(
          'Coverage probe found no fully covered widgets; using the saved dashboard.\n'
        );
      }
    }
    const effectiveOptions: BranchesOptions = {
      ...options,
      widgets: effectiveWidgets,
    };

    const schedule: BranchRun[] = [];
    for (let cycle = 0; cycle < options.pairs; cycle++) {
      if (options.order === 'abba') {
        schedule.push(
          { label: 'baseline', cycle, position: 1, runId: '', logPath: '' },
          { label: 'candidate', cycle, position: 2, runId: '', logPath: '' },
          { label: 'candidate', cycle, position: 3, runId: '', logPath: '' },
          { label: 'baseline', cycle, position: 4, runId: '', logPath: '' }
        );
      } else {
        schedule.push(
          { label: 'baseline', cycle, position: 1, runId: '', logPath: '' },
          { label: 'candidate', cycle, position: 2, runId: '', logPath: '' }
        );
      }
    }
    for (const entry of schedule) {
      const side = sides.get(entry.label);
      if (!side) throw new Error(`Missing ${entry.label} checkout.`);
      const runId = `${prefix}-${entry.label}-c${entry.cycle + 1}p${entry.position}`;
      const logPath = await captureSide(
        side,
        effectiveOptions,
        path.join(toolDirectory, 'run.ts'),
        runId,
        logDirectory
      );
      runs.push({
        ...entry,
        runId,
        logPath,
        summary: await readRunSummary(logPath, effectiveOptions),
      });
      process.stdout.write(`Captured ${entry.label} (${runId}): ${logPath}\n`);
    }

    const { aggregate, checks, inconclusiveRunIds } = evaluateBranchRuns(
      runs,
      options.ignoreGates
    );
    const baselineRun = runs.find((run) => run.label === 'baseline');
    const candidateRun = runs.find((run) => run.label === 'candidate');
    if (!baselineRun || !candidateRun)
      throw new Error('Both baseline and candidate captures are required.');
    const analyzeArgs = [
      candidateRun.logPath,
      '--baseline',
      baselineRun.logPath,
      '--warmup-seconds',
      String(options.warmupSeconds),
      '--analysis-start-seconds',
      String(options.warmupSeconds),
      '--analysis-end-seconds',
      String(options.durationSeconds),
      '--allow-inconclusive',
    ];
    if (options.ignoreGates.length > 0)
      analyzeArgs.push('--ignore-gates', options.ignoreGates.join(','));
    await runTool(
      process.execPath,
      [
        '--disable-warning=MODULE_TYPELESS_PACKAGE_JSON',
        path.join(toolDirectory, 'analyze.ts'),
        ...analyzeArgs,
      ],
      rootDirectory,
      path.join(logDirectory, 'analyze.log')
    );
    const summaryPath = candidateRun.logPath.replace(/\.[^.]+$/, '.summary.json');
    await runTool(
      process.execPath,
      [
        '--disable-warning=MODULE_TYPELESS_PACKAGE_JSON',
        path.join(toolDirectory, 'cli.ts'),
        'diagnose',
        summaryPath,
        '--output',
        path.join(options.outputDirectory, 'diagnosis'),
      ],
      rootDirectory,
      path.join(logDirectory, 'diagnose.log')
    );
    const baseline = sides.get('baseline');
    const candidate = sides.get('candidate');
    if (!baseline || !candidate)
      throw new Error('Missing branch side information.');
    const report: BranchesReport = {
      options,
      baseline,
      candidate,
      aggregate,
      effectiveWidgets,
      pr: prInfo,
      changedFiles: files,
      nativeChanged,
      dependenciesChanged,
      comparisonPath: summaryPath.replace(/\.json$/, '.md'),
      diagnosisPath: path.join(options.outputDirectory, 'diagnosis.md'),
      conclusive:
        inconclusiveRunIds.length === 0 && checks.every(comparisonCheckSatisfied),
      inconclusiveRunIds,
    };
    const reportPath = await writeBranchReport(report, { checks });
    process.stdout.write(`Branch report: ${reportPath}\n`);
    process.stdout.write(`Verdict: ${aggregate.verdict}\n`);
    if (inconclusiveRunIds.length > 0 && !options.allowInconclusive) {
      throw new Error(
        `Performance evidence is inconclusive for: ${inconclusiveRunIds.join(', ')}`
      );
    }
  } finally {
    if (!options.keepWorktrees) {
      for (const directory of temporaryWorktrees) {
        try {
          await gitValue(
            ['worktree', 'remove', '--force', directory],
            rootDirectory
          );
        } catch {
          process.stderr.write(`Could not remove worktree: ${directory}\n`);
        }
      }
    }
    await fs.rmdir(worktreeRoot).catch(() => undefined);
  }
};

const invokedDirectly =
  process.argv[1] !== undefined &&
  import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (invokedDirectly) {
  const args = process.argv.slice(2);
  if (!args.length || args.includes('--help') || args.includes('-h')) {
    process.stdout.write(BRANCHES_USAGE);
  } else {
    await runBranchesCli(args);
  }
}
