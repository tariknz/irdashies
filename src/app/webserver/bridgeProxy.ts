import { Server as HTTPServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import type { Telemetry, Session, DashboardLayout } from '@irdashies/types';
import type { IrSdkBridge, DashboardBridge } from '@irdashies/types';
import { getIsDemoMode } from '../bridge/iracingSdk/setup';

// Export current state so it can be accessed by other parts of the app
export let currentDashboard: DashboardLayout | null = null;

/**
 * Bridge proxy that exposes Electron bridge data via WebSocket
 * Allows external browsers to receive real-time telemetry, session data, and dashboard configuration
 */
export function createBridgeProxy(
  httpServer: HTTPServer,
  irsdkBridge: IrSdkBridge,
  dashboardBridge?: DashboardBridge
) {
  const wss = new WebSocketServer({ server: httpServer });

  const clients = new Set<WebSocket>();
  let currentTelemetry: Telemetry | null = null;
  let currentSession: Session | null = null;
  let isRunning = false;
  let isDemoMode = getIsDemoMode();

  if (dashboardBridge?.getCurrentDashboard) {
    currentDashboard = dashboardBridge.getCurrentDashboard();
  }

  const broadcast = (type: string, data: unknown) => {
    const message = JSON.stringify({ type, data });
    clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(message);
      }
    });
  };

  let currentBridge: IrSdkBridge | null = null;
  let unsubscribeFunctions: (() => void)[] = [];

  const subscribeToBridge = (bridge: IrSdkBridge) => {
    currentBridge = bridge;

    const unsubTelemetry = bridge.onTelemetry((telemetry: Telemetry) => {
      currentTelemetry = telemetry;
      broadcast('telemetry', telemetry);
    });

    const unsubSession = bridge.onSessionData((session: Session) => {
      currentSession = session;
      broadcast('sessionData', session);
    });

    const unsubRunning = bridge.onRunningState((running: boolean) => {
      isRunning = running;
      if (clients.size > 0) {
        broadcast('runningState', running);
      }
    });

    unsubscribeFunctions = [unsubTelemetry, unsubSession, unsubRunning].filter(fn => typeof fn === 'function');
  };

  const unsubscribeFromBridge = () => {
    unsubscribeFunctions.forEach(unsub => unsub());
    unsubscribeFunctions = [];
  };

  const resubscribeToBridge = (newBridge: IrSdkBridge) => {
    console.log('🔄 Bridge proxy: Re-subscribing to new bridge...');
    // Unsubscribe from old bridge first
    unsubscribeFromBridge();
    currentTelemetry = null;
    currentSession = null;
    isRunning = false;
    subscribeToBridge(newBridge);
  };

  if (dashboardBridge) {
    dashboardBridge.dashboardUpdated((dashboard: DashboardLayout) => {
      currentDashboard = dashboard;
      broadcast('dashboardUpdated', dashboard);
    });

    if (dashboardBridge.onDemoModeChanged) {
      dashboardBridge.onDemoModeChanged((demoMode: boolean) => {
        isDemoMode = demoMode;
        broadcast('demoModeChanged', demoMode);
      });
    }
  }

  wss.on('connection', (ws: WebSocket) => {
    clients.add(ws);

    if (unsubscribeFunctions.length === 0) {
      console.log('🔌 No active subscriptions, subscribing to bridge...');
      subscribeToBridge(currentBridge || irsdkBridge);
    }

    ws.send(JSON.stringify({
      type: 'initialState',
      data: {
        telemetry: currentTelemetry,
        sessionData: currentSession,
        isRunning,
        dashboard: currentDashboard,
        isDemoMode,
      },
    }));

    ws.on('message', async (message: Buffer) => {
      try {
        const parsed = JSON.parse(message.toString());

        switch (parsed.type) {
          case 'getDashboard':
            ws.send(JSON.stringify({
              type: 'dashboard',
              data: currentDashboard,
            }));
            break;
          case 'getDashboardForProfile': {
            const { requestId, data } = parsed;
            const result = dashboardBridge?.getDashboardForProfile?.(data.profileId) || currentDashboard;
            ws.send(JSON.stringify({
              type: 'getDashboardForProfile',
              requestId,
              data: result,
            }));
            break;
          }
          case 'reloadDashboard':
            dashboardBridge?.reloadDashboard();
            break;
          case 'saveDashboard': {
            const { dashboard, options } = parsed.data || {};
            if (dashboard && dashboardBridge) {
              dashboardBridge.saveDashboard(dashboard, options);
            }
            break;
          }
          case 'getAppVersion': {
            const { requestId } = parsed;
            const result = await dashboardBridge?.getAppVersion();
            ws.send(JSON.stringify({
              type: 'getAppVersion',
              requestId,
              data: result,
            }));
            break;
          }
          case 'getGarageCoverImageAsDataUrl': {
            const { requestId, data } = parsed;
            const result = await dashboardBridge?.getGarageCoverImageAsDataUrl(data.imagePath);
            ws.send(JSON.stringify({
              type: 'getGarageCoverImageAsDataUrl',
              requestId,
              data: result,
            }));
            break;
          }
          case 'getCurrentProfile': {
            const { requestId } = parsed;
            const result = await dashboardBridge?.getCurrentProfile();
            ws.send(JSON.stringify({
              type: 'getCurrentProfile',
              requestId,
              data: result,
            }));
            break;
          }
          case 'updateProfileTheme': {
            const { requestId, data } = parsed;
            await dashboardBridge?.updateProfileTheme(data.profileId, data.themeSettings);
            ws.send(JSON.stringify({
              type: 'updateProfileTheme',
              requestId,
              data: null,
            }));
            break;
          }
          default:
            console.log('🔄 Bridge proxy: Unknown message type:', parsed.type);
            break;
        }
      } catch (error) {
        console.error('Error parsing client message:', error);
      }
    });

    ws.on('close', () => {
      clients.delete(ws);

      if (clients.size === 0) {
        console.log('🔌 No clients connected, unsubscribing from bridge...');
        unsubscribeFromBridge();
      }
    });

    ws.on('error', (error: Error) => {
      console.error('WebSocket error:', error);
    });
  });

  return { wss, resubscribeToBridge };
}

