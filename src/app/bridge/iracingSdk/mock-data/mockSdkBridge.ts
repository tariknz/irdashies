import { generateMockData } from './generateMockData';
import { OverlayManager } from '../../../overlayManager';
import { TelemetryPerfMetrics } from '../../../perfMetrics';
import type { SessionLifecycle } from '../../../sessionLifecycle';
import type { ChannelBus } from '../../channelBridge';
import { createDefaultProcessorHost } from '../../../processors/processorRegistry';
import { TELEMETRY_INSPECTOR_RATE_HZ } from '@irdashies/types';

export async function publishIRacingSDKEvents(
  overlayManager: OverlayManager,
  lifecycle?: SessionLifecycle,
  channelBus?: ChannelBus
) {
  const perfMetrics = new TelemetryPerfMetrics(undefined, channelBus);
  let lastInspectorTelemetryPublishTime = Number.NEGATIVE_INFINITY;
  perfMetrics.startReporting();

  const bridge = generateMockData();
  const processorHost = channelBus
    ? createDefaultProcessorHost({
        bus: channelBus,
        lifecycle,
        metrics: perfMetrics,
        referenceLapPersistence: {
          load: () => null,
          save: () => undefined,
        },
      })
    : undefined;

  bridge.onSessionData((session) => {
    processorHost?.onSession(session);
    overlayManager.publishMessage('sessionData', session);
  });

  bridge.onTelemetry((telemetry) => {
    perfMetrics.markStart('processTelemetry');
    processorHost?.onFrame(telemetry);
    const tickTime = performance.now();
    if (
      overlayManager.hasTelemetryInspectorSubscribers() &&
      tickTime - lastInspectorTelemetryPublishTime >=
        1000 / TELEMETRY_INSPECTOR_RATE_HZ
    ) {
      lastInspectorTelemetryPublishTime = tickTime;
      perfMetrics.markStart('broadcast');
      overlayManager.publishMessage('telemetryInspector:telemetry', telemetry);
      perfMetrics.markEnd('broadcast');
    }
    perfMetrics.markEnd('processTelemetry');
    perfMetrics.tick(telemetry);
  });

  bridge.onRunningState((running) => {
    overlayManager.publishMessage('runningState', running);
  });

  const originalStop = bridge.stop;
  return {
    ...bridge,
    stop: () => {
      overlayManager.clearLatestSessionData?.();
      processorHost?.dispose();
      perfMetrics.stopReporting();
      originalStop();
    },
  };
}
