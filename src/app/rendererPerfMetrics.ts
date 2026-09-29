import { ipcRenderer } from 'electron';
import {
  RENDERER_PERF_MEASURES,
  type RendererPerfMeasureName,
  type RendererPerfMeasureStats,
  type RendererPerfSample,
} from '@irdashies/types';
import { FixedSampleBuffer } from '../shared/performanceSamples';
import { readRendererPerfArguments } from './perfRendererArguments';

export const PERF_RENDERER_LOG_PREFIX = '[PerfRenderer:JSON] ';

let telemetryCallbackTimes: FixedSampleBuffer | undefined;
let channelCallbackTimes: FixedSampleBuffer | undefined;
let measureTimes: MeasureBuffers | undefined;

type MeasureBuffers = Record<RendererPerfMeasureName, FixedSampleBuffer>;

const createMeasureBuffers = (): MeasureBuffers =>
  Object.fromEntries(
    RENDERER_PERF_MEASURES.map((name) => [name, new FixedSampleBuffer(4096)])
  ) as MeasureBuffers;

const resetMeasures = (measures: MeasureBuffers): void => {
  for (const name of RENDERER_PERF_MEASURES) measures[name].reset();
};

const summarizeMeasures = (
  measures: MeasureBuffers
): RendererPerfMeasureStats =>
  Object.fromEntries(
    RENDERER_PERF_MEASURES.map((name) => [name, measures[name].summarize()])
  );

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
  measureTimes?.[name]?.add(durationMs);
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
  const measures = createMeasureBuffers();
  measureTimes = measures;
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
      resetMeasures(measures);
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
      measures: summarizeMeasures(measures),
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
    resetMeasures(measures);
    framesOver25Ms = 0;
    framesOver50Ms = 0;
  }, reportIntervalMs);
}
