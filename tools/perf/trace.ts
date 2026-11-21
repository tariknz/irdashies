import { spawn } from 'node:child_process';
import { promises as fs } from 'node:fs';
import { createRequire } from 'node:module';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
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

const checkPortAvailable = (port: number): Promise<void> =>
  new Promise((resolve, reject) => {
    const server = createServer();
    server.once('error', (error) =>
      reject(
        new Error(`DevTools port ${port} is unavailable.`, { cause: error })
      )
    );
    server.listen(port, '127.0.0.1', () =>
      server.close((error) => {
        if (error) reject(error);
        else resolve();
      })
    );
  });

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isDevToolsTarget = (value: unknown): value is DevToolsTarget =>
  isRecord(value) &&
  typeof value.type === 'string' &&
  typeof value.url === 'string' &&
  (value.webSocketDebuggerUrl === undefined ||
    typeof value.webSocketDebuggerUrl === 'string');

const waitForTarget = async (
  browserUrl: URL,
  signal: AbortSignal
): Promise<string> => {
  const endpoint = `http://127.0.0.1:${browserUrl.port}`;
  const version = await fetch(`${endpoint}/json/version`, { signal });
  const identity: unknown = await version.json();
  if (
    !version.ok ||
    !isRecord(identity) ||
    identity.webSocketDebuggerUrl !== browserUrl.href
  )
    throw new Error(
      'The DevTools endpoint does not belong to the launched browser.'
    );

  for (;;) {
    const response = await fetch(`${endpoint}/json/list`, { signal });
    const targets: unknown = await response.json();
    if (
      !response.ok ||
      !Array.isArray(targets) ||
      !targets.every(isDevToolsTarget)
    )
      throw new Error('Invalid DevTools target list.');
    const pages = targets.filter(
      (target) => target.type === 'page' && target.webSocketDebuggerUrl
    );
    const target =
      pages.find((item) => /localhost:5173|127\.0\.0\.1:5173/.test(item.url)) ??
      pages[0];
    if (target?.webSocketDebuggerUrl) {
      const url = new URL(target.webSocketDebuggerUrl);
      if (
        url.origin !== browserUrl.origin ||
        !url.pathname.startsWith('/devtools/page/')
      )
        throw new Error('Invalid DevTools page endpoint.');
      return url.href;
    }
    await delay(500, undefined, { signal });
  }
};

type TraceEvent = Record<string, unknown>;

const collectTrace = async (
  webSocketDebuggerUrl: string,
  durationSeconds: number,
  signal: AbortSignal
): Promise<TraceEvent[]> => {
  signal.throwIfAborted();
  const socket = new WebSocket(webSocketDebuggerUrl, {
    handshakeTimeout: 10_000,
  });
  const disconnected = new AbortController();
  const stop = (error: Error) => disconnected.abort(error);
  socket.on('error', stop);
  socket.on('close', () => stop(new Error('DevTools connection closed.')));
  const captureSignal = AbortSignal.any([signal, disconnected.signal]);
  const wait = async <T>(
    operation: Promise<T>,
    timeoutMs?: number
  ): Promise<T> => {
    const deadline =
      timeoutMs === undefined
        ? captureSignal
        : AbortSignal.any([captureSignal, AbortSignal.timeout(timeoutMs)]);
    const onAbort = Promise.withResolvers<never>();
    const reject = () => onAbort.reject(deadline.reason);
    deadline.addEventListener('abort', reject, { once: true });
    if (deadline.aborted) reject();
    try {
      return await Promise.race([operation, onAbort.promise]);
    } finally {
      deadline.removeEventListener('abort', reject);
    }
  };

  const events: TraceEvent[] = [];
  const pending = new Map<
    number,
    ReturnType<typeof Promise.withResolvers<unknown>>
  >();
  const completion = Promise.withResolvers<undefined>();
  socket.on('message', (raw) => {
    try {
      const message: unknown = JSON.parse(raw.toString());
      if (!isRecord(message))
        throw new Error('Expected a DevTools message object.');
      if (typeof message.id === 'number') {
        const callbacks = pending.get(message.id);
        if (!callbacks) return;
        if (message.error !== undefined) {
          if (
            !isRecord(message.error) ||
            typeof message.error.message !== 'string'
          )
            throw new Error('Invalid DevTools command error.');
          callbacks.reject(new Error(message.error.message));
        } else callbacks.resolve(message.result);
      } else if (message.method === 'Tracing.dataCollected') {
        if (
          !isRecord(message.params) ||
          !Array.isArray(message.params.value) ||
          !message.params.value.every(isRecord)
        )
          throw new Error('Invalid trace event batch.');
        for (const event of message.params.value) events.push(event);
      } else if (message.method === 'Tracing.tracingComplete') {
        completion.resolve(undefined);
      }
    } catch (error) {
      stop(new Error('Invalid DevTools response.', { cause: error }));
    }
  });

  let nextId = 1;
  const send = async (method: string, params?: Record<string, unknown>) => {
    captureSignal.throwIfAborted();
    const id = nextId++;
    const response = Promise.withResolvers<unknown>();
    pending.set(id, response);
    try {
      socket.send(JSON.stringify({ id, method, params }), (error) => {
        if (error) stop(error);
      });
      return await wait(response.promise, 10_000);
    } finally {
      pending.delete(id);
    }
  };

  try {
    await wait(
      new Promise<void>((resolve) => socket.once('open', resolve)),
      10_000
    );
    await send('Tracing.start', {
      transferMode: 'ReportEvents',
      streamFormat: 'json',
      traceConfig: {
        recordMode: 'recordAsMuchAsPossible',
        includedCategories: TRACE_CATEGORIES.split(','),
      },
    });
    await delay(durationSeconds * 1000, undefined, { signal: captureSignal });
    await send('Tracing.end');
    await wait(completion.promise, 30_000);
    return events;
  } finally {
    socket.terminate();
  }
};

