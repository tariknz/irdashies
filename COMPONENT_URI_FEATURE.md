# Component URI Exposure Feature

## Overview

This feature enables external browsers to access individual dashboard components via HTTP URLs, allowing components to be embedded in iframes, OBS browser sources, or viewed standalone in any web browser.

## Architecture

### Component Server (Port 3000)
- **Express HTTP Server**: Serves component pages at `http://localhost:3000/component/<name>`
- **WebSocket Bridge**: Real-time data streaming via Socket.io
  - Broadcasts telemetry (60fps), session data, and running state
  - Syncs dashboard configuration and demo mode status
  - Supports multiple concurrent browser connections

### Data Flow
```
iRacing SDK → Electron Main Process → WebSocket Server → Browser Clients
                     ↓
              Demo Mode Toggle
                     ↓
           Mock Data Generator (with multi-subscriber support)
```

### Key Components

1. **Bridge Proxy** (`bridgeProxy.ts`)
   - WebSocket server that exposes Electron bridge data
   - Tracks demo mode state and syncs to connected clients
   - Resubscribes when bridge changes (e.g., toggling between live/demo data)

2. **Component Renderer** (`componentRenderer.tsx`)
   - Browser-side React renderer with WebSocket client
   - Applies theme settings and dashboard configuration
   - Supports conditional debug logging via `?debug=true`

3. **Mock Data Generator** (`generateMockData.ts`)
   - Refactored to support multiple subscribers using Sets
   - Generates 60fps telemetry and 2s session updates
   - Allows both overlay manager and browser clients to receive data

## Usage

### Accessing Components

**Basic URL Pattern:**
```
http://localhost:3000/component/<component-name>
```

**Available Components:**
- `map` - Track map with driver positions
- `standings` - Race standings table
- `input` - Driver input visualization
- `fuel` - Fuel calculator
- `weather` - Weather information
- And all other dashboard widgets

**URL Parameters:**
- `debug=true` - Enable verbose console logging
- `config=<json>` - Override component configuration (URL-encoded JSON)

### Examples

**Track Map (Basic):**
```
http://localhost:3000/component/map
```

**Track Map (With Config):**
```
http://localhost:3000/component/map?config=%7B%22enableTurnNames%22%3Afalse%7D
```

**Standings (Debug Mode):**
```
http://localhost:3000/component/standings?debug=true
```

### Embedding in OBS

1. Add **Browser Source** to your scene
2. Set URL to: `http://localhost:3000/component/<name>`
3. Set dimensions (e.g., 1920x1080)
4. Enable "Shutdown source when not visible" for performance
5. Background is transparent by default

### Embedding in iframes

```html
<iframe 
  src="http://localhost:3000/component/map?config=%7B%22enableTurnNames%22%3Afalse%7D" 
  width="1920" 
  height="1080"
  scrolling="no"
  frameborder="0">
</iframe>
```

## Demo Mode

Toggle between live iRacing data and mock data:
- Use the Electron app's demo mode toggle
- WebSocket automatically syncs state to all connected clients
- Bridge resubscribes when switching data sources

## Features

✅ **Real-time Data Streaming** - 60fps telemetry via WebSocket  
✅ **Transparent Backgrounds** - Ready for overlays and embedding  
✅ **Theme Support** - Respects dashboard font size and color settings  
✅ **Multi-Client** - Multiple browsers can connect simultaneously  
✅ **Debug Mode** - Conditional logging with `?debug=true`  
✅ **Hot Reload** - Components update when dashboard settings change  

## Technical Details

### CSS Variables
- Uses Tailwind CSS v4 with custom `@theme` configuration
- `--spacing: 0.25rem` for consistent padding calculations
- Transparent backgrounds with `!important` to override dark color-scheme defaults

### Debug Logging
- Suppressed by default for clean console
- Enable with `?debug=true` URL parameter
- Shows WebSocket connection, data flow, and render lifecycle

### Browser Compatibility
- Modern browsers with WebSocket support
- Tested on Chrome, Edge, Firefox
- Works in OBS browser sources (CEF)

## Performance

- WebSocket maintains single connection per client
- Mock data generator uses single interval per data type
- Set-based subscriber pattern prevents callback overwrites
- 60fps telemetry with throttled session updates (2s)
