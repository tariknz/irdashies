import { IRacingSDK } from '../../irsdk';
import { TelemetrySink } from './telemetrySink';
import { OverlayManager } from '../../overlayManager';
import type { IrSdkBridge, Session, OverlayTelemetryPayload } from '@irdashies/types';

const TIMEOUT = 1000;
const LOW_TIMEOUT = 16; // ms, for 60Hz

export async function publishIRacingSDKEvents(
  telemetrySink: TelemetrySink,
  overlayManager: OverlayManager
): Promise<IrSdkBridge> {
  console.log('Loading iRacing SDK bridge...');

  let shouldStop = false;
  const runningStateInterval = setInterval(async () => {
    const isSimRunning = await IRacingSDK.IsSimRunning();
    console.log('Sending running state to window', isSimRunning);
    overlayManager.publishMessage('runningState', isSimRunning);
  }, 2000);

  // Start the telemetry loop in the background
  (async () => {
    while (!shouldStop) {
      if (await IRacingSDK.IsSimRunning()) {
        console.log('iRacing is running');
        const sdk = new IRacingSDK();
        sdk.autoEnableTelemetry = true;

        await sdk.ready();

        while (!shouldStop) {
          try {
            const hasData = await sdk.waitForDataAsync(LOW_TIMEOUT);
            if (!hasData) {
              // No data available, continue loop
              continue;
            }

            const telemetry = sdk.getTelemetry();
            if (telemetry) {
              overlayManager.publishTelemetryFields(telemetry);
              telemetrySink.addTelemetry(telemetry);
            }

            const session = sdk.getSessionData();
            if (session) {
              overlayManager.publishMessage('sessionData', session);
              telemetrySink.addSession(session);
            }

            // No need for setImmediate since waitForDataAsync is already non-blocking
          } catch (error) {
            console.error('Error in waitForDataAsync:', error);
            // Brief pause before retrying
            await new Promise(resolve => setTimeout(resolve, 100));
          }
        }

        console.log('iRacing is no longer publishing telemetry');
      } else {
        console.log('iRacing is not running');
      }

      await new Promise((resolve) => setTimeout(resolve, TIMEOUT));
    }
  })();

  return {
    onTelemetry: (callback: (value: OverlayTelemetryPayload) => void) => callback({ overlayId: '', telemetry: {}, timestamp: Date.now() }),
    onSessionData: (callback: (value: Session) => void) => callback({} as Session),
    onRunningState: (callback: (value: boolean) => void) => callback(false),
    stop: () => {
      shouldStop = true;
      clearInterval(runningStateInterval);
    }
  };
}
