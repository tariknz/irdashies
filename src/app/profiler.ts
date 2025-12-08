import { contentTracing, app } from 'electron';
import path from 'node:path';

let profiling = false;

const TRACE_CATEGORIES = [
  'devtools.timeline',
  'v8.execute',
  'disabled-by-default-devtools.timeline',
  'disabled-by-default-devtools.timeline.frame',
  'disabled-by-default-v8.cpu_profiler',
  'blink.user_timing',
  'latencyInfo',
  'node',
  'node.async_hooks',
  'v8',
];

export async function startProfiling() {
  await contentTracing.startRecording({
    included_categories: TRACE_CATEGORIES,
  });
  profiling = true;
  console.log('CPU profiling started');
}

export async function stopProfiling(): Promise<string> {
  const desktopPath = app.getPath('desktop');
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const resultFilePath = path.join(
    desktopPath,
    `irdashies-profile-${timestamp}.json`
  );
  await contentTracing.stopRecording(resultFilePath);
  profiling = false;
  return resultFilePath;
}

export function isProfiling() {
  return profiling;
}
