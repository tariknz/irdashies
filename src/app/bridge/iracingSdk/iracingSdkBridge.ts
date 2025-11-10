import { IRacingSDK } from '../../irsdk';
import { TelemetrySink } from './telemetrySink';
import { OverlayManager } from '../../overlayManager';
import type { IrSdkBridge, Session, Telemetry } from '@irdashies/types';

const TIMEOUT = 1000;

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
  }, 5000);

  // Start the telemetry loop in the background
  (async () => {
    while (!shouldStop) {
      if (await IRacingSDK.IsSimRunning()) {
        console.log('iRacing is running');
        const sdk = new IRacingSDK();
        sdk.autoEnableTelemetry = true;

        await sdk.ready();

        while (!shouldStop && sdk.waitForData(TIMEOUT)) {
          const telemetry = sdk.getTelemetry();
          const session = sdk.getSessionData();
          await new Promise((resolve) => setTimeout(resolve, 1000 / 60));

          if (telemetry) {
            overlayManager.publishMessage('telemetry', telemetry);
            telemetrySink.addTelemetry(telemetry);
          }

          if (session) {
            overlayManager.publishMessage('sessionData', session);
            telemetrySink.addSession(session);
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
    onTelemetry: (callback: (value: Telemetry) => void) => callback({} as Telemetry),
    onSessionData: (callback: (value: Session) => void) => callback({} as Session),
    onRunningState: (callback: (value: boolean) => void) => callback(false),
    stop: () => {
      shouldStop = true;
      clearInterval(runningStateInterval);
    }
  };
}
