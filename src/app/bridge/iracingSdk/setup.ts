import { OverlayManager } from '../../overlayManager';
import { ipcMain } from 'electron';
import type { IrSdkSourceBridge } from '@irdashies/types';
import logger from '../../logger';
import {
  createSessionLifecycle,
  type SessionLifecycle,
} from '../../sessionLifecycle';
import type { ChannelBus } from '../channelBridge';
import type { ActiveSimulator } from '@irdashies/types';
import { getAvailableSimulators, getSimDefinition } from './sims/registry';
import {
  getSimulatorOverride,
  resolveSimulatorPreference,
  resolveWithoutProbing,
  shouldReuseBridge,
} from './simSelection';
import { getCurrentProfileId, getDashboard } from '../../storage/dashboards';
import { onDashboardUpdated } from '../../storage/dashboardEvents';

let isDemoMode = false;
let currentBridge: IrSdkSourceBridge | undefined;
/**
 * The simulator currently feeding telemetry, or undefined while auto-detection
 * is still probing. Published to the renderer so the settings window can name
 * it, and replayed to overlays that open later.
 */
let activeSimulator: ActiveSimulator | undefined;
/** Tail of the serialised rebuild chain. See queueBridgeSetup. */
let bridgeSetupQueue: Promise<void> = Promise.resolve();
const onBridgeChangedCallbacks = new Set<(bridge: IrSdkSourceBridge) => void>();
/**
 * Main-process listeners for the running simulator. The overlay windows are
 * told through OverlayManager; this is for the parts of main that have no
 * window to receive that message -- the browser bridge proxy.
 */
const onSimulatorChangedCallbacks = new Set<
  (simulator: ActiveSimulator | null) => void
>();

// Singleton lifecycle — created once; survives bridge restarts so subscribers
// registered before a demo-mode toggle are preserved.
let sessionLifecycle: SessionLifecycle | undefined;

export function getSessionLifecycle(): SessionLifecycle {
  if (!sessionLifecycle) {
    sessionLifecycle = createSessionLifecycle();
  }
  return sessionLifecycle;
}

export function getCurrentBridge(): IrSdkSourceBridge | undefined {
  return currentBridge;
}

export function getIsDemoMode(): boolean {
  return isDemoMode;
}

export function getActiveSimulator(): ActiveSimulator | undefined {
  return activeSimulator;
}

/**
 * Records the running simulator and tells the renderer. Auto-detection calls
 * this once it has probed; the pinned paths call it up front.
 */
export function setActiveSimulator(
  overlayManager: OverlayManager,
  simulator: ActiveSimulator | undefined
) {
  if (simulator === activeSimulator) return;
  activeSimulator = simulator;
  // The manager publishes the change and rebuilds the overlays: the set of
  // widgets this sim supports has changed, so windows have to be recreated.
  overlayManager.setActiveSimulator(simulator ?? null);
  onSimulatorChangedCallbacks.forEach((callback) => {
    try {
      callback(simulator ?? null);
    } catch (err) {
      logger.error('Error in simulator changed callback:', err);
    }
  });
}

/**
 * Subscribes to the running simulator from inside the main process.
 *
 * Browser views are not BrowserWindows, so OverlayManager's publish never
 * reaches them; the bridge proxy uses this to forward the change over its
 * WebSocket instead.
 */
export function onActiveSimulatorChanged(
  callback: (simulator: ActiveSimulator | null) => void
) {
  onSimulatorChangedCallbacks.add(callback);
  return () => onSimulatorChangedCallbacks.delete(callback);
}

export function onBridgeChanged(callback: (bridge: IrSdkSourceBridge) => void) {
  onBridgeChangedCallbacks.add(callback);
  return () => onBridgeChangedCallbacks.delete(callback);
}

