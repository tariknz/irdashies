import { spawn } from 'node:child_process';
import { promises as fs } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import WebSocket from 'ws';

const DEFAULT_PORT = 9222;
const DEFAULT_DURATION_SECONDS = 20;
const TRACE_CATEGORIES = [
  'devtools.timeline',
  'disabled-by-default-devtools.timeline.frame',
  'disabled-by-default-v8.gc',
  'disabled-by-default-v8.cpu_profiler',
  'v8',
  'v8.execute',
  'blink.user_timing',
  'toplevel',
  'cc',
  'gpu',
  'viz',
  'electron',
].join(',');

export const TRACE_USAGE = `Usage: npm run perf:trace [options]
  --input <file>              Required .irdt recording to replay
  --duration-seconds N        Trace window length (default ${DEFAULT_DURATION_SECONDS})
  --warmup-seconds N          Wait before recording (default 0)
  --output <file>             JSON trace file (default perf-results/<timestamp>.json)
  --port N                    Remote debugging port (default ${DEFAULT_PORT})
  --speed N                   Replay speed (default 1)
  --user-data-dir <directory> Isolated Electron profile
`;

export interface TraceOptions {
  inputPath: string;
  durationSeconds: number;
  warmupSeconds: number;
  outputPath: string;
  port: number;
  speed: number;
  userDataDirectory?: string;
}

const valueAfter = (args: string[], flag: string): string | undefined => {
  const index = args.indexOf(flag);
  return index >= 0 ? args[index + 1] : undefined;
};

export const parseTraceOptions = (args: string[]): TraceOptions => {
  const inputPath = valueAfter(args, '--input');
  if (!inputPath) throw new Error(`--input is required\n${TRACE_USAGE}`);
  const durationSeconds = Number(
    valueAfter(args, '--duration-seconds') ?? DEFAULT_DURATION_SECONDS
  );
  const warmupSeconds = Number(valueAfter(args, '--warmup-seconds') ?? 0);
  const port = Number(valueAfter(args, '--port') ?? DEFAULT_PORT);
  const speed = Number(valueAfter(args, '--speed') ?? 1);
  if (
    !Number.isSafeInteger(warmupSeconds) ||
    warmupSeconds < 0 ||
    !Number.isFinite(durationSeconds) ||
    durationSeconds < 5 ||
    !Number.isInteger(port) ||
    port < 1024 ||
    port > 65535 ||
    !Number.isFinite(speed) ||
    speed <= 0
  )
    throw new Error(`Invalid trace option\n${TRACE_USAGE}`);
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const requestedProfile = valueAfter(args, '--user-data-dir');
  return {
    inputPath: path.resolve(inputPath),
    durationSeconds,
    warmupSeconds,
    outputPath: path.resolve(
      valueAfter(args, '--output') ??
        path.join('perf-results', `${timestamp}-trace.json`)
    ),
    port,
    speed,
    userDataDirectory: requestedProfile
      ? path.resolve(requestedProfile)
      : undefined,
  };
};

interface DevToolsTarget {
  type: string;
  url: string;
  webSocketDebuggerUrl?: string;
}

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

