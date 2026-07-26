import { spawn } from 'node:child_process';
import { execFileSync } from 'node:child_process';
import { createWriteStream, promises as fs } from 'node:fs';
import path from 'node:path';

const PERF_REPLAY_READY_LOG_MARKER = '[PerfRun] Ready for replay publisher';
const REPLAY_STARTUP_TIMEOUT_MS = 30_000;

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
  replayInput: string;
}

function argumentValue(args: string[], name: string): string | undefined {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
}

function safeName(value: string): string {
  return value.replace(/[^a-z0-9_-]+/gi, '-').replace(/^-+|-+$/g, '');
}

function parseArgs(args: string[]): RunOptions {
  const requestedMode = argumentValue(args, '--mode');
  const mode: OverlayMode =
    requestedMode === 'observer' ||
    requestedMode === 'empty' ||
    requestedMode === 'full'
      ? requestedMode
      : 'full';
  const target: RunTarget =
    argumentValue(args, '--target') === 'packaged' ? 'packaged' : 'dev';
  const widgets = argumentValue(args, '--widgets') ?? '';
  const defaultScenario = widgets ? `widgets-${safeName(widgets)}` : mode;
  const scenario = safeName(
    argumentValue(args, '--scenario') ?? defaultScenario
  );
  const interval = Number(argumentValue(args, '--interval-ms') ?? 5000);
  const duration = Number(argumentValue(args, '--duration-seconds') ?? 0);
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');

  return {
    scenario,
    mode,
    target,
    widgets,
    intervalMs: Number.isFinite(interval) && interval >= 1000 ? interval : 5000,
    durationSeconds: Number.isFinite(duration) && duration >= 10 ? duration : 0,
    runId: safeName(
      argumentValue(args, '--run-id') ?? `${timestamp}-${scenario}`
    ),
    telemetryDelivery:
      argumentValue(args, '--telemetry-delivery') === 'off' ? 'off' : 'on',
    telemetryPayload:
      argumentValue(args, '--telemetry-payload') === 'raw'
        ? 'raw'
        : 'allowlisted',
    replayInput: argumentValue(args, '--replay-input') ?? '',
  };
}

const options = parseArgs(process.argv.slice(2));
const outputDirectory = path.resolve('perf-results');
await fs.mkdir(outputDirectory, { recursive: true });
const logPath = path.join(outputDirectory, `${options.runId}.log`);
const consoleLogPath = path.join(
  outputDirectory,
  `${options.runId}.console.log`
);
const replayInputPath = options.replayInput
  ? path.resolve(options.replayInput)
  : '';
if (replayInputPath) {
  await fs.access(replayInputPath);
}
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
      ? ['/d', '/s', '/c', 'npm.cmd start']
      : ['start'];
}
let build = 'unknown';
try {
  build = execFileSync('git', ['rev-parse', '--short', 'HEAD'], {
    encoding: 'utf8',
  }).trim();
} catch {
  // A build identifier is useful but not required for a local run.
}

process.stdout.write(
  [
    `Performance run: ${options.runId}`,
    `Scenario: ${options.scenario}`,
    `Overlay mode: ${options.mode}`,
    `Target: ${options.target}`,
    `Telemetry delivery: ${options.telemetryDelivery}`,
    `Telemetry payload: ${options.telemetryPayload}`,
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
    PERF_WIDGET_TYPES: options.widgets,
    PERF_REPORT_INTERVAL_MS: String(options.intervalMs),
    PERF_DURATION_SECONDS: String(options.durationSeconds),
    PERF_BUILD: build,
    PERF_LOG_PATH: logPath,
    PERF_TELEMETRY_DELIVERY: options.telemetryDelivery,
    PERF_TELEMETRY_PAYLOAD: options.telemetryPayload,
    IRDASHIES_IRSDK_REPLAY: replayInputPath
      ? '1'
      : process.env.IRDASHIES_IRSDK_REPLAY,
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
  if (!replayInputPath || replayPublisher) return;
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
  if (!replayInputPath || replayPublisher) return;
  startupOutput = `${startupOutput}${chunk.toString('utf8')}`.slice(-2048);
  if (startupOutput.includes(PERF_REPLAY_READY_LOG_MARKER)) {
    startReplayPublisher();
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
if (replayInputPath && !replayPublisher && !fatalError) {
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
