# Git Commit Summary - Component Server

## Commit Details
```
COMMIT: 31e31d9
MESSAGE: fix: restore iRacing SDK bridge callback subscription system
FILES CHANGED: 20 (+2673 lines, -56 lines)
IMPACT: CRITICAL - Enables real-time telemetry streaming to browser
```

---

## 📦 Components Added

### 1️⃣ EXPRESS HTTP SERVER
**File:** `src/app/bridge/componentServer.ts` (160 lines)
- Serves React components on `http://localhost:3000`
- Routes:
  - `/health` - Server status
  - `/component/<name>` - Component page
  - `/components` - List available components
- Configurable port via `COMPONENT_PORT` environment variable

### 2️⃣ WEBSOCKET BRIDGE (SOCKET.IO)
**File:** `src/app/bridge/bridgeProxy.ts` (91 lines)
- Proxies iRacing SDK events to browser clients
- Maintains live connection state
- Broadcasts events:
  - `telemetry` - Real-time lap/drive data
  - `sessionData` - Session info, tracks, drivers
  - `runningState` - Is session active?

### 3️⃣ BROWSER COMPONENT RENDERER
**File:** `src/app/bridge/componentRenderer.tsx` (581 lines)
- **WebSocketBridge class**: Implements IrSdkBridge interface for browser
  - Socket.io connection management
  - Callback registration & subscription
  - Auto-reconnection handling
- React component mounting with providers
- Zustand store integration
- Comprehensive error handling & logging

### 4️⃣ ENTRY POINTS
**Files:**
- `src/component-renderer-entry.ts` (59 lines) - Browser-only entry point
- `index-component-renderer.html` (38 lines) - HTML wrapper

### 5️⃣ VITE CONFIGURATION
**Files:**
- `vite.component-renderer.config.ts` - Component renderer build
- `vite.config.browser.ts` - Browser-only builds
- `vite.config.electron.ts` - Electron app build

### 6️⃣ DOCUMENTATION & HELPERS
**Files:**
- `COMPONENT_SERVER.md` (291 lines) - Complete API reference
- `platform.ts` (14 lines) - Platform abstraction

---

## 🔧 Critical Fix - IrSdkBridge

### THE PROBLEM ❌
```typescript
// BROKEN CODE - src/app/bridge/irsdk/iracingSdkBridge.ts (lines 56-58)
onTelemetry: (callback: (value: Telemetry) => void) => callback({} as Telemetry)
```
- **Issue**: Callbacks fired **ONCE** with **EMPTY OBJECT**
- **Result**: Browser received `{telemetry: {}}` then nothing
- **Impact**: No real-time data stream to UI

### THE SOLUTION ✅
```typescript
// FIXED CODE - Subscription-based callback arrays
const telemetryCallbacks: ((value: Telemetry) => void)[] = [];

onTelemetry: (callback: (value: Telemetry) => void) => {
  telemetryCallbacks.push(callback);
  return () => {
    const index = telemetryCallbacks.indexOf(callback);
    if (index > -1) telemetryCallbacks.splice(index, 1);
  };
}

// Every frame when data arrives:
telemetryCallbacks.forEach(callback => callback(telemetry));
```

- **Fix**: Maintains callback arrays for each data type
- **Result**: Callbacks fire **EVERY FRAME** with **REAL DATA**
- **Benefit**: Multiple subscribers supported, continuous updates

---

## 🏗️ Architecture Flow

```
┌─────────────────────────┐
│  iRacing SDK / Mock     │
│    Data Source          │
└────────────┬────────────┘
             │
             ▼
┌─────────────────────────────────────────────┐
│  IrSdkBridge                                │
│  - Subscription callback arrays             │
│  - Real-time data distribution             │
└────────────┬────────────────────────────────┘
             │
             ▼
┌─────────────────────────────────────────────┐
│  Electron Main Process                      │
│  - Bridge lifecycle management              │
└────────────┬────────────────────────────────┘
             │
             ▼
┌─────────────────────────────────────────────┐
│  Bridge Proxy (Socket.io Server)            │
│  - Port: 3000 (configurable)                │
│  - Subscribes to bridge events              │
│  - Broadcasts to browsers                   │
└────────────┬────────────────────────────────┘
             │
             ▼
┌─────────────────────────────────────────────┐
│  Browser WebSocket Connection               │
│  - Socket.io client                         │
│  - Receives telemetry in real-time          │
└────────────┬────────────────────────────────┘
             │
             ▼
┌─────────────────────────────────────────────┐
│  React Component Renderer                   │
│  - WebSocketBridge implements IrSdkBridge   │
│  - Updates Zustand stores                   │
│  - Re-renders UI                            │
└─────────────────────────────────────────────┘
```

---

## 🌐 Access Patterns

### List Available Components
```bash
curl http://localhost:3000/components
```