const waitForTarget = async (port: number): Promise<DevToolsTarget> => {
  for (let attempt = 0; attempt < 240; attempt++) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/json/list`);
      if (response.ok) {
        const targets = (await response.json()) as DevToolsTarget[];
        const target =
          targets.find(
            (item) =>
              item.type === 'page' &&
              item.webSocketDebuggerUrl &&
              /localhost:5173|127\.0\.0\.1:5173/.test(item.url)
          ) ??
          targets.find(
            (item) => item.type === 'page' && item.webSocketDebuggerUrl
          );
        if (target) return target;
      }
    } catch {
      // DevTools endpoint is not listening yet.
    }
    await sleep(500);
  }
  throw new Error(`DevTools endpoint on port ${port} did not become ready.`);
};

type TraceEvent = Record<string, unknown>;

const collectTrace = async (
  webSocketDebuggerUrl: string,
  durationSeconds: number
): Promise<TraceEvent[]> => {
  const socket = new WebSocket(webSocketDebuggerUrl);
  await new Promise<void>((resolve, reject) => {
    socket.once('open', resolve);
    socket.once('error', reject);
  });

  const events: TraceEvent[] = [];
  const pending = new Map<
    number,
    { resolve: (value: unknown) => void; reject: (error: Error) => void }
  >();
  let resolveCompletion: (() => void) | undefined;
  const completion = new Promise<void>((resolve) => {
    resolveCompletion = resolve;
  });

  socket.on('message', (raw) => {
    const message = JSON.parse(raw.toString()) as {
      id?: number;
      method?: string;
      result?: unknown;
      error?: { message: string };
      params?: { value?: TraceEvent[] };
    };
    if (message.id !== undefined) {
      const callbacks = pending.get(message.id);
      if (!callbacks) return;
      pending.delete(message.id);
      if (message.error) callbacks.reject(new Error(message.error.message));
      else callbacks.resolve(message.result);
      return;
    }
    if (message.method === 'Tracing.dataCollected') {
      events.push(...(message.params?.value ?? []));
    } else if (message.method === 'Tracing.tracingComplete') {
      resolveCompletion?.();
    }
  });

  let nextId = 1;
  const send = (method: string, params?: Record<string, unknown>) =>
    new Promise<unknown>((resolve, reject) => {
      const id = nextId++;
      pending.set(id, { resolve, reject });
      socket.send(JSON.stringify({ id, method, params }));
    });

  try {
    await send('Tracing.start', {
      transferMode: 'ReportEvents',
      streamFormat: 'json',
      traceConfig: {
        recordMode: 'recordAsMuchAsPossible',
        includedCategories: TRACE_CATEGORIES.split(','),
      },
    });
    await sleep(durationSeconds * 1000);
    await send('Tracing.end');
    await Promise.race([
      completion,
      sleep(30_000).then(() => {
        throw new Error('Timed out waiting for tracing completion.');
      }),
    ]);
    return events;
  } finally {
    socket.close();
  }
};

const runTrace = async (args: string[]): Promise<void> => {
  const options = parseTraceOptions(args);
  await fs.access(options.inputPath);
  await fs.mkdir(path.dirname(options.outputPath), { recursive: true });
  const userDataDirectory =
    options.userDataDirectory ??
    (await fs.mkdtemp(path.join(tmpdir(), 'irdashies-trace-')));

  const child = spawn(
    'npm',
    [
      'start',
      '--',
      '--',
      `--remote-debugging-port=${options.port}`,
      `--user-data-dir=${userDataDirectory}`,
    ],
    {
      cwd: process.cwd(),
      env: {
        ...process.env,
        NODE_OPTIONS: '',
        PERF_METRICS: '1',
        PERF_RUN_ID: path.basename(options.outputPath, '.json'),
        PERF_SCENARIO: 'trace',
        PERF_REPORT_INTERVAL_MS: '1000',
        ELECTRON_ENABLE_LOGGING: '1',
        IRDASHIES_TELEMETRY_REPLAY: options.inputPath,
        IRDASHIES_TELEMETRY_REPLAY_SPEED: String(options.speed),
        IRDASHIES_TELEMETRY_REPLAY_LOOP: '0',
      },
      stdio: ['ignore', 'ignore', 'pipe'],
      detached: process.platform !== 'win32',
    }
  );
  child.stderr?.on('data', () => undefined);

  const stopChild = (): void => {
    if (child.exitCode !== null || child.signalCode !== null) return;
    try {
      if (process.platform === 'win32' || child.pid === undefined)
        child.kill('SIGTERM');
      else process.kill(-child.pid, 'SIGTERM');
    } catch {
      child.kill('SIGTERM');
    }
  };

  try {
    const target = await waitForTarget(options.port);
    if (options.warmupSeconds > 0) await sleep(options.warmupSeconds * 1000);
    if (!target.webSocketDebuggerUrl)
      throw new Error('DevTools target has no WebSocket debugger URL.');
    const events = await collectTrace(
      target.webSocketDebuggerUrl,
      options.durationSeconds
    );
    await fs.writeFile(
      options.outputPath,
      JSON.stringify({ traceEvents: events }),
      'utf8'
    );
    process.stdout.write(
      `Trace: ${options.outputPath}\nEvents: ${events.length}\nProfile: ${userDataDirectory}\nOpen chrome://tracing and load this JSON file.\n`
    );
  } finally {
    stopChild();
  }
};

const invokedDirectly =
  process.argv[1] !== undefined &&
  import.meta.url === pathToFileURL(process.argv[1]).href;
if (invokedDirectly) {
  const args = process.argv.slice(2);
  if (!args.length || args.includes('--help') || args.includes('-h')) {
    process.stdout.write(TRACE_USAGE);
  } else {
    await runTrace(args);
  }
}
