import { createRoot } from 'react-dom/client';
import {
  TelemetryProvider,
  DashboardProvider,
  RunningStateProvider,
  SessionProvider,
} from '@irdashies/context';
import type { DashboardBridge, IrSdkBridge } from '@irdashies/types';
import { WIDGET_MAP } from './WidgetIndex';

export type ComponentLoaderConfig = Record<string, unknown>;

/**
 * Client-side component loader for serving individual components via HTTP
 * Dynamically loads and renders a specified component with optional configuration
 * 
 * This loader assumes we're running within an Electron context where
 * window.dashboardBridge and window.irsdkBridge are available
 */
export default class ComponentLoader {
  private componentName: string;
  private config: ComponentLoaderConfig;

  constructor(componentName: string, config: ComponentLoaderConfig = {}) {
    this.componentName = componentName;
    this.config = config;
  }

  /**
   * Load and render the component
   */
  public async load(): Promise<void> {
    const appContainer = document.getElementById('app');
    if (!appContainer) {
      console.error('Root element #app not found');
      return;
    }

    try {
      // Get the component from the widget map (case-insensitive)
      const Component =
        WIDGET_MAP[this.componentName.toLowerCase()] ||
        WIDGET_MAP[this.componentName];

      if (!Component) {
        this.showError(
          appContainer,
          `Component not found: ${this.componentName}`,
          `Available: ${Object.keys(WIDGET_MAP).join(', ')}`
        );
        return;
      }

      // Get bridge objects from window (exposed by preload)
      const dashboardBridge = (
        window as unknown as { dashboardBridge?: DashboardBridge }
      ).dashboardBridge;
      const irsdkBridge = (window as unknown as { irsdkBridge?: IrSdkBridge })
        .irsdkBridge;

      if (!dashboardBridge || !irsdkBridge) {
        this.showError(
          appContainer,
          'Missing bridge context',
          'Bridges not available. Make sure you are running within the Electron app.'
        );
        return;
      }

      // Create root and render component with providers
      const root = createRoot(appContainer);

      root.render(
        <>
          <DashboardProvider bridge={dashboardBridge}>
            <RunningStateProvider bridge={irsdkBridge}>
              <SessionProvider bridge={irsdkBridge} />
              <TelemetryProvider bridge={irsdkBridge} />
              <div style={{ width: '100%', height: '100%' }}>
                <Component {...this.config} />
              </div>
            </RunningStateProvider>
          </DashboardProvider>
        </>
      );

      console.log(`✅ Loaded component: ${this.componentName}`);
    } catch (error) {
      console.error(`❌ Failed to load component: ${this.componentName}`, error);
      this.showError(
        appContainer,
        'Error loading component',
        error instanceof Error ? error.message : String(error)
      );
    }
  }

  private showError(
    container: HTMLElement,
    title: string,
    message: string
  ): void {
    container.innerHTML = `
      <div style="
        padding: 20px;
        color: #ff6b6b;
        font-family: monospace;
        text-align: center;
      ">
        <h2 style="margin-bottom: 10px;">${title}</h2>
        <p style="opacity: 0.8;">${message}</p>
      </div>
    `;
  }
}
