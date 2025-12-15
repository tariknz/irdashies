import { IRacingSDK } from '../../irsdk';
import { TelemetrySink } from './telemetrySink';
import { OverlayManager } from '../../overlayManager';
import type { IrSdkBridge, Session, Telemetry } from '@irdashies/types';

const TIMEOUT = 66; // 15Hz update rate (1000/15 ≈ 66.67ms)

export async function publishIRacingSDKEvents(
  telemetrySink: TelemetrySink,
  overlayManager: OverlayManager
): Promise<IrSdkBridge> {
  console.log('Loading iRacing SDK bridge...');

  let shouldStop = false;
  const telemetryCallbacks: ((value: Telemetry) => void)[] = [];
  const sessionCallbacks: ((value: Session) => void)[] = [];
  const runningStateCallbacks: ((value: boolean) => void)[] = [];

  const runningStateInterval = setInterval(async () => {
    const isSimRunning = await IRacingSDK.IsSimRunning();
    console.log('Sending running state to window', isSimRunning);
    overlayManager.publishMessage('runningState', isSimRunning);
    // Notify all subscribers
    runningStateCallbacks.forEach(callback => callback(isSimRunning));
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

          if (telemetry) {
            overlayManager.publishMessage('telemetry', telemetry);
            telemetrySink.addTelemetry(telemetry);
            // Notify all subscribers
            telemetryCallbacks.forEach(callback => callback(telemetry));
          }

          if (session) {
            overlayManager.publishMessage('sessionData', session);
            telemetrySink.addSession(session);
            // Notify all subscribers
            sessionCallbacks.forEach(callback => callback(session));
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
    onTelemetry: (callback: (value: Telemetry) => void) => {
      telemetryCallbacks.push(callback);
      return () => {
        const index = telemetryCallbacks.indexOf(callback);
        if (index > -1) telemetryCallbacks.splice(index, 1);
      };
    },
    onSessionData: (callback: (value: Session) => void) => {
      sessionCallbacks.push(callback);
      return () => {
        const index = sessionCallbacks.indexOf(callback);
        if (index > -1) sessionCallbacks.splice(index, 1);
      };
    },
    onRunningState: (callback: (value: boolean) => void) => {
      runningStateCallbacks.push(callback);
      return () => {
        const index = runningStateCallbacks.indexOf(callback);
        if (index > -1) runningStateCallbacks.splice(index, 1);
      };
    },
    stop: () => {
      shouldStop = true;
      clearInterval(runningStateInterval);
    }
  };
}
