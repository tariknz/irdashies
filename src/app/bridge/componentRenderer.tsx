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

// Check if debug mode is enabled
const isDebugMode = () => typeof window !== 'undefined' && (window as any).__DEBUG_MODE__ === true;

// Conditional console logging
const debugLog = (...args: any[]) => {
  if (isDebugMode()) {
    console.log(...args);
  }
};

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
  private socket: WebSocket | null;
  private telemetryCallbacks: Set<(data: any) => void>;
  private sessionCallbacks: Set<(data: any) => void>;
  private runningCallbacks: Set<(running: boolean) => void>;
  private isConnecting: boolean;
  private connectionPromise: Promise<void> | null;
  private isConnected: boolean;
  private wsUrl: string;
  private reconnectTimer: ReturnType<typeof setTimeout> | null;
  private reconnectAttempts: number;
  private maxReconnectAttempts: number;
  private reconnectDelay: number;
  private reconnectDelayMax: number;

  // Dashboard Bridge methods
  private editModeCallbacks: Set<(value: boolean) => void>;
  private dashboardUpdateCallbacks: Set<(value: any) => void>;
  private demoModeCallbacks: Set<(value: boolean) => void>;
  private lastDashboard: any = null;
  private currentIsDemoMode = false;

  constructor() {
    this.telemetryCallbacks = new Set();
    this.sessionCallbacks = new Set();
    this.runningCallbacks = new Set();
    this.editModeCallbacks = new Set();
    this.dashboardUpdateCallbacks = new Set();
    this.demoModeCallbacks = new Set();
    this.socket = null;
    this.isConnecting = false;
    this.isConnected = false;
    this.connectionPromise = null;
    this.wsUrl = '';
    this.reconnectTimer = null;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = Infinity;
    this.reconnectDelay = 1000;
    this.reconnectDelayMax = 5000;
  }

  private handleMessage(event: MessageEvent) {
    try {
      const message = JSON.parse(event.data);
      const { type, data } = message;

      switch (type) {
        case 'initialState': {
          const state = data;
          debugLog('📥 Received initialState from bridge:', state);
          debugLog('  Telemetry:', state.telemetry ? 'present' : 'missing');
          debugLog('  SessionData:', state.sessionData ? 'present' : 'missing');
          debugLog('  Dashboard:', state.dashboard ? 'present' : 'missing');
          debugLog('  IsRunning:', state.isRunning);

          if (state.telemetry) {
            debugLog('  📤 Triggering telemetry callbacks with', Object.keys(state.telemetry).length, 'keys');
            this.telemetryCallbacks.forEach((cb) => {
              try {
                cb(state.telemetry);
              } catch (e) {
                console.error('Error in telemetry callback:', e);
              }
            });
          }
          if (state.sessionData) {
            debugLog('  📤 Triggering session callbacks with', Object.keys(state.sessionData).length, 'keys');
            this.sessionCallbacks.forEach((cb) => {
              try {
                cb(state.sessionData);
              } catch (e) {
                console.error('Error in session callback:', e);
              }
            });
          }
          if (state.dashboard) {
            debugLog('  📤 Triggering dashboard callbacks...');
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
            debugLog('  📤 Triggering running state callbacks...');
            this.runningCallbacks.forEach((cb) => {
              try {
                cb(state.isRunning);
              } catch (e) {
                console.error('Error in running state callback:', e);
              }
            });
          }
          if (state.isDemoMode !== undefined) {
            debugLog('  📤 Triggering demo mode callbacks...');
            this.currentIsDemoMode = state.isDemoMode;
            this.demoModeCallbacks.forEach((cb) => {
              try {
                cb(state.isDemoMode);
              } catch (e) {
                console.error('Error in demo mode callback:', e);
              }
            });
          }
          break;
        }
        case 'telemetry':
          this.telemetryCallbacks.forEach((cb) => {
            try {
              cb(data);
            } catch (e) {
              console.error('Error in telemetry callback:', e);
            }
          });
          break;
        case 'sessionData':
          this.sessionCallbacks.forEach((cb) => {
            try {
              cb(data);
            } catch (e) {
              console.error('Error in session callback:', e);
            }
          });
          break;
        case 'runningState':
          this.runningCallbacks.forEach((cb) => {
            try {
              cb(data);
            } catch (e) {
              console.error('Error in running state callback:', e);
            }
          });
          break;
        case 'dashboardUpdated':
          debugLog('📊 Received dashboardUpdated event');
          this.lastDashboard = data;
          this.dashboardUpdateCallbacks.forEach((cb) => {
            try {
              cb(data);
            } catch (e) {
              console.error('Error in dashboard update callback:', e);
            }
          });
          break;
        case 'demoModeChanged':
          debugLog('🎭 Received demoModeChanged event:', data);
          this.currentIsDemoMode = data;
          this.demoModeCallbacks.forEach((cb) => {
            try {
              cb(data);
            } catch (e) {
              console.error('Error in demo mode callback:', e);
            }
          });
          break;
        case 'dashboard':
          this.lastDashboard = data;
          this.dashboardUpdateCallbacks.forEach((cb) => {
            try {
              cb(data);
            } catch (e) {
              console.error('Error in dashboard callback:', e);
            }
          });
          break;
      }
    } catch (error) {
      console.error('Error parsing WebSocket message:', error);
    }
  }

  private attemptReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('Max reconnection attempts reached');
      return;
    }

    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
    }

    const delay = Math.min(this.reconnectDelay * Math.pow(2, this.reconnectAttempts), this.reconnectDelayMax);
    this.reconnectAttempts++;

    debugLog(`Attempting to reconnect in ${delay}ms (attempt ${this.reconnectAttempts})`);

    this.reconnectTimer = setTimeout(() => {
      this.connect(this.wsUrl).catch((err) => {
        console.error('Reconnection failed:', err);
        this.attemptReconnect();
      });
    }, delay);
  }

  async connect(wsUrl: string): Promise<void> {
    if (this.isConnected && this.socket?.readyState === WebSocket.OPEN) {
      return;
    }

    if (this.connectionPromise) {
      return this.connectionPromise;
    }

    if (this.isConnecting) {
      return;
    }

    this.isConnecting = true;
    this.wsUrl = wsUrl;

    // Convert http:// to ws://
    const wsUrlConverted = wsUrl.replace(/^http/, 'ws');

    this.connectionPromise = new Promise((resolve, reject) => {
      try {
        const ws = new WebSocket(wsUrlConverted);
        this.socket = ws;

        ws.onopen = () => {
          debugLog('✅ Connected to bridge');
          this.isConnecting = false;
          this.isConnected = true;
          this.reconnectAttempts = 0;
          resolve();
        };

        ws.onmessage = (event) => {
          this.handleMessage(event);
        };

        ws.onerror = (error) => {
          console.error('WebSocket error:', error);
          if (this.isConnecting) {
            this.isConnecting = false;
            reject(new Error('WebSocket connection error'));
          }
        };

        ws.onclose = () => {
          console.log('❌ Disconnected from bridge');
          this.isConnected = false;
          this.socket = null;
          
          // Attempt to reconnect if we were previously connected
          if (!this.isConnecting) {
            this.attemptReconnect();
          }
        };

        // Timeout after 10 seconds
        setTimeout(() => {
          if (this.isConnecting) {
            this.isConnecting = false;
            ws.close();
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
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.socket) {
      this.socket.close();
      this.socket = null;
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
    } else if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      // Request dashboard if we don't have it cached
      this.socket.send(JSON.stringify({ type: 'getDashboard' }));
    }
  }

  reloadDashboard(): void {
    console.log('reloadDashboard called');
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify({ type: 'reloadDashboard' }));
    }
  }

  saveDashboard(dashboard: any, options?: any): void {
    console.log('saveDashboard called', dashboard);
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify({ type: 'saveDashboard', data: { dashboard, options } }));
    }
  }

  async resetDashboard(resetEverything: boolean): Promise<any> {
    console.log('resetDashboard called', resetEverything);
    return new Promise((resolve) => {
      if (this.socket && this.socket.readyState === WebSocket.OPEN) {
        const requestId = Math.random().toString(36).substring(7);
        const handler = (event: MessageEvent) => {
          try {
            const message = JSON.parse(event.data);
            if (message.type === 'resetDashboard' && message.requestId === requestId) {
              this.socket?.removeEventListener('message', handler);
              resolve(message.data);
            }
          } catch (e) {
            console.error('Error in resetDashboard callback:', e);
          }
        };
        this.socket.addEventListener('message', handler);
        this.socket.send(JSON.stringify({ type: 'resetDashboard', requestId, data: { resetEverything } }));
      } else {
        resolve(null);
      }
    });
  }

  async toggleLockOverlays(): Promise<boolean> {
    console.log('toggleLockOverlays called');
    return new Promise((resolve) => {
      if (this.socket && this.socket.readyState === WebSocket.OPEN) {
        const requestId = Math.random().toString(36).substring(7);
        const handler = (event: MessageEvent) => {
          try {
            const message = JSON.parse(event.data);
            if (message.type === 'toggleLockOverlays' && message.requestId === requestId) {
              this.socket?.removeEventListener('message', handler);
              resolve(message.data);
            }
          } catch (e) {
            console.error('Error in toggleLockOverlays callback:', e);
          }
        };
        this.socket.addEventListener('message', handler);
        this.socket.send(JSON.stringify({ type: 'toggleLockOverlays', requestId }));
      } else {
        resolve(false);
      }
    });
  }

  async getAppVersion(): Promise<string> {
    console.log('getAppVersion called');
    return new Promise((resolve) => {
      if (this.socket && this.socket.readyState === WebSocket.OPEN) {
        const requestId = Math.random().toString(36).substring(7);
        const handler = (event: MessageEvent) => {
          try {
            const message = JSON.parse(event.data);
            if (message.type === 'getAppVersion' && message.requestId === requestId) {
              this.socket?.removeEventListener('message', handler);
              resolve(message.data);
            }
          } catch (e) {
            console.error('Error in getAppVersion callback:', e);
            // Ignore parsing errors
          }
        };
        this.socket.addEventListener('message', handler);
        this.socket.send(JSON.stringify({ type: 'getAppVersion', requestId }));
      } else {
        resolve('unknown');
      }
    });
  }

  toggleDemoMode(value: boolean): void {
    console.log('toggleDemoMode called', value);
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify({ type: 'toggleDemoMode', data: value }));
    }
  }

  onDemoModeChanged(callback: (value: boolean) => void): void {
    this.demoModeCallbacks.add(callback);
    // Send current demo mode state to new callbacks immediately
    if (this.currentIsDemoMode !== undefined) {
      console.log('🎭 Sending cached demo mode to new callback:', this.currentIsDemoMode);
      try {
        callback(this.currentIsDemoMode);
      } catch (e) {
        console.error('Error in demo mode callback:', e);
      }
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
    debugLog('🚀 renderComponent called with:', { componentName, wsUrl });

    // Step 1: Initialize mock stores first
    debugLog('📝 Step 1: Initialize mock stores');
    await initializeMockStores();

    // Step 2: Import stores (we'll need them to set up listeners)
    debugLog('📝 Step 2: Import Zustand stores');
    debugLog('  ✅ Stores imported');

    // Step 3: Create the bridge but DON'T connect yet
    debugLog('📝 Step 3: Create WebSocket bridge');
    const bridge = new WebSocketBridge();

    // Step 4: Connect to the bridge
    // The providers will handle subscribing to bridge events
    debugLog('📝 Step 4: Connect to WebSocket bridge');
    debugLog(`  Connecting to ${wsUrl}...`);
    await bridge.connect(wsUrl);
    debugLog('  ✅ Bridge connected');

    // Give the store listeners a moment to process the initialState
    await new Promise((resolve) => setTimeout(resolve, 100));
    debugLog('  ✅ Stores will be updated by providers');

    // Step 5: Create root
    debugLog('📝 Step 5: Create React root');
    const root = createRoot(containerElement);
    debugLog('  ✅ Root created');

    // Step 6: Get component from widget map
    debugLog('📝 Step 6: Get component from widget map');
    const normalizedName = componentName.toLowerCase();
    debugLog('  Looking for component:', normalizedName);

    const ComponentFn = WIDGET_MAP[normalizedName];

    if (!ComponentFn) {
      throw new Error(
        `Component not found: ${componentName}. Available: ${Object.keys(WIDGET_MAP).join(
          ', '
        )}`
      );
    }

    debugLog(`  ✅ Found component: ${componentName}`);

    // Step 7: Render actual component wrapped with providers
    debugLog('📝 Step 7: Render actual component with providers');
    debugLog('  📋 Component config:', config);

    // Log current store state before rendering
    const { useTelemetryStore: TelemetryStore } = await import('../../frontend/context/TelemetryStore/TelemetryStore');
    const { useSessionStore: SessionStore } = await import('../../frontend/context/SessionStore/SessionStore');
    const currentTelemetry = TelemetryStore.getState().telemetry;
    const currentSession = SessionStore.getState().session;
    debugLog('  📊 Current store state:');
    debugLog('    Telemetry:', currentTelemetry ? 'present' : 'MISSING');
    debugLog('    Session:', currentSession ? 'present' : 'MISSING');

    // Component that applies theme CSS classes - must be inside DashboardProvider
    const ThemeWrapper = () => {
      const { currentDashboard } = useDashboard();
      const settings = currentDashboard?.generalSettings;

      React.useEffect(() => {
        debugLog('🎨 ThemeWrapper effect running:', { settings, hasContainer: !!containerElement });
        
        if (!settings) {
          debugLog('  ⚠️ No settings yet');
          return;
        }

        // Apply classes directly to the container element we're rendering into
        const targetElement = containerElement;

        // Add overlay-window class if not present (needed for CSS selectors)
        if (!targetElement.classList.contains('overlay-window')) {
          targetElement.classList.add('overlay-window');
        }

        // Ensure transparent background for iframe/browser rendering
        targetElement.style.background = 'transparent';

        // Remove all existing theme classes
        targetElement.classList.forEach(className => {
          if (className.startsWith('overlay-theme-')) {
            targetElement.classList.remove(className);
          }
        });

        // Add new theme classes based on settings
        if (settings.fontSize) {
          targetElement.classList.add(`overlay-theme-${settings.fontSize}`);
          debugLog(`  ✅ Applied font size class: overlay-theme-${settings.fontSize}`);
        }

        if (settings.colorPalette) {
          targetElement.classList.add(`overlay-theme-color-${settings.colorPalette}`);
          debugLog(`  ✅ Applied color class: overlay-theme-color-${settings.colorPalette}`);
        }

        debugLog('  📊 Final classList:', Array.from(targetElement.classList));
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

    debugLog(`✅ Successfully rendered component: ${componentName}`);
    
    // Debug: Check if anything was actually rendered
    if (isDebugMode()) {
      setTimeout(() => {
        const children = containerElement.children;
        debugLog(`🔍 Post-render check:`);
        debugLog(`  Container children count: ${children.length}`);
        debugLog(`  Container innerHTML length: ${containerElement.innerHTML.length}`);
        if (children.length > 0) {
          debugLog(`  First child:`, children[0]);
        } else {
          console.warn(`  ⚠️ No children rendered! Component may be conditionally hidden.`);
        }
      }, 1000);
    }
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
