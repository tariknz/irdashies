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
  const telemetryCallbacks = new Set<(value: Telemetry) => void>();
  const sessionCallbacks = new Set<(value: Session) => void>();
  const runningStateCallbacks = new Set<(value: boolean) => void>();

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
        let lastSessionVersion = -1;
        sdk.autoEnableTelemetry = true;

        await sdk.ready();

        while (!shouldStop && sdk.waitForData(TIMEOUT)) {
          const telemetry = sdk.getTelemetry();
          const session = sdk.getSessionData();
          await new Promise((resolve) => setTimeout(resolve, 1000 / 25)); // 25Hz update rate

          if (telemetry) {
            overlayManager.publishMessage('telemetry', telemetry);
            telemetrySink.addTelemetry(telemetry);
            // Notify all subscribers
            telemetryCallbacks.forEach(callback => callback(telemetry));
          }

          if (session && sdk.currDataVersion !== lastSessionVersion) {
            lastSessionVersion = sdk.currDataVersion;
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
      telemetryCallbacks.add(callback);
      return () => {
        telemetryCallbacks.delete(callback);
      };
    },
    onSessionData: (callback: (value: Session) => void) => {
      sessionCallbacks.add(callback);
      return () => {
        sessionCallbacks.delete(callback);
      };
    },
    onRunningState: (callback: (value: boolean) => void) => {
      runningStateCallbacks.add(callback);
      return () => {
        runningStateCallbacks.delete(callback);
      };
    },
    stop: () => {
      shouldStop = true;
      clearInterval(runningStateInterval);
    }
  };
}
