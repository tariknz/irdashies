# Component Server Documentation

## Overview

The Component Server exposes your iRacing components via an HTTP server and WebSocket bridge, allowing external browsers (like Chrome) to view real-time telemetry data from your Electron app.

## Features

- 🌐 **HTTP Server**: Serves component pages on `http://localhost:3000`
- 🔌 **WebSocket Bridge**: Real-time data streaming via Socket.io from Electron to browser
- 📊 **Live Dashboard**: Monitor telemetry, session data, and running state
- 🔄 **Hot Reload**: Changes to data are reflected instantly in the browser

## Running the App

```bash
npm start
```

This starts:
- Electron app with the main dashboard
- Express HTTP server on port 3000 (configurable via `COMPONENT_PORT` env var)
- WebSocket bridge for data streaming

## Accessing Components

### List Available Components
```
http://localhost:3000/components
```

Returns JSON with available component names and URLs.

### View Component Dashboard
```
http://localhost:3000/component/<componentName>
```

Examples:
- `http://localhost:3000/component/standings` - Driver standings with live telemetry
- `http://localhost:3000/component/map` - Track map data
- `http://localhost:3000/component/weather` - Weather information
- `http://localhost:3000/component/input` - Input/control data
- `http://localhost:3000/component/relative` - Relative positioning data
- `http://localhost:3000/component/fastercarsfrombehind` - Cars faster from behind data

## Dashboard Display

Each component page shows:

1. **Connection Status** - Current WebSocket connection state (✅ Connected / ❌ Disconnected)
2. **Component Config** - Configuration object passed to the component
3. **Telemetry Data** - Live telemetry stream with real-time updates
4. **Session Data** - Session information (track, cars, drivers, etc.)
5. **Running State** - Indicator showing if iRacing is currently running

All data updates in real-time as it streams from the Electron app via WebSocket.

## Configuration

### Environment Variables

- `COMPONENT_PORT` - Port for the component server (default: 3000)
  ```bash
  COMPONENT_PORT=8080 npm start
  ```

## WebSocket API

The WebSocket server (via Socket.io) provides the following events:

### Server → Client

- `connect` - Client connected to server
- `initialState` - Initial state with telemetry, sessionData, isRunning, isDemoMode
  ```javascript
  {
    telemetry: { ... },      // Current telemetry data
    sessionData: { ... },    // Current session information  
    isRunning: boolean,      // Whether iRacing is running
    isDemoMode: boolean      // Whether demo/mock data is being used
  }
  ```
- `telemetry` - Updated telemetry data
- `sessionData` - Updated session data
- `runningState` - Updated running state (boolean)
- `demoModeChanged` - Updated demo mode state (boolean)
- `connect_error` - Connection error occurred

### Example Client Code

```javascript
const socket = io('ws://localhost:3000');

socket.on('connect', () => {
  console.log('Connected to component server');
});

socket.on('initialState', (state) => {
  console.log('Telemetry:', state.telemetry);
  console.log('Session:', state.sessionData);
  console.log('Running:', state.isRunning);
});

socket.on('telemetry', (data) => {
  console.log('Updated telemetry:', data);
});

socket.on('disconnect', () => {
  console.log('Disconnected from component server');
});
```

## Architecture

### Main Components

1. **componentServer.ts** - Express HTTP server serving component pages and health checks
2. **bridgeProxy.ts** - Socket.io WebSocket server that proxies bridge data from Electron
3. **componentRenderer.tsx** - Client-side React component renderer (for future use with HMR)

### Data Flow

```
┌─────────────────┐
│  iRacing SDK    │
│  (Mock/Real)    │
└────────┬────────┘
         │
         ▼
┌─────────────────────────────────────┐
│ IrSdkBridge                         │
│ • onTelemetry()                     │
│ • onSessionData()                   │
│ • onRunningState()                  │
└────────┬────────────────────────────┘
         │
         ▼
┌──────────────────────────────────────────────┐
│ Bridge Proxy (Socket.io Server)              │
│ • Listens to bridge events                   │
│ • Broadcasts to connected WebSocket clients  │
└────────┬─────────────────────────────────────┘
         │
         ▼
┌──────────────────────────────────────────────┐
│ Browser (Chrome/Firefox/etc)                 │
│ • Connects via Socket.io                     │
│ • Receives live data                         │
│ • Updates dashboard display                  │
└──────────────────────────────────────────────┘
```

