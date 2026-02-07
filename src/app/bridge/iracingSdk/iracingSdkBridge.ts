import { IRacingSDK } from '../../irsdk';
import { TelemetrySink } from './telemetrySink';
import { OverlayManager } from '../../overlayManager';
import { TelemetryPerfMetrics } from '../../perfMetrics';
import type { IrSdkBridge, Session, Telemetry } from '@irdashies/types';

const TIMEOUT = 1000;

export async function publishIRacingSDKEvents(
  telemetrySink: TelemetrySink,
  overlayManager: OverlayManager
): Promise<IrSdkBridge> {
  console.log('[iracingSdkBridge] Loading iRacing SDK bridge...');

  const perfMetrics = new TelemetryPerfMetrics();
  perfMetrics.startReporting();

  let shouldStop = false;
  let lastRunningState: boolean | undefined = undefined;
  let latestTelemetry: Telemetry | null = null;
  let latestSession: Session | null = null;

  const telemetryCallbacks = new Set<(value: Telemetry) => void>();
  const sessionCallbacks = new Set<(value: Session) => void>();
  const runningStateCallbacks = new Set<(value: boolean) => void>();

  overlayManager.onOverlayReady((id) => {
    console.log(
      '[iracingSdkBridge] New window ready, sending initial data: ',
      id
    );
    if (lastRunningState !== undefined)
      overlayManager.publishMessageToOverlay(
        id,
        'runningState',
        lastRunningState
      );
    if (latestTelemetry)
      overlayManager.publishMessageToOverlay(id, 'telemetry', latestTelemetry);
    if (latestSession)
      overlayManager.publishMessageToOverlay(id, 'sessionData', latestSession);
  });

  const runningStateSdk = new IRacingSDK();
  await runningStateSdk.ready();

  const runningStateInterval = setInterval(() => {
    const isSimRunning = runningStateSdk.sessionStatusOK;
    if (isSimRunning === lastRunningState) {
      return;
    }
    lastRunningState = isSimRunning;
    console.log(
      '[iracingSdkBridge] Sending running state to window',
      isSimRunning
    );
    overlayManager.publishMessage('runningState', isSimRunning);
    runningStateCallbacks.forEach((callback) => callback(isSimRunning));
  }, 5000);

  // Start the telemetry loop in the background
  (async () => {
    const sdk = new IRacingSDK();
    sdk.autoEnableTelemetry = true;
    await sdk.ready();

    while (!shouldStop) {
      if (sdk.sessionStatusOK) {
        console.log('[iracingSdkBridge] iRacing is running');
        let lastSessionVersion = -1;
        let lastSessionPublishTime = 0;

        while (!shouldStop && sdk.waitForData(TIMEOUT)) {
          perfMetrics.markStart('processTelemetry');
          const telemetry = sdk.getTelemetry();
          const session = sdk.getSessionData();
          await new Promise((resolve) => setTimeout(resolve, 1000 / 25)); // 25Hz update rate

          if (telemetry) {
            latestTelemetry = telemetry;
            perfMetrics.markStart('broadcast');
            overlayManager.publishMessage('telemetry', telemetry);
            perfMetrics.markEnd('broadcast');
            telemetrySink.addTelemetry(telemetry);
            telemetryCallbacks.forEach((callback) => callback(telemetry));
          }

          if (session) {
            // Only publish the session data if it has changed or if 1 second has passed since the last publish
            const now = Date.now();
            const timeSinceLastPublish = now - lastSessionPublishTime;
            if (
              sdk.currDataVersion !== lastSessionVersion ||
              timeSinceLastPublish >= 1000
            ) {
              lastSessionVersion = sdk.currDataVersion;
              lastSessionPublishTime = now;
              latestSession = session;
              overlayManager.publishMessage('sessionData', session);
              telemetrySink.addSession(session);
              sessionCallbacks.forEach((callback) => callback(session));
            }
          }
          perfMetrics.markEnd('processTelemetry');
          perfMetrics.tick();
        }

        console.log(
          '[iracingSdkBridge] iRacing is no longer publishing telemetry'
        );
      } else {
        console.log('[iracingSdkBridge] iRacing is not running');
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
      perfMetrics.stopReporting();
    },
  };
}
