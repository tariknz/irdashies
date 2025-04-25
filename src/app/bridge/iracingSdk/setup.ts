import { OverlayManager } from 'src/app/overlayManager';
import { TelemetrySink } from './telemetrySink';
import { ipcMain } from 'electron';
import type { IrSdkBridge } from '@irdashies/types';

let isDemoMode = false;
let currentBridge: IrSdkBridge | undefined;

export async function iRacingSDKSetup(
  telemetrySink: TelemetrySink,
  overlayManager: OverlayManager
) {
  // Listen for demo mode toggle events
  ipcMain.on('toggleDemoMode', async (_, value: boolean) => {
    isDemoMode = value;
    // Stop the current bridge if it exists
    if (currentBridge) {
      currentBridge.stop();
      currentBridge = undefined;
    }
    // Reload the bridge with new mode
    await setupBridge(telemetrySink, overlayManager);
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
      isDemoMode || process.platform === 'darwin'
        ? await import('./mock-data/mockSdkBridge')
        : await import('./iracingSdkBridge');

    const { publishIRacingSDKEvents } = module;
    currentBridge = await publishIRacingSDKEvents(telemetrySink, overlayManager);
  } catch (err) {
    console.error(`Failed to load bridge`);
    throw err;
  }
}
