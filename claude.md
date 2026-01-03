# iRDashies - Claude Development Guide

## Project Overview

**iRDashies** is an Electron-based iRacing overlay/dashboard app using React, TypeScript, Zustand, and Tailwind CSS.

- **Repo**: https://github.com/tariknz/irdashies (fork)
- **Branch**: `main` | **Version**: 0.0.28 | **License**: MIT

---

## Git Workflow

**Never commit directly to `main`** - always use feature branches and PRs.

### Branch Naming
- `feat/feature-name` | `fix/bug-description` | `chore/task` | `wip/experimental`

### Commit Format
```
<type>: <description>
# Examples: feat: add avg lap time column | fix: resolve linting errors
```

### Clean Feature Branches (cherry-pick)
```bash
git checkout main && git checkout -b feat/feature-clean
git cherry-pick <hash>              # Full commit
git cherry-pick -n <hash>           # Partial: then reset/checkout unwanted files
```

---

## Project Structure

```
src/
├── app/                  # Electron main process
│   ├── bridge/           # IPC bridges (dashboard, iracingSdk)
│   ├── irsdk/            # iRacing SDK wrapper
│   └── storage/          # Dashboard persistence
├── frontend/             # React UI
│   ├── components/       # Widgets (Standings, Input, Settings, etc.)
│   ├── context/          # Zustand stores & React providers
│   └── utils/            # Shared utilities (colors, time)
└── types/                # Shared TypeScript types
```

---

## State Management

| Use Case | Solution |
|----------|----------|
| Cross-component, high-frequency (60 FPS telemetry) | **Zustand** with custom equality |
| UI-only, single component | **useState** |
| Configuration, callbacks, infrequent updates | **React Context** |

### Core Stores

```typescript
// Telemetry (real-time)
const speed = useTelemetry('Speed', customComparator);
const playerSpeed = useTelemetryValue('Speed');

// Session (drivers, positions)
const drivers = useSessionDrivers();
const playerCarIdx = useDriverCarIdx();
```

### Specialized Stores
Create **only when** feature needs: historical data, complex calculations, shared state across feature components, or persistence across remounts.

Keep scoped to feature - don't add to global exports unless multiple overlays need it.

Existing: `RelativeGapStore`, `LapTimesStore`, `CarSpeedsStore`

---

## Component Patterns

### Structure
```typescript
export const MyComponent = memo(({ prop }: Props) => {
  const data = useSomeStore((s) => s.data);           // 1. Hooks
  const computed = useMemo(() => calc(data), [data]); // 2. Memoize
  return <div className="flex items-center">{/* 3. Tailwind JSX */}</div>;
});
MyComponent.displayName = 'MyComponent';
```

### File Organization
```
ComponentName/
├── ComponentName.tsx
├── ComponentName.stories.tsx
├── components/           # Sub-components
└── hooks/                # Component-specific hooks
```

### Performance
- `memo()` for components receiving props in high-frequency updates
- `useMemo()` for expensive calculations
- Custom equality comparators for Zustand array selectors

### Widget Registration
All widgets in `WidgetIndex.tsx`:
```typescript
export const WIDGET_MAP = { standings: Standings, relative: Relative, mywidget: MyWidget };
```

---

## Tailwind CSS

**Always use Tailwind** - no custom CSS unless absolutely necessary.

- **Theme**: `theme.css` with CSS variables
- **Font**: Lato | **Version**: 4.1

### Common Patterns
```tsx
// Overlay background with variable opacity
<div className="bg-slate-800/[var(--bg-opacity)] rounded-sm p-2 text-white">

// State-based styling
<tr className={['odd:bg-slate-800/70 even:bg-slate-900/70',
  !onTrack ? 'text-white/60' : '', isPlayer ? 'text-amber-300' : ''].join(' ')}>

// Scrollable content
<div className="flex flex-col h-full">
  <div className="flex-none">Header</div>
  <div className="flex-1 overflow-y-auto min-h-0">Content</div>
</div>
```

