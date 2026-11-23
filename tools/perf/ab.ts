import { spawn } from 'node:child_process';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  listArgument,
  numericArgument,
  parseArguments,
  safeName,
} from './args.ts';
import {
  comparisonCheckSatisfied,
  comparisonCheckStatus,
  contrastDescription,
  parseComparisonContrast,
  type ComparisonContrast,
} from './gates.ts';

const DEFAULT_DURATION_SECONDS = 420;
const DEFAULT_WARMUP_SECONDS = 60;
const DEFAULT_SCENARIOS = ['observer', 'empty', 'full'] as const;
const BASE_MODES = ['observer', 'empty', 'full'] as const;

export const AB_USAGE = `Usage: npm run perf:ab [options]
  --input <file>              Required .irdt recording to replay
  --duration-seconds N        Capture length per scenario (default ${DEFAULT_DURATION_SECONDS})
  --warmup-seconds N          Ignored startup window (default ${DEFAULT_WARMUP_SECONDS})
  --scenarios a,b,c           observer|empty|full or widget types, e.g. observer,full,map
  --profile <directory>       Seed profile copied for every scenario
  --output <directory>        Result directory (default perf-results/ab-<timestamp>)
  --contrast overlay,widgets  Override the declared intentional A/B difference
  --allow-inconclusive        Keep going when analyzer evidence is incomplete
  --ignore-gates a,b          Skip selected gate names explicitly
`;

export type AbOverlayMode = (typeof BASE_MODES)[number];

export interface AbScenarioSpec {
  name: string;
  mode: AbOverlayMode;
  widgets?: string;
}

export interface AbOptions {
  inputPath: string;
  durationSeconds: number;
  warmupSeconds: number;
  scenarios: string[];
  scenarioSpecs: AbScenarioSpec[];
  contrast?: ComparisonContrast;
  allowInconclusive: boolean;
  ignoreGates: string[];
  seedProfile?: string;
  outputDirectory: string;
}

const scenarioNamePattern = /^[a-z0-9][a-z0-9-]*$/i;

export function parseScenarioSpecs(names: readonly string[]): AbScenarioSpec[] {
  return names.map((raw) => {
    const name = raw.trim();
    if ((BASE_MODES as readonly string[]).includes(name))
      return { name, mode: name as AbOverlayMode };
    const widgets = name.startsWith('widgets:') ? name.slice(8) : name;
    if (!scenarioNamePattern.test(widgets))
      throw new Error(`Invalid scenario: ${raw}\n${AB_USAGE}`);
    return { name: widgets, mode: 'full', widgets };
  });
}

export function contrastBetween(
  previous: AbScenarioSpec | undefined,
  current: AbScenarioSpec
): ComparisonContrast {
  if (!previous) return [];
  const contrasts: string[] = [];
  if (previous.mode !== current.mode) contrasts.push('overlay');
  if ((previous.widgets ?? '') !== (current.widgets ?? ''))
    contrasts.push('widgets');
  return parseComparisonContrast(contrasts);
}

export function parseAbOptions(args: string[]): AbOptions {
  const parsed = parseArguments(args, {
    usage: AB_USAGE,
    values: [
      '--input',
      '--duration-seconds',
      '--warmup-seconds',
      '--scenarios',
      '--profile',
      '--output',
      '--contrast',
      '--ignore-gates',
    ],
    booleans: ['--allow-inconclusive'],
  });
  const inputPath = parsed.value('--input');
  if (!inputPath) throw new Error(`--input is required\n${AB_USAGE}`);
  const durationSeconds = numericArgument(
    parsed,
    '--duration-seconds',
    DEFAULT_DURATION_SECONDS,
    { min: 30 }
  );
  const warmupSeconds = numericArgument(
    parsed,
    '--warmup-seconds',
    DEFAULT_WARMUP_SECONDS,
    { min: 0, integer: true }
  );
  if (warmupSeconds >= durationSeconds)
    throw new Error(`Invalid A/B option\n${AB_USAGE}`);
  const scenarios = parsed.value('--scenarios') ?? DEFAULT_SCENARIOS.join(',');
  const scenarioNames = scenarios
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
  if (scenarioNames.length < 2)
    throw new Error(`At least two scenarios are required\n${AB_USAGE}`);
  const scenarioSpecs = parseScenarioSpecs(scenarioNames);
  const seedProfile = parsed.value('--profile');
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  return {
    inputPath: path.resolve(inputPath),
    durationSeconds,
    warmupSeconds,
    scenarios: scenarioNames,
    scenarioSpecs,
    contrast: parsed.has('--contrast')
      ? parseComparisonContrast(
          (parsed.value('--contrast') ?? '').split(',').map((item) => item.trim())
        )
      : undefined,
    allowInconclusive: parsed.flag('--allow-inconclusive'),
    ignoreGates: listArgument(parsed, '--ignore-gates'),
    seedProfile: seedProfile ? path.resolve(seedProfile) : undefined,
    outputDirectory: path.resolve(
      parsed.value('--output') ??
        path.join('perf-results', `ab-${timestamp}`)
    ),
  };
}

