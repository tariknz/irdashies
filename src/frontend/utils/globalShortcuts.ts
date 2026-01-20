import { app, globalShortcut } from 'electron';
import { OverlayManager } from 'src/app/overlayManager';


export function registerHideUiShortcut(overlayManager: OverlayManager) {
  let hideState = false;
  const accel = 'Alt+H';

  app.whenReady().then(() => {
    const registered = globalShortcut.register(accel, () => {
      // Toggle internal state and notify all overlay windows
      hideState = !hideState;
      overlayManager.getOverlays().forEach(({ window }) => {
        window.webContents.send('global-toggle-hide', hideState);
      });
    });

    if (!registered) {
      console.error(`Failed to register global shortcut: ${accel}`);
    }
  });

  // Cleanup when the app is quitting
  app.on('will-quit', () => {
    globalShortcut.unregister(accel);
    globalShortcut.unregisterAll();
  });
}
