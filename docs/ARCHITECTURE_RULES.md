# irDashies Architecture Rules — for LLM Coding Agents

> **Purpose:** Current hard rules for any contributor (human or LLM) working in this codebase. The historical review that informed them is archived in [`archive/architecture-2026/`](./archive/architecture-2026/). When this file conflicts with general LLM training intuitions or with `AGENTS.md`, **this file wins for architecture concerns.**
>
> **How to use:** Before opening a PR, scan the relevant section, then run the [Pre-PR Checklist](#pre-pr-checklist) at the end. Each rule has an **enforcement** note — most can be checked with `grep` or `eslint`.

---

## 0. The non-negotiable invariants

These four rules cause real damage when broken. Verify them on every change.

| ID     | Rule                                                                                                                              | Quick check                                                                      |
| ------ | --------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| **N1** | No synchronous `fs.*Sync` outside startup. Use `fs.promises.*` and debounce writes.                                               | `grep -rn "writeFileSync\|readFileSync" src/app` excluding startup paths         |
| **N2** | The frontend never imports from `src/app/`. Type-only imports are also forbidden — use `src/types/` instead.                      | `grep -rn "from.*['\"]\.\./.*app/\|from.*['\"]@.*app/" src/frontend`             |
| **N3** | A widget folder never imports from another widget folder. Shared logic lives in `src/frontend/domain/` or behind a typed channel. | `grep -rn "from.*components/" src/frontend/components/<X>` for any pair `(X, Y)` |
| **N4** | No raw `ipcMain.handle` arg is dispatched to a method name, file path, or process flag without an allowlist.                      | Review every `ipcMain.handle` and `ipcMain.on` body                              |

---

## 1. Layered Architecture

Imports flow **downward** in this list. A layer may import from any layer below it; never above.

```
┌─ src/frontend/components/<Widget>/    (one widget; pure consumer)
├─ src/frontend/domain/                 (shared selectors, channel hooks)
├─ src/frontend/context/                (snapshot stores; raw TelemetryStore)
├─ src/frontend/utils/                  (pure helpers — colors, time, format)
├─ src/types/                           (snapshot shapes, settings shapes, type contracts)
├─ src/app/bridge/                      (channel bus, IPC handlers, defineBridge)
├─ src/app/processors/                  (TelemetryProcessor classes — derived data)
├─ src/app/sessionLifecycle/            (single session event source)
├─ src/app/storage/                     (async-only persistence)
├─ src/app/irsdk/                       (SDK wrapper, type generation)
└─ src/app/irsdk/native/                (C++ N-API addon)
```

### Rules

- **R1.1** Frontend code may only import from `@irdashies/types`, `@irdashies/utils`, `@irdashies/context`, `@irdashies/domain`, or its own widget folder.
- **R1.2** Widget folder `<X>` may not `from '../<Y>/...'` for any other widget `<Y>`. If you need shared logic, hoist to `frontend/domain/`.
- **R1.3** Storage modules must not import from `bridge` or `processors`. Storage is downstream of everything except `sessionLifecycle`.
- **R1.4** Native addon code is closed; no upward imports. Anything the JS layer needs must be exposed through the existing N-API surface.
- **R1.5** `src/types/` must not import from `src/app/` or `src/frontend/`. It is leaves-only.

**Enforcement:** add `eslint-plugin-boundaries` rules. Until then, reviewers/LLMs grep for cross-layer imports before merging.

---

## 2. Telemetry rules

### 2.1 Subscribing to telemetry

- **R2.1** Float arrays from `CarIdx*` MUST be subscribed via `useTelemetryValuesRounded(key, precision)`, never `useTelemetryValues(key)` — unless the key is on the **No-round list** below.
- **R2.2** Continuous scalar floats (`SessionTime`, `LapDistPct`) MUST be subscribed via `useTelemetryValueRounded(key, precision)` for any UI use; `useTelemetryValue` is only for booleans, integers, and strings.
- **R2.3** A side-effect (effect/updater) that reads telemetry SHOULD subscribe directly via `useTelemetryStore.subscribe` rather than via a hook — hooks re-run as React deps and amplify wake-ups.

### 2.2 Telemetry precision

| Use case                                       | Hook                        | Precision |
| ---------------------------------------------- | --------------------------- | --------- |
| Track-map position                             | `useTelemetryValuesRounded` | 3dp       |
| Position sorting (Standings)                   | `useTelemetryValuesRounded` | 3dp       |
| Time delta display (0.1 s)                     | `useTelemetryValuesRounded` | 2dp       |
| Reference-lap interpolation                    | `useTelemetryValuesRounded` | 4dp       |
| Throttle / Brake / Clutch / SteeringWheelAngle | `useTelemetryValues`        | —         |
| `CarSpeedsProcessor` inputs                    | full precision              | —         |
| `FuelLevel` / `SessionTime` thresholds         | `useTelemetryValues`        | —         |

### 2.3 No-round list (do not round, ever)

`Throttle`, `Brake`, `Clutch`, `SteeringWheelAngle`, `FuelLevel`, `FuelLevelPct`, `SessionTime`, anything fed into `CarSpeedsProcessor`, anything fed into a fuel-projection threshold.

**Enforcement:** `grep -rn "useTelemetryValues(['\"]CarIdx" src/frontend` should return only no-round-list entries.

---

## 3. Stores and Session Lifecycle

### 3.1 Stores

- **R3.1** New renderer stores that hold session-derived state MUST be added to the centralized disconnect reset in `useResetOnDisconnect`. If they also need session-number or driver lifecycle handling, consume the existing typed lifecycle/snapshot source instead of creating another global event source.
- **R3.2** A store that grows unboundedly (history, recorded laps, per-driver maps) MUST cap itself or clear on `sessionNumChange`. Document the cap in the store file.
- **R3.3** Stores live in `src/frontend/context/<StoreName>/`. Their updaters live in the same folder, not in `OverlayContainer/` or anywhere else.
- **R3.4** A store exposes its data via a typed hook (`use<Thing>Snapshot()`); selectors that other widgets consume live in `frontend/domain/`, not in a sibling widget folder.

### 3.2 Session lifecycle

- **R3.5** There is exactly one main-process `sessionLifecycle` source in `src/app/sessionLifecycle/`. Renderers consume lifecycle state through the existing typed channel and snapshot hooks.
- **R3.6** Code that aggregates over time must preserve the existing distinction between live, mock, and replay sources and must handle replay resets or scrubbing explicitly.

---

## 4. IPC, Bridges, and Channels

### 4.1 Bridge definition

- **R4.1** New bridges are defined via `defineBridge<I>(channel, impl)`. Hand-rolled `contextBridge.exposeInMainWorld` blocks are forbidden in new code.
- **R4.2** Module-global callback `Set`s in bridges are forbidden. Use the per-window subscription map provided by `defineBridge`.
- **R4.3** Every IPC handler (`ipcMain.handle`, `ipcMain.on`) MUST validate input. Specifically:
  - String arguments that select a method/property name → check against an explicit allowlist (e.g. `['debug','info','warn','error']`).
  - Path arguments → resolved against an allowed-base prefix and reject any traversal (`..`, absolute paths outside the prefix).
  - Anything that becomes a Chromium switch, environment variable, or shell argument → allowlist by name.

### 4.2 Channels

- **R4.4** New cross-process data flow goes over **named typed channels**, not the legacy `'telemetry'` firehose. Each channel has:
  - A `interface <Name>Snapshot` in `src/types/channels/`.
  - A processor in `src/app/processors/` that owns it.
  - A renderer hook `use<Name>Snapshot()` in `src/frontend/context/`.
- **R4.5** A channel snapshot MUST be the minimum payload the consumers need. Do not re-broadcast the full telemetry shape inside a "convenience" channel.
- **R4.6** Channel subscriptions are per-window. Closed or hidden windows do not receive broadcasts. Implement using `webContents.isVisible()` plus the per-window subscription map.

---

## 5. Processors (main-process derived telemetry)

- **R5.1** A `TelemetryProcessor` is a class implementing:
  ```ts
  interface TelemetryProcessor<S> {
    readonly channel: string;
    readonly tickRateHz: number | 'event'; // 'event' = only emit on signal
    init(session: SessionSnapshot): void;
    onFrame(frame: RawTelemetryFrame): void;
    onLifecycle(event: SessionLifecycleEvent): void;
    snapshot(): S;
  }
  ```
- **R5.2** Processors MUST be deterministic given a sequence of frames + lifecycle events. They are unit-tested with recorded fixtures in `src/app/processors/<Name>.spec.ts`.
- **R5.3** A processor declares its tick rate. `60` only for input-style channels; `25` for positional; `5` for sortable; `'event'` for crossings/laps.
- **R5.4** Processors do not perform I/O (storage, logging beyond `logger.warn`/`error`, network). Pull dependencies through a constructor-injected interface so tests can stub them.

---

## 6. Storage and Persistence

- **R6.1** All disk I/O in `src/app/storage/` MUST be async. `writeFileSync` / `readFileSync` are forbidden in new code.
- **R6.2** Writes are debounced (default 250 ms). The debouncer flushes on `app.before-quit`.
- **R6.3** Any persisted collection that grows over time MUST declare a cap (count, size, or age) and prune on save.
- **R6.4** Read errors return a typed safe default and call `logger.warn` with the path and error. They never throw to the bridge.

---

## 7. Widgets

### 7.1 Adding a widget

Follow the repository's widget checklist in `AGENTS.md`. The current explicit
registration flow includes `WidgetIndex.tsx`, the settings loader and menu,
`widgetConfigs.ts`, and `defaultDashboard.ts`; there is no auto-discovered
`WidgetDefinition` registry.

### 7.2 Widget rules

- **R7.1** Widgets are pure consumers. They subscribe to channel snapshots and selectors from `frontend/domain/`. They do not derive cross-widget data themselves. Register new widgets through the explicit files listed in `AGENTS.md`.
- **R7.2** Heavy memoised components MUST receive primitive props (string/number/boolean), not freshly-allocated objects. Either flatten props in the parent, or attach a custom `propsAreEqual` to the `memo()` wrapper.
- **R7.3** UI text is plain strings. **Never use emojis** — use Phosphor icons (`@phosphor-icons/react`).
- **R7.4** Styling is Tailwind-only. No custom CSS unless theme-level.
- **R7.5** Every widget has a `.stories.tsx` decorated with `TelemetryDecorator()` or the appropriate channel-snapshot decorator.

---

## 8. Settings and Migration

- **R8.1** Additive settings changes update the widget type and its entry in `defaultDashboard.ts`; `deepMergeConfig` fills missing fields when dashboards load.
- **R8.2** Breaking changes (rename, retype, or remove) require an explicit, tested migration at the dashboard-load boundary. Keep a migration close to the storage code unless the project adopts a shared registry later.
- **R8.3** Treat persisted dashboard data as untrusted. Migrations and merge logic must validate shapes and fall back to typed defaults when values are incompatible.
- **R8.4** Do not introduce a settings-version or migrator framework as incidental work. That was an unimplemented Phase 2b proposal and requires its own design and migration plan.

---

## 9. Profiles

- **R9.1** Code that needs the active dashboard MUST resolve the profile via `getCurrentProfileId()` and `getDashboard(profileId)`.
- **R9.2** `'default'` is the canonical built-in profile and may be used for creation, fallback, deletion protection, and explicitly global/default-backed settings. Do not use it accidentally where the active profile is intended.

---

## 10. Native code (`src/app/irsdk/native/`)

- **R10.1** Every pointer returned by `irsdk_*` functions MUST be null-checked before dereference. `irsdk_getVarHeaderEntry` returns NULL for invalid indices and pre-init state.
- **R10.2** Every JS-supplied index MUST be range-checked against `header->numVars` before use.
- **R10.3** Every N-API method that reads `info[N]` MUST verify `info.Length() > N` and `info[N].IsNumber()` (or appropriate type) before extracting.
- **R10.4** `_GENERATED_telemetry.ts` is generated by `src/app/irsdk/native/scripts/generate-var-types.js`. After changing native telemetry variables, run that generator directly and commit the result. There is currently no package script or CI freshness guard.

---

## 11. Logging and Errors

- **R11.1** Direct `console.log` / `console.warn` / `console.error` are forbidden (ESLint enforces `no-console`). Use the project logger.
- **R11.2** `logger[level]` calls MUST use a literal level (`logger.warn(...)`), never `logger[dynamicVar](...)`.
- **R11.3** `process.on('uncaughtException')` and `process.on('unhandledRejection')` MUST be registered in `src/main.ts` and forward to the logger and analytics.
- **R11.4** Logged messages MUST NOT include user-identifiable file paths verbatim if the entry will be forwarded to analytics. Strip `app.getPath('userData')` and `os.homedir()` prefixes before logging.

---

## 12. Security

- **R12.1** New `BrowserWindow` instances rely on Electron secure defaults. Do not set `nodeIntegration: true`, `contextIsolation: false`, `sandbox: false`, or `webSecurity: false`. If you must, the PR description explains why.
- **R12.2** Every new window registers `webContents.setWindowOpenHandler(() => ({ action: 'deny' }))` and `webContents.on('will-navigate', e => e.preventDefault())`.
- **R12.3** Renderer-supplied input that influences next launch (Chromium switches, environment, file system writes) is allowlisted by name. No free-form passthrough.
- **R12.4** Renderer HTML loads under a CSP that restricts `script-src` to `'self'` and `connect-src` to the local websocket origin.

---

## 13. Performance hygiene

- **R13.1** New high-frequency code paths must include a `perfMetrics.measure('<name>', fn)` wrap so they show up in the existing perf overlay.
- **R13.2** Per-frame allocations (new arrays / objects per tick) in hot paths are forbidden without a benchmark in the PR. Reuse buffers; mutate in place inside processors.
- **R13.3** A new widget MUST be checked with React DevTools Profiler at full grid before merge. Cell-component re-renders per second are documented in the PR description.

---

## 14. Testing

- **R14.1** New processors MUST ship with a `*.spec.ts` driving recorded frame sequences through `init` → `onFrame*` → `snapshot` and asserting the snapshot.
- **R14.2** New domain selectors (`frontend/domain/`) MUST ship with `*.spec.ts(x)` covering their pure logic.
- **R14.3** Widget components MUST ship with `.stories.tsx`. Visual regression is verified in Storybook.

---

## Pre-PR Checklist

Run through this list before opening any PR. LLM agents: include a filled copy in the PR description.

```
[ ] N1 — no new fs.*Sync outside startup
[ ] N2 — no new frontend → src/app/ imports (including type-only)
[ ] N3 — no new cross-widget imports (`components/<X>/` → `components/<Y>/`)
[ ] N4 — every new ipcMain handler validates renderer input
[ ] R2.1/R2.2 — telemetry hooks use the rounded variants (or the key is on the no-round list)
[ ] R3.1 — new session-derived renderer stores participate in centralized reset/lifecycle handling
[ ] R4.1 — new bridges use defineBridge
[ ] R6.1 — new storage code is async
[ ] R7.1 — new widget is added through the explicit registration/settings/default flow
[ ] R8.1/R8.2 — settings defaults are updated; breaking changes ship a tested load-time migration
[ ] R10.1 — native code null-checks pointers and bounds-checks indices
[ ] R11.1 — logging uses the project logger and literal level names
[ ] R13.1 — high-frequency code is wrapped in perfMetrics
[ ] R14.1 — new processors and selectors have *.spec.ts coverage
[ ] Storybook story exists for any new visual component
[ ] PR description includes: architecture impact (affected rules/layers, or "None") and before/after perf numbers if hot-path
```

---

## Forbidden patterns — quick reference

```ts
// FORBIDDEN — sync I/O on main process
fs.writeFileSync(path, JSON.stringify(data));
fs.readFileSync(path, 'utf8');

// FORBIDDEN — frontend importing from app
import { something } from '../../app/foo';
import type { X } from '../../app/foo'; // also forbidden — use src/types/

// FORBIDDEN — cross-widget import
import { useDriverStandings } from '../Standings/hooks/useDriverStandings';

// FORBIDDEN — raw telemetry float-array subscription
const positions = useTelemetryValues('CarIdxLapDistPct');

// FORBIDDEN — dynamic logger level dispatch
logger[level](message);

// FORBIDDEN — IPC arg flowing into a method/path/flag without an allowlist
ipcMain.handle('do-thing', (_e, name) => api[name]());
ipcMain.handle('save-flags', (_e, raw) => writeFlags(raw)); // see chromiumFlags

// FORBIDDEN — new store inventing another global lifecycle source
const mySessionEvents = new EventEmitter();

// FORBIDDEN — hand-rolled bridge expose in new code
contextBridge.exposeInMainWorld('myBridge', { foo, bar });
```

## Required patterns — quick reference

```ts
// REQUIRED — async + debounced storage write
import { promises as fsp } from 'node:fs';
import { debounce } from '@irdashies/utils/debounce';
export const saveData = debounce(async (data) => {
  await fsp.writeFile(path, JSON.stringify(data), 'utf8');
}, 250);

// REQUIRED — rounded telemetry subscription
const positions = useTelemetryValuesRounded('CarIdxLapDistPct', 3);

// REQUIRED — renderer store participates in centralized disconnect reset
if (prevRunning.current && !running) {
  useMyStore.getState().reset();
}

// REQUIRED — bridge via defineBridge with input validation
defineBridge<LogBridge>('log', {
  log: (level, ...args) => {
    if (!(['debug', 'info', 'warn', 'error'] as const).includes(level)) return;
    logger[level](...args);
  },
});

// REQUIRED — channel-based cross-process data flow
class FuelProjectionProcessor implements TelemetryProcessor<FuelProjectionSnapshot> {
  readonly channel = 'fuel.projection';
  readonly tickRateHz = 1;
  // init / onFrame / onLifecycle / snapshot
}

// REQUIRED — explicit widget registration (plus settings/default files)
export const WIDGET_MAP = {
  // existing widgets
  mywidget: MyWidget,
};
```
