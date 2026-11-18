import { spawn } from 'node:child_process';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const DEFAULT_DURATION_SECONDS = 420;
const DEFAULT_WARMUP_SECONDS = 60;
const DEFAULT_SCENARIOS = ['observer', 'empty', 'full'] as const;

export const AB_USAGE = `Usage: npm run perf:ab [options]
  --input <file>              Required .irdt recording to replay
  --duration-seconds N        Capture length per scenario (default ${DEFAULT_DURATION_SECONDS})
  --warmup-seconds N          Ignored startup window (default ${DEFAULT_WARMUP_SECONDS})
  --scenarios a,b,c           Scenarios to run (default ${DEFAULT_SCENARIOS.join(',')})
  --profile <directory>       Seed profile copied for every scenario
  --output <directory>        Result directory (default perf-results/ab-<timestamp>)
`;

export interface AbOptions {
  inputPath: string;
  durationSeconds: number;
  warmupSeconds: number;
  scenarios: string[];
  seedProfile?: string;
  outputDirectory: string;
}

const valueAfter = (args: string[], flag: string): string | undefined => {
  const index = args.indexOf(flag);
  return index >= 0 ? args[index + 1] : undefined;
};

export const parseAbOptions = (args: string[]): AbOptions => {
  const inputPath = valueAfter(args, '--input');
  if (!inputPath) throw new Error(`--input is required\n${AB_USAGE}`);
  const durationSeconds = Number(
    valueAfter(args, '--duration-seconds') ?? DEFAULT_DURATION_SECONDS
  );
  const warmupSeconds = Number(
    valueAfter(args, '--warmup-seconds') ?? DEFAULT_WARMUP_SECONDS
  );
  if (
    !Number.isFinite(durationSeconds) ||
    durationSeconds < 30 ||
    !Number.isFinite(warmupSeconds) ||
    warmupSeconds < 0 ||
    warmupSeconds >= durationSeconds
  )
    throw new Error(`Invalid A/B option\n${AB_USAGE}`);
  const seedProfile = valueAfter(args, '--profile');
  const scenarios = (
    valueAfter(args, '--scenarios') ?? DEFAULT_SCENARIOS.join(',')
  )
    .split(',')
    .map((value) => value.trim())
    .filter((value) => /^[a-z0-9-]+$/.test(value));
  if (scenarios.length < 2) throw new Error(`At least two scenarios are required\n${AB_USAGE}`);
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  return {
    inputPath: path.resolve(inputPath),
    durationSeconds,
    warmupSeconds,
    scenarios,
    seedProfile: seedProfile ? path.resolve(seedProfile) : undefined,
    outputDirectory: path.resolve(
      valueAfter(args, '--output') ??
        path.join('perf-results', `ab-${timestamp}`)
    ),
  };
};

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

const deltaRows = (comparison: {
  delta: Record<string, number>;
}): string[] =>
  Object.entries(comparison.delta)
    .filter(([, value]) => Number.isFinite(value))
    .sort((left, right) => Math.abs(right[1]) - Math.abs(left[1]))
    .slice(0, 15)
    .map(([name, value]) => `| ${name} | ${value.toFixed(3)} |`);

const runAb = async (args: string[]): Promise<void> => {
  const options = parseAbOptions(args);
  await fs.access(options.inputPath);
  await fs.mkdir(options.outputDirectory, { recursive: true });
  const runPrefix = path.basename(options.outputDirectory);
  let previousLog: string | undefined;

  for (const scenario of options.scenarios) {
    const profile = path.join(options.outputDirectory, `profile-${scenario}`);
    if (options.seedProfile) {
      await fs.cp(options.seedProfile, profile, { recursive: true });
    } else {
      await fs.mkdir(profile, { recursive: true });
    }
    const runId = `${runPrefix}-${scenario}`;
    const capture = await runTool(
      'tools/perf/run.ts',
      [
        '--mode',
        scenario,
        '--scenario',
        scenario,
        '--duration-seconds',
        String(options.durationSeconds),
        '--run-id',
        runId,
        '--replay-input',
        options.inputPath,
        '--user-data-dir',
        profile,
      ],
      path.join(options.outputDirectory, `${scenario}.run.log`)
    );
    if (capture.exitCode !== 0)
      throw new Error(`Scenario ${scenario} failed: ${capture.stderr.slice(-1000)}`);

    const candidateLog = path.join('perf-results', `${runId}.log`);
    const analyzeArgs = [
      candidateLog,
      '--warmup-seconds',
      String(options.warmupSeconds),
      '--analysis-start-seconds',
      String(options.warmupSeconds),
      '--analysis-end-seconds',
      String(options.durationSeconds),
      '--allow-inconclusive',
    ];
    if (previousLog) analyzeArgs.push('--baseline', previousLog);
    const analysis = await runTool(
      'tools/perf/analyze.ts',
      analyzeArgs,
      path.join(options.outputDirectory, `${scenario}.analyze.log`)
    );
    if (analysis.exitCode !== 0)
      throw new Error(`Analysis of ${scenario} failed: ${analysis.stderr.slice(-1000)}`);

    const summaryPath = path.resolve(
      candidateLog.replace(/\.[^.]+$/, '.summary.json')
    );
    const diagnosis = await runTool(
      'tools/perf/cli.ts',
      [
        'diagnose',
        summaryPath,
        '--output',
        path.join(options.outputDirectory, `${scenario}.diagnosis`),
      ],
      path.join(options.outputDirectory, `${scenario}.diagnose.log`)
    );
    if (diagnosis.exitCode !== 0)
      throw new Error(`Diagnosis of ${scenario} failed: ${diagnosis.stderr.slice(-1000)}`);

    const reportLines = [`## ${scenario}`, ''];
    if (previousLog) {
      const comparison = JSON.parse(await fs.readFile(summaryPath, 'utf8')) as {
        delta: Record<string, number>;
      };
      reportLines.push('| Largest delta | Value |', '| --- | ---: |');
      reportLines.push(...deltaRows(comparison));
    } else {
      reportLines.push('Baseline scenario; no delta.');
    }
    reportLines.push('');
    await fs.appendFile(
      path.join(options.outputDirectory, 'AB_REPORT.md'),
      reportLines.join('\n'),
      'utf8'
    );
    process.stdout.write(`Completed ${scenario}\n`);
    previousLog = candidateLog;
  }
  process.stdout.write(`A/B report: ${path.join(options.outputDirectory, 'AB_REPORT.md')}\n`);
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
