# iRDashies - Claude Development Guide

## Project Overview

**iRDashies** is an Electron-based application for creating custom overlays and dashboards for iRacing. It's built with React, TypeScript, Zustand for state management, and Tailwind CSS for styling.

**Repository**: https://github.com/tariknz/irdashies (forked from original)
**Main Branch**: `main`
**Version**: 0.0.28
**License**: MIT

---

## Critical Git Workflow Rules

### Always Use Feature Branches on Fork

**IMPORTANT**: This is a forked repository. Always create and work on feature branches:

```bash
# Create a new feature branch from main
git checkout main
git pull origin main
git checkout -b feat/your-feature-name

# Work on your changes...
git add .
git commit -m "feat: description of changes"

# Push to your fork
git push -u origin feat/your-feature-name
```

**Never commit directly to `main`** - always use pull requests from feature branches.

### Branch Naming Conventions

- **Features**: `feat/feature-name`
- **Fixes**: `fix/bug-description`
- **Chores**: `chore/maintenance-task`
- **Experimental**: `wip/work-in-progress`

### Commit Message Format

```
<type>: <description>

Examples:
feat: add average lap time column to standings
fix: resolve linting errors in relative gap calculation
chore: update dependencies
```

### Creating Clean Feature Branches

When mixed commits exist, use cherry-pick to create clean branches:

```bash
# Create clean branch from main
git checkout main
git checkout -b feat/feature-clean

# Cherry-pick only relevant commits
git cherry-pick <commit-hash-1>
git cherry-pick <commit-hash-2>

# For mixed commits, cherry-pick without committing
git cherry-pick -n <commit-hash>
git reset HEAD path/to/unrelated/files
git checkout -- path/to/unrelated/files
git commit -m "original message"
```

---

## Project Structure

```
irdashies/
├── src/
│   ├── app/              # Electron main process & backend
│   │   ├── bridge/       # IPC communication bridges
│   │   ├── irsdk/        # iRacing SDK wrapper
│   │   ├── storage/      # Dashboard persistence
│   │   └── overlayManager.ts
│   ├── frontend/         # React components & UI
│   │   ├── components/   # UI components (Standings, Input, etc.)
│   │   ├── context/      # Zustand stores & React providers
│   │   ├── utils/        # Utility functions
│   │   └── App.tsx
│   └── types/           # Shared TypeScript types
├── .storybook/          # Component development
├── tools/               # Build scripts
└── [config files]       # Vite, ESLint, TypeScript configs
```

### Frontend Structure (`src/frontend/`)

```
frontend/
├── components/
│   ├── Standings/           # Standings overlay
│   │   ├── Standings.tsx
│   │   ├── Relative.tsx
│   │   ├── components/      # Sub-components
│   │   ├── hooks/           # Component-specific hooks
│   │   └── *.stories.tsx    # Storybook stories
│   ├── Settings/            # Settings panels
│   │   ├── sections/        # Widget settings
│   │   ├── components/      # BaseSettingsSection, ToggleSwitch
│   │   └── types.ts         # Settings type definitions
│   └── [other widgets]/
├── context/                 # State management
│   ├── TelemetryStore/      # Real-time telemetry (Zustand)
│   ├── SessionStore/        # Session data (React Context)
│   ├── DashboardContext/    # Layout & settings
│   └── [specialized stores]/
└── utils/                   # Shared utilities
    ├── colors.ts
    ├── time.ts
    └── [others]
```

### Backend Structure (`src/app/`)

```
app/
├── bridge/
│   ├── dashboard/          # Dashboard IPC bridge
│   ├── iracingSdk/         # iRacing SDK integration
│   └── rendererExposeBridge.ts
├── irsdk/                  # SDK wrapper (Node + Native)
├── storage/
│   ├── dashboards.ts       # Persistence layer
│   └── defaultDashboard.ts # Default configuration
└── overlayManager.ts       # Window management
```

---

## State Management Architecture

### Zustand Store Guidelines

