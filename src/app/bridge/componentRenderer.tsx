/* eslint-disable @typescript-eslint/no-explicit-any */
import { createRoot } from 'react-dom/client';
import React from 'react';
import { WIDGET_MAP } from '../../frontend/WidgetIndex';
import type { IrSdkBridge } from '../../types';
import {
  DashboardProvider,
  useDashboard,
  RunningStateProvider,
  SessionProvider,
  TelemetryProvider,
} from '@irdashies/context';

/**
 * New Approach:
 * Instead of trying to use Electron providers in a browser, we:
 * 1. Mock the Zustand stores with initial data
 * 2. Render components (they will use the mocked store data)
 * 3. When bridge connects, update the stores with real data
 */

/**
 * Web-based bridge that connects to the WebSocket server
 */
class WebSocketBridge implements IrSdkBridge {
  private socket: any;
  private telemetryCallbacks: Set<(data: any) => void>;
  private sessionCallbacks: Set<(data: any) => void>;
  private runningCallbacks: Set<(running: boolean) => void>;
  private isConnecting: boolean;
  private connectionPromise: Promise<void> | null;
  private isConnected: boolean;

  // Dashboard Bridge methods
  private editModeCallbacks: Set<(value: boolean) => void>;
  private dashboardUpdateCallbacks: Set<(value: any) => void>;
  private lastDashboard: any = null;

  constructor() {
    this.telemetryCallbacks = new Set();
    this.sessionCallbacks = new Set();
    this.runningCallbacks = new Set();
    this.editModeCallbacks = new Set();
    this.dashboardUpdateCallbacks = new Set();
    this.socket = null;
    this.isConnecting = false;
    this.isConnected = false;
    this.connectionPromise = null;
  }

  async connect(wsUrl: string): Promise<void> {
    if (this.isConnected) {
      return;
    }

    if (this.connectionPromise) {
      return this.connectionPromise;
    }

    if (this.isConnecting) {
      return;
    }

    this.isConnecting = true;

    this.connectionPromise = new Promise((resolve, reject) => {
      const { io } = window as any;
      if (!io) {
        this.isConnecting = false;
        reject(new Error('Socket.io not loaded'));
        return;
      }

      try {
        this.socket = io(wsUrl, {
          reconnection: true,
          reconnectionDelay: 1000,
          reconnectionDelayMax: 5000,
          reconnectionAttempts: Infinity,
        });

        this.socket.on('connect', () => {
          console.log('✅ Connected to bridge');
          this.isConnecting = false;
          this.isConnected = true;
          resolve();
        });

        this.socket.on('initialState', (state: any) => {
          console.log('📥 Received initialState from bridge:', state);
          console.log('  Telemetry:', state.telemetry ? 'present' : 'missing');
          console.log('  SessionData:', state.sessionData ? 'present' : 'missing');
          console.log('  Dashboard:', state.dashboard ? 'present' : 'missing');
          console.log('  IsRunning:', state.isRunning);

          if (state.telemetry) {
            console.log('  📤 Triggering telemetry callbacks with', Object.keys(state.telemetry).length, 'keys');
            this.telemetryCallbacks.forEach((cb) => {
              try {
                cb(state.telemetry);
              } catch (e) {
                console.error('Error in telemetry callback:', e);
              }
            });
          }
          if (state.sessionData) {
            console.log('  📤 Triggering session callbacks with', Object.keys(state.sessionData).length, 'keys');
            this.sessionCallbacks.forEach((cb) => {
              try {
                cb(state.sessionData);
              } catch (e) {
                console.error('Error in session callback:', e);
              }
            });
          }
          if (state.dashboard) {
            console.log('  📤 Triggering dashboard callbacks...');
            this.lastDashboard = state.dashboard;
            this.dashboardUpdateCallbacks.forEach((cb) => {
              try {
                cb(state.dashboard);
              } catch (e) {
                console.error('Error in dashboard callback:', e);
              }
            });
          }
          if (state.isRunning !== undefined) {
            console.log('  📤 Triggering running state callbacks...');
            this.runningCallbacks.forEach((cb) => {
              try {
                cb(state.isRunning);
              } catch (e) {
                console.error('Error in running state callback:', e);
              }
            });
          }
        });

        this.socket.on('telemetry', (data: any) => {
          this.telemetryCallbacks.forEach((cb) => {
            try {
              cb(data);
            } catch (e) {
              console.error('Error in telemetry callback:', e);
            }
          });
        });

        this.socket.on('sessionData', (data: any) => {
          this.sessionCallbacks.forEach((cb) => {
            try {
              cb(data);
            } catch (e) {
              console.error('Error in session callback:', e);
            }
          });
        });

        this.socket.on('runningState', (running: boolean) => {
          this.runningCallbacks.forEach((cb) => {
            try {
              cb(running);
            } catch (e) {
              console.error('Error in running state callback:', e);
            }
          });
        });

        this.socket.on('dashboardUpdated', (dashboard: any) => {
          console.log('📊 Received dashboardUpdated event');
          this.lastDashboard = dashboard;
          this.dashboardUpdateCallbacks.forEach((cb) => {
            try {
              cb(dashboard);
            } catch (e) {
              console.error('Error in dashboard update callback:', e);
            }
          });
        });

        this.socket.on('connect_error', (err: any) => {
          console.error('WebSocket connection error:', err);
          this.isConnecting = false;
          reject(err);
        });

        this.socket.on('disconnect', () => {
          console.log('❌ Disconnected from bridge');
          this.isConnected = false;
        });

        // Timeout after 10 seconds
        setTimeout(() => {
          if (this.isConnecting) {
            this.isConnecting = false;
            reject(new Error('Connection timeout'));
          }
        }, 10000);
      } catch (error) {
        this.isConnecting = false;
        reject(error);
      }
    });

    return this.connectionPromise;
  }

