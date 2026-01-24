import { generateMockData } from './generateMockData';
import { TelemetrySink } from '../telemetrySink';
import { OverlayManager } from 'src/app/overlayManager';
import type { Session } from '@irdashies/types';

export async function publishIRacingSDKEvents(
  telemetrySink: TelemetrySink,
  overlayManager: OverlayManager
) {
  const bridge = generateMockData();

  let lastSession: Session | undefined;

  bridge.onSessionData((session) => {
    lastSession = session;
    telemetrySink.addSession(session);
  });

  bridge.onTelemetry((telemetry) => {
    // Batch IPC: send telemetry with session (only when session changes)
    overlayManager.publishMessage('sdkData', {
      telemetry,
      session: lastSession
    });
    // Clear session after first send so we don't send it every frame
    lastSession = undefined;

    telemetrySink.addTelemetry(telemetry);
  });

  bridge.onRunningState((running) => {
    overlayManager.publishMessage('runningState', running);
  });

  return bridge;
}