**Use Global Stores (Zustand) When:**
- Data is needed across multiple components
- High-frequency updates (telemetry at 60 FPS)
- Requires custom equality comparisons for performance
- Needs persistent state across route changes

**Use Local State (useState) When:**
- UI-only state (forms, modals, dropdowns)
- State is isolated to a single component
- No cross-component dependencies

**Use React Context When:**
- Providing configuration (bridges, providers)
- Less frequent updates (dashboard layout)
- Need to pass callbacks through component tree

### Core Stores

#### 1. TelemetryStore (Zustand)
```typescript
// Real-time telemetry data, updated every frame
import { useTelemetryStore } from '@irdashies/context';

// Get full telemetry array with equality checking
const speed = useTelemetry('Speed', customComparator);

// Get first value only
const playerSpeed = useTelemetryValue('Speed');

// Get entire array
const allSpeeds = useTelemetryValues('Speed');
```

#### 2. SessionStore (React Context)
```typescript
// Session data: drivers, positions, lap times
import {
  useSessionDrivers,
  useSessionPositions,
  useDriverCarIdx,
  useTrackLength
} from '@irdashies/context';

const drivers = useSessionDrivers();
const playerCarIdx = useDriverCarIdx();
```

#### 3. Specialized Stores (Feature-Specific)

**IMPORTANT**: If creating a store for a specific widget/feature that won't be shared across multiple overlays, keep it standalone and scoped to that feature:

```typescript
// ✅ CORRECT: Scoped to Relative overlay feature
// src/frontend/context/RelativeGapStore/RelativeGapStore.tsx
export const useRelativeGapStore = create<RelativeGapState>((set) => ({
  // ... state specific to relative gap calculations
}));

// Only imported by Relative.tsx and related components
```

```typescript
// ❌ WRONG: Making it generic when it's not needed elsewhere
// Don't add to global context exports if only one feature uses it
```

**When to create a specialized store:**
- Feature needs historical data or complex calculations
- Multiple components in the feature need shared state
- Performance requires memoization and selective updates
- State must persist across component remounts

**Existing specialized stores:**
- `RelativeGapStore` - Position/time records for gap calculations
- `LapTimesStore` - Lap time tracking with 5-lap rolling window
- `CarSpeedsStore` - Speed calculations with moving average

### Provider Integration Pattern

```typescript
// Always wrap providers in correct order
<DashboardProvider bridge={dashboardBridge}>
  <RunningStateProvider bridge={irsdkBridge}>
    <SessionProvider bridge={irsdkBridge} />
    <TelemetryProvider bridge={irsdkBridge} />
    <HashRouter>
      {/* Your app */}
    </HashRouter>
  </RunningStateProvider>
</DashboardProvider>
```

---

## Component Patterns

### Functional Component Structure

```typescript
import { memo, useMemo } from 'react';
import { useSomeStore } from '@irdashies/context';

interface ComponentProps {
  propName: string;
  optionalProp?: number;
}

export const MyComponent = memo(({ propName, optionalProp }: ComponentProps) => {
  // 1. Hooks first
  const storeData = useSomeStore((state) => state.data);

  // 2. Memoize expensive computations
  const computed = useMemo(() => {
    return expensiveCalculation(storeData);
  }, [storeData]);

  // 3. Render with Tailwind classes
  return (
    <div className="flex items-center space-y-2">
      {/* Component JSX */}
    </div>
  );
});

MyComponent.displayName = 'MyComponent';
```

### Component Organization

```
ComponentName/
├── ComponentName.tsx           # Main component
├── ComponentName.stories.tsx   # Storybook story
├── components/                 # Sub-components
│   └── SubComponent.tsx
└── hooks/                      # Component-specific hooks
    └── useComponentData.tsx
```

### Performance Patterns

**1. Memoization for High-Frequency Updates**
```typescript
// Use memo() for components receiving many props
export const DriverRow = memo(({ driver, telemetry }) => {
  // Component implementation
});

// Use useMemo() for expensive calculations
const sortedDrivers = useMemo(() =>
  drivers.sort((a, b) => a.position - b.position),
  [drivers]
);
```