export async function iRacingSDKSetup(
  overlayManager: OverlayManager,
  channelBus?: ChannelBus
) {
  ipcMain.on('toggleDemoMode', async (_, value: boolean) => {
    isDemoMode = value;

    // Flip the UI immediately; the data source swaps underneath. Otherwise the
    // mode change is gated behind the full bridge teardown/rebuild below
    // (dynamic import, native SDK load, sdk.ready()).
    overlayManager.publishMessage('demoModeChanged', value);
    const { notifyDemoModeChanged } =
      await import('../dashboard/dashboardBridge');
    notifyDemoModeChanged(value);

    await queueBridgeSetup(overlayManager, channelBus);
  });

  // The preference itself is persisted with the rest of the dashboard; this
  // only rebuilds the bridge so the change takes effect without a restart.
  ipcMain.on('simulatorPreferenceChanged', async () => {
    await queueBridgeSetup(overlayManager, channelBus);
  });

  ipcMain.handle('getActiveSimulator', () => activeSimulator ?? null);
  ipcMain.handle('getAvailableSimulators', () => getAvailableSimulators());

  // The preference lives in the dashboard, so it is per-profile: switching to a
  // profile pinned to another simulator has to move the telemetry source with
  // it, or the settings window names one sim while another keeps feeding the
  // overlays. Only a profile change is reconciled -- an ordinary settings save
  // emits the same event, and rebuilding on each one would tear the bridge down
  // on every toggle whenever the resolved sim is still pending a probe.
  let lastProfileId = getCurrentProfileId();
  onDashboardUpdated(() => {
    const profileId = getCurrentProfileId();
    if (profileId === lastProfileId) return;
    lastProfileId = profileId;
    // shouldReuseBridge still guards the rebuild, so profiles that resolve to
    // the same simulator cost nothing.
    void queueBridgeSetup(overlayManager, channelBus);
  });

  await queueBridgeSetup(overlayManager, channelBus);
}

/**
 * Serialises bridge rebuilds.
 *
 * setupBridge stops the current bridge, clears the handle, and only then awaits
 * its replacement. Two overlapping calls would both sail past that stop with
 * nothing left to stop, and the first bridge would be overwritten without ever
 * being stopped -- its telemetry loop and running-state interval publishing for
 * the rest of the session. Overlapping calls are ordinary rather than rare: the
 * simulator dropdown fires a change per keystroke when arrowed through, and a
 * demo-mode toggle can land on top of one.
 *
 * A failed rebuild must not wedge the queue, so the chain swallows rejections;
 * setupBridge logs and rethrows for the caller that asked for this rebuild.
 */
function queueBridgeSetup(
  overlayManager: OverlayManager,
  channelBus?: ChannelBus
): Promise<void> {
  const next = bridgeSetupQueue
    .catch(() => undefined)
    .then(() => setupBridge(overlayManager, channelBus));
  bridgeSetupQueue = next.catch(() => undefined);
  return next;
}

async function setupBridge(
  overlayManager: OverlayManager,
  channelBus?: ChannelBus
) {
  try {
    const isTapeReplay = Boolean(process.env.IRDASHIES_TELEMETRY_REPLAY);
    const isMock =
      isDemoMode || (process.platform !== 'win32' && !isTapeReplay);
    const available = getAvailableSimulators();

    // Tape replay always feeds the iRacing bridge, whatever the preference
    // says: the tape is an iRacing recording.
    const simulator = isTapeReplay
      ? 'iracing'
      : (resolveSimulatorPreference(
          getDashboard(getCurrentProfileId())?.generalSettings?.simulator,
          getSimulatorOverride(process.argv, process.env.IRDASHIES_SIM),
          available
        ) ?? resolveWithoutProbing(available));

    // Resolved before anything is torn down, and entirely synchronously, so
    // the decision sees the bridge that is actually up. Skipping here is what
    // keeps a move between 'auto' and a pinned iRacing from disconnecting the
    // overlays on a single-source build to rebuild the identical bridge.
    if (
      shouldReuseBridge({
        hasLiveBridge: Boolean(currentBridge),
        isMock,
        simulator,
        activeSimulator,
      })
    ) {
      return;
    }

    if (currentBridge) {
      currentBridge.stop();
      currentBridge = undefined;
    }

    const publishIRacingSDKEvents = isMock
      ? (await import('./mock-data/mockSdkBridge')).publishIRacingSDKEvents
      : simulator
        ? await loadSimBridge(simulator)
        : (await import('./autoDetectSdkBridge')).publishAutoDetectedSdkEvents;

    // Known now for a pinned sim, and for a build with only one source. On a
    // real 'auto' the answer is whatever the probe settles on, which
    // autoDetectSdkBridge reports itself; clear it meanwhile so the UI does
    // not name a stale sim.
    setActiveSimulator(overlayManager, isMock ? undefined : simulator);

    const lifecycle = isDemoMode ? undefined : getSessionLifecycle();
    currentBridge = await publishIRacingSDKEvents(
      overlayManager,
      lifecycle,
      channelBus
    );

    if (onBridgeChangedCallbacks.size > 0 && currentBridge) {
      const bridge = currentBridge;
      onBridgeChangedCallbacks.forEach((cb) => cb(bridge));
    }
  } catch (err) {
    logger.error('Failed to load bridge');
    throw err;
  }
}

async function loadSimBridge(simulator: ActiveSimulator) {
  const definition = getSimDefinition(simulator);
  if (!definition) {
    throw new Error(
      `No telemetry source for simulator '${simulator}' in this build`
    );
  }
  return definition.loadBridge();
}