  onTelemetry(callback: (data: any) => void): void {
    if (!callback) {
      console.warn('onTelemetry called with null callback');
      return;
    }
    this.telemetryCallbacks.add(callback);
  }

  onSessionData(callback: (data: any) => void): void {
    if (!callback) {
      console.warn('onSessionData called with null callback');
      return;
    }
    this.sessionCallbacks.add(callback);
  }

  onRunningState(callback: (running: boolean) => void): void {
    if (!callback) {
      console.warn('onRunningState called with null callback');
      return;
    }
    this.runningCallbacks.add(callback);
  }

  stop(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.isConnected = false;
    }
  }

  onEditModeToggled(callback: (value: boolean) => void): void {
    this.editModeCallbacks.add(callback);
  }

  dashboardUpdated(callback: (value: any) => void): void {
    this.dashboardUpdateCallbacks.add(callback);
    // If we already have a dashboard, send it immediately to the new callback
    if (this.lastDashboard) {
      console.log('📊 Sending cached dashboard to new callback');
      try {
        callback(this.lastDashboard);
      } catch (e) {
        console.error('Error in dashboard callback:', e);
      }
    }
  }

  reloadDashboard(): void {
    console.log('reloadDashboard called');
    // Emit event to Electron if needed
    if (this.socket) {
      this.socket.emit('reloadDashboard');
    }
  }

  saveDashboard(dashboard: any, options?: any): void {
    console.log('saveDashboard called', dashboard);
    if (this.socket) {
      this.socket.emit('saveDashboard', { dashboard, options });
    }
  }

  async resetDashboard(resetEverything: boolean): Promise<any> {
    console.log('resetDashboard called', resetEverything);
    return new Promise((resolve) => {
      if (this.socket) {
        this.socket.emit('resetDashboard', { resetEverything }, (result: any) => {
          resolve(result);
        });
      } else {
        resolve(null);
      }
    });
  }

  async toggleLockOverlays(): Promise<boolean> {
    console.log('toggleLockOverlays called');
    return new Promise((resolve) => {
      if (this.socket) {
        this.socket.emit('toggleLockOverlays', (result: boolean) => {
          resolve(result);
        });
      } else {
        resolve(false);
      }
    });
  }

  async getAppVersion(): Promise<string> {
    console.log('getAppVersion called');
    return new Promise((resolve) => {
      if (this.socket) {
        this.socket.emit('getAppVersion', (version: string) => {
          resolve(version);
        });
      } else {
        resolve('unknown');
      }
    });
  }

  toggleDemoMode(value: boolean): void {
    console.log('toggleDemoMode called', value);
    if (this.socket) {
      this.socket.emit('toggleDemoMode', value);
    }
  }
}