**2. Custom Equality Comparators**
```typescript
// For Zustand selectors with array comparisons
const speeds = useTelemetry('Speed', (prev, next) => {
  return prev?.length === next?.length &&
         prev.every((val, i) => val === next[i]);
});
```

### Widget Registration

All widgets must be registered in `WidgetIndex.tsx`:

```typescript
export const WIDGET_MAP: Record<string, (config: any) => React.JSX.Element> = {
  standings: Standings,
  relative: Relative,
  input: Input,
  mywidget: MyWidget, // Add new widgets here
};
```

---

## Styling with Tailwind CSS

### Core Principles

**Always use Tailwind CSS for all layouts and UX** - no custom CSS files unless absolutely necessary.

### Configuration

- **Theme File**: `theme.css` - Contains CSS variables and custom utilities
- **Tailwind Version**: 4.1 with `@tailwindcss/postcss` plugin
- **Font Family**: Lato (sans-serif)

### Common Patterns

#### 1. Overlay Backgrounds
```tsx
<div className="bg-slate-800/[var(--bg-opacity)] rounded-sm p-2 text-white">
  {/* Opacity controlled by CSS variable from settings */}
</div>
```

#### 2. Responsive Font Sizes
```tsx
{/* Font sizes scale based on theme class */}
<div className="text-xs sm:text-sm md:text-base">
  Scales: xs(8-14px), sm(10-16px), base(12-18px)
</div>
```

#### 3. State-Based Styling
```tsx
<tr className={[
  'odd:bg-slate-800/70 even:bg-slate-900/70 text-sm',
  !onTrack || onPitRoad ? 'text-white/60' : '',
  isPlayer ? 'text-amber-300' : '',
  !isPlayer && isLapped ? 'text-blue-400' : '',
].join(' ')}>
```

#### 4. Flexbox Layouts
```tsx
{/* Horizontal layout with vertical spacing */}
<div className="flex items-center justify-between space-y-4">
  <span>Label</span>
  <input />
</div>

{/* Vertical layout with scrollable content */}
<div className="flex flex-col h-full">
  <div className="flex-none">Header</div>
  <div className="flex-1 overflow-y-auto min-h-0">
    Scrollable content
  </div>
</div>
```

### Color System

```typescript
// Use the color utility system
import { getTailwindStyle, getColor } from '@irdashies/utils/colors';

const styles = getTailwindStyle(colorIndex);
// Returns: { driverIcon, classHeader, fill, canvasFill }

const hexColor = getColor('orange', 500); // CSS variable lookup
```

### Theme Customization

Users can customize via `ThemeManager`:
- **Font Sizes**: xs, sm, lg, xl
- **Color Palettes**: Multiple pre-defined color schemes
- **Background Opacity**: Adjustable per widget

---

## TypeScript Conventions

### Path Aliases

```typescript
// Available aliases
import { useTelemetryStore } from '@irdashies/context';
import { formatTime } from '@irdashies/utils/time';
import type { DashboardLayout } from '@irdashies/types';
```

### Type Organization

```
src/types/
├── index.ts                 # Export all types
├── dashboardLayout.ts       # Widget layout and config
├── dashboardBridge.ts       # IPC bridge types
├── irSdkBridge.ts          # SDK bridge types
├── session.ts              # Session data
└── telemetry.ts            # Telemetry data
```

### Interface Naming Conventions

```typescript
// Props interfaces
interface ComponentNameProps {
  required: string;
  optional?: number;
}

// Settings interfaces
interface WidgetNameSettings extends BaseWidgetSettings {
  config: {
    enabled: boolean;
    option: { value: number };
  };
}

// Store state interfaces
interface StoreState {
  data: string;
  setData: (data: string) => void;
}

// Type definitions
type SessionType = 'Practice' | 'Qualifying' | 'Race';
```

### Type Safety Best Practices

1. **Strict Mode Enabled**: Always use strict TypeScript
2. **Avoid `any`**: Use generics or union types
3. **Optional Chaining**: Use `?.` for safe access
   ```typescript
   const value = telemetry?.SessionTime?.value?.[0];
   ```
