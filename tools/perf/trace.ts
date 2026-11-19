import { spawn } from 'node:child_process';
import { promises as fs } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import WebSocket from 'ws';
import { numericArgument, parseArguments } from './args.ts';
import { writeTraceAnalysis } from './analyzeTrace.ts';

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
  --replay-speed N            Alias for --speed
  --user-data-dir <directory> Isolated Electron profile
  --no-analyze                Skip the generated trace summary
`;

export interface TraceOptions {
  inputPath: string;
  durationSeconds: number;
  warmupSeconds: number;
  outputPath: string;
  port: number;
  speed: number;
  analyze: boolean;
  userDataDirectory?: string;
}

export const parseTraceOptions = (args: string[]): TraceOptions => {
  const parsed = parseArguments(args, {
    usage: TRACE_USAGE,
    values: [
      '--input',
      '--duration-seconds',
      '--warmup-seconds',
      '--output',
      '--port',
      '--speed',
      '--replay-speed',
      '--user-data-dir',
    ],
    booleans: ['--no-analyze'],
  });
  const inputPath = parsed.value('--input');
  if (!inputPath) throw new Error(`--input is required\n${TRACE_USAGE}`);
  let durationSeconds: number;
  let warmupSeconds: number;
  let port: number;
  let speed: number;
  try {
    durationSeconds = numericArgument(
      parsed,
      '--duration-seconds',
      DEFAULT_DURATION_SECONDS,
      { min: 5 }
    );
    warmupSeconds = numericArgument(parsed, '--warmup-seconds', 0, {
      min: 0,
      integer: true,
    });
    port = numericArgument(parsed, '--port', DEFAULT_PORT, {
      min: 1024,
      max: 65535,
      integer: true,
    });
    speed = parsed.has('--speed')
      ? numericArgument(parsed, '--speed', 1, { min: 0.000001 })
      : numericArgument(parsed, '--replay-speed', 1, { min: 0.000001 });
  } catch {
    throw new Error(`Invalid trace option\n${TRACE_USAGE}`);
  }
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const requestedProfile = parsed.value('--user-data-dir');
  return {
    inputPath: path.resolve(inputPath),
    durationSeconds,
    warmupSeconds,
    outputPath: path.resolve(
      parsed.value('--output') ??
        path.join('perf-results', `${timestamp}-trace.json`)
    ),
    port,
    speed,
    analyze: !parsed.flag('--no-analyze'),
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

const waitForTarget = async (
  port: number,
  signal: AbortSignal
): Promise<DevToolsTarget> => {
  for (let attempt = 0; attempt < 240 && !signal.aborted; attempt++) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/json/list`, {
        signal,
      });
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

  const forgeCli = createRequire(import.meta.url).resolve(
    '@electron-forge/cli/dist/electron-forge.js'
  );
  const child = spawn(
    process.execPath,
    [
      forgeCli,
      'start',
      '--enable-logging',
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
  const startup = new AbortController();
  const childFailure = new Promise<never>((_, reject) => {
    child.once('error', (error) =>
      reject(new Error('Could not launch Electron.', { cause: error }))
    );
    child.once('exit', (code, signal) =>
      reject(
        new Error(
          `Electron launcher exited during capture (${code ?? signal}).`
        )
      )
    );
  });

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
    const target = await Promise.race([
      waitForTarget(options.port, startup.signal),
      childFailure,
    ]);
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
    const outputBase = options.outputPath.replace(/\.[^.]+$/, '');
    const summary = options.analyze
      ? await writeTraceAnalysis({
          inputPath: options.outputPath,
          outputPrefix: `${outputBase}.trace-summary`,
          minLongTaskMs: 50,
        })
      : undefined;
    process.stdout.write(
      [
        `Trace: ${options.outputPath}`,
        `Events: ${events.length}`,
        `Profile: ${userDataDirectory}`,
        summary
          ? `Trace summary: ${summary.markdownPath}\nTrace data: ${summary.jsonPath}`
          : undefined,
        'Open chrome://tracing and load this JSON file.',
      ]
        .filter(Boolean)
        .join('\n') + '\n'
    );
  } finally {
    startup.abort();
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
