import { OverlayManager } from 'src/app/overlayManager';
import { TelemetrySink } from './telemetrySink';
import { ipcMain } from 'electron';
import type { IrSdkBridge } from '@irdashies/types';
import { writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';

const DEBUG_LOG_DIR = 'C:\\Temp\\irdashies';

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
  // === DEBUG TELEMETRY LOGGING (temporary) ===
  ipcMain.handle('writeDebugLog', async (_, filename: string, content: string) => {
    try {
      await mkdir(DEBUG_LOG_DIR, { recursive: true });
      const filePath = path.join(DEBUG_LOG_DIR, filename);
      await writeFile(filePath, content, 'utf-8');
      return { success: true, path: filePath };
    } catch (err) {
      console.error('Failed to write debug log:', err);
      return { success: false, error: String(err) };
    }
  });

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
