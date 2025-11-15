import { Server as HTTPServer } from 'http';
import { Server as SocketIOServer, Socket } from 'socket.io';
import type { Telemetry, Session } from '@irdashies/types';
import type { IrSdkBridge } from '@irdashies/types';

/**
 * Bridge proxy that exposes Electron bridge data via WebSocket
 * Allows external browsers to receive real-time telemetry and session data
 */
export function createBridgeProxy(
  httpServer: HTTPServer,
  irsdkBridge: IrSdkBridge
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

  // Handle client connections
  io.on('connection', (socket: Socket) => {
    console.log(`✅ Client connected: ${socket.id}`);

    // Send current state to newly connected client
    socket.emit('initialState', {
      telemetry: currentTelemetry,
      sessionData: currentSession,
      isRunning,
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
