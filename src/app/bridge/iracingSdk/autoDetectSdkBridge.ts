import type { IrSdkSourceBridge, Session, Telemetry } from '@irdashies/types';
import type { OverlayManager } from '../../overlayManager';
import logger from '../../logger';
import type { SessionLifecycle } from '../../sessionLifecycle';
import type { ChannelBus } from '../channelBridge';
import { selectDetectedSimulator, type Simulator } from './simSelection';

const RETRY_INTERVAL = 1000;

export async function publishAutoDetectedSdkEvents(
  overlayManager: OverlayManager,
  lifecycle?: SessionLifecycle,
  channelBus?: ChannelBus
): Promise<IrSdkSourceBridge> {
  let activeBridge: IrSdkSourceBridge | undefined;
  let shouldStop = false;
  let stopProbes: (() => void) | undefined;
  const telemetryCallbacks = new Set<(value: Telemetry) => void>();
  const sessionCallbacks = new Set<(value: Session) => void>();
  const runningStateCallbacks = new Set<(value: boolean) => void>();
  let lastRunningState: boolean | undefined;
  const activeUnsubscribers: (() => void)[] = [];

  overlayManager.publishMessage('runningState', false);

  const attachBridge = (bridge: IrSdkSourceBridge) => {
    activeBridge = bridge;
    const subscriptions = [
      bridge.onTelemetry((value) =>
        telemetryCallbacks.forEach((callback) => callback(value))
      ),
      bridge.onSessionData((value) =>
        sessionCallbacks.forEach((callback) => callback(value))
      ),
      bridge.onRunningState((value) => {
        lastRunningState = value;
        runningStateCallbacks.forEach((callback) => callback(value));
      }),
    ];
    subscriptions.forEach((unsubscribe) => {
      if (unsubscribe) activeUnsubscribers.push(unsubscribe);
    });
  };

  void (async () => {
    const [{ NativeSDK }, { NativeLmu }] = await Promise.all([
      import('../../irsdk/native'),
      import('../../irsdk/native/lmu'),
    ]);
    if (shouldStop) return;

    const iracing = new NativeSDK();
    const lmu = new NativeLmu();
    stopProbes = () => {
      iracing.stopSDK();
      lmu.stop();
    };

    let simulator: Simulator | undefined;
    let lastProbeState = '';
    while (!shouldStop && !simulator) {
      iracing.startSDK();
      lmu.start();
      const iracingActive = iracing.waitForData(0);
      const lmuFrame = lmu.read();
      const lmuActive =
        lmuFrame.running &&
        lmuFrame.trackName.length > 0 &&
        lmuFrame.numVehicles > 0;
      const probeState = `iracing=${iracingActive ? 'active' : 'inactive'} lmu=${lmuActive ? 'active' : 'inactive'}`;
      if (probeState !== lastProbeState) {
        lastProbeState = probeState;
        logger.info(`[autoDetectSdkBridge] Probe ${probeState}`);
      }
      simulator = selectDetectedSimulator(iracingActive, lmuActive);
      if (!simulator)
        await new Promise((resolve) => setTimeout(resolve, RETRY_INTERVAL));
    }

    stopProbes();
    stopProbes = undefined;
    if (shouldStop || !simulator) return;

    logger.info(
      `[autoDetectSdkBridge] Selected ${simulator} (${lastProbeState})`
    );
    const module =
      simulator === 'lmu'
        ? await import('./lmuSdkBridge')
        : await import('./iracingSdkBridge');
    const bridge = await module.publishIRacingSDKEvents(
      overlayManager,
      lifecycle,
      channelBus
    );
    if (shouldStop) {
      bridge.stop();
      return;
    }
    attachBridge(bridge);
  })().catch((error) => {
    logger.error('[autoDetectSdkBridge] Failed to detect simulator', error);
    stopProbes?.();
  });

  return {
    onTelemetry: (callback) => {
      telemetryCallbacks.add(callback);
      return () => telemetryCallbacks.delete(callback);
    },
    onSessionData: (callback) => {
      sessionCallbacks.add(callback);
      return () => sessionCallbacks.delete(callback);
    },
    onRunningState: (callback) => {
      runningStateCallbacks.add(callback);
      if (lastRunningState !== undefined) callback(lastRunningState);
      return () => runningStateCallbacks.delete(callback);
    },
    stop: () => {
      shouldStop = true;
      stopProbes?.();
      activeUnsubscribers.forEach((unsubscribe) => unsubscribe());
      activeBridge?.stop();
      telemetryCallbacks.clear();
      sessionCallbacks.clear();
      runningStateCallbacks.clear();
    },
    changeCameraNumber: (...args) => activeBridge?.changeCameraNumber(...args),
    changeReplayPosition: (...args) =>
      activeBridge?.changeReplayPosition(...args),
    triggerReplaySessionSearch: (...args) =>
      activeBridge?.triggerReplaySessionSearch(...args),
  };
}
