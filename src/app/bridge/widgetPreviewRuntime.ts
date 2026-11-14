import type { Session, Telemetry } from '@irdashies/types';
import { ChannelBus, type RendererTarget } from './channelBus';
import { generateMockData } from './iracingSdk/mock-data/generateMockData';
import { createDefaultProcessorHost } from '../processors/processorRegistry';
import type { ProcessorMetrics } from '../processors/ProcessorHost';

/**
 * Each settings renderer owns a disposable demo pipeline with its own bus.
 *
 * It starts running. Pausing it stops the mock generator's timers and nothing
 * else: the generator keeps its lap, fuel and session time while no one
 * listens and goes on from there once listened to again, so a resumed preview
 * carries on instead of starting over, and the processors and the bus keep
 * their state and last snapshots. No frame reaches the processors while it
 * is paused.
 */
export function createWidgetPreviewRuntime(
  target: RendererTarget,
  metrics: ProcessorMetrics,
  logError: (message: string, error: unknown) => void
) {
  const bus = new ChannelBus();
  const host = createDefaultProcessorHost({
    bus,
    metrics,
    logError,
    referenceLapPersistence: { load: () => null, save: () => undefined },
  });
  const source = generateMockData();
  let session: Session | undefined;
  let telemetry: Telemetry | null = null;
  let disposed = false;
  const onSession = (value: Session) => {
    session = value;
    host.onSession(value);
  };
  const onFrame = (frame: Telemetry) => {
    metrics.markStart('widgetPreviewProcessing');
    host.onFrame(frame);
    telemetry = frame;
    metrics.markEnd('widgetPreviewProcessing');
  };
  /** Set while running: stops listening, which stops the generator's timers. */
  let stopListening: (() => void) | undefined;
  const listen = () => {
    // Session first: it is sent at once, so frames never come before it.
    const stopSession = source.onSessionData(onSession);
    const stopTelemetry = source.onTelemetry(onFrame);
    stopListening = () => {
      stopTelemetry?.();
      stopSession?.();
    };
  };
  listen();

  return {
    getTelemetry: () => telemetry,
    getSession: () => {
      if (!session) throw new Error('Demo session is unavailable');
      return session;
    },
    subscribe: (channel: string, rate?: number) =>
      bus.subscribe(target, channel, rate),
    unsubscribe: (channel: string) => bus.unsubscribe(target.id, channel),
    show: () => bus.rendererBecameVisible(target.id),
    hide: () => bus.rendererBecameHidden(target.id),
    setRunning: (running: boolean) => {
      if (disposed || running === !!stopListening) return;
      if (running) {
        listen();
        return;
      }
      stopListening?.();
      stopListening = undefined;
    },
    dispose: () => {
      disposed = true;
      stopListening = undefined;
      source.stop();
      host.dispose();
      bus.dispose();
    },
  };
}
