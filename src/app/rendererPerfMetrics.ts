import { ipcRenderer } from 'electron';
import type {
  RendererPerfMeasureName,
  RendererPerfSample,
} from '@irdashies/types';
import { RENDERER_PERF_MEASURE_NAMES } from '../types/performance';
import { FixedSampleBuffer } from '../shared/performanceSamples';
import { readRendererPerfArguments } from './perfRendererArguments';

export const PERF_RENDERER_LOG_PREFIX = '[PerfRenderer:JSON] ';

let telemetryCallbackTimes: FixedSampleBuffer | undefined;
let channelCallbackTimes: FixedSampleBuffer | undefined;
/** One buffer per named measure, reported as `<name>Ms`. */
let measureTimes:
  Record<RendererPerfMeasureName, FixedSampleBuffer> | undefined;
/**
 * The measures this window has recorded at least once. Only those are
 * reported: the analyzer takes a measure's rate over the windows that report
 * it, and a window that never runs the loop -- every other overlay, with
 * per-widget windows -- would otherwise add its whole interval to the time
 * and divide the rate by the number of windows. A window that does run it
 * keeps reporting its idle intervals, at a count of 0.
 */
let measuresRun: Set<RendererPerfMeasureName> | undefined;

export function isRendererPerfMetricsEnabled(): boolean {
  return telemetryCallbackTimes !== undefined;
}

export function recordTelemetryCallback(durationMs: number): void {
  telemetryCallbackTimes?.add(durationMs);
}

export function recordChannelCallback(durationMs: number): void {
  channelCallbackTimes?.add(durationMs);
}

export function recordRendererMeasure(
  name: RendererPerfMeasureName,
  durationMs: number
): void {
  if (!measureTimes) return;
  measureTimes[name].add(durationMs);
  measuresRun?.add(name);
}

export function startRendererPerfMetrics(): void {
  const config = readRendererPerfArguments();
  if (!config.enabled) return;

  const configuredInterval = config.reportIntervalMs;
  const reportIntervalMs =
    Number.isFinite(configuredInterval) && configuredInterval >= 1000
      ? configuredInterval
      : 10_000;
  const frameTimes = new FixedSampleBuffer(4096);
  const callbackTimes = new FixedSampleBuffer(4096);
  telemetryCallbackTimes = callbackTimes;
  const channelTimes = new FixedSampleBuffer(4096);
  channelCallbackTimes = channelTimes;
  const measures = Object.fromEntries(
    RENDERER_PERF_MEASURE_NAMES.map((name) => [
      name,
      new FixedSampleBuffer(4096),
    ])
  ) as Record<RendererPerfMeasureName, FixedSampleBuffer>;
  measureTimes = measures;
  const run = new Set<RendererPerfMeasureName>();
  measuresRun = run;
  const measured = (name: RendererPerfMeasureName) =>
    run.has(name) ? measures[name].summarize() : undefined;
  const resetMeasures = () => {
    for (const name of RENDERER_PERF_MEASURE_NAMES) measures[name].reset();
  };
  let intervalStart = performance.now();
  let previousFrameTime = 0;
  let framesOver25Ms = 0;
  let framesOver50Ms = 0;

  const onFrame = (now: number): void => {
    if (previousFrameTime > 0) {
      const frameTime = now - previousFrameTime;
      frameTimes.add(frameTime);
      if (frameTime > 25) framesOver25Ms++;
      if (frameTime > 50) framesOver50Ms++;
    }
    previousFrameTime = now;
    requestAnimationFrame(onFrame);
  };

  requestAnimationFrame(onFrame);

  setInterval(() => {
    const now = performance.now();
    const stats = frameTimes.summarize();
    if (stats.count === 0) {
      intervalStart = now;
      previousFrameTime = 0;
      callbackTimes.reset();
      channelTimes.reset();
      resetMeasures();
      framesOver25Ms = 0;
      framesOver50Ms = 0;
      return;
    }

    const sample: RendererPerfSample = {
      schemaVersion: 1,
      timestamp: new Date().toISOString(),
      runId: config.runId,
      scenario: config.scenario,
      pid: process.pid,
      route: window.location.hash || window.location.pathname,
      visibilityState: document.visibilityState,
      intervalMs: now - intervalStart,
      frameTimeMs: stats,
      telemetryCallbackMs: callbackTimes.summarize(),
      channelCallbackMs: channelTimes.summarize(),
      trackMapAnimationFrameMs: measured('trackMapAnimationFrame'),
      standingsFinalTimingMs: measured('standingsFinalTiming'),
      standingsPlayerGapsMs: measured('standingsPlayerGaps'),
      lapTraceFrameMs: measured('lapTraceFrame'),
      lapTraceBrakeCueMs: measured('lapTraceBrakeCue'),
      telemetryWakeups: callbackTimes.summarize().count,
      channelWakeups: channelTimes.summarize().count,
      framesOver25Ms,
      framesOver50Ms,
    };

    ipcRenderer.send(
      'log',
      'info',
      `${PERF_RENDERER_LOG_PREFIX}${JSON.stringify(sample)}`
    );

    intervalStart = now;
    frameTimes.reset();
    callbackTimes.reset();
    channelTimes.reset();
    resetMeasures();
    framesOver25Ms = 0;
    framesOver50Ms = 0;
  }, reportIntervalMs);
}
