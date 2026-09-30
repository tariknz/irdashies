import type {
  ActiveSimulator,
  IrSdkSourceBridge,
  Session,
  Telemetry,
} from '@irdashies/types';
import type { OverlayManager } from '../../overlayManager';
import logger from '../../logger';
import type { SessionLifecycle } from '../../sessionLifecycle';
import type { ChannelBus } from '../channelBridge';
import { getSimDefinitions } from './sims/registry';
import { selectDetectedSimulator } from './simSelection';
import type { SimDefinition, SimProbe } from './sims/types';

const RETRY_INTERVAL = 1000;

interface Probe {
  id: ActiveSimulator;
  probe: SimProbe;
}

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
 *
 * Once a simulator is attached, a watchdog keeps the app following whichever
 * source is actually running: each sim's own bridge only knows how to wait for
 * that one sim to come back, so without this, closing one sim and opening
 * another would leave irdashies deaf until it was restarted. The watchdog
 * deliberately does *not* tear the attached bridge down to go looking — see
 * `startWatchdog`.
 */
export async function publishAutoDetectedSdkEvents(
  overlayManager: OverlayManager,
  lifecycle?: SessionLifecycle,
  channelBus?: ChannelBus
): Promise<IrSdkSourceBridge> {
  let activeBridge: IrSdkSourceBridge | undefined;
  let detachActiveBridge: (() => void) | undefined;
  let shouldStop = false;
  let stopProbes: (() => void) | undefined;
  let stopWatchdog: (() => void) | undefined;
  const telemetryCallbacks = new Set<(value: Telemetry) => void>();
  const sessionCallbacks = new Set<(value: Session) => void>();
  const runningStateCallbacks = new Set<(value: boolean) => void>();
  let lastRunningState: boolean | undefined;

  const definitions = getSimDefinitions();

  overlayManager.publishMessage('runningState', false);

  /**
   * Per-definition rather than a bare Promise.all: one source whose native
   * module is missing or wedged should drop out of the running, not reject the
   * batch and end detection for every other simulator.
   */
  const createProbes = async (candidates: SimDefinition[]): Promise<Probe[]> =>
    (
      await Promise.all(
        candidates.map(async (definition) => {
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

  /**
   * A single function that releases a whole set of probes.
   *
   * Each stop is guarded, so one source that cannot be shut down cleanly does
   * not leave the rest of the set running.
   */
  const stopperFor = (probes: Probe[]) => () =>
    probes.forEach(({ id, probe }) => {
      try {
        probe.stop();
      } catch (error) {
        logger.error(`[autoDetectSdkBridge] Failed to stop ${id} probe`, error);
      }
    });

  /** Whether one simulator is running, treating a broken probe as inactive. */
  const readProbe = ({ id, probe }: Probe) => {
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

  /**
   * A round of probe results as one line, for the log.
   *
   * Callers compare it against the previous round and only log a change, so a
   * loop running at 1 Hz does not fill the log with identical lines.
   */
  const describeProbes = (results: { id: string; active: boolean }[]) =>
    results
      .map(({ id, active }) => `${id}=${active ? 'active' : 'inactive'}`)
      .join(' ');

  /** Stops watching for a replacement, and allows a later watch to start. */
  const cancelWatchdog = () => {
    stopWatchdog?.();
    stopWatchdog = undefined;
  };

  /**
   * Lets go of the attached simulator entirely: unsubscribes from it, cancels
   * any watch it started, and shuts its bridge down.
   */
  const detachAndStopActiveBridge = () => {
    detachActiveBridge?.();
    detachActiveBridge = undefined;
    activeBridge?.stop();
    activeBridge = undefined;
  };

  /**
   * Watches for a *different* simulator while the attached one is not running.
   *
   * The attached bridge and `activeSimulator` are both left alone. Tearing them
   * down here would be far more expensive than it looks: clearing the active
   * simulator rebuilds every overlay window, and the trigger is not rare. The
   * iRacing bridge reports `running=false` from `irsdk_isConnected`, which drops
   * when the driver merely returns to the iRacing UI between sessions — so a
   * teardown would cost two full window rebuilds on an ordinary session exit,
   * for a source that is about to come straight back.
   *
   * Instead the bridge stays up and keeps waiting for its own sim, while this
   * probes only the others. Nothing changes until one of them is genuinely
   * running; if the attached sim returns first, this cancels silently.
   *
   * The attached sim is excluded from the probing, so its live bridge keeps sole
   * ownership of its SDK handle.
   */
  const startWatchdog = (attachedId: ActiveSimulator) => {
    if (stopWatchdog) return;
    const others = definitions.filter(({ id }) => id !== attachedId);
    if (!others.length) return;

    let cancelled = false;
    let stopOwnProbes: (() => void) | undefined;
    stopWatchdog = () => {
      cancelled = true;
      stopOwnProbes?.();
      stopOwnProbes = undefined;
    };

    logger.info(
      `[autoDetectSdkBridge] ${attachedId} is not running; watching for [${others
        .map(({ id }) => id)
        .join(', ')}]`
    );

    void (async () => {
      const probes = await createProbes(others);
      if (cancelled || shouldStop) {
        stopperFor(probes)();
        return;
      }
      stopOwnProbes = stopperFor(probes);

      let lastProbeState = '';
      while (!cancelled && !shouldStop) {
        const results = probes.map((entry) => ({
          id: entry.id,
          active: readProbe(entry),
        }));
        const probeState = describeProbes(results);
        if (probeState !== lastProbeState) {
          lastProbeState = probeState;
          logger.info(`[autoDetectSdkBridge] Watch ${probeState}`);
        }

        const simulator = selectDetectedSimulator(results);
        if (simulator) {
          stopOwnProbes?.();
          stopOwnProbes = undefined;
          if (cancelled || shouldStop) return;
          logger.info(
            `[autoDetectSdkBridge] ${simulator} took over from ${attachedId}`
          );
          // Cancels this watchdog on the way through, via detachActiveBridge.
          detachAndStopActiveBridge();
          await attachSimulator(simulator, probeState);
          return;
        }

        await new Promise((resolve) => setTimeout(resolve, RETRY_INTERVAL));
      }

      stopOwnProbes?.();
    })().catch((error) => {
      logger.error(
        `[autoDetectSdkBridge] Watching for a simulator to replace ${attachedId} failed`,
        error
      );
      cancelWatchdog();
    });
  };

  /**
   * Points the façade at one simulator's bridge and starts following it.
   *
   * Forwards its telemetry, session data and running state to this façade's own
   * subscribers, and uses the running state to decide when to go looking for a
   * replacement.
   */
  const attachBridge = (
    bridge: IrSdkSourceBridge,
    simulator: ActiveSimulator
  ) => {
    activeBridge = bridge;
    // Only a sim that was genuinely up can have gone away. A bridge replaying
    // `false` because it has not connected yet must not start the watchdog:
    // that would hand the session to a lower-priority sim on a startup blip,
    // rather than waiting for the one auto-detect actually chose.
    let sawRunning = false;
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
        if (value) {
          sawRunning = true;
          // Back on its own, so there is nothing to replace it with.
          cancelWatchdog();
          return;
        }
        if (sawRunning && !shouldStop) startWatchdog(simulator);
      }),
    ];
    detachActiveBridge = () => {
      cancelWatchdog();
      subscriptions.forEach((unsubscribe) => unsubscribe?.());
    };
  };

  /** Loads and attaches one simulator's bridge, and names it to the renderer. */
  const attachSimulator = async (
    simulator: ActiveSimulator,
    probeState: string
  ) => {
    const definition = definitions.find(({ id }) => id === simulator);
    if (!definition) return;

    logger.info(`[autoDetectSdkBridge] Selected ${simulator} (${probeState})`);

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
    attachBridge(bridge, simulator);
  };

  /** Probes every registered sim until one is running, then hands off to it. */
  const runInitialDetection = async () => {
    const probes = await createProbes(definitions);
    if (shouldStop) {
      stopperFor(probes)();
      return;
    }
    stopProbes = stopperFor(probes);

    let simulator: ReturnType<typeof selectDetectedSimulator>;
    let lastProbeState = '';
    while (!shouldStop && !simulator) {
      const results = probes.map((entry) => ({
        id: entry.id,
        active: readProbe(entry),
      }));
      const probeState = describeProbes(results);
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

    await attachSimulator(simulator, lastProbeState);
  };

  void runInitialDetection().catch((error) => {
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
      detachAndStopActiveBridge();
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