4. **Type Guards**: Validate at boundaries
   ```typescript
   if (value && typeof value === 'object' && 'property' in value) {
     // TypeScript narrows type
   }
   ```

---

## Widget Settings Pattern

### Settings Structure

Each widget follows this pattern:

```typescript
// 1. Define settings type in Settings/types.ts
export interface MyWidgetSettings extends BaseWidgetSettings {
  config: {
    enabled: boolean;
    buffer: number;
    customOption: { value: string };
  };
}

// 2. Create settings component in Settings/sections/
const defaultConfig: MyWidgetSettings['config'] = {
  enabled: true,
  buffer: 5,
  customOption: { value: 'default' }
};

const migrateConfig = (savedConfig: unknown): MyWidgetSettings['config'] => {
  if (!savedConfig || typeof savedConfig !== 'object') return defaultConfig;
  const config = savedConfig as Record<string, unknown>;

  // Handle backwards compatibility
  return {
    enabled: (config.enabled as { enabled?: boolean })?.enabled ?? true,
    buffer: (config.buffer as number) ?? 5,
    customOption: { value: (config.customOption as { value?: string })?.value ?? 'default' }
  };
};

export const MyWidgetSettings = () => {
  const { currentDashboard } = useDashboard();
  const savedSettings = currentDashboard?.widgets.find(w => w.id === 'mywidget');
  const [settings, setSettings] = useState<MyWidgetSettings>({
    enabled: savedSettings?.enabled ?? true,
    config: migrateConfig(savedSettings?.config),
  });

  return (
    <BaseSettingsSection
      title="My Widget Settings"
      description="Configure your widget"
      settings={settings}
      onSettingsChange={setSettings}
      widgetId="mywidget"
    >
      {(handleConfigChange) => (
        <div className="space-y-4">
          {/* Settings UI controls */}
          <div className="flex items-center justify-between">
            <span className="text-sm text-slate-300">Buffer Size</span>
            <select
              value={settings.config.buffer}
              onChange={(e) => handleConfigChange({ buffer: parseInt(e.target.value) })}
              className="bg-slate-700 text-slate-200 px-3 py-1 rounded border border-slate-600"
            >
              {Array.from({ length: 10 }, (_, i) => (
                <option key={i} value={i + 1}>{i + 1}</option>
              ))}
            </select>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-sm text-slate-300">Enable Feature</span>
            <ToggleSwitch
              enabled={settings.config.enabled}
              onToggle={(enabled) => handleConfigChange({ enabled })}
            />
          </div>
        </div>
      )}
    </BaseSettingsSection>
  );
};
```

### Settings Persistence Flow

```
User Changes Settings
  ↓
BaseSettingsSection captures change
  ↓
updateDashboard() callback
  ↓
DashboardBridge.saveDashboard() (IPC)
  ↓
Electron stores to disk
  ↓
Reloaded on app restart
```

### Store Configuration Pattern

If your feature has a specialized store that needs settings:

```typescript
// In your store
interface StoreConfig {
  enabled: boolean;
  option: string;
}

interface StoreState {
  config: StoreConfig;
  updateConfig: (config: StoreConfig) => void;
}

export const useMyStore = create<StoreState>((set) => ({
  config: { enabled: true, option: 'default' },
  updateConfig: (config) => set({ config }),
}));

// In settings component
const updateStoreConfig = useMyStore((state) => state.updateConfig);

useEffect(() => {
  // Sync settings to store on mount only
  updateStoreConfig(settings.config);
}, []); // Empty deps!

// Update store immediately on change
const handleToggle = (enabled: boolean) => {
  const newConfig = { ...settings.config, enabled };
  handleConfigChange({ enabled });
  updateStoreConfig(newConfig); // Immediate update
};
```

---

## Testing

### Testing Setup

- **Test Runner**: Vitest 3.2.4
- **DOM Testing**: @testing-library/react
- **Test Files**: `*.spec.ts` or `*.spec.tsx`
- **Configuration**: `vitest.config.ts`

