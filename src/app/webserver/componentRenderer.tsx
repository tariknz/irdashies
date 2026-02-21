/* eslint-disable @typescript-eslint/no-explicit-any */
import type { IrSdkBridge } from '../../types';

const isDebugMode = () =>
  typeof window !== 'undefined' && (window as any).__DEBUG_MODE__ === true;

const debugLog = (...args: any[]) => {
  if (isDebugMode()) {
    console.log(...args);
  }
};

/**
 * Web-based bridge that connects to the WebSocket server
 */
export class WebSocketBridge implements IrSdkBridge {
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

  private dashboardUpdateCallbacks: Set<
    (value: any, profileId?: string) => void
  >;
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
        case 'dashboardUpdated': {
          const { dashboard: updatedDashboard, profileId: updatedProfileId } =
            data || {};
          if (updatedDashboard) {
            this.lastDashboard = updatedDashboard;
            this.dashboardUpdateCallbacks.forEach((cb) => {
              try {
                cb(updatedDashboard, updatedProfileId);
              } catch (e) {
                console.error('Error in dashboard update callback:', e);
              }
            });
          }
          break;
        }
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

    const delay = Math.min(
      this.reconnectDelay * Math.pow(2, this.reconnectAttempts),
      this.reconnectDelayMax
    );
    this.reconnectAttempts++;

    debugLog(
      `Attempting to reconnect in ${delay}ms (attempt ${this.reconnectAttempts})`
    );

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

  onTelemetry(callback: (data: any) => void): (() => void) | undefined {
    if (!callback) return undefined;
    this.telemetryCallbacks.add(callback);
    return () => this.telemetryCallbacks.delete(callback);
  }

  onSessionData(callback: (data: any) => void): (() => void) | undefined {
    if (!callback) return undefined;
    this.sessionCallbacks.add(callback);
    return () => this.sessionCallbacks.delete(callback);
  }

