import { generateMockData } from './generateMockData';
import { TelemetrySink } from '../telemetrySink';
import { OverlayManager } from 'src/app/overlayManager';

export async function publishIRacingSDKEvents(
  telemetrySink: TelemetrySink,
  overlayManager: OverlayManager
) {
  console.log('🎭 Mock SDK Bridge: Starting mock data generation...');
  const bridge = generateMockData();
  
  let telemetryCount = 0;
  let sessionCount = 0;
  
  bridge.onSessionData((session) => {
    sessionCount++;
    if (sessionCount === 1 || sessionCount % 10 === 0) {
      console.log('🎭 Mock SDK Bridge: Generated session data #', sessionCount);
    }
    overlayManager.publishMessage('sessionData', session);
    telemetrySink.addSession(session);
  });
  
  bridge.onTelemetry((telemetry) => {
    telemetryCount++;
    if (telemetryCount === 1 || telemetryCount % 60 === 0) {
      console.log('🎭 Mock SDK Bridge: Generated telemetry #', telemetryCount);
    }
    overlayManager.publishMessage('telemetry', telemetry);
    telemetrySink.addTelemetry(telemetry);
  });
  
  bridge.onRunningState((running) => {
    console.log('🎭 Mock SDK Bridge: Running state:', running);
    overlayManager.publishMessage('runningState', running);
  });
  
  return bridge;
}
