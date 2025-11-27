import { generateMockData } from './generateMockData';
import { TelemetrySink } from '../telemetrySink';
import { OverlayManager } from 'src/app/overlayManager';

export async function publishIRacingSDKEvents(
  telemetrySink: TelemetrySink,
  overlayManager: OverlayManager
) {
  const bridge = generateMockData();
  
  bridge.onSessionData((session) => {
    overlayManager.publishMessage('sessionData', session);
    telemetrySink.addSession(session);
  });
  
  bridge.onTelemetry((telemetry) => {
    overlayManager.publishMessage('telemetry', telemetry);
    telemetrySink.addTelemetry(telemetry);
  });
  
  bridge.onRunningState((running) => {
    overlayManager.publishMessage('runningState', running);
  });
  
  return bridge;
}
