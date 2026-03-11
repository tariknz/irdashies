import { generateMockData } from './generateMockData';
import { TelemetrySink } from '../telemetrySink';
import { OverlayManager } from 'src/app/overlayManager';
import { TelemetryPerfMetrics } from '../../../perfMetrics';

export async function publishIRacingSDKEvents(
  telemetrySink: TelemetrySink,
  overlayManager: OverlayManager
) {
  const perfMetrics = new TelemetryPerfMetrics();
  perfMetrics.startReporting();

  const bridge = generateMockData();

  bridge.onSessionData((session) => {
    overlayManager.publishMessage('sessionData', session);
    telemetrySink.addSession(session);
  });

  bridge.onTelemetry((telemetry) => {
    perfMetrics.markStart('processTelemetry');
    perfMetrics.markStart('broadcast');
    overlayManager.publishMessage('telemetry', telemetry);
    perfMetrics.markEnd('broadcast');
    telemetrySink.addTelemetry(telemetry);
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
