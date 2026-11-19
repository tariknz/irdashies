import { spawn } from 'node:child_process';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { createReadStream, createWriteStream, promises as fs } from 'node:fs';
import path from 'node:path';
import { choiceArgument, numericArgument, parseArguments } from './args.ts';
import { collectHostFacts } from './hostFacts.ts';
import { readWidgetInputRequirements } from './widgetInputMetadata.ts';
import {
  PERF_REPLAY_READY_LOG_MARKER,
  parsePerfVisibilityPhases,
  perfRunSimulator,
  replayRunEnvironment,
  usesIsolatedReplayPublisher,
} from '../../src/app/perfRunConfig.ts';

const REPLAY_STARTUP_TIMEOUT_MS = 120_000;

export const PERF_RUN_USAGE = `Usage: npm run perf:run -- [options]
  --mode observer|empty|full       Overlay scenario (default full)
  --target dev|packaged            Build to benchmark (default dev)
  --scenario <name>                Scenario label
  --run-id <name>                  Structured log identifier
  --duration-seconds N             Fixed capture length; 0 waits for Ctrl+C
  --interval-ms N                  Sample interval (default 5000)
  --replay-input <file>            .irdt/.ibt recording to replay
  --replay-speed N                 Tape playback speed, 0.25–100
  --sdk-wait                       Record opt-in SDK wait metrics
  --widgets <a,b>                  Widget type filter
  --window-mode display|widget     Overlay window mode override
  --visibility-phases <schedule>   visible:120,hidden:120,visible:120
  --telemetry-delivery on|off      Raw Inspector stream
  --telemetry-payload allowlisted|raw
  --channel-delivery on|off        Typed channel snapshots
  --simulator-mode live|replay     Workload label
  --field-count / --class-count N  Workload metadata
  --display-geometry <WxH>         Workload metadata
  --fps-cap / --sync-mode          Workload metadata
  --user-data-dir <directory>      Isolated Electron profile
  --output-directory <directory>   Where structured logs are written
  --replay-visible-widgets         Keep widgets visible in replay
`;

type OverlayMode = 'full' | 'empty' | 'observer';
type RunTarget = 'dev' | 'packaged';

interface RunOptions {
  scenario: string;
  mode: OverlayMode;
  target: RunTarget;
  widgets: string;
  intervalMs: number;
  durationSeconds: number;
  runId: string;
  telemetryDelivery: 'on' | 'off';
  telemetryPayload: 'allowlisted' | 'raw';
  channelDelivery: 'on' | 'off';
  visibilityPhases: string;
  replayInput: string;
  replaySpeed?: number;
  sdkWait: boolean;
  outputDirectory?: string;
  windowMode?: 'display' | 'widget';
  replayVisibleWidgets: boolean;
  metadata: {
    target: RunTarget;
    simulatorMode: 'live' | 'replay';
    fieldCount?: number;
    classCount?: number;
    displayGeometry?: string;
    fpsCap?: number;
    syncMode?: string;
    replaySpeed?: number;
    sdkWait?: boolean;
    hostPlatform: string;
    hostArch: string;
    hostRelease: string;
    hostCpuModel: string;
    hostLogicalCores: number;
    hostTotalMemoryGB: number;
    hostDisplayServer: string;
    tapeSha256?: string;
    tapeBytes?: number;
  };
}

const fingerprintTape = async (
  filePath: string
): Promise<{ sha256: string; bytes: number }> => {
  const hash = createHash('sha256');
  const { size } = await fs.stat(filePath);
  await new Promise<void>((resolve, reject) => {
    const stream = createReadStream(filePath);
    stream.on('data', (chunk: Buffer) => hash.update(chunk));
    stream.once('end', resolve);
    stream.once('error', reject);
  });
  return { sha256: hash.digest('hex'), bytes: size };
};

function safeName(value: string): string {
  return value.replace(/[^a-z0-9_-]+/gi, '-').replace(/^-+|-+$/g, '');
}