const runTrace = async (args: string[]): Promise<void> => {
  const options = parseTraceOptions(args);
  await fs.access(options.inputPath);
  await checkPortAvailable(options.port);
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
  const startup = new AbortController();
  const browser = Promise.withResolvers<URL>();
  let stderr = '';
  child.stderr?.on('data', (chunk: Buffer) => {
    stderr = (stderr + chunk.toString()).slice(-4096);
    const match =
      /DevTools listening on (ws:\/\/127\.0\.0\.1:\d+\/devtools\/browser\/[^\s]+)[\r\n]/.exec(
        stderr
      );
    if (match) {
      const url = new URL(match[1]);
      if (url.port === String(options.port)) browser.resolve(url);
    }
  });
  child.once('error', (error) =>
    startup.abort(new Error('Could not launch Electron.', { cause: error }))
  );
  child.once('exit', (code, signal) =>
    startup.abort(
      new Error(`Electron launcher exited during capture (${code ?? signal}).`)
    )
  );

  const stopChild = (): void => {
    try {
      if (process.platform !== 'win32' && child.pid !== undefined)
        process.kill(-child.pid, 'SIGTERM');
      else if (child.exitCode === null && child.signalCode === null)
        child.kill('SIGTERM');
    } catch {
      child.kill('SIGTERM');
    }
  };

  const onInterrupt = () =>
    startup.abort(new Error('Trace cancelled (SIGINT).'));
  const onTerminate = () =>
    startup.abort(new Error('Trace cancelled (SIGTERM).'));
  process.on('SIGINT', onInterrupt);
  process.on('SIGTERM', onTerminate);
  try {
    const startupSignal = AbortSignal.any([
      startup.signal,
      AbortSignal.timeout(120_000),
    ]);
    const aborted = Promise.withResolvers<never>();
    const onAbort = () => aborted.reject(startupSignal.reason);
    startupSignal.addEventListener('abort', onAbort, { once: true });
    let browserUrl: URL;
    try {
      browserUrl = await Promise.race([browser.promise, aborted.promise]);
    } finally {
      startupSignal.removeEventListener('abort', onAbort);
    }
    const webSocketDebuggerUrl = await waitForTarget(browserUrl, startupSignal);
    if (options.warmupSeconds > 0)
      await delay(options.warmupSeconds * 1000, undefined, {
        signal: startup.signal,
      });
    const events = await collectTrace(
      webSocketDebuggerUrl,
      options.durationSeconds,
      startup.signal
    );
    startup.signal.throwIfAborted();
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
    process.off('SIGINT', onInterrupt);
    process.off('SIGTERM', onTerminate);
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
