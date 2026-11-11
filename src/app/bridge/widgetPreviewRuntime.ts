import type { Session, Telemetry } from '@irdashies/types';
import { ChannelBus, type RendererTarget } from './channelBus';
import { generateMockData } from './iracingSdk/mock-data/generateMockData';
import { createDefaultProcessorHost } from '../processors/processorRegistry';
import type { ProcessorMetrics } from '../processors/ProcessorHost';

/** Each settings renderer owns a disposable demo pipeline with its own bus. */
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
  source.onSessionData((value) => {
    session = value;
    host.onSession(value);
  });
  source.onTelemetry((frame) => {
    metrics.markStart('widgetPreviewProcessing');
    host.onFrame(frame);
    telemetry = frame;
    metrics.markEnd('widgetPreviewProcessing');
  });

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
    dispose: () => {
      source.stop();
      host.dispose();
      bus.dispose();
    },
  };
}
