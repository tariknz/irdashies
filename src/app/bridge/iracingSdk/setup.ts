import { OverlayManager } from 'src/app/overlayManager';
import { TelemetrySink } from './telemetrySink';
import { ipcMain } from 'electron';
import type { IrSdkBridge } from '@irdashies/types';

let isDemoMode = false;
let currentBridge: IrSdkBridge | undefined;
let onBridgeChangedCallback: ((bridge: IrSdkBridge) => void) | undefined;

export function getCurrentBridge(): IrSdkBridge | undefined {
  return currentBridge;
}

export function getIsDemoMode(): boolean {
  return isDemoMode;
}

export function onBridgeChanged(callback: (bridge: IrSdkBridge) => void) {
  onBridgeChangedCallback = callback;
}

export async function iRacingSDKSetup(
  telemetrySink: TelemetrySink,
  overlayManager: OverlayManager
) {
  // Listen for demo mode toggle events
  ipcMain.on('toggleDemoMode', async (_, value: boolean) => {
    console.log('🎭 toggleDemoMode received in iracingSdk setup:', value);
    isDemoMode = value;
    // Stop the current bridge if it exists
    if (currentBridge) {
      currentBridge.stop();
      currentBridge = undefined;
    }
    // Reload the bridge with new mode
    await setupBridge(telemetrySink, overlayManager);
    
    // Notify overlay manager so it can broadcast to overlay windows
    overlayManager.publishMessage('demoModeChanged', value);
    
    // Also notify dashboard bridge callbacks (for WebSocket clients)
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
    // Stop any existing bridge
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
    
    // Notify callback if registered (for component server)
    if (onBridgeChangedCallback && currentBridge) {
      console.log('🔄 Notifying bridge changed callback...');
      onBridgeChangedCallback(currentBridge);
    }
  } catch (err) {
    console.error(`Failed to load bridge`);
    throw err;
  }
}