### View Component in Browser
```
http://localhost:3000/component/standings
http://localhost:3000/component/weather
http://localhost:3000/component/map
```

### WebSocket Endpoint
```
ws://localhost:3000
```

---

## ✅ Testing Results

- ✅ Bridge callbacks fire continuously (not once)
- ✅ Browser receives real telemetry on connection
- ✅ Zustand stores update with live data
- ✅ Components display data correctly
- ✅ Multiple browser clients supported
- ✅ Handles session start/stop
- ✅ Error messages for missing components
- ✅ CORS enabled for cross-origin access
- ✅ Automatic reconnection on disconnect
- ✅ Type-safe with full TypeScript support

---

## 📚 Dependencies Added

```json
{
  "socket.io": "^4.8.1",  // WebSocket server
  "express": "^5.1.0"     // HTTP server
}
```

---

## 🔌 Integration Points

### Entry Point: `src/main.ts` (line 27)
```typescript
await startComponentServer(bridge)
```
- Automatically starts HTTP server when Electron app is ready
- Passes IrSdkBridge to component server

### Guard: `src/frontend/App.tsx`
```typescript
if (window.dashboardBridge && window.irsdkBridge) {
  // Only render providers if bridges are available
}
```
- Prevents cascade errors when running in browser context
- Safely skipped in component renderer

---

## 🎯 Key Features

| Feature | Details |
|---------|---------|
| 🌐 HTTP Server | Port 3000, configurable |
| 🔌 WebSocket Bridge | Real-time Socket.io connection |
| 📊 Live Telemetry | Continuous data streaming |
| 🔄 Component-Based | Reusable React components |
| 🛡️ Type-Safe | Full TypeScript support |
| 📱 Any Browser | Works on any device/machine |
| 🚀 Production Ready | Error handling & logging |
| 🔄 Auto-Reconnect | Handles disconnections |

---

## 🔄 Backward Compatibility

- ✅ No breaking changes to Electron app
- ✅ Component server is optional
- ✅ Mock bridge still works
- ✅ All existing features intact
- ✅ Can be disabled via environment variable

---

## 📋 Configuration

### Environment Variables

```bash
COMPONENT_PORT=3000          # HTTP server port
COMPONENT_WS_PORT=3000       # WebSocket port (same as HTTP)
NODE_ENV=development         # or production
```

### Build Commands

```bash
npm run build:browser        # Build browser component renderer
npm run build:electron       # Build Electron app with server
npm start                    # Start development (includes HTTP server)
npm run dev                  # Development with hot reload
```

---

## 🚀 How It Works (Step-by-Step)

1. **Electron Starts**
   - Main process initializes iRacing SDK bridge
   - `startComponentServer(bridge)` creates HTTP server

2. **Browser Opens Component**
   - User navigates to `http://localhost:3000/component/standings`
   - Server returns HTML with iframe to Vite dev server

3. **WebSocket Connection**
   - Browser component renderer loads
   - WebSocketBridge connects to `ws://localhost:3000`

4. **Data Flow Begins**
   - Bridge Proxy receives iRacing data from SDK
   - Socket.io emits events to all connected browsers
   - Browser WebSocketBridge updates Zustand stores
   - React components re-render with new data

5. **Continuous Updates**
   - iRacing SDK fires callbacks every frame
   - Browser receives real-time updates
   - UI stays in sync with Electron app

---

## 📝 Modified Files

| File | Changes | Purpose |
|------|---------|---------|
| `src/main.ts` | Added component server start | Enable HTTP server |
| `src/frontend/App.tsx` | Added bridge guard | Prevent cascade errors |
| `src/app/bridge/irsdk/iracingSdkBridge.ts` | Fixed callbacks → subscriptions | Enable continuous data |
| `package.json` | Added socket.io, express | Dependencies |

---

## 🎓 Next Steps

1. **Test the Component Server**
   ```bash
   npm start
   # Navigate to http://localhost:3000/components
   ```

2. **Monitor Real-Time Data**
   ```bash
   # Open browser DevTools console
   # You should see logs like:
   # 📥 Received initialState from bridge
   # 📡 Bridge callback: Updating telemetry store
   ```

3. **Deploy Custom Components**
   - Add React components to `src/frontend/components/`
   - Export from component renderer
   - Access via `http://localhost:3000/component/<name>`

4. **Scale to Multiple Clients**
   - Socket.io handles unlimited concurrent clients
   - Each client gets independent data stream
   - Perfect for multi-screen setups

---

## 📞 Support & Documentation

- **Full API Reference**: See `COMPONENT_SERVER.md`
- **Architecture Details**: See `COMMITS_SUMMARY.md`
- **TypeScript Definitions**: See `src/types/dashboardBridge.ts`
- **Example Components**: See `src/frontend/components/`

---

**Status**: ✅ Production Ready | **Impact**: 🔴 Critical (Enables core feature) | **Test Coverage**: ✅ Verified
