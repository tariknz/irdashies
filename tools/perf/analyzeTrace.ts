import { promises as fs } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { numericArgument, parseArguments } from './args.ts';

export const ANALYZE_TRACE_USAGE = `Usage: npm run perf:trace-analyze -- <trace.json> [options]
  --output <path-prefix>      Write <prefix>.trace-summary.json and .md
  --min-long-task-ms N        Long-task threshold (default 50)
`;

export interface TraceFunctionHotspot {
  functionName: string;
  location: string;
  selfMs: number;
  samples: number;
}

export interface TraceLongTask {
  name: string;
  durationMs: number;
  timestampMs: number;
  pid: number;
  tid: number;
}

export interface TraceProcessSummary {
  pid: number;
  longTasks: number;
  worstTaskMs: number;
}

export interface TraceAnalysis {
  schemaVersion: 1;
  source: string;
  eventCount: number;
  profile: {
    sampleCount: number;
    sampledMs: number;
    hotspots: TraceFunctionHotspot[];
  };
  longTasks: {
    thresholdMs: number;
    count: number;
    countOver100Ms: number;
    worstMs: number;
    top: TraceLongTask[];
  };
  gc: {
    count: number;
    totalMs: number;
    maxMs: number;
  };
  processes: TraceProcessSummary[];
  limitations: string[];
}

interface TraceEvent {
  name?: unknown;
  ph?: unknown;
  dur?: unknown;
  ts?: unknown;
  pid?: unknown;
  tid?: unknown;
  args?: unknown;
  id?: unknown;
  id2?: unknown;
}

interface CpuNode {
  id?: unknown;
  callFrame?: {
    functionName?: unknown;
    url?: unknown;
    lineNumber?: unknown;
  };
}