/** Parse capture options, keeping replay metadata independent of tape input. */
function parseArgs(args: string[]): {
  options: RunOptions;
  userDataDirectory?: string;
} {
  const windowModeIndex = args.indexOf('--window-mode');
  const windowModeValue =
    windowModeIndex >= 0 ? args[windowModeIndex + 1] : undefined;
  if (
    windowModeIndex >= 0 &&
    (windowModeValue === undefined ||
      windowModeValue.startsWith('--') ||
      (windowModeValue !== 'display' && windowModeValue !== 'widget'))
  )
    throw new Error('--window-mode must be display or widget');

  const parsed = parseArguments(args, {
    usage: PERF_RUN_USAGE,
    values: [
      '--mode',
      '--target',
      '--widgets',
      '--scenario',
      '--interval-ms',
      '--duration-seconds',
      '--visibility-phases',
      '--replay-input',
      '--replay-speed',
      '--window-mode',
      '--run-id',
      '--telemetry-delivery',
      '--telemetry-payload',
      '--channel-delivery',
      '--simulator-mode',
      '--field-count',
      '--class-count',
      '--display-geometry',
      '--fps-cap',
      '--sync-mode',
      '--user-data-dir',
      '--output-directory',
    ],
    booleans: ['--replay-visible-widgets', '--sdk-wait'],
  });
  const mode = choiceArgument(
    parsed,
    '--mode',
    ['observer', 'empty', 'full'] as const,
    'full'
  );
  const target = choiceArgument(
    parsed,
    '--target',
    ['dev', 'packaged'] as const,
    'dev'
  );
  const telemetryDelivery = choiceArgument(
    parsed,
    '--telemetry-delivery',
    ['on', 'off'] as const,
    'on'
  );
  const telemetryPayload = choiceArgument(
    parsed,
    '--telemetry-payload',
    ['allowlisted', 'raw'] as const,
    'allowlisted'
  );
  const channelDelivery = choiceArgument(
    parsed,
    '--channel-delivery',
    ['on', 'off'] as const,
    'on'
  );
  const simulatorMode = choiceArgument(
    parsed,
    '--simulator-mode',
    ['live', 'replay'] as const,
    'live'
  );
  const widgets = parsed.value('--widgets') ?? '';
  const defaultScenario = widgets ? `widgets-${safeName(widgets)}` : mode;
  const scenario = safeName(parsed.value('--scenario') ?? defaultScenario);
  if (!scenario) throw new Error('--scenario must contain usable characters.');
  const intervalMs = numericArgument(parsed, '--interval-ms', 5000, {
    min: 1000,
    integer: true,
  });
  const durationSeconds = numericArgument(
    parsed,
    '--duration-seconds',
    0,
    { min: 0 }
  );
  if (durationSeconds > 0 && durationSeconds < 10)
    throw new Error('--duration-seconds must be 0 or at least 10.');
  const visibilityPhases = parsed.value('--visibility-phases') ?? '';
  const phaseDuration = parsePerfVisibilityPhases(visibilityPhases).reduce(
    (sum, phase) => sum + phase.durationSeconds,
    0
  );
  const effectiveDuration =
    durationSeconds > 0
      ? durationSeconds
      : phaseDuration >= 10
        ? phaseDuration
        : 0;
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const runId = safeName(
    parsed.value('--run-id') ?? `${timestamp}-${scenario}`
  );
  if (!runId) throw new Error('--run-id must contain usable characters.');
  const replayInput = parsed.value('--replay-input') ?? '';
  const replaySpeed = parsed.has('--replay-speed')
    ? numericArgument(parsed, '--replay-speed', 1, { min: 0.25, max: 100 })
    : undefined;
  const requestedWindowMode = parsed.value('--window-mode');
  const windowMode =
    requestedWindowMode === 'display' || requestedWindowMode === 'widget'
      ? requestedWindowMode
      : undefined;
  const optionalNumber = (flag: string): number | undefined =>
    parsed.has(flag)
      ? numericArgument(parsed, flag, 0, { min: 0 })
      : undefined;

  return {
    userDataDirectory: parsed.value('--user-data-dir'),
    options: {
      scenario,
      mode,
      target,
      widgets,
      intervalMs,
      durationSeconds: effectiveDuration,
      runId,
      telemetryDelivery,
      telemetryPayload,
      channelDelivery,
      visibilityPhases,
      replayInput,
      replaySpeed,
      sdkWait: parsed.flag('--sdk-wait'),
      outputDirectory: parsed.value('--output-directory')
        ? path.resolve(parsed.value('--output-directory') as string)
        : undefined,
      windowMode,
      replayVisibleWidgets: parsed.flag('--replay-visible-widgets'),
      metadata: {
        target,
        simulatorMode: replayInput ? 'replay' : simulatorMode,
        fieldCount: optionalNumber('--field-count'),
        classCount: optionalNumber('--class-count'),
        displayGeometry: parsed.value('--display-geometry'),
        fpsCap: optionalNumber('--fps-cap'),
        syncMode: parsed.value('--sync-mode'),
        replaySpeed,
        sdkWait: parsed.flag('--sdk-wait'),
        ...collectHostFacts(),
      },
    },
  };
}

