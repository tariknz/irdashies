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

const isDebugMode = () => typeof window !== 'undefined' && (window as any).__DEBUG_MODE__ === true;

const debugLog = (...args: any[]) => {
  if (isDebugMode()) {
    console.log(...args);
  }
};

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

  private dashboardUpdateCallbacks: Set<(value: any) => void>;
  private demoModeCallbacks: Set<(value: boolean) => void>;
  private lastDashboard: any = null;
  private currentIsDemoMode = false;

  constructor() {
    this.telemetryCallbacks = new Set();
    this.sessionCallbacks = new Set();
    this.runningCallbacks = new Set();
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
          debugLog('Received initialState from bridge');

          if (state.telemetry) {
            this.telemetryCallbacks.forEach((cb) => {
              try {
                cb(state.telemetry);
              } catch (e) {
                console.error('Error in telemetry callback:', e);
              }
            });
          }
          if (state.sessionData) {
            this.sessionCallbacks.forEach((cb) => {
              try {
                cb(state.sessionData);
              } catch (e) {
                console.error('Error in session callback:', e);
              }
            });
          }
          if (state.dashboard) {
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
            this.runningCallbacks.forEach((cb) => {
              try {
                cb(state.isRunning);
              } catch (e) {
                console.error('Error in running state callback:', e);
              }
            });
          }
          if (state.isDemoMode !== undefined) {
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

    const wsUrlConverted = wsUrl.replace(/^http/, 'ws');

    this.connectionPromise = new Promise((resolve, reject) => {
      try {
        const ws = new WebSocket(wsUrlConverted);
        this.socket = ws;

        ws.onopen = () => {
          debugLog('Connected to bridge');
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
            this.connectionPromise = null;
            reject(new Error('WebSocket connection error'));
          }
        };

        ws.onclose = () => {
          debugLog('Disconnected from bridge');
          this.isConnected = false;
          this.socket = null;
          this.connectionPromise = null;
          
          if (!this.isConnecting) {
            this.attemptReconnect();
          }
        };

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
    if (!callback) return;
    this.telemetryCallbacks.add(callback);
  }

  onSessionData(callback: (data: any) => void): void {
    if (!callback) return;
    this.sessionCallbacks.add(callback);
  }

  onRunningState(callback: (running: boolean) => void): void {
    if (!callback) return;
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

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  onEditModeToggled(_: (value: boolean) => void): void {
    // Edit mode is not supported in browser clients
  }

  dashboardUpdated(callback: (value: any) => void): void {
    this.dashboardUpdateCallbacks.add(callback);
    if (this.lastDashboard) {
      try {
        callback(this.lastDashboard);
      } catch (e) {
        console.error('Error in dashboard callback:', e);
      }
    } else if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify({ type: 'getDashboard' }));
    }
  }

  reloadDashboard(): void {
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify({ type: 'reloadDashboard' }));
    }
  }

  saveDashboard(dashboard: any, options?: any): void {
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify({ type: 'saveDashboard', data: { dashboard, options } }));
    }
  }

  async resetDashboard(resetEverything: boolean): Promise<any> {
    return new Promise((resolve) => {
      if (this.socket && this.socket.readyState === WebSocket.OPEN) {
        const requestId = Math.random().toString(36).substring(7);
        const handler = (event: MessageEvent) => {
          try {
            const message = JSON.parse(event.data);
            if (message.type === 'resetDashboard' && message.requestId === requestId) {
              this.socket?.removeEventListener('message', handler);
              clearTimeout(timeout);
              resolve(message.data);
            }
          } catch (e) {
            console.error('Error in resetDashboard callback:', e);
          }
        };
        const timeout = setTimeout(() => {
          this.socket?.removeEventListener('message', handler);
          resolve(null);
        }, 5000);
        this.socket.addEventListener('message', handler);
        this.socket.send(JSON.stringify({ type: 'resetDashboard', requestId, data: { resetEverything } }));
      } else {
        resolve(null);
      }
    });
  }

  async toggleLockOverlays(): Promise<boolean> {
    return new Promise((resolve) => {
      if (this.socket && this.socket.readyState === WebSocket.OPEN) {
        const requestId = Math.random().toString(36).substring(7);
        const handler = (event: MessageEvent) => {
          try {
            const message = JSON.parse(event.data);
            if (message.type === 'toggleLockOverlays' && message.requestId === requestId) {
              this.socket?.removeEventListener('message', handler);
              clearTimeout(timeout);
              resolve(message.data);
            }
          } catch (e) {
            console.error('Error in toggleLockOverlays callback:', e);
          }
        };
        const timeout = setTimeout(() => {
          this.socket?.removeEventListener('message', handler);
          resolve(false);
        }, 5000);
        this.socket.addEventListener('message', handler);
        this.socket.send(JSON.stringify({ type: 'toggleLockOverlays', requestId }));
      } else {
        resolve(false);
      }
    });
  }

  async getAppVersion(): Promise<string> {
    return new Promise((resolve) => {
      if (this.socket && this.socket.readyState === WebSocket.OPEN) {
        const requestId = Math.random().toString(36).substring(7);
        const handler = (event: MessageEvent) => {
          try {
            const message = JSON.parse(event.data);
            if (message.type === 'getAppVersion' && message.requestId === requestId) {
              this.socket?.removeEventListener('message', handler);
              clearTimeout(timeout);
              resolve(message.data);
            }
          } catch (e) {
            console.error('Error in getAppVersion callback:', e);
          }
        };
        const timeout = setTimeout(() => {
          this.socket?.removeEventListener('message', handler);
          resolve('unknown');
        }, 5000);
        this.socket.addEventListener('message', handler);
        this.socket.send(JSON.stringify({ type: 'getAppVersion', requestId }));
      } else {
        resolve('unknown');
      }
    });
  }

  toggleDemoMode(value: boolean): void {
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify({ type: 'toggleDemoMode', data: value }));
    }
  }

  onDemoModeChanged(callback: (value: boolean) => void): void {
    this.demoModeCallbacks.add(callback);
    if (this.currentIsDemoMode !== undefined) {
      try {
        callback(this.currentIsDemoMode);
      } catch (e) {
        console.error('Error in demo mode callback:', e);
      }
    }
  }
}

