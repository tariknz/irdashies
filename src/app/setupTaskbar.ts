import { nativeImage, Tray, Menu, app, globalShortcut, desktopCapturer } from 'electron';
import { TelemetrySink } from './bridge/iracingSdk/telemetrySink';
import { OverlayManager } from './overlayManager';
import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { startProfiling, stopProfiling, isProfiling } from './profiler';
import {
  logMemoryUsage,
  takeHeapSnapshot,
  saveMemoryReport,
} from './memoryProfiler';

declare const MAIN_WINDOW_VITE_DEV_SERVER_URL: string;

const isDev = !!MAIN_WINDOW_VITE_DEV_SERVER_URL;

function getIconPath(): string {
  const basePath = isDev 
    ? path.join(__dirname, '../../docs/assets/icons')
    : path.join(process.resourcesPath, 'icons');
  
  return path.join(basePath, 'logo-tray.png');
}

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
    const iconPath = getIconPath();
    const icon = nativeImage.createFromPath(iconPath);
    
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
      // Dev-only profiling tools
      ...(isDev
        ? [
            {
              label: isProfiling()
                ? 'Stop CPU Profiling'
                : 'Start CPU Profiling',
              click: async () => {
                if (isProfiling()) {
                  const filePath = await stopProfiling();
                  console.log('Profile saved to:', filePath);
                } else {
                  await startProfiling();
                }
                this.setupContextMenu();
              },
            },
            {
              label: 'Memory',
              submenu: [
                {
                  label: 'Log Memory Usage',
                  click: async () => {
                    await logMemoryUsage();
                  },
                },
                {
                  label: 'Take Heap Snapshot',
                  click: async () => {
                    const filePath = await takeHeapSnapshot();
                    console.log('Heap snapshot saved to:', filePath);
                  },
                },
                {
                  label: 'Save Memory Report',
                  click: async () => {
                    const filePath = await saveMemoryReport();
                    console.log('Memory report saved to:', filePath);
                  },
                },
              ],
            },
          ]
        : []),
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
