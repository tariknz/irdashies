import { nativeImage, Tray, Menu, app, globalShortcut, desktopCapturer } from 'electron';
import { TelemetrySink } from './bridge/iracingSdk/telemetrySink';
import { OverlayManager } from './overlayManager';
import { writeFile } from 'node:fs/promises';
import path from 'node:path';

class Taskbar {
  private tray: Tray;

  constructor(
    private telemetrySink: TelemetrySink,
    private overlayManager: OverlayManager
  ) {
    this.tray = this.createTray();
    this.setupContextMenu();
    this.registerShortcuts();
  }

  private createTray(): Tray {
    const icon = nativeImage.createFromDataURL(
      'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABgAAAAYCAYAAADgdz34AAAAAXNSR0IArs4c6QAAAH5JREFUSEvtlUEOgCAMBJdvGfXz6rs0JuIB0zjZpFyUaxeWadlQlLxK8vnqbrBJGgKqVdJ01ajuQbC/tKwSU91vEDb0fjztK6K9pTp7BoukMbj/WZtrzSXA+exuQNHtoFF0e8jpBhTdJqAbqc7OwYcNaA6orv+XSXOAdemf/gFmjSgZ2hbq7gAAAABJRU5ErkJggg=='
    );
    const tray = new Tray(icon);
    tray.setToolTip('irDashies');
    return tray;
  }

  private setupContextMenu(): void {
    const contextMenu = Menu.buildFromTemplate([
      {
        label: 'Settings',
        click: () => {
          this.overlayManager.createSettingsWindow();
        },
      },
      {
        label: 'Lock / Unlock (F6)',
        click: () => {
          this.toggleLockWindows();
        },
      },
      {
        label: 'Save Current Telemetry (F7)',
        click: () => {
          this.saveTelemetry();
        },
      },
      // WIP
      // {
      //   label: 'Record Telemetry',
      //   click: async () => {
      //     await this.telemetrySink.startRecording();
      //   },
      // },
      {
        label: 'Quit',
        click: () => {
          app.quit();
        },
      },
    ]);

    this.tray.setContextMenu(contextMenu);
  }

  private toggleLockWindows(): void {
    this.overlayManager.toggleLockOverlays();
  }

  private async saveTelemetry(): Promise<void> {
    try {
      // First, import and call dumpTelemetry to get the directory path
      const { dumpCurrentTelemetry } = await import('./bridge/iracingSdk/dumpTelemetry');
      const telemetryResult = await dumpCurrentTelemetry();
      
      // Check if dirPath exists and is not null
      const dirPath = telemetryResult && 'dirPath' in telemetryResult ? telemetryResult.dirPath : null;
      if (dirPath) {
        // Capture all screens
        const sources = await desktopCapturer.getSources({
          types: ['screen'],
          thumbnailSize: { width: 1920, height: 1080 } // Use a standard resolution
        });
        
        // Save each screen as a separate file
        await Promise.all(sources.map(async (source, index) => {
          if (source.thumbnail) {
            const screenshotPath = path.join(dirPath, `screenshot_${index + 1}.png`);
            const pngData = source.thumbnail.toPNG();
            await writeFile(screenshotPath, pngData);
            console.log(`Screenshot ${index + 1} saved to: ${screenshotPath}`);
          }
        }));
      }
    } catch (error) {
      console.error('Error capturing screenshots:', error);
    }
  }

  private registerShortcuts(): void {
    globalShortcut.register('F6', () => {
      this.toggleLockWindows();
    });
    globalShortcut.register('F7', () => {
      this.saveTelemetry();
    });
  }
}

export const setupTaskbar = (
  telemetrySink: TelemetrySink,
  overlayManager: OverlayManager
) => {
  new Taskbar(telemetrySink, overlayManager);
};
