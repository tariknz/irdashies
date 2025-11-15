# Component Loading Issues - Troubleshooting Guide

## Symptoms
- Component page loads but nothing appears
- No console errors
- Blank/black screen

## Debugging Steps

### 1. Check Browser Console

Open the browser console (F12) and look for these logs:

```
📦 Component renderer entry point loaded
📋 URL Parameters:
  Component: standings
  WebSocket URL: http://localhost:3000
  Config: {...}
🎯 Starting component render...
🚀 renderComponent called with: {...}
📝 Step 1: Initialize mock stores
...
```

**If you DON'T see these logs:**
- Vite dev server might not be running
- Check if `http://localhost:5173` is accessible
- Restart the Vite dev server

**If you see an error:**
- Read the error message carefully
- Check if all imports are resolving correctly
- Look for missing dependencies

### 2. Check WebSocket Connection

Look for these WebSocket logs in console:

```
✅ Connected to bridge
📥 Received initialState from bridge
  Telemetry: present
  SessionData: present
  IsRunning: true/false
```

**If you DON'T see these:**
- Component server might not be running
- Check if `http://localhost:3000` is accessible
- Verify WebSocket bridge is initialized

**To test WebSocket separately:**
```javascript
// Paste in browser console
const socket = io('http://localhost:3000');
socket.on('connect', () => console.log('✅ Connected'));
socket.on('initialState', (state) => console.log('📥 State:', state));
```

### 3. Check Component Server

Test these URLs:

1. **Health Check**
   ```
   http://localhost:3000/health
   ```
   Should return: `{"status":"ok","message":"Component server is running"}`

2. **Dashboard Debug**
   ```
   http://localhost:3000/debug/dashboard
   ```
   Shows current dashboard state and widget configs

3. **Component List**
   ```
   http://localhost:3000/components
   ```
   Lists all available components

### 4. Check Vite Dev Server

Test if Vite is serving files:

```
http://localhost:5173/component-renderer.html
```

Should show either:
- "Component Renderer - No component specified" message
- OR the actual component if you add `?component=standings`

### 5. Check Data Flow

If component renders but shows blank:

**In Electron app:**
- Is iRacing running?
- Is there telemetry data being received?
- Check main app console for telemetry logs

**In browser:**
- Open console and check store state:
  ```javascript
  // Paste in browser console (after page loads)
  window.__REACT_DEVTOOLS_GLOBAL_HOOK__
  ```

### 6. Check Component Config

Look for these logs:
```
✅ Found widget config for standings: {...}
📋 Final browser config for standings: {...}
```

If missing:
- Dashboard might not have the widget
- Widget config might be empty
- Check stream config in `streamConfig.ts`

## Common Issues

### Issue: Blank Screen, No Errors

**Possible Causes:**
1. Component is rendering but has no data to display
2. CSS is hiding content (check with browser inspector)
3. Component is waiting for WebSocket data that never arrives

**Solution:**
- Check if iRacing is running (components might hide when not racing)
- Inspect element to see if DOM is being created
- Check component-specific `showOnlyWhenOnTrack` settings

### Issue: "Component not found" Error

**Solution:**
- Check component name spelling (must match WIDGET_MAP)
- Available: `standings`, `input`, `relative`, `map`, `weather`, `fastercarsfrombehind`
- Component names are case-insensitive

### Issue: Socket.io Not Defined

**Solution:**
- Check if Socket.io CDN script is loaded in `index-component-renderer.html`
- Look for: `<script src="https://cdn.socket.io/4.5.4/socket.io.min.js"></script>`

### Issue: Module Import Errors

**Solution:**
- Run `npm install` to ensure all dependencies are installed
- Check tsconfig path aliases are configured correctly
- Restart Vite dev server

## Manual Testing Commands

### Test Component Server
```powershell
# Check if server is running
curl http://localhost:3000/health

# Check dashboard state
curl http://localhost:3000/debug/dashboard

# List components
curl http://localhost:3000/components
```

### Test Vite Server
```powershell
# Check if Vite is serving
curl http://localhost:5173/component-renderer.html
```

### Test Full Flow
```powershell
# Open in browser (PowerShell)
Start-Process "http://localhost:3000/component/standings"
```

## Debug Checklist

- [ ] Electron app is running (`npm start`)
- [ ] Component server logs show: `✅ Component server running on http://localhost:3000`
- [ ] Vite dev server is running (usually auto-started)
- [ ] `http://localhost:3000/health` returns OK
- [ ] Browser console shows component loading logs
- [ ] Browser console shows WebSocket connection
- [ ] Browser console shows `✅ Successfully rendered component`
- [ ] iRacing is running (if component has `showOnlyWhenOnTrack`)

## Expected Console Output

### Successful Load:
```
📦 Component renderer entry point loaded (NOT loading App.tsx)
📋 URL Parameters:
  Component: standings
  WebSocket URL: http://localhost:3000
  Config: {...}
🎯 Starting component render...
🚀 renderComponent called with: { componentName: 'standings', wsUrl: 'http://localhost:3000' }
📝 Step 1: Initialize mock stores
🎨 Initializing mock store data...
✅ Mock data initialized
📝 Step 2: Import Zustand stores
  ✅ Stores imported
📝 Step 3: Create WebSocket bridge
📝 Step 4: Register store update listeners
  ✅ Store listeners registered
📝 Step 5: Connect to WebSocket bridge
  Connecting to http://localhost:3000...
✅ Connected to bridge
📥 Received initialState from bridge: {...}
  Telemetry: present
  SessionData: present
  IsRunning: true
  ✅ Bridge connected
  ✅ Stores updated with initial data
📝 Step 6: Create React root
  ✅ Root created
📝 Step 7: Get component from widget map
  Looking for component: standings
  ✅ Found component: standings
📝 Step 8: Render actual component with providers
  📋 Component config: {...}
  📊 Current store state:
    Telemetry: present
    Session: present
✅ Successfully rendered component: standings
✅ Component render completed successfully
```

## Still Not Working?

1. **Clear browser cache** (Ctrl+Shift+Delete)
2. **Hard refresh** (Ctrl+F5)
3. **Restart everything:**
   ```powershell
   # Kill all processes
   taskkill /F /IM node.exe
   
   # Restart app
   npm start
   ```
4. **Check for port conflicts:**
   ```powershell
   netstat -ano | findstr :3000
   netstat -ano | findstr :5173
   ```

## Getting More Info

Add this to browser console to see React component tree:
```javascript
// Check if React root exists
console.log('Root element:', document.getElementById('root'));
console.log('Root HTML:', document.getElementById('root')?.innerHTML);
console.log('Root children:', document.getElementById('root')?.children);
```

## Reporting Issues

If still not working, provide:
1. Full browser console output
2. Component server console output
3. Output from `http://localhost:3000/debug/dashboard`
4. Screenshot of blank screen with browser inspector open
