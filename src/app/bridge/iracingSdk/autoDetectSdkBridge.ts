import type { IrSdkSourceBridge, Session, Telemetry } from '@irdashies/types';
import type { OverlayManager } from '../../overlayManager';
import logger from '../../logger';
import type { SessionLifecycle } from '../../sessionLifecycle';
import type { ChannelBus } from '../channelBridge';
import { getSimDefinitions } from './sims/registry';
import { selectDetectedSimulator } from './simSelection';
import type { SimProbe } from './sims/types';

const RETRY_INTERVAL = 1000;

/**
 * Polls every simulator in the registry until one is running, then hands over
 * to that simulator's bridge.
 *
 * Only reached when the build has more than one simulator to choose between —
 * with a single source, `setup` resolves it outright and never gets here.
 *
 * The returned bridge is a stable façade: it is handed to callers immediately,
 * while detection is still running, and forwards to the real bridge once one
 * exists. Subscribers therefore do not have to care that the source arrived
 * late.
 */
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
    const definitions = getSimDefinitions();
    // Per-definition rather than a bare Promise.all: one source whose native
    // module is missing or wedged should drop out of the running, not reject
    // the batch and end detection for every other simulator.
    const probes = (
      await Promise.all(
        definitions.map(async (definition) => {
          try {
            return { id: definition.id, probe: await definition.createProbe() };
          } catch (error) {
            logger.error(
              `[autoDetectSdkBridge] Failed to create ${definition.id} probe`,
              error
            );
            return undefined;
          }
        })
      )
    ).filter((entry) => entry !== undefined);
    if (shouldStop) return;

    stopProbes = () =>
      probes.forEach(({ id, probe }) => {
        try {
          probe.stop();
        } catch (error) {
          logger.error(
            `[autoDetectSdkBridge] Failed to stop ${id} probe`,
            error
          );
        }
      });

    const readProbe = ({ id, probe }: { id: string; probe: SimProbe }) => {
      try {
        probe.start();
        return probe.isActive();
      } catch (error) {
        // One unhappy source must not end detection for the others — a sim
        // whose native module is missing or wedged should look inactive, not
        // take the whole probe loop down.
        logger.error(`[autoDetectSdkBridge] ${id} probe failed`, error);
        return false;
      }
    };

    let simulator: ReturnType<typeof selectDetectedSimulator>;
    let lastProbeState = '';
    while (!shouldStop && !simulator) {
      const results = probes.map((entry) => ({
        id: entry.id,
        active: readProbe(entry),
      }));
      const probeState = results
        .map(({ id, active }) => `${id}=${active ? 'active' : 'inactive'}`)
        .join(' ');
      if (probeState !== lastProbeState) {
        lastProbeState = probeState;
        logger.info(`[autoDetectSdkBridge] Probe ${probeState}`);
      }
      simulator = selectDetectedSimulator(results);
      if (!simulator)
        await new Promise((resolve) => setTimeout(resolve, RETRY_INTERVAL));
    }

    stopProbes();
    stopProbes = undefined;
    if (shouldStop || !simulator) return;

    logger.info(
      `[autoDetectSdkBridge] Selected ${simulator} (${lastProbeState})`
    );

    const definition = definitions.find(({ id }) => id === simulator);
    if (!definition) return;

    // Only known once the probe settles, so the settings window shows nothing
    // until here rather than guessing.
    const { setActiveSimulator } = await import('./setup');
    // A newer setupBridge may have stopped this detector while it awaited the
    // import. Writing the simulator now would name a sim the newer setup has
    // already replaced, and rebuild every overlay for it.
    if (shouldStop) return;
    setActiveSimulator(overlayManager, simulator);

    const publishEvents = await definition.loadBridge();
    if (shouldStop) return;
    const bridge = await publishEvents(overlayManager, lifecycle, channelBus);
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
