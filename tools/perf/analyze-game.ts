import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/** PresentMon Capture Application CSV; NA is missing, never a zero frame. */
export function parseGameCsv(source: string): Record<string, string>[] {
  const split = (line: string): string[] => {
    const cells: string[] = [];
    let value = '';
    let quoted = false;
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        if (quoted && line[i + 1] === '"') {
          value += '"';
          i++;
        } else quoted = !quoted;
      } else if (char === ',' && !quoted) {
        cells.push(value);
        value = '';
      } else value += char;
    }
    if (quoted) throw new Error('Unterminated CSV field');
    return [...cells, value];
  };
  const lines = source
    .replace(/^\uFEFF/, '')
    .trim()
    .split(/\r?\n/);
  const header = split(lines.shift() ?? '');
  for (const name of [
    'Application',
    'ProcessID',
    'SwapChainAddress',
    'TimeInSeconds',
    'MsBetweenPresents',
  ]) {
    if (!header.includes(name)) throw new Error(`Missing CSV column: ${name}`);
  }
  return lines.filter(Boolean).map((line) => {
    const cells = split(line);
    if (cells.length !== header.length)
      throw new Error('CSV row width mismatch');
    return Object.fromEntries(header.map((name, i) => [name, cells[i]]));
  });
}

const numeric = (value: string | undefined): number | undefined => {
  if (!value?.trim() || value === 'NA') return undefined;
  const result = Number(value);
  return Number.isFinite(result) && result >= 0 ? result : undefined;
};
const mean = (values: number[]) =>
  values.reduce((sum, value) => sum + value, 0) / values.length;

export function frameDistribution(values: number[], seconds: number) {
  if (!Number.isFinite(seconds) || seconds <= 0)
    throw new Error('Invalid distribution duration');
  const sorted = values
    .filter((v) => Number.isFinite(v) && v > 0)
    .sort((a, b) => a - b);
  if (sorted.length === 0) return null;
  const percentile = (fraction: number) =>
    sorted[Math.max(0, Math.ceil(sorted.length * fraction) - 1)];
  const slowTailFps = (fraction: number) =>
    1000 /
    mean(sorted.slice(-Math.max(1, Math.ceil(sorted.length * fraction))));
  return {
    sampleCount: sorted.length,
    meanFps: 1000 / mean(sorted),
    onePercentLowFps: slowTailFps(0.01),
    pointOnePercentLowFps: slowTailFps(0.001),
    meanMs: mean(sorted),
    p99Ms: percentile(0.99),
    p999Ms: percentile(0.999),
    maximumMs: sorted[sorted.length - 1],
    slowFrames: [25, 100 / 3, 50, 100].map((thresholdMs) => {
      const count = sorted.filter((v) => v > thresholdMs).length;
      return {
        thresholdMs,
        count,
        percent: (count / sorted.length) * 100,
        perMinute: (count / seconds) * 60,
      };
    }),
  };
}

export function summarizeGameFrames(
  source: string,
  {
    startSeconds = 60,
    endSeconds = 410,
    processName = 'iRacingSim64DX11.exe',
  } = {}
) {
  if (
    !Number.isFinite(startSeconds) ||
    !Number.isFinite(endSeconds) ||
    !(endSeconds > startSeconds && startSeconds >= 0)
  )
    throw new Error('Invalid analysis window');
  const all = parseGameCsv(source).filter(
    (r) => r.Application.toLowerCase() === processName.toLowerCase()
  );
  const groups = new Map<string, typeof all>();
  for (const row of all) {
    const key = `${row.ProcessID}:${row.SwapChainAddress}`;
    const group = groups.get(key) ?? [];
    group.push(row);
    groups.set(key, group);
  }
  if (groups.size === 0) throw new Error('No target game frames');
  const inWindow = (r: Record<string, string>) => {
    const time = numeric(r.TimeInSeconds);
    return time !== undefined && time >= startSeconds && time < endSeconds;
  };
  // A startup or retired swap chain can dominate the complete CSV while
  // another chain supplies the frames in the requested measured segment.
  const primary = [...groups.entries()]
    .map(([key, frames]) => ({
      key,
      frames,
      measured: frames.filter(inWindow),
    }))
    .sort((a, b) => b.measured.length - a.measured.length)[0];
  const rows = primary.measured;
  if (!rows.length) throw new Error('No game frames in analysis window');
  const intervals = (field: string) =>
    rows.flatMap((r) => {
      const value = numeric(r[field]);
      return value !== undefined && value > 0 ? [value] : [];
    });
  const durationSeconds = endSeconds - startSeconds;
  const buckets = new Map<number, { present: number[]; display: number[] }>();
  for (const row of rows) {
    const second = Math.floor(Number(row.TimeInSeconds));
    const bucket = buckets.get(second) ?? { present: [], display: [] };
    const present = numeric(row.MsBetweenPresents);
    const display = numeric(row.MsBetweenDisplayChange);
    if (present !== undefined && present > 0) bucket.present.push(present);
    if (display !== undefined && display > 0) bucket.display.push(display);
    buckets.set(second, bucket);
  }
  const captureSpanSeconds = primary.frames.reduce(
    ([first, last], row) => {
      const time = numeric(row.TimeInSeconds);
      return time === undefined
        ? [first, last]
        : [Math.min(first, time), Math.max(last, time)];
    },
    [Infinity, -Infinity]
  );
  return {
    schemaVersion: 1,
    analysisWindowSeconds: [startSeconds, endSeconds],
    durationSeconds,
    processName,
    primarySwapChain: primary.key,
    swapChains: [...groups].map(([key, frames]) => ({
      key,
      frameCount: frames.length,
    })),
    frameRows: rows.length,
    displayTimingUnavailableRows: rows.filter(
      (r) => numeric(r.MsBetweenDisplayChange) === undefined
    ).length,
    present: frameDistribution(intervals('MsBetweenPresents'), durationSeconds),
    display: frameDistribution(
      intervals('MsBetweenDisplayChange'),
      durationSeconds
    ),
    presentModes: [...new Set(rows.map((r) => r.PresentMode))],
    frameTypes: [...new Set(rows.map((r) => r.FrameType))],
    captureSpanSeconds,
    evidence: {
      fullAnalysisWindowAvailable:
        captureSpanSeconds[0] <= startSeconds &&
        captureSpanSeconds[1] >= endSeconds,
      longEnough: durationSeconds >= 300,
    },
    timeline: [...buckets]
      .sort((a, b) => a[0] - b[0])
      .map(([second, b]) => ({
        second,
        presentFrames: b.present.length,
        displayFrames: b.display.length,
        presentMeanMs: b.present.length ? mean(b.present) : null,
        presentMaxMs: b.present.length ? Math.max(...b.present) : null,
        displayMaxMs: b.display.length ? Math.max(...b.display) : null,
      })),
  };
}

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  const input = process.argv[2];
  if (!input)
    throw new Error('Usage: node tools/perf/analyze-game.ts <capture.csv>');
  const summary = summarizeGameFrames(await fs.readFile(input, 'utf8'));
  await fs.writeFile(
    input.replace(/\.csv$/i, '') + '.summary.json',
    JSON.stringify(summary, null, 2) + '\n'
  );
  process.stdout.write(
    JSON.stringify({
      present: summary.present,
      display: summary.display,
      evidence: summary.evidence,
    }) + '\n'
  );
  if (
    !summary.evidence.fullAnalysisWindowAvailable ||
    !summary.evidence.longEnough
  )
    process.exitCode = 1;
}
