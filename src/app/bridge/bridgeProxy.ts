import { Server as HTTPServer } from 'http';
import { Server as SocketIOServer, Socket } from 'socket.io';
import type { Telemetry, Session, DashboardLayout } from '@irdashies/types';
import type { IrSdkBridge, DashboardBridge } from '@irdashies/types';

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
  const io = new SocketIOServer(httpServer, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST'],
    },
  });

  // Track connected clients
  let currentTelemetry: Telemetry | null = null;
  let currentSession: Session | null = null;
  let isRunning = false;

  // Subscribe to bridge events
  irsdkBridge.onTelemetry((telemetry: Telemetry) => {
    currentTelemetry = telemetry;
    io.emit('telemetry', telemetry);
  });

  irsdkBridge.onSessionData((session: Session) => {
    currentSession = session;
    io.emit('sessionData', session);
  });

  irsdkBridge.onRunningState((running: boolean) => {
    isRunning = running;
    io.emit('runningState', running);
  });

  // Subscribe to dashboard updates if available
  if (dashboardBridge) {
    dashboardBridge.dashboardUpdated((dashboard: DashboardLayout) => {
      currentDashboard = dashboard;
      io.emit('dashboardUpdated', dashboard);
    });
  }

  // Handle client connections
  io.on('connection', (socket: Socket) => {
    console.log(`✅ Client connected: ${socket.id}`);

    // Send current state to newly connected client
    socket.emit('initialState', {
      telemetry: currentTelemetry,
      sessionData: currentSession,
      isRunning,
      dashboard: currentDashboard,
    });

    // Handle getDashboard request from browser
    socket.on('getDashboard', (callback: (dashboard: DashboardLayout | null) => void) => {
      callback(currentDashboard);
    });

    socket.on('disconnect', () => {
      console.log(`❌ Client disconnected: ${socket.id}`);
    });
  });

  return io;
}

/**
 * Create a mock bridge for testing/demo purposes
 */
export function createMockBridge(): IrSdkBridge {
  const listeners: {
    telemetry: Set<(data: Telemetry) => void>;
    sessionData: Set<(data: Session) => void>;
    runningState: Set<(running: boolean) => void>;
  } = {
    telemetry: new Set(),
    sessionData: new Set(),
    runningState: new Set(),
  };

  return {
    onTelemetry: (callback: (data: Telemetry) => void) => {
      listeners.telemetry.add(callback);
    },
    onSessionData: (callback: (data: Session) => void) => {
      listeners.sessionData.add(callback);
    },
    onRunningState: (callback: (running: boolean) => void) => {
      listeners.runningState.add(callback);
    },
    stop: () => {
      listeners.telemetry.clear();
      listeners.sessionData.clear();
      listeners.runningState.clear();
    },
  };
}