const rawArgs = process.argv.slice(2);
if (rawArgs.includes('--help') || rawArgs.includes('-h')) {
  process.stdout.write(PERF_RUN_USAGE);
  process.exit(0);
}
let parsedRun: ReturnType<typeof parseArgs>;
try {
  parsedRun = parseArgs(rawArgs);
} catch (error) {
  process.stderr.write(
    `${error instanceof Error ? error.message : String(error)}\n`
  );
  process.exit(1);
}
const options = parsedRun.options;
const userDataDirectory = parsedRun.userDataDirectory;
if (
  userDataDirectory &&
  /[\s"&|<>^%!\r\n]/.test(path.resolve(userDataDirectory))
) {
  throw new Error(
    '--user-data-dir requires a path without shell metacharacters or spaces.'
  );
}
const widgetInputRequirements = await readWidgetInputRequirements();
const outputDirectory = options.outputDirectory ?? path.resolve('perf-results');
await fs.mkdir(outputDirectory, { recursive: true });
const logPath = path.join(outputDirectory, `${options.runId}.log`);
const consoleLogPath = path.join(
  outputDirectory,
  `${options.runId}.console.log`
);
if (
  (await fs.access(logPath).then(() => true, () => false)) ||
  (await fs.access(consoleLogPath).then(() => true, () => false))
)
  throw new Error(
    `Run ${options.runId} already has output files; choose another --run-id.`
  );
const replayInputPath = options.replayInput
  ? path.resolve(options.replayInput)
  : '';
if (replayInputPath) {
  await fs.access(replayInputPath);
}
const tapeFingerprint = replayInputPath
  ? await fingerprintTape(replayInputPath)
  : undefined;
const useIsolatedReplayPublisher = usesIsolatedReplayPublisher(
  replayInputPath,
  process.platform
);
const output = createWriteStream(consoleLogPath, { encoding: 'utf8' });
let childCommand: string;
let childArguments: string[];
if (options.target === 'packaged') {
  if (process.platform !== 'win32') {
    throw new Error('The packaged benchmark target is currently Windows-only.');
  }
  childCommand = path.resolve('out/irdashies-win32-x64/irdashies.exe');
  try {
    await fs.access(childCommand);
  } catch {
    throw new Error(
      `Packaged app not found at ${childCommand}. Run "npm run package" first.`
    );
  }
  childArguments = [];
} else {
  childCommand =
    process.platform === 'win32'
      ? (process.env.ComSpec ?? 'C:\\Windows\\System32\\cmd.exe')
      : 'npm';
  childArguments =
    process.platform === 'win32'
      ? [
          '/d',
          '/s',
          '/c',
          userDataDirectory
            ? `npm.cmd start -- -- --user-data-dir=${path.resolve(userDataDirectory)}`
            : 'npm.cmd start',
        ]
      : [
          'start',
          ...(userDataDirectory
            ? ['--', '--', `--user-data-dir=${path.resolve(userDataDirectory)}`]
            : []),
        ];
}
if (options.target === 'packaged' && userDataDirectory) {
  childArguments.push(`--user-data-dir=${path.resolve(userDataDirectory)}`);
}
const gitValue = (args: string[]): string | undefined => {
  try {
    return execFileSync('git', args, { encoding: 'utf8' }).trim();
  } catch {
    return undefined;
  }
};
const sourceCommit = gitValue(['rev-parse', 'HEAD']) ?? 'unknown';
const gitStatus = gitValue(['status', '--porcelain']);
const sourceDirty = gitStatus === undefined ? null : gitStatus.length > 0;
const build = sourceCommit === 'unknown' ? 'unknown' : sourceCommit.slice(0, 8);

process.stdout.write(
  [
    `Performance run: ${options.runId}`,
    `Scenario: ${options.scenario}`,
    `Overlay mode: ${options.mode}`,
    `Target: ${options.target}`,
    `Source: ${sourceCommit} (${sourceDirty === null ? 'worktree state unknown' : sourceDirty ? 'dirty worktree' : 'clean worktree'})`,
    `Window mode: ${options.windowMode ?? 'saved profile setting'}`,
    `Effective options: ${JSON.stringify({
      intervalMs: options.intervalMs,
      simulatorMode: options.metadata.simulatorMode,
      fieldCount: options.metadata.fieldCount,
      classCount: options.metadata.classCount,
      displayGeometry: options.metadata.displayGeometry,
      fpsCap: options.metadata.fpsCap,
      syncMode: options.metadata.syncMode,
      replaySpeed: options.replaySpeed,
      sdkWait: options.sdkWait,
      hostCpuModel: options.metadata.hostCpuModel,
      hostTotalMemoryGB: options.metadata.hostTotalMemoryGB,
    })}`,
    `Replay widget visibility override: ${options.replayVisibleWidgets}`,
    `Telemetry delivery: ${options.telemetryDelivery}`,
    `Telemetry payload: ${options.telemetryPayload}`,
    `Channel delivery: ${options.channelDelivery}`,
    options.visibilityPhases
      ? `Visibility phases: ${options.visibilityPhases}`
      : '',
    replayInputPath ? `Replay: ${replayInputPath}` : '',
    options.widgets ? `Widgets: ${options.widgets}` : '',
    options.durationSeconds > 0
      ? `Duration: ${options.durationSeconds}s`
      : 'Duration: until Ctrl+C',
    `Structured log: ${logPath}`,
    `Console log: ${consoleLogPath}`,
    'Stop the run with Ctrl+C after the measured segment.',
  ]
    .filter(Boolean)
    .join('\n') + '\n'
);

const simulator = perfRunSimulator(
  process.env.IRDASHIES_SIM,
  Boolean(replayInputPath)
);
if (simulator.overridden) {
  process.stdout.write(
    `IRDASHIES_SIM=${simulator.overridden} ignored: replay runs need the iRacing bridge\n`
  );
}

const child = spawn(childCommand, childArguments, {
  cwd: process.cwd(),
  env: {
    ...process.env,
    NODE_OPTIONS: '',
    VSCODE_INSPECTOR_OPTIONS: '',
    PERF_METRICS: '1',
    PERF_RUN_ID: options.runId,
    PERF_SCENARIO: options.scenario,
    PERF_OVERLAY_MODE: options.mode,
    PERF_WINDOW_MODE: options.windowMode ?? '',
    PERF_REPLAY_VISIBLE_WIDGETS: options.replayVisibleWidgets ? '1' : '0',
    PERF_WIDGET_TYPES: options.widgets,
    PERF_FORCE_PROCESSOR_DEMAND:
      options.mode === 'full'
        ? process.env.PERF_FORCE_PROCESSOR_DEMAND ?? '1'
        : process.env.PERF_FORCE_PROCESSOR_DEMAND,
    PERF_REPORT_INTERVAL_MS: String(options.intervalMs),
    PERF_DURATION_SECONDS: String(options.durationSeconds),
    PERF_BUILD: build,
    PERF_LOG_PATH: logPath,
    PERF_TELEMETRY_DELIVERY: options.telemetryDelivery,
    PERF_TELEMETRY_PAYLOAD: options.telemetryPayload,
    PERF_CHANNEL_DELIVERY: options.channelDelivery,
    PERF_VISIBILITY_PHASES: options.visibilityPhases,
    PERF_SCENARIO_METADATA: JSON.stringify({
      ...options.metadata,
      requestedWidgetTypes: options.widgets
        .split(',')
        .map((widget) => widget.trim())
        .filter(Boolean),
      channelDelivery: options.channelDelivery,
      telemetryDelivery: options.telemetryDelivery,
      telemetryPayload: options.telemetryPayload,
      replayVisibleWidgets: options.replayVisibleWidgets,
      tapeSha256: tapeFingerprint?.sha256,
      tapeBytes: tapeFingerprint?.bytes,
      sourceCommit,
      sourceDirty,
      widgetInputRequirements,
    }),
    ...replayRunEnvironment(
      replayInputPath,
      process.platform,
      process.env
    ),
    ...(options.replaySpeed !== undefined
      ? { IRDASHIES_TELEMETRY_REPLAY_SPEED: String(options.replaySpeed) }
      : {}),
    ...(options.sdkWait ? { PERF_SDK_WAIT: '1' } : {}),
    IRDASHIES_SIM: simulator.simulator,
    ELECTRON_ENABLE_LOGGING: '1',
  },
  stdio: ['inherit', 'pipe', 'pipe'],
});
const childSpawnError = new Promise<Error>((resolve) => {
  child.once('error', resolve);
});

let stdoutAvailable = true;
let replayPublisher: ReturnType<typeof spawn> | undefined;
let startupOutput = '';
let fatalError: Error | undefined;
let stopping = false;
let replayStartupTimeout: NodeJS.Timeout | undefined;
process.stdout.on('error', (error: NodeJS.ErrnoException) => {
  if (error.code === 'EPIPE') {
    stdoutAvailable = false;
    return;
  }
  throw error;
});

const copyOutput = (chunk: Buffer): void => {
  if (stdoutAvailable) process.stdout.write(chunk);
  output.write(chunk);
};

const terminateProcessTree = (
  target: ReturnType<typeof spawn> | undefined
): void => {
  if (!target || target.exitCode !== null || !target.pid) return;
  if (process.platform === 'win32') {
    try {
      execFileSync('taskkill', ['/pid', String(target.pid), '/t', '/f'], {
        stdio: 'ignore',
      });
    } catch {
      // The process may have exited between the status check and taskkill.
    }
    return;
  }
  target.kill();
};

const stopChild = (): void => {
  if (stopping) return;
  stopping = true;
  if (replayStartupTimeout) clearTimeout(replayStartupTimeout);
  terminateProcessTree(replayPublisher);
  terminateProcessTree(child);
};

const failRun = (error: Error): void => {
  if (fatalError) return;
  fatalError = error;
  copyOutput(Buffer.from(`[PerfRun] Fatal error: ${error.message}\n`));
  stopChild();
};

const startReplayPublisher = (): void => {
  if (!useIsolatedReplayPublisher || replayPublisher) return;
  if (replayStartupTimeout) clearTimeout(replayStartupTimeout);
  const publisherPath = path.resolve('build/Release/irsdk_replay.exe');
  const publisher = spawn(
    publisherPath,
    ['play', '--input', replayInputPath, '--loop'],
    {
      cwd: process.cwd(),
      stdio: ['ignore', 'pipe', 'pipe'],
    }
  );
  replayPublisher = publisher;
  publisher.stdout?.on('data', copyOutput);
  publisher.stderr?.on('data', copyOutput);
  publisher.once('error', (error) => {
    failRun(new Error(`Replay publisher failed to start: ${error.message}`));
  });
  publisher.once('exit', (code, signal) => {
    if (!stopping && child.exitCode === null) {
      failRun(
        new Error(
          `Replay publisher exited unexpectedly (code ${code ?? 'none'}, signal ${signal ?? 'none'})`
        )
      );
    }
  });
};

const copyAppOutput = (chunk: Buffer): void => {
  copyOutput(chunk);
  if (!replayInputPath) return;
  startupOutput = `${startupOutput}${chunk.toString('utf8')}`.slice(-2048);
  if (!startupOutput.includes(PERF_REPLAY_READY_LOG_MARKER)) return;
  if (useIsolatedReplayPublisher) {
    startReplayPublisher();
  } else if (replayStartupTimeout) {
    clearTimeout(replayStartupTimeout);
    replayStartupTimeout = undefined;
  }
};

child.stdout.on('data', copyAppOutput);
child.stderr.on('data', copyAppOutput);

if (replayInputPath) {
  replayStartupTimeout = setTimeout(() => {
    failRun(
      new Error(
        `App did not emit replay readiness within ${REPLAY_STARTUP_TIMEOUT_MS / 1000}s`
      )
    );
  }, REPLAY_STARTUP_TIMEOUT_MS);
}

process.once('SIGINT', stopChild);
process.once('SIGTERM', stopChild);

const childExitCode = await Promise.race([
  new Promise<number>((resolve) => {
    child.once('exit', (code) => resolve(code ?? 0));
  }),
  childSpawnError.then((error) => {
    failRun(new Error(`App failed to start: ${error.message}`));
    return 1;
  }),
]);
if (replayStartupTimeout) clearTimeout(replayStartupTimeout);
if (useIsolatedReplayPublisher && !replayPublisher && !fatalError) {
  fatalError = new Error('App exited before emitting replay readiness');
}
if (replayPublisher?.exitCode === null) {
  stopping = true;
  terminateProcessTree(replayPublisher);
  await new Promise<void>((resolve) => {
    const timeout = setTimeout(resolve, 5000);
    replayPublisher?.once('exit', () => {
      clearTimeout(timeout);
      resolve();
    });
  });
}
await new Promise<void>((resolve, reject) => {
  output.end((error?: Error | null) => {
    if (error) reject(error);
    else resolve();
  });
});

if (fatalError) {
  process.stderr.write(`Performance run failed: ${fatalError.message}\n`);
  process.exitCode = 1;
} else {
  process.stdout.write(
    `Captured ${logPath}\nAnalyse with: npm run perf:analyze -- "${logPath}"\n`
  );
  process.exitCode = childExitCode;
}
