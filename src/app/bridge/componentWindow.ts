import { BrowserWindow } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

interface ComponentWindowOptions {
  componentName: string;
  config?: Record<string, unknown>;
  width?: number;
  height?: number;
}

/**
 * Creates a new Electron window to display a specific component
 * This allows you to open individual components in separate windows
 * with full access to telemetry and dashboard bridges
 * 
 * Example usage (from main process):
 *   openComponentWindow({ componentName: 'standings', width: 1024, height: 768 })
 */
export function openComponentWindow(options: ComponentWindowOptions): BrowserWindow {
  const {
    componentName,
    config = {},
    width = 1024,
    height = 768,
  } = options;

  const componentWindow = new BrowserWindow({
    width,
    height,
    webPreferences: {
      preload: path.join(__dirname, '../../preload.ts'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    show: false,
  });

  // Use the built component renderer with URL parameters
  const rendererPath = path.join(__dirname, '../../index.html');
  const configJson = encodeURIComponent(JSON.stringify(config));
  const queryParams = `?component=${encodeURIComponent(componentName)}&config=${configJson}&mode=electron`;
  
  componentWindow.loadFile(rendererPath, {
    search: queryParams
  });
  
  componentWindow.show();

  return componentWindow;
}