/**
 * Initialize mock data in the Zustand stores
 * This allows components to render even before the bridge connects
 */
async function initializeMockStores(): Promise<void> {
  console.log('🎨 Initializing mock store data...');

  try {
    // Import the stores dynamically to ensure they're loaded
    const { useTelemetryStore } = await import('../../frontend/context/TelemetryStore/TelemetryStore');
    const { useSessionStore } = await import('../../frontend/context/SessionStore/SessionStore');

    // Create minimal mock data that satisfies the Telemetry type
    // Just set empty values - components will render with null/empty state
    const mockTelemetry = {
      SessionTick: { value: [0] },
      DisplayUnits: { value: [0] },
      TrackName: { value: ['Mock Track'] },
      TrackID: { value: ['0'] },
      TrackLength: { value: [0] },
      TrackDisplayName: { value: ['Mock Track'] },
      YawNorth: { value: [0] },
      SteeringWheelAngle: { value: [0] },
      Throttle: { value: [0] },
      Brake: { value: [0] },
      RPM: { value: [0] },
      RpmRedLine: { value: [6500] },
      SessionState: { value: [0] },
      SessionNum: { value: [0] },
      RaceLaps: { value: [0] },
      LapCompleted: { value: [0] },
      LapDist: { value: [0] },
      LapDistPct: { value: [0] },
      TrackTemp: { value: [0] },
      TrackWetness: { value: [0] },
      WindDir: { value: [0] },
      WindVel: { value: [0] },
      AirTemp: { value: [0] },
      AirDensity: { value: [0] },
      Skies: { value: [0] },
      WeatherType: { value: [0] },
      OnPitRoad: { value: [false] },
    } as any;

    // Set mock data in stores
    useTelemetryStore.setState({ telemetry: mockTelemetry });
    useSessionStore.setState({ session: null });

    console.log('✅ Mock data initialized');
  } catch (error) {
    console.error('⚠️ Error initializing mock stores:', error);
    // Continue anyway - components might work without it
  }
}

/**
 * Main export: Render a component to a container element
 */
