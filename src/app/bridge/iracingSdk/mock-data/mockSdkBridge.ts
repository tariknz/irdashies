import { generateMockData } from './generateMockData';
import { TelemetrySink } from '../telemetrySink';
import { OverlayManager } from 'src/app/overlayManager';
import type { Telemetry } from '@irdashies/types';

export async function publishIRacingSDKEvents(
  telemetrySink: TelemetrySink,
  overlayManager: OverlayManager
) {
  const bridge = generateMockData();
  console.log('Mock SDK Bridge created');
  bridge.onSessionData((session) => {
    overlayManager.publishMessage('sessionData', session);
    telemetrySink.addSession(session);
  });
  bridge.onTelemetry((payload) => {
    overlayManager.publishTelemetryFields(payload.telemetry as Telemetry);
    telemetrySink.addTelemetry(payload.telemetry as Telemetry);
  });
  bridge.onRunningState((running) => {
    overlayManager.publishMessage('runningState', running);
  });
  return bridge;
}
