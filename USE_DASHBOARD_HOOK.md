# Using useDashboard() in Browser Components

## Overview

Browser components can now use the `useDashboard()` hook to access the dashboard configuration directly, just like Electron components.

## Example: Standings Component

```tsx
import { useDashboard } from '@irdashies/context';

export const Standings = (props: StandingsProps) => {
  const { currentDashboard } = useDashboard();
  
  // Get THIS widget's configuration from the dashboard
  const widget = currentDashboard?.widgets.find(
    w => w.id.toLowerCase() === 'standings'
  );
  const config = widget?.config || {};
  
  // Merge with passed props (passed props take precedence)
  const finalConfig = { ...config, ...props };
  
  return (
    <div>
      {/* Use finalConfig instead of props */}
      <h1>{finalConfig.title}</h1>
      {/* ... rest of component */}
    </div>
  );
};
```

## How It Works

### In Electron (Same as Before)
```tsx
const { currentDashboard } = useDashboard();
const widget = currentDashboard?.widgets.find(w => w.id === 'standings');
const config = widget?.config;
```

### In Browser (Now Works!)
```tsx
// Browser now also has access to currentDashboard through context
const { currentDashboard } = useDashboard();
const widget = currentDashboard?.widgets.find(w => w.id === 'standings');
const config = widget?.config;  // ✅ Same code works in both!
```

## Data Flow

### Setup
1. Browser navigates to: `http://localhost:3000/component/standings`
2. Component server finds widget config from `currentDashboard`
3. Browser component loads and connects to WebSocket
4. Bridge proxy sends `initialState` with dashboard included
5. `DashboardProvider` receives dashboard and updates context
6. Component can now use `useDashboard()` hook

### Real-time Updates
1. User changes widget config in Electron
2. Electron emits `dashboardUpdated` event
3. Bridge proxy broadcasts to all browsers
4. Browser receives `dashboardUpdated` event
5. `DashboardProvider` updates context
6. Component automatically re-renders with new config

## Best Practices

### Access Widget Config
```tsx
const { currentDashboard } = useDashboard();

// Get this widget's specific config
const widget = currentDashboard?.widgets.find(
  w => w.id.toLowerCase() === 'standings'
);
const widgetConfig = widget?.config || {};
```

### Merge with Props
```tsx
// Props from URL take precedence over dashboard config
const finalConfig = { ...widgetConfig, ...props };
```

### Handle Undefined Dashboard
```tsx
if (!currentDashboard) {
  return <div>Loading dashboard...</div>;
}
```

### Access General Settings
```tsx
const fontSize = currentDashboard?.generalSettings?.fontSize || 'md';
const showOnlyOnTrack = currentDashboard?.generalSettings?.showOnlyWhenOnTrack;
```

## Complete Example

```tsx
import React from 'react';
import { useDashboard } from '@irdashies/context';

interface StandingsProps {
  title?: string;
  maxRows?: number;
  colorScheme?: 'dark' | 'light';
}

export const Standings: React.FC<StandingsProps> = (props) => {
  const { currentDashboard } = useDashboard();
  
  // Find this widget's config in the dashboard
  const widget = currentDashboard?.widgets.find(
    w => w.id.toLowerCase() === 'standings'
  );
  
  // Merge dashboard config with props (props override)
  const config = {
    title: 'Standings',
    maxRows: 10,
    colorScheme: 'dark' as const,
    ...widget?.config,
    ...props,
  };
  
  if (!currentDashboard) {
    return <div>Waiting for dashboard...</div>;
  }
  
  return (
    <div className={`standings standings-${config.colorScheme}`}>
      <h1>{config.title}</h1>
      {/* Component content using config */}
    </div>
  );
};
```

## Testing

### In Browser
1. Start app: `npm start`
2. Visit: `http://localhost:3000/component/standings`
3. Open DevTools console
4. Should see:
   ```
   📥 Received initialState from bridge: {..., dashboard: {...}}
   📤 Triggering dashboard callbacks...
   ```
5. Component displays with dashboard config

### Verify Config is Used
1. Change widget settings in Electron
2. Refresh browser tab
3. Component should display with new settings

### Real-time Updates
1. Have browser tab open
2. Change widget config in Electron
3. Browser should auto-update (if WebSocket connection active)

## URL Parameters Still Work

The `config` URL parameter still works for testing/overrides:

```
http://localhost:3000/component/standings?config={"maxRows":5}
```

The URL config is merged with dashboard config (URL takes precedence).

## Migration Path

If you have existing components using props only:

**Before:**
```tsx
export const Standings = (props: StandingsProps) => {
  // Props come from URL only
  return <div>{props.title}</div>;
};
```

**After:**
```tsx
export const Standings = (props: StandingsProps) => {
  const { currentDashboard } = useDashboard();
  const widget = currentDashboard?.widgets.find(w => w.id === 'standings');
  const config = { ...widget?.config, ...props };
  
  // Now uses dashboard config!
  return <div>{config.title}</div>;
};
```

## Summary

✅ Browser components now have access to Electron's dashboard configuration  
✅ Use `useDashboard()` to get `currentDashboard` with all widgets and their configs  
✅ Same code works in both Electron and Browser  
✅ Real-time sync of configuration changes  
✅ URL config still works for testing/overrides