  onRunningState(
    callback: (running: boolean) => void
  ): (() => void) | undefined {
    if (!callback) return undefined;
    this.runningCallbacks.add(callback);
    return () => this.runningCallbacks.delete(callback);
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
    this.telemetryCallbacks.clear();
    this.sessionCallbacks.clear();
    this.runningCallbacks.clear();
    this.dashboardUpdateCallbacks.clear();
    this.demoModeCallbacks.clear();
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  onEditModeToggled(_: (value: boolean) => void): (() => void) | undefined {
    // Edit mode is not supported in browser clients
    return undefined;
  }

  dashboardUpdated(
    callback: (value: any, profileId?: string) => void
  ): (() => void) | undefined {
    this.dashboardUpdateCallbacks.add(callback);
    if (this.lastDashboard) {
      try {
        // Handle both old and new formats for backward compatibility
        if (
          typeof this.lastDashboard === 'object' &&
          'dashboard' in this.lastDashboard &&
          'profileId' in this.lastDashboard
        ) {
          callback(this.lastDashboard.dashboard, this.lastDashboard.profileId);
        } else {
          callback(this.lastDashboard);
        }
      } catch (e) {
        console.error('Error in dashboard callback:', e);
      }
    } else if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify({ type: 'getDashboard' }));
    }
    return () => this.dashboardUpdateCallbacks.delete(callback);
  }

  reloadDashboard(): void {
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify({ type: 'reloadDashboard' }));
    }
  }

  saveDashboard(dashboard: any, options?: any): void {
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      this.socket.send(
        JSON.stringify({ type: 'saveDashboard', data: { dashboard, options } })
      );
    }
  }

  setAutoStart(): Promise<void> {
    // Not supported by component browser
    return new Promise<void>((resolve) => resolve());
  }

  getDriverTagSettings(): Promise<undefined> {
    return Promise.resolve(undefined);
  }

  saveDriverTagSettings(): Promise<void> {
    return Promise.resolve();
  }

  async resetDashboard(resetEverything: boolean): Promise<any> {
    return new Promise((resolve) => {
      if (this.socket && this.socket.readyState === WebSocket.OPEN) {
        const requestId = Math.random().toString(36).substring(7);
        const handler = (event: MessageEvent) => {
          try {
            const message = JSON.parse(event.data);
            if (
              message.type === 'resetDashboard' &&
              message.requestId === requestId
            ) {
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
        this.socket.send(
          JSON.stringify({
            type: 'resetDashboard',
            requestId,
            data: { resetEverything },
          })
        );
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
            if (
              message.type === 'toggleLockOverlays' &&
              message.requestId === requestId
            ) {
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
        this.socket.send(
          JSON.stringify({ type: 'toggleLockOverlays', requestId })
        );
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
            if (
              message.type === 'getAppVersion' &&
              message.requestId === requestId
            ) {
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

  async getGarageCoverImageAsDataUrl(
    imagePath: string
  ): Promise<string | null> {
    return new Promise((resolve) => {
      if (this.socket && this.socket.readyState === WebSocket.OPEN) {
        const requestId = Math.random().toString(36).substring(7);
        const handler = (event: MessageEvent) => {
          try {
            const message = JSON.parse(event.data);
            if (
              message.type === 'getGarageCoverImageAsDataUrl' &&
              message.requestId === requestId
            ) {
              this.socket?.removeEventListener('message', handler);
              clearTimeout(timeout);
              resolve(message.data);
            }
          } catch (e) {
            console.error('Error in getGarageCoverImageAsDataUrl callback:', e);
          }
        };
        const timeout = setTimeout(() => {
          this.socket?.removeEventListener('message', handler);
          resolve(null);
        }, 5000);
        this.socket.addEventListener('message', handler);
        this.socket.send(
          JSON.stringify({
            type: 'getGarageCoverImageAsDataUrl',
            requestId,
            data: { imagePath },
          })
        );
      } else {
        resolve(null);
      }
    });
  }

  toggleDemoMode(value: boolean): void {
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify({ type: 'toggleDemoMode', data: value }));
    }
  }

  onDemoModeChanged(
    callback: (value: boolean) => void
  ): (() => void) | undefined {
    this.demoModeCallbacks.add(callback);
    if (this.currentIsDemoMode !== undefined) {
      try {
        callback(this.currentIsDemoMode);
      } catch (e) {
        console.error('Error in demo mode callback:', e);
      }
    }
    return () => this.demoModeCallbacks.delete(callback);
  }

  // Profile management methods
  async listProfiles(): Promise<any[]> {
    return new Promise((resolve) => {
      if (this.socket && this.socket.readyState === WebSocket.OPEN) {
        const requestId = Math.random().toString(36).substring(7);
        const handler = (event: MessageEvent) => {
          try {
            const message = JSON.parse(event.data);
            if (
              message.type === 'listProfiles' &&
              message.requestId === requestId
            ) {
              this.socket?.removeEventListener('message', handler);
              clearTimeout(timeout);
              resolve(message.data || []);
            }
          } catch (e) {
            console.error('Error in listProfiles callback:', e);
          }
        };
        const timeout = setTimeout(() => {
          this.socket?.removeEventListener('message', handler);
          resolve([{ id: 'default', name: 'Default' }]);
        }, 5000);
        this.socket.addEventListener('message', handler);
        this.socket.send(JSON.stringify({ type: 'listProfiles', requestId }));
      } else {
        resolve([{ id: 'default', name: 'Default' }]);
      }
    });
  }

  async createProfile(): Promise<any> {
    return { id: 'new', name: 'New Profile' };
  }

  async deleteProfile(): Promise<void> {
    return;
  }

  async renameProfile(): Promise<void> {
    return;
  }

  async switchProfile(): Promise<void> {
    return;
  }

  async getCurrentProfile(): Promise<any> {
    return new Promise((resolve) => {
      if (this.socket && this.socket.readyState === WebSocket.OPEN) {
        const requestId = Math.random().toString(36).substring(7);
        const handler = (event: MessageEvent) => {
          try {
            const message = JSON.parse(event.data);
            if (
              message.type === 'getCurrentProfile' &&
              message.requestId === requestId
            ) {
              this.socket?.removeEventListener('message', handler);
              clearTimeout(timeout);
              resolve(message.data);
            }
          } catch (e) {
            console.error('Error in getCurrentProfile callback:', e);
          }
        };
        const timeout = setTimeout(() => {
          this.socket?.removeEventListener('message', handler);
          resolve({ id: 'default', name: 'Default' });
        }, 5000);
        this.socket.addEventListener('message', handler);
        this.socket.send(
          JSON.stringify({ type: 'getCurrentProfile', requestId })
        );
      } else {
        resolve({ id: 'default', name: 'Default' });
      }
    });
  }

  async updateProfileTheme(
    profileId: string,
    themeSettings: any
  ): Promise<void> {
    return new Promise((resolve) => {
      if (this.socket && this.socket.readyState === WebSocket.OPEN) {
        const requestId = Math.random().toString(36).substring(7);
        const handler = (event: MessageEvent) => {
          try {
            const message = JSON.parse(event.data);
            if (
              message.type === 'updateProfileTheme' &&
              message.requestId === requestId
            ) {
              this.socket?.removeEventListener('message', handler);
              clearTimeout(timeout);
              resolve();
            }
          } catch (e) {
            console.error('Error in updateProfileTheme callback:', e);
          }
        };
        const timeout = setTimeout(() => {
          this.socket?.removeEventListener('message', handler);
          resolve();
        }, 5000);
        this.socket.addEventListener('message', handler);
        this.socket.send(
          JSON.stringify({
            type: 'updateProfileTheme',
            requestId,
            data: { profileId, themeSettings },
          })
        );
      } else {
        resolve();
      }
    });
  }

  async getDashboardForProfile(profileId: string): Promise<any> {
    return new Promise((resolve) => {
      if (this.socket && this.socket.readyState === WebSocket.OPEN) {
        const requestId = Math.random().toString(36).substring(7);
        const handler = (event: MessageEvent) => {
          try {
            const message = JSON.parse(event.data);
            if (
              message.type === 'getDashboardForProfile' &&
              message.requestId === requestId
            ) {
              this.socket?.removeEventListener('message', handler);
              clearTimeout(timeout);
              resolve(message.data);
            }
          } catch (e) {
            console.error('Error in getDashboardForProfile callback:', e);
          }
        };
        const timeout = setTimeout(() => {
          this.socket?.removeEventListener('message', handler);
          resolve(null);
        }, 5000);
        this.socket.addEventListener('message', handler);
        this.socket.send(
          JSON.stringify({
            type: 'getDashboardForProfile',
            requestId,
            data: { profileId },
          })
        );
      } else {
        resolve(null);
      }
    });
  }

  // Additional DashboardBridge methods
  getCurrentDashboard(): any | null {
    return this.lastDashboard;
  }

  async saveGarageCoverImage(buffer: Uint8Array): Promise<string> {
    return new Promise((resolve) => {
      if (this.socket && this.socket.readyState === WebSocket.OPEN) {
        const requestId = Math.random().toString(36).substring(7);
        const handler = (event: MessageEvent) => {
          try {
            const message = JSON.parse(event.data);
            if (
              message.type === 'saveGarageCoverImage' &&
              message.requestId === requestId
            ) {
              this.socket?.removeEventListener('message', handler);
              clearTimeout(timeout);
              resolve(message.data);
            }
          } catch (e) {
            console.error('Error in saveGarageCoverImage callback:', e);
          }
        };
        const timeout = setTimeout(() => {
          this.socket?.removeEventListener('message', handler);
          resolve('');
        }, 5000);
        this.socket.addEventListener('message', handler);
        this.socket.send(
          JSON.stringify({
            type: 'saveGarageCoverImage',
            requestId,
            data: { buffer: Array.from(buffer) },
          })
        );
      } else {
        resolve('');
      }
    });
  }

  async getAnalyticsOptOut(): Promise<boolean> {
    return new Promise((resolve) => {
      if (this.socket && this.socket.readyState === WebSocket.OPEN) {
        const requestId = Math.random().toString(36).substring(7);
        const handler = (event: MessageEvent) => {
          try {
            const message = JSON.parse(event.data);
            if (
              message.type === 'getAnalyticsOptOut' &&
              message.requestId === requestId
            ) {
              this.socket?.removeEventListener('message', handler);
              clearTimeout(timeout);
              resolve(message.data);
            }
          } catch (e) {
            console.error('Error in getAnalyticsOptOut callback:', e);
          }
        };
        const timeout = setTimeout(() => {
          this.socket?.removeEventListener('message', handler);
          resolve(false);
        }, 5000);
        this.socket.addEventListener('message', handler);
        this.socket.send(
          JSON.stringify({ type: 'getAnalyticsOptOut', requestId })
        );
      } else {
        resolve(false);
      }
    });
  }

  async setAnalyticsOptOut(optOut: boolean): Promise<void> {
    return new Promise((resolve) => {
      if (this.socket && this.socket.readyState === WebSocket.OPEN) {
        const requestId = Math.random().toString(36).substring(7);
        const handler = (event: MessageEvent) => {
          try {
            const message = JSON.parse(event.data);
            if (
              message.type === 'setAnalyticsOptOut' &&
              message.requestId === requestId
            ) {
              this.socket?.removeEventListener('message', handler);
              clearTimeout(timeout);
              resolve();
            }
          } catch (e) {
            console.error('Error in setAnalyticsOptOut callback:', e);
          }
        };
        const timeout = setTimeout(() => {
          this.socket?.removeEventListener('message', handler);
          resolve();
        }, 5000);
        this.socket.addEventListener('message', handler);
        this.socket.send(
          JSON.stringify({
            type: 'setAnalyticsOptOut',
            requestId,
            data: { optOut },
          })
        );
      } else {
        resolve();
      }
    });
  }
}
