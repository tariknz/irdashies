import { ipcMain } from 'electron';
import { OverlayManager } from '../../overlayManager';

/**
 * Telemetry bridge for managing field subscriptions between frontend and main process
 */
export class TelemetryBridge {
  constructor(private overlayManager: OverlayManager) {}

  /**
   * Setup IPC handlers for telemetry field subscriptions
   */
  public setupIpcHandlers(): void {
    ipcMain.handle('subscribe-telemetry-fields', async (event, fields) => {
      try {
        // Validate input
        if (!Array.isArray(fields)) {
          console.warn('Invalid fields parameter for subscribe-telemetry-fields');
          return;
        }

        // Get overlay ID from the webContents that sent the request
        const overlayId = this.getOverlayIdFromWebContents(event.sender);
        if (overlayId) {
          this.overlayManager.subscribeToTelemetryFields(overlayId, fields);
          // Logging is now handled by OverlayManager
        } else {
          console.warn('Could not determine overlay ID for subscription request');
        }
      } catch (error) {
        console.error('Error subscribing to telemetry fields:', error);
        // Don't throw - IPC handlers should handle errors gracefully
      }
    });

    ipcMain.handle('unsubscribe-telemetry-fields', async (event, fields) => {
      try {
        // Validate input
        if (!Array.isArray(fields)) {
          console.warn('Invalid fields parameter for unsubscribe-telemetry-fields');
          return;
        }

        // Get overlay ID from the webContents that sent the request
        const overlayId = this.getOverlayIdFromWebContents(event.sender);
        if (overlayId) {
          this.overlayManager.unsubscribeFromTelemetryFields(overlayId, fields);
          // Logging is now handled by OverlayManager
        } else {
          console.warn('Could not determine overlay ID for unsubscription request');
        }
      } catch (error) {
        console.error('Error unsubscribing from telemetry fields:', error);
        // Don't throw - IPC handlers should handle errors gracefully
      }
    });
  }

  /**
   * Get overlay ID from webContents
   */
  private getOverlayIdFromWebContents(webContents: Electron.WebContents): string | null {
    // Find the overlay that matches this webContents
    const overlays = this.overlayManager.getOverlays();
    for (const { widget, window } of overlays) {
      if (window.webContents === webContents) {
        return widget.id;
      }
    }
    return null;
  }
}
