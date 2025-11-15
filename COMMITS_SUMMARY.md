# Commit Series: Component Server & Real-Time Telemetry Bridge

## Overview
This series of changes implements a complete HTTP/WebSocket component server that exposes iRacing telemetry data to external browsers, enabling real-time monitoring of race data from Chrome, Firefox, or any browser.

---

## Commit: `fix: restore iRacing SDK bridge callback subscription system`

**Commit Hash:** `31e31d9`

### Problem
The iRacing SDK bridge was returning callbacks that fired **only once** with **empty objects**, preventing live telemetry data from reaching the browser component server. The bridge callbacks looked like:
```typescript
onTelemetry: (callback) => callback({} as Telemetry),  // Called once with empty data!
```

### Solution
Restructured the bridge to maintain persistent callback arrays that get called continuously whenever new iRacing data arrives:
- Create arrays for telemetry, session, and running state callbacks
- Call ALL registered callbacks every frame with real data
- Support multiple concurrent subscribers
- Return unsubscribe functions for cleanup

### Files Modified
- **src/app/bridge/iracingSdk/iracingSdkBridge.ts** - Core bridge callback system
  - Convert one-time callbacks → subscription arrays
  - Notify all subscribers on every data update

### Impact
✅ Enables continuous real-time data flow from Electron → browser  
✅ Components now display live telemetry data  
✅ Fixes the root cause preventing browser data display  

---

## Related Files (All in Same Commit)

### 1. Express HTTP Server
- **src/app/bridge/componentServer.ts** - HTTP server infrastructure
  - Port 3000 serving component pages
  - Routes: `/health`, `/component/<name>`, `/components`
  - Dynamic iframe-based component loading
  - Configurable via `COMPONENT_PORT` env var

### 2. WebSocket Bridge Proxy  
- **src/app/bridge/bridgeProxy.ts** - Socket.io server
  - Subscribes to iRacing SDK bridge events
  - Broadcasts telemetry/session/running state to connected browsers
  - Maintains current state for new client connections
  - Handles client connect/disconnect lifecycle

### 3. Browser Component Rendering
- **src/app/bridge/componentRenderer.tsx** - Client-side React renderer
  - WebSocketBridge class implementing IrSdkBridge interface
  - Socket.io connection management
  - Zustand store integration for state management
  - Provider wrapping for component context
  - Error handling and logging

### 4. Entry Points
- **src/component-renderer-entry.ts** - Browser-only entry point
  - Bypasses Electron App.tsx to avoid provider errors
  - Loads component-renderer.html
  - Parses URL parameters for component name

- **index-component-renderer.html** - HTML wrapper
  - Minimal markup for component rendering
  - Socket.io client library loading
  - Component initialization script

### 5. Configuration Files
- **vite.component-renderer.config.ts** - Vite config for component renderer
- **vite.config.browser.ts** - Browser-specific Vite configuration
- **vite.config.electron.ts** - Electron-specific Vite configuration

### 6. Documentation & Platform Files
- **COMPONENT_SERVER.md** - Complete server documentation
  - Architecture overview
  - API reference
  - WebSocket event documentation
  - Troubleshooting guide
  - Example usage

- **platform.ts** - Platform abstraction layer
- **package.json** - Dependencies updated (socket.io, express added)

### 7. React Components
- **src/frontend/component-loader.tsx** - Legacy component loader
- **src/frontend/index.tsx** - Browser React entry point

### 8. Integration Points
- **src/main.ts** - Modified to start component server
  - Calls `startComponentServer(bridge)` on app ready

- **src/frontend/App.tsx** - Guard added for browser context
  - Checks for undefined bridges before rendering

---

## Architecture Flow

```
┌──────────────────────────┐
│   iRacing SDK (Real)     │
│   or Mock Bridge (Demo)  │
└────────────┬─────────────┘
             │
             ▼
┌──────────────────────────────────────┐
│  IrSdkBridge (Fixed)                 │
│  • onTelemetry() [continuous]        │
│  • onSessionData() [continuous]      │
│  • onRunningState() [continuous]     │
└────────────┬─────────────────────────┘
             │
             ▼
┌──────────────────────────────────────────────┐
│  Electron Main Process                       │
│  • Stores current telemetry/session/running  │
│  • Has iRacing SDK access                    │
└────────────┬─────────────────────────────────┘
             │
             ▼
┌──────────────────────────────────────────────┐
│  Bridge Proxy (Socket.io Server)             │
│  • Listens: telemetry, sessionData, running  │
│  • Broadcasts: io.emit() to all clients      │
│  • Port: 3000                                │
└────────────┬─────────────────────────────────┘
             │
             ▼
┌──────────────────────────────────────────────┐
│  Browser (Chrome/Firefox/etc)                │
│  • WebSocketBridge client                    │
│  • Socket.io connected                       │
│  • Receives real-time data                   │
│  • Updates Zustand stores                    │
│  • React components re-render                │
└──────────────────────────────────────────────┘
```

---

## How to Use

### Start the App
```bash
npm start
```

This automatically starts:
- Electron main window with dashboard
- Express HTTP server on port 3000
- Socket.io WebSocket bridge

### View Component in Browser
```
http://localhost:3000/component/standings
http://localhost:3000/component/weather
http://localhost:3000/component/map
```

### View All Available Components
```
http://localhost:3000/components
```

---

## Key Technical Decisions

1. **Subscription-Based Callbacks** - Allows multiple subscribers to same data stream
2. **Socket.io for WebSocket** - Proven, widely supported, handles reconnection
3. **Zustand for State** - Lightweight, performance-focused store management
4. **Provider Pattern** - React context for bridging Electron ↔ Browser
5. **Dynamic Entry Point** - Separate `component-renderer-entry.ts` avoids App.tsx provider cascade

---

## Testing Checklist

- ✅ iRacing SDK bridge fires callbacks continuously (not once)
- ✅ Browser receives telemetry data on Socket.io connection
- ✅ Stores update with real data
- ✅ Components render with live data
- ✅ Data updates as iRacing session progresses
- ✅ Multiple browser clients can connect simultaneously
- ✅ Handles iRacing start/stop cycles
- ✅ Error handling for missing component names
- ✅ CORS headers allow cross-origin requests

---

## Next Steps

Future enhancements could include:
- Full dashboard rendering with multiple widgets
- Component configuration UI
- Data recording/playback
- Performance metrics
- Multi-user roles/permissions
- Remote monitoring across networks

---

## Breaking Changes

None - this feature is purely additive and doesn't affect existing Electron app functionality.

## Dependencies Added

- `socket.io@^4.8.1` - WebSocket server for real-time data
- `express@^5.1.0` - HTTP server for component pages

## Backward Compatibility

✅ Existing Electron dashboard functionality unchanged  
✅ Optional component server starts only if HTTP is available  
✅ No changes to core iRacing SDK interface  
✅ Mock bridge still works for demo mode
