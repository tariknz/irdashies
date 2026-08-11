import { OverlayManager } from '../../overlayManager';
import { ipcMain } from 'electron';
import type { IrSdkSourceBridge } from '@irdashies/types';
import logger from '../../logger';
import {
  createSessionLifecycle,
  type SessionLifecycle,
} from '../../sessionLifecycle';
import type { ChannelBus } from '../channelBridge';

let isDemoMode = false;
let currentBridge: IrSdkSourceBridge | undefined;
const onBridgeChangedCallbacks = new Set<(bridge: IrSdkSourceBridge) => void>();

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
    if (currentBridge) {
      currentBridge.stop();
      currentBridge = undefined;
    }

    // Flip the UI immediately; the data source swaps underneath. Otherwise the
    // mode change is gated behind the full bridge teardown/rebuild below
    // (dynamic import, native SDK load, sdk.ready()).
    overlayManager.publishMessage('demoModeChanged', value);
    const { notifyDemoModeChanged } =
      await import('../dashboard/dashboardBridge');
    notifyDemoModeChanged(value);

    await setupBridge(overlayManager, channelBus);
  });

  await setupBridge(overlayManager, channelBus);
}

async function setupBridge(
  overlayManager: OverlayManager,
  channelBus?: ChannelBus
) {
  try {
    if (currentBridge) {
      currentBridge.stop();
      currentBridge = undefined;
    }

    const isTapeReplay = Boolean(process.env.IRDASHIES_TELEMETRY_REPLAY);
    const module =
      isDemoMode || (process.platform !== 'win32' && !isTapeReplay)
        ? await import('./mock-data/mockSdkBridge')
        : await import('./iracingSdkBridge');

    const { publishIRacingSDKEvents } = module;
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