export async function renderComponent(
  containerElement: HTMLElement,
  componentName: string,
  config: Record<string, any>,
  wsUrl: string
): Promise<void> {
  try {
    console.log('🚀 renderComponent called with:', { componentName, wsUrl });

    // Step 1: Initialize mock stores first
    console.log('📝 Step 1: Initialize mock stores');
    await initializeMockStores();

    // Step 2: Import stores (we'll need them to set up listeners)
    console.log('📝 Step 2: Import Zustand stores');
    console.log('  ✅ Stores imported');

    // Step 3: Create the bridge but DON'T connect yet
    console.log('📝 Step 3: Create WebSocket bridge');
    const bridge = new WebSocketBridge();

    // Step 4: Connect to the bridge
    // The providers will handle subscribing to bridge events
    console.log('📝 Step 4: Connect to WebSocket bridge');
    console.log(`  Connecting to ${wsUrl}...`);
    await bridge.connect(wsUrl);
    console.log('  ✅ Bridge connected');

    // Give the store listeners a moment to process the initialState
    await new Promise((resolve) => setTimeout(resolve, 100));
    console.log('  ✅ Stores will be updated by providers');

    // Step 5: Create root
    console.log('📝 Step 5: Create React root');
    const root = createRoot(containerElement);
    console.log('  ✅ Root created');

    // Step 6: Get component from widget map
    console.log('📝 Step 6: Get component from widget map');
    const normalizedName = componentName.toLowerCase();
    console.log('  Looking for component:', normalizedName);

    const ComponentFn = WIDGET_MAP[normalizedName];

    if (!ComponentFn) {
      throw new Error(
        `Component not found: ${componentName}. Available: ${Object.keys(WIDGET_MAP).join(
          ', '
        )}`
      );
    }

    console.log(`  ✅ Found component: ${componentName}`);

    // Step 7: Render actual component wrapped with providers
    console.log('📝 Step 7: Render actual component with providers');
    console.log('  📋 Component config:', config);

    // Log current store state before rendering
    const { useTelemetryStore: TelemetryStore } = await import('../../frontend/context/TelemetryStore/TelemetryStore');
    const { useSessionStore: SessionStore } = await import('../../frontend/context/SessionStore/SessionStore');
    const currentTelemetry = TelemetryStore.getState().telemetry;
    const currentSession = SessionStore.getState().session;
    console.log('  📊 Current store state:');
    console.log('    Telemetry:', currentTelemetry ? 'present' : 'MISSING');
    console.log('    Session:', currentSession ? 'present' : 'MISSING');

    // Component that applies theme CSS classes - must be inside DashboardProvider
    const ThemeWrapper = () => {
      const { currentDashboard } = useDashboard();
      const settings = currentDashboard?.generalSettings;

      React.useEffect(() => {
        console.log('🎨 ThemeWrapper effect running:', { settings, hasContainer: !!containerElement });
        
        if (!settings) {
          console.log('  ⚠️ No settings yet');
          return;
        }

        // Apply classes directly to the container element we're rendering into
        const targetElement = containerElement;

        // Add overlay-window class if not present (needed for CSS selectors)
        if (!targetElement.classList.contains('overlay-window')) {
          targetElement.classList.add('overlay-window');
        }

        // Remove all existing theme classes
        targetElement.classList.forEach(className => {
          if (className.startsWith('overlay-theme-')) {
            targetElement.classList.remove(className);
          }
        });

        // Add new theme classes based on settings
        if (settings.fontSize) {
          targetElement.classList.add(`overlay-theme-${settings.fontSize}`);
          console.log(`  ✅ Applied font size class: overlay-theme-${settings.fontSize}`);
        }

        if (settings.colorPalette) {
          targetElement.classList.add(`overlay-theme-color-${settings.colorPalette}`);
          console.log(`  ✅ Applied color class: overlay-theme-color-${settings.colorPalette}`);
        }

        console.log('  📊 Final classList:', Array.from(targetElement.classList));
      }, [settings]);

      return <ComponentFn {...config} />;
    };

    const WrappedComponent = (
      <DashboardProvider bridge={bridge as any}>
        <RunningStateProvider bridge={bridge as any}>
          <SessionProvider bridge={bridge as any} />
          <TelemetryProvider bridge={bridge as any} />
          <ThemeWrapper />
        </RunningStateProvider>
      </DashboardProvider>
    );

    root.render(WrappedComponent);

    console.log(`✅ Successfully rendered component: ${componentName}`);
    
    // Debug: Check if anything was actually rendered
    setTimeout(() => {
      const children = containerElement.children;
      console.log(`🔍 Post-render check:`);
      console.log(`  Container children count: ${children.length}`);
      console.log(`  Container innerHTML length: ${containerElement.innerHTML.length}`);
      if (children.length > 0) {
        console.log(`  First child:`, children[0]);
      } else {
        console.warn(`  ⚠️ No children rendered! Component may be conditionally hidden.`);
      }
    }, 1000);
  } catch (error) {
    console.error(`❌ Failed to render component: ${componentName}`, error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorStack = (error instanceof Error ? error.stack : '') || '';
    containerElement.innerHTML = `
      <div style="
        padding: 40px;
        background: #1a1a1a;
        color: #ff6b6b;
        font-family: monospace;
        min-height: 100vh;
        display: flex;
        flex-direction: column;
        justify-content: center;
        align-items: center;
        white-space: pre-wrap;
        overflow: auto;
      ">
        <h1>Error Rendering Component</h1>
        <p style="max-width: 600px; margin: 20px 0;">
          <strong>Component:</strong> ${componentName}
        </p>
        <p style="max-width: 600px; margin: 20px 0;">
          <strong>Message:</strong> ${errorMessage}
        </p>
        <p style="max-width: 600px; margin: 20px 0; font-size: 12px; color: #999;">
          <strong>Stack:</strong> ${errorStack.replace(/</g, '&lt;').replace(/>/g, '&gt;')}
        </p>
      </div>
    `;
  }
}

// Expose to window for direct access
declare global {
  interface Window {
    renderComponent: typeof renderComponent;
  }
}

if (typeof window !== 'undefined') {
  (window as any).renderComponent = renderComponent;
}