interface ToolResult {
  exitCode: number | null;
  stdout: string;
  stderr: string;
}

const runTool = async (
  script: string,
  args: string[],
  logPath: string
): Promise<ToolResult> => {
  const child = spawn(
    process.execPath,
    [
      '--disable-warning=MODULE_TYPELESS_PACKAGE_JSON',
      path.resolve(script),
      ...args,
    ],
    { cwd: process.cwd(), stdio: ['ignore', 'pipe', 'pipe'] }
  );
  let stdout = '';
  let stderr = '';
  child.stdout?.on('data', (chunk: Buffer) => {
    stdout += chunk.toString();
  });
  child.stderr?.on('data', (chunk: Buffer) => {
    stderr += chunk.toString();
  });
  const exitCode = await new Promise<number | null>((resolve) =>
    child.once('close', resolve)
  );
  await fs.writeFile(logPath, `${stdout}\n${stderr}`, 'utf8');
  return { exitCode, stdout, stderr };
};

interface ComparisonJson {
  delta: Record<string, number>;
  checks: { name: string; passed: boolean | null; actual: number; target: string }[];
}

const deltaUnit = (key: string): string => {
  if (key === 'appCpuPercent') return 'pp';
  if (key.endsWith('Percent')) return '%';
  if (key.endsWith('Ms')) return 'ms';
  if (key.endsWith('Hz')) return 'Hz';
  if (key.endsWith('MB')) return 'MB';
  return '';
};

const deltaLabel = (key: string): string =>
  key
    .replace(/(Percent|Ms|Hz|MB)$/, '')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/^./, (character) => character.toUpperCase());

const deltaSections = (comparison: ComparisonJson): string[] => {
  const groups = new Map<string, { key: string; value: number }[]>();
  for (const [key, value] of Object.entries(comparison.delta)) {
    if (!Number.isFinite(value)) continue;
    const unit = deltaUnit(key);
    const rows = groups.get(unit) ?? [];
    rows.push({ key, value });
    groups.set(unit, rows);
  }
  return [...groups].map(([unit, rows]) => {
    const sorted = rows
      .sort((left, right) => Math.abs(right.value) - Math.abs(left.value))
      .map(
        ({ key, value }) =>
          `| ${deltaLabel(key)} | ${value >= 0 ? '+' : ''}${value.toFixed(3)} ${unit} |`
      )
      .join('\n');
    return `### Deltas (${unit || 'unitless'})\n\n| Metric | Delta |\n| --- | ---: |\n${sorted}`;
  });
};

const checkRows = (comparison: ComparisonJson): string[] =>
  comparison.checks.map(
    (check) =>
      `| ${check.name} | ${comparisonCheckStatus(check)} | ${Number.isFinite(check.actual) ? check.actual.toFixed(3) : 'n/a'} | ${check.target} |`
  );

