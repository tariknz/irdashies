import { generateMockData } from './generateMockData';
import { OverlayManager } from '../../../overlayManager';
import { TelemetryPerfMetrics } from '../../../perfMetrics';
import type { SessionLifecycle } from '../../../sessionLifecycle';
import type { ChannelBus } from '../../channelBridge';
import { CarSpeedsRuntime } from '../../../processors/carSpeedsRuntime';

export async function publishIRacingSDKEvents(
  overlayManager: OverlayManager,
  lifecycle?: SessionLifecycle,
  channelBus?: ChannelBus
) {
  const perfMetrics = new TelemetryPerfMetrics();
  perfMetrics.startReporting();

  const bridge = generateMockData();
  const carSpeedsRuntime = channelBus
    ? new CarSpeedsRuntime(channelBus, lifecycle, perfMetrics)
    : undefined;

  bridge.onSessionData((session) => {
    carSpeedsRuntime?.onSession(session);
    overlayManager.publishMessage('sessionData', session);
  });

  bridge.onTelemetry((telemetry) => {
    perfMetrics.markStart('processTelemetry');
    carSpeedsRuntime?.onFrame(telemetry);
    perfMetrics.markStart('broadcast');
    overlayManager.publishMessage('telemetry', telemetry);
    perfMetrics.markEnd('broadcast');
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
      carSpeedsRuntime?.dispose();
      perfMetrics.stopReporting();
      originalStop();
    },
  };
}
