import { generateMockData } from './generateMockData';
import { OverlayManager } from 'src/app/overlayManager';
import { TelemetryPerfMetrics } from '../../../perfMetrics';

export async function publishIRacingSDKEvents(overlayManager: OverlayManager) {
  const perfMetrics = new TelemetryPerfMetrics();
  perfMetrics.startReporting();

  const bridge = generateMockData();

  bridge.onSessionData((session) => {
    overlayManager.publishMessage('sessionData', session);
  });

  bridge.onTelemetry((telemetry) => {
    perfMetrics.markStart('processTelemetry');
    perfMetrics.markStart('broadcast');
    overlayManager.publishMessage('telemetry', telemetry);
    perfMetrics.markEnd('broadcast');
    perfMetrics.markEnd('processTelemetry');
    perfMetrics.tick();
  });

  bridge.onRunningState((running) => {
    overlayManager.publishMessage('runningState', running);
  });

  const originalStop = bridge.stop;
  return {
    ...bridge,
    stop: () => {
      perfMetrics.stopReporting();
      originalStop();
    },
  };
}
