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
  dashboardBridge?: DashboardBridge,
  initialDemoMode = false
) {
  console.log('🚀 createBridgeProxy called!');
  console.log('  Has irsdkBridge?', !!irsdkBridge);
  console.log('  Has dashboardBridge?', !!dashboardBridge);
  console.log('  Initial demo mode:', initialDemoMode);

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
  let isDemoMode = initialDemoMode;

  console.log('🎭 Bridge proxy initialized with demo mode:', isDemoMode);

  console.log('🔍 Bridge proxy: Registering event listeners...');
  console.log('🔍 Bridge has onTelemetry?', typeof irsdkBridge.onTelemetry);
  console.log('🔍 Bridge has onSessionData?', typeof irsdkBridge.onSessionData);
  console.log('🔍 Bridge has onRunningState?', typeof irsdkBridge.onRunningState);

  // Store reference to current bridge
  let currentBridge: IrSdkBridge | null = null;
  let unsubscribeFunctions: (() => void)[] = [];

  // Function to subscribe to bridge events
  const subscribeToBridge = (bridge: IrSdkBridge) => {
    console.log('🔌 Bridge proxy: Subscribing to bridge events...');
    currentBridge = bridge;

    const unsubTelemetry = bridge.onTelemetry((telemetry: Telemetry) => {
      currentTelemetry = telemetry;
      io.emit('telemetry', telemetry);
    });
    console.log('✅ Bridge proxy: onTelemetry listener registered');

    const unsubSession = bridge.onSessionData((session: Session) => {
      currentSession = session;
      io.emit('sessionData', session);
    });
    console.log('✅ Bridge proxy: onSessionData listener registered');

    const unsubRunning = bridge.onRunningState((running: boolean) => {
      isRunning = running;
      console.log('🔄 Bridge proxy: Received running state:', running, ', broadcasting to', io.engine.clientsCount, 'clients');
      io.emit('runningState', running);
    });
    console.log('✅ Bridge proxy: onRunningState listener registered');

    // Store unsubscribe functions if they were returned
    unsubscribeFunctions = [unsubTelemetry, unsubSession, unsubRunning].filter(fn => typeof fn === 'function');
  };

  // Function to unsubscribe from bridge events
  const unsubscribeFromBridge = () => {
    console.log('🔌 Bridge proxy: Unsubscribing from bridge events...');
    unsubscribeFunctions.forEach(unsub => unsub());
    unsubscribeFunctions = [];
  };

  // Return a function to resubscribe when bridge changes
  const resubscribeToBridge = (newBridge: IrSdkBridge) => {
    console.log('🔄 Bridge proxy: Re-subscribing to new bridge...');
    // Unsubscribe from old bridge first
    unsubscribeFromBridge();
    // Reset current state
    currentTelemetry = null;
    currentSession = null;
    isRunning = false;
    // Subscribe to new bridge
    subscribeToBridge(newBridge);
  };

  // Subscribe to dashboard updates if available
  if (dashboardBridge) {
    dashboardBridge.dashboardUpdated((dashboard: DashboardLayout) => {
      console.log('📊 Dashboard updated in bridgeProxy:', dashboard ? `${dashboard.widgets?.length || 0} widgets` : 'null');
      currentDashboard = dashboard;
      io.emit('dashboardUpdated', dashboard);
    });

    // Subscribe to demo mode changes
    if (dashboardBridge.onDemoModeChanged) {
      dashboardBridge.onDemoModeChanged((demoMode: boolean) => {
        console.log('🎭 Demo mode changed in bridgeProxy:', demoMode);
        isDemoMode = demoMode;
        io.emit('demoModeChanged', demoMode);
      });
    }
  } else {
    console.log('⚠️ No dashboardBridge provided to bridgeProxy');
  }

  // Handle client connections
  io.on('connection', (socket: Socket) => {
    console.log(`✅ Client connected: ${socket.id}`);
    
    // Subscribe to bridge when first client connects (or resubscribe if needed)
    if (io.engine.clientsCount === 1 && unsubscribeFunctions.length === 0) {
      subscribeToBridge(currentBridge || irsdkBridge);
    }

    // Send current state to newly connected client
    socket.emit('initialState', {
      telemetry: currentTelemetry,
      sessionData: currentSession,
      isRunning,
      dashboard: currentDashboard,
      isDemoMode,
    });

    // Handle getDashboard request from browser
    socket.on('getDashboard', (callback: (dashboard: DashboardLayout | null) => void) => {
      callback(currentDashboard);
    });

    socket.on('disconnect', () => {
      console.log(`❌ Client disconnected: ${socket.id}`);
      
      // Unsubscribe from bridge when last client disconnects
      if (io.engine.clientsCount === 0) {
        console.log('🛑 No clients connected, stopping bridge subscriptions');
        unsubscribeFromBridge();
      }
    });
  });

  return { io, resubscribeToBridge };
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