const runAb = async (args: string[]): Promise<void> => {
  const options = parseAbOptions(args);
  await fs.access(options.inputPath);
  await fs.mkdir(options.outputDirectory, { recursive: true });
  const reportPath = path.join(options.outputDirectory, 'AB_REPORT.md');
  await fs.writeFile(reportPath, '# A/B performance report\n\n', 'utf8');
  const runPrefix = path.basename(options.outputDirectory);
  let previousSpec: AbScenarioSpec | undefined;
  let previousLog: string | undefined;

  for (const spec of options.scenarioSpecs) {
    const profile = path.join(options.outputDirectory, `profile-${spec.name}`);
    if (options.seedProfile) {
      await fs.cp(options.seedProfile, profile, { recursive: true });
    } else {
      await fs.mkdir(profile, { recursive: true });
    }
    const runId = safeName(`${runPrefix}-${spec.name}`);
    const runArguments = [
      '--mode',
      spec.mode,
      '--scenario',
      spec.name,
      '--duration-seconds',
      String(options.durationSeconds),
      '--run-id',
      runId,
      '--replay-input',
      options.inputPath,
      '--output-directory',
      options.outputDirectory,
      '--user-data-dir',
      profile,
    ];
    if (spec.widgets) runArguments.push('--widgets', spec.widgets);
    const capture = await runTool(
      'tools/perf/run.ts',
      runArguments,
      path.join(options.outputDirectory, `${spec.name}.run.log`)
    );
    if (capture.exitCode !== 0)
      throw new Error(`Scenario ${spec.name} failed: ${capture.stderr.slice(-1000)}`);

    const candidateLog = path.join(options.outputDirectory, `${runId}.log`);
    const analyzeArgs = [
      candidateLog,
      '--warmup-seconds',
      String(options.warmupSeconds),
      '--analysis-start-seconds',
      String(options.warmupSeconds),
      '--analysis-end-seconds',
      String(options.durationSeconds),
    ];
    const contrast = options.contrast ?? contrastBetween(previousSpec, spec);
    if (contrast.length > 0)
      analyzeArgs.push('--contrast', contrast.join(','));
    if (options.allowInconclusive)
      analyzeArgs.push('--allow-inconclusive');
    if (options.ignoreGates.length > 0)
      analyzeArgs.push('--ignore-gates', options.ignoreGates.join(','));
    if (previousLog) analyzeArgs.push('--baseline', previousLog);
    const analysis = await runTool(
      'tools/perf/analyze.ts',
      analyzeArgs,
      path.join(options.outputDirectory, `${spec.name}.analyze.log`)
    );
    if (analysis.exitCode !== 0)
      throw new Error(
        `Analysis of ${spec.name} failed: ${analysis.stderr.slice(-1000)}`
      );

    const summaryPath = path.resolve(
      candidateLog.replace(/\.[^.]+$/, '.summary.json')
    );
    const diagnosis = await runTool(
      'tools/perf/cli.ts',
      [
        'diagnose',
        summaryPath,
        '--output',
        path.join(options.outputDirectory, `${spec.name}.diagnosis`),
      ],
      path.join(options.outputDirectory, `${spec.name}.diagnose.log`)
    );
    if (diagnosis.exitCode !== 0)
      throw new Error(
        `Diagnosis of ${spec.name} failed: ${diagnosis.stderr.slice(-1000)}`
      );

    const reportLines = [`## ${spec.name}`, ''];
    reportLines.push(
      `- Mode: ${spec.mode}${spec.widgets ? `, widgets: ${spec.widgets}` : ''}`,
      `- Declared contrast: ${contrastDescription(contrast)}`
    );
    if (previousLog) {
      const comparison = JSON.parse(
        await fs.readFile(summaryPath, 'utf8')
      ) as ComparisonJson;
      const conclusive = comparison.checks.every(comparisonCheckSatisfied);
      reportLines.push(
        `- Evidence: **${conclusive ? 'CONCLUSIVE' : 'INCONCLUSIVE'}**`,
        ''
      );
      if (!conclusive)
        reportLines.push(
          '> One or more checks are inconclusive or failed; deltas below are investigation leads only.',
          ''
        );
      reportLines.push(...deltaSections(comparison), '');
      reportLines.push(
        '### Gates',
        '',
        '| Check | Status | Actual | Target |',
        '| --- | --- | ---: | --- |',
        ...checkRows(comparison),
        ''
      );
    } else {
      reportLines.push('Baseline scenario; no delta.', '');
    }
    await fs.appendFile(reportPath, reportLines.join('\n'), 'utf8');
    process.stdout.write(`Completed ${spec.name}\n`);
    previousSpec = spec;
    previousLog = candidateLog;
  }
  process.stdout.write(`A/B report: ${reportPath}\n`);
};

const invokedDirectly =
  process.argv[1] !== undefined &&
  import.meta.url === pathToFileURL(process.argv[1]).href;
if (invokedDirectly) {
  const args = process.argv.slice(2);
  if (!args.length || args.includes('--help') || args.includes('-h')) {
    process.stdout.write(AB_USAGE);
  } else {
    await runAb(args);
  }
}