interface CpuProfileBatch {
  profileKey: string;
  nodes: CpuNode[];
  samples: unknown[];
  timeDeltas?: unknown[];
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const finite = (value: unknown): number | undefined =>
  typeof value === 'number' && Number.isFinite(value) ? value : undefined;

const asString = (value: unknown): string | undefined =>
  typeof value === 'string' && value.length > 0 ? value : undefined;

const profileBatches = (events: readonly TraceEvent[]): CpuProfileBatch[] => {
  const batches: CpuProfileBatch[] = [];
  for (const event of events) {
    if (event.name !== 'Profile' && event.name !== 'ProfileChunk') continue;
    const data = isRecord(event.args) ? event.args.data : undefined;
    if (!isRecord(data)) continue;
    const profile = isRecord(data.cpuProfile) ? data.cpuProfile : data;
    const nodes = Array.isArray(profile.nodes)
      ? profile.nodes.filter(isRecord)
      : [];
    const samples: unknown[] = Array.isArray(profile.samples)
      ? profile.samples
      : [];
    const timeDeltas = Array.isArray(data.timeDeltas)
      ? data.timeDeltas
      : Array.isArray(profile.timeDeltas)
        ? profile.timeDeltas
        : undefined;
    const id = isRecord(event.id2)
      ? [event.id2.local ?? null, event.id2.global ?? null]
      : (event.id ?? null);
    const profileKey = JSON.stringify([event.pid, event.tid, id]);
    if (nodes.length || samples.length)
      batches.push({ profileKey, nodes, samples, timeDeltas });
  }
  return batches;
};

const summarizeProfile = (
  batches: readonly CpuProfileBatch[]
): TraceAnalysis['profile'] & { limitations: string[] } => {
  const nodesByProfile = new Map<string, Map<number, CpuNode>>();
  for (const batch of batches) {
    const nodes =
      nodesByProfile.get(batch.profileKey) ?? new Map<number, CpuNode>();
    nodesByProfile.set(batch.profileKey, nodes);
    for (const node of batch.nodes) {
      const id = finite(node.id);
      if (id !== undefined) nodes.set(id, node);
    }
  }
  const selfTime = new Map<string, { selfMs: number; samples: number }>();
  let sampleCount = 0;
  let sampledMicroseconds = 0;
  let estimatedDeltas = 0;

  for (const batch of batches) {
    const nodes = nodesByProfile.get(batch.profileKey);
    batch.samples.forEach((sample, index) => {
      const id = finite(sample);
      if (id === undefined) return;
      const delta = finite(batch.timeDeltas?.[index]);
      const microseconds = delta !== undefined && delta >= 0 ? delta : 1000;
      if (delta === undefined || delta < 0) estimatedDeltas++;
      const node = nodes?.get(id);
      const callFrame = node?.callFrame;
      const functionName = asString(callFrame?.functionName) ?? '(anonymous)';
      const url = asString(callFrame?.url);
      const line = finite(callFrame?.lineNumber);
      const location =
        url === undefined
          ? '(native)'
          : line === undefined
            ? url
            : `${url}:${line + 1}`;
      const key = `${functionName}\u0000${location}`;
      const entry = selfTime.get(key) ?? { selfMs: 0, samples: 0 };
      entry.selfMs += microseconds / 1000;
      entry.samples += 1;
      selfTime.set(key, entry);
      sampleCount++;
      sampledMicroseconds += microseconds;
    });
  }

  const hotspots = [...selfTime]
    .map(([key, entry]) => {
      const [functionName, location] = key.split('\u0000');
      return {
        functionName,
        location,
        selfMs: Math.round(entry.selfMs * 100) / 100,
        samples: entry.samples,
      };
    })
    .sort((left, right) => right.selfMs - left.selfMs)
    .slice(0, 20);

  return {
    sampleCount,
    sampledMs: Math.round(sampledMicroseconds / 100) / 10,
    hotspots,
    limitations:
      estimatedDeltas > 0
        ? [
            `${estimatedDeltas} CPU samples had no timeDelta; 1 ms per sample was assumed.`,
          ]
        : [],
  };
};

export function analyzeTraceJson(
  value: unknown,
  source: string,
  minLongTaskMs = 50
): TraceAnalysis {
  const events: TraceEvent[] = Array.isArray(value)
    ? value.filter(isRecord)
    : isRecord(value) && Array.isArray(value.traceEvents)
      ? value.traceEvents.filter(isRecord)
      : [];
  if (events.length === 0)
    throw new Error('No traceEvents were found in the trace file.');
  if (!Number.isFinite(minLongTaskMs) || minLongTaskMs <= 0)
    throw new Error('--min-long-task-ms must be a positive number.');

  const thresholdMicroseconds = minLongTaskMs * 1000;
  const longTasks: TraceLongTask[] = [];
  const gcEvents: { durationMs: number }[] = [];
  for (const event of events) {
    const name = asString(event.name) ?? '';
    const duration = finite(event.dur);
    if (duration === undefined || duration < 0) continue;
    if (/cpu.*profiler.*start/i.test(name) || /Tracing::Start/i.test(name))
      continue;
    if (/gc|collectgarbage/i.test(name))
      gcEvents.push({ durationMs: duration / 1000 });
    if (event.ph !== 'X' || duration < thresholdMicroseconds) continue;
    longTasks.push({
      name,
      durationMs: Math.round(duration / 100) / 10,
      timestampMs: (finite(event.ts) ?? 0) / 1000,
      pid: finite(event.pid) ?? 0,
      tid: finite(event.tid) ?? 0,
    });
  }

  longTasks.sort((left, right) => right.durationMs - left.durationMs);
  const profile = summarizeProfile(profileBatches(events));
  const processMap = new Map<number, TraceProcessSummary>();
  for (const task of longTasks) {
    const entry = processMap.get(task.pid) ?? {
      pid: task.pid,
      longTasks: 0,
      worstTaskMs: 0,
    };
    entry.longTasks++;
    entry.worstTaskMs = Math.max(entry.worstTaskMs, task.durationMs);
    processMap.set(task.pid, entry);
  }

  return {
    schemaVersion: 1,
    source,
    eventCount: events.length,
    profile: {
      sampleCount: profile.sampleCount,
      sampledMs: profile.sampledMs,
      hotspots: profile.hotspots,
    },
    longTasks: {
      thresholdMs: minLongTaskMs,
      count: longTasks.length,
      countOver100Ms: longTasks.filter((task) => task.durationMs > 100).length,
      worstMs: longTasks[0]?.durationMs ?? 0,
      top: longTasks.slice(0, 20),
    },
    gc: {
      count: gcEvents.length,
      totalMs:
        Math.round(
          gcEvents.reduce((sum, event) => sum + event.durationMs, 0) * 10
        ) / 10,
      maxMs:
        Math.round(
          Math.max(0, ...gcEvents.map((event) => event.durationMs)) * 10
        ) / 10,
    },
    processes: [...processMap.values()].sort(
      (left, right) => right.worstTaskMs - left.worstTaskMs
    ),
    limitations: [
      ...profile.limitations,
      'Trace collection adds overhead; keep analysis traces separate from A/B baselines.',
      'Nested complete events overlap; long-task and GC totals are not additive CPU time.',
    ],
  };
}

const format = (value: number, digits = 2): string => value.toFixed(digits);

export function traceAnalysisMarkdown(analysis: TraceAnalysis): string {
  const hotspots = analysis.profile.hotspots
    .map(
      (hotspot, index) =>
        `| ${index + 1} | ${hotspot.functionName} | \`${hotspot.location}\` | ${format(hotspot.selfMs)} | ${hotspot.samples} |`
    )
    .join('\n');
  const longTasks = analysis.longTasks.top
    .map(
      (task) =>
        `| ${format(task.timestampMs, 0)} | ${task.pid} | ${task.name} | ${format(task.durationMs, 1)} |`
    )
    .join('\n');
  const processes = analysis.processes
    .map(
      (process) =>
        `| ${process.pid} | ${process.longTasks} | ${format(process.worstTaskMs, 1)} |`
    )
    .join('\n');

  return `# Trace analysis

- Source: \`${analysis.source}\`
- Trace events: ${analysis.eventCount}
- CPU samples: ${analysis.profile.sampleCount} (${format(analysis.profile.sampledMs)} ms attributed)
- Long tasks over ${analysis.longTasks.thresholdMs} ms: ${analysis.longTasks.count} (${analysis.longTasks.countOver100Ms} over 100 ms, worst ${format(analysis.longTasks.worstMs, 1)} ms)
- GC events: ${analysis.gc.count} (${format(analysis.gc.totalMs)} ms total, ${format(analysis.gc.maxMs, 1)} ms max)

## Highest V8 self time

| # | Function | Location | Self ms | Samples |
| ---: | --- | --- | ---: | ---: |
${hotspots}

## Longest complete events

| Trace start ms | PID | Event | Duration ms |
| ---: | ---: | --- | ---: |
${longTasks}

## Processes with long tasks

| PID | Long tasks | Worst ms |
| ---: | ---: | ---: |
${processes}

## Interpretation

${analysis.limitations.map((item) => `- ${item}`).join('\n')}
`;
}

export interface TraceAnalysisOptions {
  inputPath: string;
  outputPrefix: string;
  minLongTaskMs: number;
}

export function parseTraceAnalysisOptions(
  args: string[]
): TraceAnalysisOptions {
  const parsed = parseArguments(args, {
    usage: ANALYZE_TRACE_USAGE,
    values: ['--output', '--min-long-task-ms'],
    positional: 'one',
  });
  const inputPath = path.resolve(parsed.positionals[0]);
  return {
    inputPath,
    outputPrefix: path.resolve(
      parsed.value('--output') ??
        inputPath.replace(/\.[^.]+$/, '') + '.trace-summary'
    ),
    minLongTaskMs: numericArgument(parsed, '--min-long-task-ms', 50, {
      min: 1,
    }),
  };
}

export async function analyzeTraceFile(
  inputPath: string,
  minLongTaskMs = 50
): Promise<TraceAnalysis> {
  const contents = await fs.readFile(inputPath, 'utf8');
  return analyzeTraceJson(
    JSON.parse(contents) as unknown,
    path.basename(inputPath),
    minLongTaskMs
  );
}

export async function writeTraceAnalysis(
  options: TraceAnalysisOptions
): Promise<{ jsonPath: string; markdownPath: string }> {
  const analysis = await analyzeTraceFile(
    options.inputPath,
    options.minLongTaskMs
  );
  const jsonPath = `${options.outputPrefix}.json`;
  const markdownPath = `${options.outputPrefix}.md`;
  await fs.mkdir(path.dirname(jsonPath), { recursive: true });
  await Promise.all([
    fs.writeFile(jsonPath, JSON.stringify(analysis, null, 2), 'utf8'),
    fs.writeFile(markdownPath, traceAnalysisMarkdown(analysis), 'utf8'),
  ]);
  return { jsonPath, markdownPath };
}

const invokedDirectly =
  process.argv[1] !== undefined &&
  import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;

if (invokedDirectly) {
  const args = process.argv.slice(2);
  if (!args.length || args.includes('--help') || args.includes('-h')) {
    process.stdout.write(ANALYZE_TRACE_USAGE);
  } else {
    const paths = await writeTraceAnalysis(parseTraceAnalysisOptions(args));
    process.stdout.write(
      `Trace summary: ${paths.markdownPath}\nTrace data: ${paths.jsonPath}\n`
    );
  }
}