### Colors
```typescript
import { getTailwindStyle, getColor } from '@irdashies/utils/colors';
```

---

## TypeScript

### Path Aliases
```typescript
import { useTelemetryStore } from '@irdashies/context';
import { formatTime } from '@irdashies/utils/time';
import type { DashboardLayout } from '@irdashies/types';
```

### Naming Conventions
- Props: `ComponentNameProps`
- Settings: `WidgetNameSettings extends BaseWidgetSettings`
- Store state: `StoreState` with data + actions
- Types: `type SessionType = 'Practice' | 'Qualifying' | 'Race'`

### Best Practices
- Strict mode enabled, no `any`
- Optional chaining: `telemetry?.SessionTime?.value?.[0]`
- Type guards at boundaries

---

## Widget Settings

### Pattern
1. Define type in `Settings/types.ts` extending `BaseWidgetSettings`
2. Create settings component in `Settings/sections/`
3. Implement `migrateConfig()` for backwards compatibility
4. Use `BaseSettingsSection` wrapper

### Persistence Flow
```
User Changes → BaseSettingsSection → updateDashboard() → IPC → Disk → Reload on restart
```

---

## IPC Bridge Architecture

**Frontend MUST NOT import from `./app`** - use IPC bridges only (type definitions in `src/types/` are OK).

```typescript
// Bridge pattern
interface MyBridge {
  getData: () => Promise<Data>;
  onDataUpdated: (cb: (data: Data) => void) => () => void;
}
```

---

## Testing

- **Runner**: Vitest | **Files**: `*.spec.ts(x)` | **DOM**: @testing-library/react

```bash
npm run test              # With coverage
npm run test -- --no-coverage
```

---

## Storybook

Every component needs `.stories.tsx`:
```typescript
import { TelemetryDecorator } from '@irdashies/storybook';
const meta: Meta<typeof MyComponent> = { component: MyComponent, decorators: [TelemetryDecorator()] };
```

```bash
npm run storybook  # Port 6006
```

---

## Development Tasks

### Adding a Widget
1. Create `src/frontend/components/MyWidget/MyWidget.tsx`
2. Create `Settings/sections/MyWidgetSettings.tsx`
3. Add type to `Settings/types.ts`
4. Create `.stories.tsx`
5. Register in `WidgetIndex.tsx`
6. Add default config in `defaultDashboard.ts`

### Adding a Hook
```typescript
// src/frontend/context/shared/useMyHook.tsx
export const useMyHook = () => { /* ... */ };
// Export from context/index.ts
```

---

## Scripts

```bash
npm start              # Dev app
npm run storybook      # Component library
npm run test           # Tests
npm run lint           # ESLint
npm run package        # Create installer
```

### Code Quality
- ESLint before committing
- Prettier: single quotes, 80 chars, trailing commas (ES5)

---

## Key Technologies

| Tech | Version | | Tech | Version |
|------|---------|---|------|---------|
| React | 19 | | Electron | 35.1 |
| TypeScript | 5.9 | | Vitest | 3.2 |
| Zustand | 5 | | Storybook | 10 |
| Tailwind | 4.1 | | Vite | 7.1 |

---

## Architecture Principles

1. **Separation**: Frontend (React) ↔ Bridge (IPC) ↔ Backend (Electron)
2. **Performance**: Memoization, custom equality, lazy loading
3. **Type Safety**: Strict TS, no `any`, guards at boundaries
4. **Tailwind-First**: Minimal custom CSS
5. **Feature Isolation**: Scoped stores, co-located code

---

## Debugging

| Issue | Check |
|-------|-------|
| Store not updating | Equality comparator, memo deps, provider mounted |
| Settings not persisting | `migrateConfig()`, `handleConfigChange()`, IPC |
| Tailwind not working | Rebuild, check theme.css, verify class names |
| Telemetry missing | TelemetryProvider mounted, iRacing running, bridge connection |

**Tools**: React DevTools, Zustand DevTools, Electron DevTools, Storybook