### Unit Test Pattern

```typescript
import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import { MyComponent } from './MyComponent';

describe('MyComponent', () => {
  it('renders without crashing', () => {
    const { container } = render(<MyComponent />);
    expect(container).toBeInTheDocument();
  });

  it('handles user interactions', () => {
    const mockHandler = vi.fn();
    const { getByRole } = render(<MyComponent onClick={mockHandler} />);

    fireEvent.click(getByRole('button'));
    expect(mockHandler).toHaveBeenCalled();
  });
});
```

### Store Testing

```typescript
import { renderHook, act } from '@testing-library/react';
import { useMyStore } from './store';

describe('useMyStore', () => {
  it('updates state correctly', () => {
    const { result } = renderHook(() => useMyStore());

    act(() => {
      result.current.setValue('new value');
    });

    expect(result.current.value).toBe('new value');
  });
});
```

### Run Tests

```bash
npm run test                    # With coverage
npm run test -- --no-coverage  # Without coverage
```

---

## Storybook Development

### Component Stories

Every component should have a `.stories.tsx` file:

```typescript
import type { Meta, StoryObj } from '@storybook/react-vite';
import { TelemetryDecorator } from '@irdashies/storybook';
import { MyComponent } from './MyComponent';

const meta: Meta<typeof MyComponent> = {
  component: MyComponent,
  decorators: [TelemetryDecorator()], // Provides mock telemetry
};

export default meta;

type Story = StoryObj<typeof MyComponent>;

export const Default: Story = {
  args: {
    propName: 'value'
  }
};

export const WithCustomConfig: Story = {
  decorators: [
    TelemetryDecoratorWithConfig('path/to/mock.json', {
      mywidget: { buffer: 5 } // Override settings
    })
  ]
};
```

### Run Storybook

```bash
npm run storybook  # Opens on port 6006
```

---

## IPC Bridge Architecture

### Critical Separation Rule

**Frontend components MUST NOT import from `./app` directory**

- **Reason**: Electron-specific modules won't work in renderer process
- **Solution**: Use IPC bridges for all communication
- **Exception**: Type definitions in `src/types/`

### Bridge Pattern

```typescript
// Bridge definition (exposed via preload.ts)
interface MyBridge {
  getData: () => Promise<Data>;
  onDataUpdated: (callback: (data: Data) => void) => () => void;
}

// React provider
export const MyProvider = ({ bridge, children }) => {
  const [data, setData] = useState<Data>();

  useEffect(() => {
    // Subscribe to updates
    return bridge.onDataUpdated((newData) => setData(newData));
  }, [bridge]);

  return <MyContext.Provider value={data}>{children}</MyContext.Provider>;
};
```

---

## Common Development Tasks

### Adding a New Widget

1. **Create component**: `src/frontend/components/MyWidget/MyWidget.tsx`
2. **Create settings**: `src/frontend/components/Settings/sections/MyWidgetSettings.tsx`
3. **Add settings type**: `src/frontend/components/Settings/types.ts`
4. **Create story**: `src/frontend/components/MyWidget/MyWidget.stories.tsx`
5. **Register widget**: Add to `WidgetIndex.tsx`
6. **Add default config**: Update `defaultDashboard.ts`
7. **Export from context**: If using stores, export from `context/index.ts`

### Adding a Custom Hook

```typescript
// src/frontend/context/shared/useMyHook.tsx
export const useMyHook = () => {
  const data = useTelemetryStore((state) => state.data);
  return useMemo(() => compute(data), [data]);
};

// Export from context/index.ts
export * from './shared/useMyHook';
```

### Creating a Feature-Specific Store

**Only create if:**
- Feature needs historical data or complex calculations
- Multiple components within the feature need shared state
- Performance requires memoization
- State must persist across component remounts