async function initializeMockStores(): Promise<void> {
  try {
    const { useTelemetryStore } = await import('../../frontend/context/TelemetryStore/TelemetryStore');
    const { useSessionStore } = await import('../../frontend/context/SessionStore/SessionStore');

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

    useTelemetryStore.setState({ telemetry: mockTelemetry });
    useSessionStore.setState({ session: null });
  } catch (error) {
    console.error('Error initializing mock stores:', error);
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
    debugLog('renderComponent called with:', { componentName, wsUrl });

    await initializeMockStores();

    const bridge = new WebSocketBridge();

    await bridge.connect(wsUrl);

    await new Promise((resolve) => setTimeout(resolve, 100));

    const root = createRoot(containerElement);

    const normalizedName = componentName.toLowerCase();
    const ComponentFn = WIDGET_MAP[normalizedName];

    if (!ComponentFn) {
      throw new Error(
        `Component not found: ${componentName}. Available: ${Object.keys(WIDGET_MAP).join(', ')}`
      );
    }

    const ThemeWrapper = () => {
      const { currentDashboard } = useDashboard();
      const settings = currentDashboard?.generalSettings;

      React.useEffect(() => {
        if (!settings) return;

        const targetElement = containerElement;

        if (!targetElement.classList.contains('overlay-window')) {
          targetElement.classList.add('overlay-window');
        }

        targetElement.style.background = 'transparent';

        targetElement.classList.forEach(className => {
          if (className.startsWith('overlay-theme-')) {
            targetElement.classList.remove(className);
          }
        });

        if (settings.fontSize) {
          targetElement.classList.add(`overlay-theme-${settings.fontSize}`);
        }

        if (settings.colorPalette) {
          targetElement.classList.add(`overlay-theme-color-${settings.colorPalette}`);
        }
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

    debugLog(`Successfully rendered component: ${componentName}`);
  } catch (error) {
    console.error(`Failed to render component: ${componentName}`, error);
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

declare global {
  interface Window {
    renderComponent: typeof renderComponent;
  }
}

if (typeof window !== 'undefined') {
  (window as any).renderComponent = renderComponent;
}
