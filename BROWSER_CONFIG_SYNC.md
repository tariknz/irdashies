# Browser Component Configuration Sync

## Summary

Browser components use the **exact same configuration** as Electron dashboard widgets. The configuration is automatically passed from the Electron app to the browser through the component server in real-time.

**No separate browser config** - What you configure in Electron is exactly what renders in the browser.

## How It Works

### 1. Dashboard State Tracking (`bridgeProxy.ts`)

The bridge proxy exports `currentDashboard` which is updated in real-time:

```typescript
export let currentDashboard: DashboardLayout | null = null;

// Subscribes to dashboard updates
if (dashboardBridge) {
  dashboardBridge.dashboardUpdated((dashboard: DashboardLayout) => {
    currentDashboard = dashboard;
    io.emit('dashboardUpdated', dashboard);
  });
}
```

**Result:** The bridge proxy always has the current dashboard configuration in memory.

---

### 2. Config Passing (`componentServer.ts`)

When serving a component, the server looks up the widget config and passes it as a URL parameter:

```typescript
// Look up widget in current dashboard
if (currentDashboard) {
  const normalizedName = componentName.toLowerCase();
  const widget = currentDashboard.widgets?.find(
    (w) => w.id.toLowerCase() === normalizedName
  );
  
  // Pass config via URL parameter
  if (widget?.config) {
    configParam = `&config=${encodeURIComponent(JSON.stringify(widget.config))}`;
  }
}

// Generate iframe with config parameter
const html = `
  <iframe src="...?component=standings&wsUrl=...&config=${configParam}"></iframe>
`;
```

**Result:** Browser receives URL like:
```
http://localhost:5173/component-renderer.html?component=standings&wsUrl=http://localhost:3000&config={"someKey":"someValue"}
```

**Important:** Always access components via the component server (`http://localhost:3000/component/standings`), not directly via Vite URL. The component server wraps the iframe with proper parameters.

---

### 3. Browser Component Renders

The component renderer receives the config from URL parameters (already handled in `component-renderer-entry.ts`):

```typescript
const params = new URLSearchParams(window.location.search);
const config = configJson ? JSON.parse(decodeURIComponent(configJson)) : {};

// Component renders with this config
<ComponentFn {...config} />
```

**Result:** Browser component receives exact same props as Electron component.

---

## Data Flow Diagram

```
┌─────────────────────────────┐
│ Electron Dashboard          │
│ - User configures widget    │
│ - Widget config stored      │
└────────────┬────────────────┘
             │
             │ Config changes
             ▼
┌─────────────────────────────┐
│ DashboardBridge             │
│ - Emits dashboardUpdated    │
└────────────┬────────────────┘
             │
             ▼
┌─────────────────────────────┐
│ BridgeProxy                 │
│ - Updates currentDashboard  │
│ - Broadcasts to browsers    │
└────────────┬────────────────┘
             │
             ▼
┌─────────────────────────────┐
│ ComponentServer             │
│ - Imports currentDashboard  │
│ - Looks up widget config    │
│ - Encodes as URL parameter  │
└────────────┬────────────────┘
             │
             ▼
┌─────────────────────────────┐
│ Browser                     │
│ - Receives config in URL    │
│ - Component renders with    │
│   exact same settings       │
└─────────────────────────────┘
```

---

## Usage

### View a Component in Browser

Simply navigate to the component:

```
http://localhost:3000/component/standings
```

The component will automatically:
1. ✅ Fetch the dashboard from Electron
2. ✅ Find the widget configuration for "standings"
3. ✅ Pass it as a URL parameter
4. ✅ Browser component receives and uses it
5. ✅ Renders with exact same config as Electron

### If Widget Config Changes in Electron

1. Electron broadcasts `dashboardUpdated` event
2. BridgeProxy updates `currentDashboard`
3. Next time you visit a component URL, it gets the new config

---

## Technical Details

### Modified Files

1. **`bridgeProxy.ts`**
   - Export `currentDashboard` variable
   - Subscribe to dashboard updates
   - Update `currentDashboard` in real-time

2. **`componentServer.ts`**
   - Import `currentDashboard` from bridgeProxy
   - Look up widget config in `/component/:componentName` route
   - Encode config as URL parameter

3. **`componentRenderer.tsx`**
   - Removed complex dashboard fetching logic (no longer needed)
   - Components receive config from URL parameters
   - Simplified data flow

4. **`dashboardBridge.ts`**
   - Exported `dashboardBridge` object
   - Notify bridgeProxy of updates via callbacks

5. **`main.ts`**
   - Pass `dashboardBridge` to `startComponentServer`

---

## Benefits

✅ **No duplication** - One source of truth (Electron dashboard)  
✅ **Real-time sync** - Config changes automatically propagate  
✅ **Simple** - Just passes config via URL  
✅ **Reliable** - Uses existing dashboard storage mechanism  
✅ **Zero latency** - No async fetching needed

---

## Testing

To verify browser components use Electron config:

1. **Start the app:**
   ```bash
   npm start
   ```

2. **In Electron app:**
   - Configure a widget (e.g., change colors, sizes, options)
   - Note the exact settings

3. **In Browser:**
   - Navigate to `http://localhost:3000/component/standings`
   - Browser component should display with **exact same configuration**
   - Console logs show: `✅ Found widget config for standings`

4. **Change config in Electron:**
   - Update widget settings
   - Refresh browser tab
   - Browser component immediately uses new config

---

## Notes

- Config is URL-encoded JSON, so complex objects work fine
- If widget has no config, component gets empty object `{}`
- URL config parameter takes precedence (useful for testing overrides)
- Electron and browser components are now perfectly synchronized
