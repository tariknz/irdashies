import {
  GlobalFlags,
  SessionState,
  type Session,
  type Telemetry,
} from '@irdashies/types';
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
  // These fields must not share arrays with the mock SDK's imported fixture.
  const state = { value: [SessionState.Racing] };
  const flags = { value: [GlobalFlags.Green] };
  const remaining = { value: [0] };
  let session: Session | undefined;
  let telemetry: Telemetry | null = null;
  source.onSessionData((value) => {
    session = value;
    host.onSession(value);
  });
  source.onTelemetry((frame) => {
    // The fixture finishes under the checkered flag; previews start racing.
    metrics.markStart('widgetPreviewProcessing');
    frame.SessionState = state;
    frame.SessionFlags = flags;
    frame.SessionLapsRemainEx = remaining;
    remaining.value[0] = frame.SessionLapsRemain.value[0];
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
