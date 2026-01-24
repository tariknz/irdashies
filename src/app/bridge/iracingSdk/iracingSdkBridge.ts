import { IRacingSDK } from '../../irsdk';
import { TelemetrySink } from './telemetrySink';
import { OverlayManager } from '../../overlayManager';
import type { IrSdkBridge, Session, Telemetry } from '@irdashies/types';

const WAIT_TIMEOUT = 16; // 60Hz max (SDK publishes at 60Hz)

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

        let lastSessionVersion = -1;

        while (!shouldStop && sdk.waitForData(WAIT_TIMEOUT)) {
          const telemetry = sdk.getTelemetry();

          // Only fetch session data when it actually changes
          let session: Session | null = null;
          if (sdk.currDataVersion !== lastSessionVersion) {
            session = sdk.getSessionData();
            lastSessionVersion = sdk.currDataVersion;
          }

          if (telemetry) {
            // Batch IPC: single message with both telemetry and session (if changed)
            overlayManager.publishMessage('sdkData', {
              telemetry,
              session: session || undefined
            });

            telemetrySink.addTelemetry(telemetry);
            telemetryCallbacks.forEach(callback => callback(telemetry));
          }

          // Only notify session callbacks when session actually changed
          if (session) {
            telemetrySink.addSession(session);
            sessionCallbacks.forEach(callback => callback(session));
          }
        }

        console.log('iRacing is no longer publishing telemetry');
        sdk.stopSDK();
      } else {
        console.log('iRacing is not running');
      }

      await new Promise((resolve) => setTimeout(resolve, 1000));
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