```typescript
// src/frontend/context/MyFeatureStore/MyFeatureStore.tsx
import { create } from 'zustand';

interface MyFeatureState {
  data: string[];
  config: Config;
  addData: (item: string) => void;
  updateConfig: (config: Config) => void;
  clearData: () => void;
}

export const useMyFeatureStore = create<MyFeatureState>((set, get) => ({
  data: [],
  config: { enabled: true },

  addData: (item) => set((state) => ({
    data: [...state.data, item]
  })),

  updateConfig: (config) => set({ config }),

  clearData: () => set({ data: [] }),
}));

// Hook for auto-updating from telemetry
export const useMyFeatureUpdater = () => {
  const telemetry = useTelemetryStore((state) => state.telemetry);
  const addData = useMyFeatureStore((state) => state.addData);

  useEffect(() => {
    if (!telemetry) return;
    // Process telemetry and update store
    addData(processedData);
  }, [telemetry, addData]);
};

// Export from index.ts
export * from './MyFeatureStore/MyFeatureStore';
```

### Modifying Widget Settings

1. **Update interface** in `Settings/types.ts`
2. **Update defaultConfig** in settings component
3. **Add migration logic** in `migrateConfig()` for backwards compatibility
4. **Add UI controls** in `BaseSettingsSection` render function
5. **Test in Storybook** with mock configuration

---

## Build & Development

### Scripts

```bash
# Development
npm start              # Start dev app with logging
npm run storybook     # Component library (port 6006)
npm run test          # Run tests with coverage
npm run lint          # Check code quality

# Building
npm run package       # Create installer
npm run make          # Create .exe file
npm run generate-assets # Generate asset data
```

### Code Quality

**ESLint**: Run before committing
```bash
npm run lint
```

**Prettier**: Auto-format on save (VS Code)
- Single quotes
- 80 character line width
- Trailing commas (ES5)

---

## Key Technologies

| Technology | Version | Purpose |
|------------|---------|---------|
| React | 19 | UI framework |
| TypeScript | 5.9 | Type safety |
| Zustand | 5 | State management |
| Tailwind CSS | 4.1 | Styling |
| Vite | 7.1 | Build tool |
| Electron | 35.1 | Desktop app |
| Vitest | 3.2 | Testing |
| Storybook | 10 | Component dev |

---

## Architecture Principles

### 1. Separation of Concerns
- **Frontend**: React components, stores, hooks
- **Backend**: Electron main process, SDK integration
- **Bridge**: Typed IPC communication only

### 2. Performance First
- Memoization for high-frequency updates
- Custom equality comparators for Zustand
- Lazy loading where applicable
- Efficient re-render prevention

### 3. Type Safety
- Strict TypeScript mode
- No `any` types
- Type guards at boundaries
- Shared type definitions

### 4. Tailwind-First Styling
- Use Tailwind for all layouts
- Minimal custom CSS
- Theme variables for customization
- Responsive design built-in

### 5. Feature Isolation
- Specialized stores for specific features
- Don't make generic what isn't shared
- Keep feature code together
- Clear ownership and scope

---

## Debugging Tips

### Common Issues

**1. Store not updating:**
- Check equality comparator in selector
- Verify memo dependencies are correct
- Ensure provider is mounted

**2. Settings not persisting:**
- Check migration logic in `migrateConfig()`
- Verify `handleConfigChange()` is called
- Confirm dashboard saves via IPC

**3. Tailwind classes not working:**
- Rebuild to update PostCSS
- Check theme.css for custom variables
- Verify class names are correct

**4. Telemetry data missing:**
- Confirm TelemetryProvider is mounted
- Check if iRacing is running (or use mock SDK)
- Verify bridge connection

### Development Tools

- **React DevTools**: Component tree and props
- **Zustand DevTools**: State inspection (add middleware)
- **Electron DevTools**: Network, console, performance
- **Storybook**: Component isolation and testing

---

## Resources

- **README.md**: User-facing documentation
- **IMPLEMENTATION_SUMMARY.md**: Feature implementation details (enhanced relative gap system)
- **.storybook/**: Component library
- **docs/**: Additional documentation

---

This guide covers the essential patterns and practices for developing on iRDashies. Always prioritize clean separation between frontend/backend, use Tailwind for styling, create specialized stores only when needed, and maintain type safety throughout.