## Use Cases

1. **Remote Monitoring** - Monitor iRacing telemetry from another computer
2. **Dashboard Display** - Display real-time race data on secondary monitors
3. **Streaming Data** - Integrate with streaming/recording tools
4. **Data Analysis** - Capture and analyze telemetry streams
5. **Debugging** - Debug component data flow and structure

## Future Enhancements

- Full React component rendering via module federation or SSR
- Component customization/configuration UI
- Data recording and playback
- Performance metrics and analytics
- Multi-user WebSocket connections with roles/permissions

## Troubleshooting

### "Connection timeout" Error
- Ensure the Electron app is running (`npm start`)
- Check that port 3000 is not blocked by firewall
- Verify WebSocket connection: `ws://localhost:3000`

### No telemetry data appearing
- If iRacing is not running, you'll see mock data (in demo mode)
- Check browser console for connection errors
- Verify the bridge is properly initialized

### Port Already in Use
```bash
# Change the port
COMPONENT_PORT=3001 npm start

# Or kill the process using port 3000
# Windows: netstat -ano | findstr :3000
# macOS/Linux: lsof -i :3000
```

## Development

### Adding New Components

1. Create component in `src/frontend/components/`
2. Export in `src/frontend/WidgetIndex.tsx` WIDGET_MAP
3. Access via `http://localhost:3000/component/mycomponent`

### Extending Bridge Data

To expose additional data via the bridge:

1. Add listener in `bridgeProxy.ts`
2. Emit Socket.io event from server
3. Handle in browser JavaScript

Returns a JSON response with all available components.

### View a Component
```
http://localhost:3000/component/standings
http://localhost:3000/component/weather
http://localhost:3000/component/map
```

### Pass Configuration
Components can receive configuration via query parameters:
```
http://localhost:3000/component/standings?config={"prop":"value"}
```

## Available Components

- `standings` - Standings display widget
- `input` - Input display widget
- `relative` - Relative position widget
- `map` - Track map widget
- `weather` - Weather widget
- `fastercarsfrombehind` - Faster cars detection widget

## Features

✅ **HTTP Access** - Components accessible via localhost URLs  
✅ **Full Bridge Context** - Components have access to telemetry, dashboard, and running state via Electron bridges  
✅ **Dynamic Component Loading** - Components are loaded by name from the widget registry  
✅ **Error Handling** - User-friendly error messages when components fail to load  
✅ **Health Check** - `/health` endpoint to verify the server is running  
✅ **Development Ready** - Works alongside your existing Electron app  

## Requirements

- Components must be registered in `src/frontend/WidgetIndex.tsx`
- Bridge objects (`dashboardBridge`, `irsdkBridge`) are automatically available via the preload script
- Must be accessed from within the Electron app (e.g., in a webview or separate window)

## Technical Details

- Server runs on **port 3000** (customizable via `COMPONENT_PORT` environment variable)
- Components are rendered with all necessary context providers
- HTML pages use dynamic ES module imports to load component code
- Type-safe with full TypeScript support
- Each component page runs in its own renderer context

## How to Use from Another Renderer

You can open component URLs from another Electron renderer window:

```typescript
// From another Electron window
window.open('http://localhost:3000/component/standings', '_blank');

// Or load it in a BrowserView
const view = new BrowserView();
mainWindow.addBrowserView(view);
view.webContents.loadURL('http://localhost:3000/component/standings');
```

## Example: Custom Implementation

```typescript
// Open a component in a modal or overlay
import { BrowserWindow } from 'electron';

const componentWindow = new BrowserWindow({
  width: 800,
  height: 600,
  webPreferences: {
    preload: path.join(__dirname, 'preload.ts'),
  }
});

componentWindow.loadURL('http://localhost:3000/component/weather');
```

## Environment Variables

- `COMPONENT_PORT`: Override the default component server port (default: 3000)

Example:
```bash
COMPONENT_PORT=8080 npm start
```
