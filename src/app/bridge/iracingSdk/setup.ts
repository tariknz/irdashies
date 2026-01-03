import { OverlayManager } from 'src/app/overlayManager';
import { TelemetrySink } from './telemetrySink';
import { ipcMain } from 'electron';
import type { IrSdkBridge } from '@irdashies/types';

let isDemoMode = false;
let currentBridge: IrSdkBridge | undefined;
const onBridgeChangedCallbacks = new Set<(bridge: IrSdkBridge) => void>();

export function getCurrentBridge(): IrSdkBridge | undefined {
  return currentBridge;
}

export function getIsDemoMode(): boolean {
  return isDemoMode;
}

export function onBridgeChanged(callback: (bridge: IrSdkBridge) => void) {
  onBridgeChangedCallbacks.add(callback);
  return () => onBridgeChangedCallbacks.delete(callback);
}

export async function iRacingSDKSetup(
  telemetrySink: TelemetrySink,
  overlayManager: OverlayManager
) {
  ipcMain.on('toggleDemoMode', async (_, value: boolean) => {
    isDemoMode = value;
    if (currentBridge) {
      currentBridge.stop();
      currentBridge = undefined;
    }
    await setupBridge(telemetrySink, overlayManager);
    
    overlayManager.publishMessage('demoModeChanged', value);
    
    const { notifyDemoModeChanged } = await import('../dashboard/dashboardBridge');
    notifyDemoModeChanged(value);
  });

  await setupBridge(telemetrySink, overlayManager);
}

async function setupBridge(
  telemetrySink: TelemetrySink,
  overlayManager: OverlayManager
) {
  try {
    if (currentBridge) {
      currentBridge.stop();
      currentBridge = undefined;
    }

    const module =
      isDemoMode || process.platform !== 'win32'
        ? await import('./mock-data/mockSdkBridge')
        : await import('./iracingSdkBridge');

    const { publishIRacingSDKEvents } = module;
    currentBridge = await publishIRacingSDKEvents(telemetrySink, overlayManager);
    
    if (onBridgeChangedCallbacks.size > 0 && currentBridge) {
      const bridge = currentBridge;
      onBridgeChangedCallbacks.forEach(cb => cb(bridge));
    }
  } catch (err) {
    console.error('Failed to load bridge');
    throw err;
  }
}
