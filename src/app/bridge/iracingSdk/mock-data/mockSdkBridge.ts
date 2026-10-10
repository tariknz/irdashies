import { generateMockData } from './generateMockData';
import { OverlayManager } from '../../../overlayManager';
import { TelemetryPerfMetrics } from '../../../perfMetrics';
import type { SessionLifecycle } from '../../../sessionLifecycle';
import type { ChannelBus } from '../../channelBus';
import { createDefaultProcessorHost } from '../../../processors/processorRegistry';
import logger from '../../../logger';
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
        logError: (message, error) => logger.error(message, error),
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

  // The mock re-asserts the same running state every second. The real bridges
  // publish only on a change, and consumers now include the settings window,
  // so match them rather than broadcasting a boolean that never moves.
  let lastRunningState: boolean | undefined;
  bridge.onRunningState((running) => {
    if (running === lastRunningState) return;
    lastRunningState = running;
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
