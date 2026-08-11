import { Server as HTTPServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import {
  TELEMETRY_INSPECTOR_RATE_HZ,
  type Telemetry,
  type Session,
  type DashboardLayout,
} from '@irdashies/types';
import type { IrSdkSourceBridge, DashboardBridge } from '@irdashies/types';
import { getIsDemoMode } from '../bridge/iracingSdk/setup';
import logger from '../logger';
import type { ChannelBus } from '../bridge/channelBridge';

// Export current state so it can be accessed by other parts of the app
export let currentDashboard: DashboardLayout | null = null;

/**
 * Bridge proxy that exposes Electron bridge data via WebSocket
 * Allows external browsers to receive real-time telemetry, session data, and dashboard configuration
 */
export function createBridgeProxy(
  httpServer: HTTPServer,
  irsdkBridge: IrSdkSourceBridge,
  dashboardBridge?: DashboardBridge,
  channelBus?: ChannelBus
) {
  const wss = new WebSocketServer({ server: httpServer });

  const clients = new Set<WebSocket>();
  const inspectorStreams = new Map<
    WebSocket,
    Set<'telemetryInspector' | 'sessionData'>
  >();
  let nextChannelTargetId = -1;
  let currentTelemetry: Telemetry | null = null;
  let lastTelemetryBroadcastTime = Number.NEGATIVE_INFINITY;
  let currentSession: Session | null = null;
  let isRunning = false;
  let isDemoMode = getIsDemoMode();

  if (dashboardBridge?.getCurrentDashboard) {
    currentDashboard = dashboardBridge.getCurrentDashboard();
  }

  const broadcast = (type: string, data: unknown) => {
    const message = JSON.stringify({ type, data });
    clients.forEach((client) => {
      if (
        (type === 'telemetry' || type === 'sessionData') &&
        !inspectorStreams
          .get(client)
          ?.has(type === 'telemetry' ? 'telemetryInspector' : 'sessionData')
      ) {
        return;
      }
      if (client.readyState === WebSocket.OPEN) {
        client.send(message);
      }
    });
  };

  let currentBridge: IrSdkSourceBridge | null = null;
  let unsubscribeFunctions: (() => void)[] = [];

  const subscribeToBridge = (bridge: IrSdkSourceBridge) => {
    currentBridge = bridge;

    const unsubTelemetry = bridge.onTelemetry((telemetry: Telemetry) => {
      currentTelemetry = telemetry;
      const now = performance.now();
      if (
        clients.size > 0 &&
        now - lastTelemetryBroadcastTime >= 1000 / TELEMETRY_INSPECTOR_RATE_HZ
      ) {
        lastTelemetryBroadcastTime = now;
        broadcast('telemetry', telemetry);
      }
    });

    const unsubSession = bridge.onSessionData((session: Session) => {
      currentSession = session;
      if (clients.size > 0) {
        broadcast('sessionData', session);
      }
    });

    const unsubRunning = bridge.onRunningState((running: boolean) => {
      isRunning = running;
      if (clients.size > 0) {
        broadcast('runningState', running);
      }
    });

    unsubscribeFunctions = [unsubTelemetry, unsubSession, unsubRunning].filter(
      (fn) => typeof fn === 'function'
    );
  };

  const unsubscribeFromBridge = () => {
    unsubscribeFunctions.forEach((unsub) => unsub());
    unsubscribeFunctions = [];
  };

  const resubscribeToBridge = (newBridge: IrSdkSourceBridge) => {
    logger.info('Bridge proxy: Re-subscribing to new bridge...');
    // Unsubscribe from old bridge first
    unsubscribeFromBridge();
    currentTelemetry = null;
    currentSession = null;
    isRunning = false;
    subscribeToBridge(newBridge);
  };

  if (dashboardBridge) {
    dashboardBridge.dashboardUpdated(
      (dashboard: DashboardLayout, profileId?: string) => {
        currentDashboard = dashboard;
        broadcast('dashboardUpdated', { dashboard, profileId });
      }
    );

    if (dashboardBridge.onDemoModeChanged) {
      dashboardBridge.onDemoModeChanged((demoMode: boolean) => {
        isDemoMode = demoMode;
        broadcast('demoModeChanged', demoMode);
      });
    }
  }

  wss.on('connection', (ws: WebSocket) => {
    clients.add(ws);
    inspectorStreams.set(ws, new Set());
    const channelTarget = {
      id: nextChannelTargetId--,
      isDestroyed: () => ws.readyState === WebSocket.CLOSED,
      isVisible: () => ws.readyState === WebSocket.OPEN,
      send: (_delivery: string, channel: string, payload: unknown) => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(
            JSON.stringify({ type: 'channel', data: { channel, payload } })
          );
        }
      },
    };

    if (unsubscribeFunctions.length === 0) {
      logger.info('No active subscriptions, subscribing to bridge...');
      subscribeToBridge(currentBridge || irsdkBridge);
    }

    ws.send(
      JSON.stringify({
        type: 'initialState',
        data: {
          isRunning,
          dashboard: currentDashboard,
          isDemoMode,
        },
      })
    );

    ws.on('message', async (message: Buffer) => {
      try {
        const parsed = JSON.parse(message.toString());

        switch (parsed.type) {
          case 'telemetryInspectorSubscribe': {
            const stream = parsed.data?.stream;
            if (stream !== 'telemetryInspector' && stream !== 'sessionData') {
              throw new Error('Invalid Telemetry Inspector subscription');
            }
            inspectorStreams.get(ws)?.add(stream);
            const current =
              stream === 'telemetryInspector'
                ? currentTelemetry
                : currentSession;
            if (current !== null && ws.readyState === WebSocket.OPEN) {
              ws.send(
                JSON.stringify({
                  type: stream === 'telemetryInspector' ? 'telemetry' : stream,
                  data: current,
                })
              );
            }
            break;
          }
          case 'telemetryInspectorUnsubscribe': {
            const stream = parsed.data?.stream;
            if (stream !== 'telemetryInspector' && stream !== 'sessionData') {
              throw new Error('Invalid Telemetry Inspector unsubscribe');
            }
            inspectorStreams.get(ws)?.delete(stream);
            break;
          }
          case 'channelSubscribe': {
            const channel = parsed.data?.channel;
            const rate = parsed.data?.requestedRateHz;
            if (
              typeof channel !== 'string' ||
              (rate !== undefined && typeof rate !== 'number')
            ) {
              throw new Error('Invalid channel subscription');
            }
            channelBus?.subscribe(channelTarget, channel, rate);
            break;
          }
          case 'channelUnsubscribe': {
            const channel = parsed.data?.channel;
            if (typeof channel !== 'string') {
              throw new Error('Invalid channel unsubscribe');
            }
            channelBus?.unsubscribe(channelTarget.id, channel);
            break;
          }
          case 'getDashboard':
            ws.send(
              JSON.stringify({
                type: 'dashboard',
                data: currentDashboard,
              })
            );
            break;
          case 'getDashboardForProfile': {
            const { requestId, data } = parsed;
            const result =
              (await dashboardBridge?.getDashboardForProfile?.(
                data.profileId
              )) || currentDashboard;
            ws.send(
              JSON.stringify({
                type: 'getDashboardForProfile',
                requestId,
                data: result,
              })
            );
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
            ws.send(
              JSON.stringify({
                type: 'getAppVersion',
                requestId,
                data: result,
              })
            );
            break;
          }
          case 'getGarageCoverImageAsDataUrl': {
            const { requestId, data } = parsed;
            const result = await dashboardBridge?.getGarageCoverImageAsDataUrl(
              data.imagePath
            );
            ws.send(
              JSON.stringify({
                type: 'getGarageCoverImageAsDataUrl',
                requestId,
                data: result,
              })
            );
            break;
          }
          case 'getPlayerIconImageAsDataUrl': {
            const { requestId, data } = parsed;
            if (!data || typeof data.imagePath !== 'string') {
              ws.send(
                JSON.stringify({
                  type: 'getPlayerIconImageAsDataUrl',
                  requestId,
                  data: null,
                })
              );
              break;
            }
            const result = await dashboardBridge?.getPlayerIconImageAsDataUrl(
              data.imagePath
            );
            ws.send(
              JSON.stringify({
                type: 'getPlayerIconImageAsDataUrl',
                requestId,
                data: result,
              })
            );
            break;
          }
          case 'savePlayerIconImage': {
            const { requestId, data } = parsed;
            const buffer = Array.isArray(data?.buffer)
              ? new Uint8Array(data.buffer)
              : null;
            if (!buffer) {
              ws.send(
                JSON.stringify({
                  type: 'savePlayerIconImage',
                  requestId,
                  data: '',
                })
              );
              break;
            }
            try {
              const result = await dashboardBridge?.savePlayerIconImage(buffer);
              ws.send(
                JSON.stringify({
                  type: 'savePlayerIconImage',
                  requestId,
                  data: result ?? '',
                })
              );
            } catch (err) {
              logger.error('[bridgeProxy] savePlayerIconImage failed:', err);
              ws.send(
                JSON.stringify({
                  type: 'savePlayerIconImage',
                  requestId,
                  data: '',
                })
              );
            }
            break;
          }
          case 'getCurrentProfile': {
            const { requestId } = parsed;
            const result = await dashboardBridge?.getCurrentProfile();
            ws.send(
              JSON.stringify({
                type: 'getCurrentProfile',
                requestId,
                data: result,
              })
            );
            break;
          }
          case 'listProfiles': {
            const { requestId } = parsed;
            const result = await dashboardBridge?.listProfiles();
            ws.send(
              JSON.stringify({
                type: 'listProfiles',
                requestId,
                data: result,
              })
            );
            break;
          }
          case 'updateProfileTheme': {
            const { requestId, data } = parsed;
            await dashboardBridge?.updateProfileTheme(
              data.profileId,
              data.themeSettings
            );
            ws.send(
              JSON.stringify({
                type: 'updateProfileTheme',
                requestId,
                data: null,
              })
            );
            break;
          }
          default:
            logger.info('Bridge proxy: Unknown message type:', parsed.type);
            break;
        }
      } catch (error) {
        logger.error('Error parsing client message:', error);
      }
    });

    ws.on('close', () => {
      clients.delete(ws);
      inspectorStreams.delete(ws);
      channelBus?.removeRenderer(channelTarget.id);

      if (clients.size === 0) {
        logger.info('No clients connected, unsubscribing from bridge...');
        unsubscribeFromBridge();
      }
    });

    ws.on('error', (error: Error) => {
      logger.error('WebSocket error:', error);
    });
  });

  return { wss, resubscribeToBridge };
}
