# irDashies Architecture Review

> **Status:** Proposal (revised after Phase 0 measurement) — May 2026
> **Audience:** Maintainers and LLM coding agents working on the codebase
> **Companion files:**
>
> - [`ARCHITECTURE_RULES.md`](./ARCHITECTURE_RULES.md) — the enforceable rules derived from this review
> - [`PERFORMANCE_TEST_SUMMARY.md`](./PERFORMANCE_TEST_SUMMARY.md) — empirical evidence (5 controlled sessions, May 2026) underpinning the revised priorities below
> - [`IMPLEMENTATION_PLAN.md`](./IMPLEMENTATION_PLAN.md) — running progress log
>
> **Revision note (2026-05-11):** Findings tables and the implementation plan have been updated to reflect Phase 0 measurement. Confirmed/demoted/promoted status is annotated against each finding. The biggest change is that **P1 (telemetry firehose) is now empirically confirmed as the primary in-race memory-leak source**, while **L4 (reference-lap accumulation) is empirically disconfirmed as the dominant in-race leak source** — although it remains a real correctness issue. A new finding **L6 (multi-class startup baseline cost)** has been added.
>
> **Revision note (2026-05-12):** A follow-up test (Practice 2 in [`PERFORMANCE_TEST_SUMMARY.md`](./PERFORMANCE_TEST_SUMMARY.md) §3.6) captured a real-multiplayer session with a known driver-join burst. Result: **A2/A3/L5/A7 are now empirically CONFIRMED as the primary leak source in busy online sessions**, with quantification at ~5–6 MB of permanent app memory per joining driver, concentrated in renderers hosting driver-list-aware widgets and _not released_ when drivers leave. A new finding **P7 (driver-join leak)** captures the user-facing symptom, and the SessionLifecycle / bridge-callback-cleanup work that addresses it has been pulled forward from Phase 2 into Phase 1.

This document captures findings from a multi-agent audit of the irDashies codebase, the recommended target architecture, and a phased implementation plan. It exists so that future contributors (human and LLM) share the same understanding of _why_ the architecture is moving in this direction.

---

## 1. Executive Summary

irDashies has a healthy foundation (Electron 35 secure defaults, contextBridge, native iRacing SDK addon, Zustand with custom equality, version-tagged stores) but is suffering from three compounding problems:

1. **A telemetry hot-path that fans the entire ~340-key telemetry object out to every overlay window 25 Hz** then triggers React render storms because a handful of hooks subscribe to raw, unrounded float arrays. _Phase 0 testing confirmed this is the primary in-race memory-leak source_ (steady +13 to +20 MB/min, driver-count-independent). See [`PERFORMANCE_TEST_SUMMARY.md`](./PERFORMANCE_TEST_SUMMARY.md) §3-4.
2. **Architectural debt around lifecycle, coupling, and god-files** — `Standings/` has become an unofficial domain library that 6+ other widgets reach into; the disconnect-reset code path is dead; the multi-profile system is bypassed by a hardcoded `'default'` profile; adding a widget edits 5+ god-files.
3. **Several latent stability and security issues** — synchronous `fs.writeFileSync` on the main process, no global error handlers, arbitrary Chromium switch injection through user settings, and unbounded native pointer dereferences in the SDK addon.

Two further phenomena emerged from Phase 0 testing that were not in the original audit:

4. **Multi-class race startup carries a one-time ~+1.5 GB memory cost** above single-class baseline (Renderer settings, NetworkService, and GPU processes all jump significantly at app start). This is configuration-dependent baseline allocation, not gradual accumulation; it is the most likely contributor to the "feels heavier on multi-class" symptom.
5. **Each driver who joins an active iRacing session costs ~5–6 MB of permanent app memory**, concentrated in renderers hosting driver-list-aware widgets (Standings, Relative, Blindspot, etc.), and _not released_ when drivers leave. In a busy online session with 50+ join events this adds ~250–300 MB on top of the steady-state leak and is the dominant factor in why "busy online sessions feel worse than AI sessions of the same field size, despite AI being CPU-heavier." This is the user-facing symptom of the lifecycle-and-cleanup architectural gap (A2/A3/L5/A7).

**The right fix is not "rewrite in C++."** The native layer is already C++ and is already fast. The right fix is to (a) introduce a derived-telemetry layer in the Electron main process, (b) replace the raw telemetry firehose with per-channel typed subscriptions, and (c) clean up the architectural debt that would otherwise be carried into the new design.

C++/native optimisations are deferred to a final phase and only undertaken if profiling proves a specific calculation is CPU-bound — Phase 0 measurement suggests it likely won't be.

---

## 2. Findings

### 2.1 Performance

> **Empirical status legend** (after Phase 0): **CONFIRMED** = directly evidenced by the test data; **PARTIALLY CONFIRMED** = some aspects supported; **DISCONFIRMED (as leak source)** = the hypothesis that this drives the in-race memory leak was tested and rejected, though the underlying issue may still be a real concern; **NOT INDEPENDENTLY TESTED** = subsumed under another finding's test or not exercised by the test matrix.

| #              | Finding                                                                                                                                                                                                                                                                                                                                                                                                                                                             | Where                                                                                                                                                                                                                                                                                                                                           | Impact                                                                                                                                                                                                                                                                        | Empirical status                                                           |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| **P1**         | Full ~340-key telemetry payload structured-cloned to every overlay 25 Hz                                                                                                                                                                                                                                                                                                                                                                                            | [iracingSdkBridge.ts:85](../src/app/bridge/iracingSdk/iracingSdkBridge.ts#L85), [overlayManager.ts:486](../src/app/overlayManager.ts#L486)                                                                                                                                                                                                      | **Primary in-race memory leak source.** Driver-count-independent constant-per-tick allocation; ~+13–20 MB/min steady; also highest CPU/IPC cost; multiplies linearly with open windows                                                                                        | **CONFIRMED** (PERFORMANCE_TEST_SUMMARY §3-4)                              |
| **P5**         | `memo(DriverInfoRow)` defeated by prop churn — `useDriverStandings` returns brand-new objects every tick                                                                                                                                                                                                                                                                                                                                                            | [DriverInfoRow.tsx:145](../src/frontend/components/Standings/components/DriverInfoRow/DriverInfoRow.tsx#L145), [Standings.tsx:154-247](../src/frontend/components/Standings/Standings.tsx#L154-L247)                                                                                                                                            | **Primary CPU/latency driver.** Multi-class processTelemetry p99 +69 % over single-class; Standings-bearing renderer shows largest CPU growth; ~750 cell-component renders per tick at full grid                                                                              | **CONFIRMED** (PERFORMANCE_TEST_SUMMARY §3-4)                              |
| P2             | `useDriverPositions` subscribes to raw `CarIdxLapDistPct` (exact equality on float array)                                                                                                                                                                                                                                                                                                                                                                           | [useDriverPositions.tsx:55](../src/frontend/components/Standings/hooks/useDriverPositions.tsx#L55)                                                                                                                                                                                                                                              | Re-runs full Standings + Relative pipeline every tick                                                                                                                                                                                                                         | Subsumed under P1; not independently tested                                |
| P3             | `ReferenceLapStoreUpdater` runs `collectLapData` for every driver every frame on raw input                                                                                                                                                                                                                                                                                                                                                                          | [ReferenceLapStoreUpdater.tsx:60-84](../src/frontend/context/ReferenceLapStore/ReferenceLapStoreUpdater.tsx#L60-L84)                                                                                                                                                                                                                            | **Per-tick CPU cost only** — not a memory-leak source. Scales p99 with driver count but the allocations are GC'd within the tick. Still worth fixing because it is the easiest win in Phase 1                                                                                 | **PARTIALLY CONFIRMED** — CPU yes, leak no (PERFORMANCE_TEST_SUMMARY §3.3) |
| P4             | `SectorTimingStore.tick()` subscribes to raw `LapDistPct`/`SessionTime`                                                                                                                                                                                                                                                                                                                                                                                             | [useSectorTiming.tsx:48-80](../src/frontend/components/TrackMap/hooks/useSectorTiming.tsx#L48-L80)                                                                                                                                                                                                                                              | Per-frame global wake-up                                                                                                                                                                                                                                                      | Subsumed under P1; not independently tested                                |
| P6             | Hidden / minimised overlays still receive every broadcast                                                                                                                                                                                                                                                                                                                                                                                                           | [overlayManager.ts:484-510](../src/app/overlayManager.ts#L484-L510)                                                                                                                                                                                                                                                                             | Wasted IPC + GPU work                                                                                                                                                                                                                                                         | NOT TESTED — all test windows were visible throughout                      |
| **P7** _(new)_ | **Driver-join leak.** Each driver who joins an active iRacing session causes ~5–6 MB of app memory to be allocated, concentrated in renderers hosting driver-list-aware widgets (Standings, Relative, Blindspot, FasterCarsFromBehind, SlowCarAhead, etc.). Memory is _not_ released when drivers leave. Underlying mechanism is A2 + A3 + L5 + A7 (no session lifecycle, no reset path, module-global callback `Set`s in bridges not cleared on driver disconnect) | Cross-cutting: [iracingSdkBridge.ts:27-29](../src/app/bridge/iracingSdk/iracingSdkBridge.ts#L27-L29), [dashboardBridge.ts:63-66](../src/app/bridge/dashboard/dashboardBridge.ts#L63-L66), the driver-list-aware widgets in [src/frontend/components/](../src/frontend/components/), plus the missing `sessionLifecycle` module under `src/app/` | **Dominant leak source in busy online sessions.** ~+260 MB across a 5-minute join burst with ~50 joiners. Compounds on top of P1's steady-state leak; pushes V8 to its major-GC threshold sooner and explains why busy online sessions feel worse than equally-sized AI grids | **CONFIRMED** (PERFORMANCE_TEST_SUMMARY §3.6)                              |

### 2.2 Architecture

| #      | Finding                                                                                                                        | Where                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     | Impact                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| ------ | ------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| A1     | `Standings/` is a hidden domain library; 6+ widgets cross-import from `Standings/hooks/` and `Standings/relativeGapHelpers.ts` | [FasterCarsFromBehind/hooks/useCarBehind.tsx:2-3](../src/frontend/components/FasterCarsFromBehind/hooks/useCarBehind.tsx#L2-L3), [RejoinIndicator/RejoinIndicator.tsx:15-18](../src/frontend/components/RejoinIndicator/RejoinIndicator.tsx#L15-L18), [TrackMap/TrackCanvas.tsx:19](../src/frontend/components/TrackMap/TrackCanvas.tsx#L19), [InformationBar/InformationBar.tsx:6-7](../src/frontend/components/InformationBar/InformationBar.tsx#L6-L7), [SectorDelta/hooks/useLiveSectorDelta.ts:9](../src/frontend/components/SectorDelta/hooks/useLiveSectorDelta.ts#L9), [Weather/Weather.tsx:6](../src/frontend/components/Weather/Weather.tsx#L6) | Refactoring `Standings` breaks five other widgets                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| **A2** | No `SessionLifecycle` abstraction — each store invents its own session-change detector                                         | [LapTimesStoreUpdater.tsx:22](../src/frontend/context/LapTimesStore/LapTimesStoreUpdater.tsx#L22), [SectorTimingStore.tsx:250](../src/frontend/context/SectorTimingStore/SectorTimingStore.tsx#L250), `PitLapStore`, `ReferenceLapStore`                                                                                                                                                                                                                                                                                                                                                                                                                  | **Now confirmed as a primary leak source.** Stores drift; resets miss; replays look like new laps; _and_ — per Practice 2 — there is no centralised handler for "driver joined / driver left" that bridges and stores can hook into, which is the mechanism driving P7                                                                                                                                                                                                                                                                                                                                                                                         | **CONFIRMED** implicated for driver-join leak (PERFORMANCE_TEST_SUMMARY §3.6); also strongly implicated for L6 startup cost |
| **A3** | `useResetOnDisconnect` has zero callers and omits 3 stores                                                                     | [useResetOnDisconnect.ts](../src/frontend/context/shared/useResetOnDisconnect.ts)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         | Dead code; reference laps and sector timing leak across sessions. **Now reclassified:** _not_ implicated as the in-race steady-state leak source (single-driver Test 1 leaks at +19.7 MB/min with no reference data), _but_ CONFIRMED implicated for the driver-join leak (P7) — the absence of a reset path matches the observed pattern exactly: state added on join, nothing to release it on leave. The team has shipped a one-time `migrateReferenceLaps()` cleanup ([referenceLaps.ts:15-37](../src/app/storage/referenceLaps.ts#L15-L37), 2026-05 release) which removes stale on-disk data once but does not address the missing in-session reset path | **CONFIRMED** implicated for driver-join leak; **DISCONFIRMED** as in-race steady-state leak source                         |
| A4     | God-files for widget registration drive the "8-step recipe"                                                                    | [WidgetIndex.tsx](../src/frontend/WidgetIndex.tsx), [SettingsLoader.tsx:52-91](../src/frontend/components/Settings/SettingsLoader.tsx#L52-L91), [SettingsMenu.tsx](../src/frontend/components/Settings/SettingsMenu.tsx), [widgetConfigs.ts](../src/types/widgetConfigs.ts) (692 lines), [defaultDashboard.ts](../src/types/defaultDashboard.ts) (1,272 lines)                                                                                                                                                                                                                                                                                            | Every new widget is a merge-conflict event                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| A5     | Profile system bypassed — `getDashboard('default')` hardcoded                                                                  | [overlayManager.ts:670, 728, 735](../src/app/overlayManager.ts#L670)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      | Hardware accel, autostart, tray settings ignore the active profile                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| A6     | No real settings migration — `deepMergeConfig` only fills gaps                                                                 | [defaultDashboard.ts:1203](../src/types/defaultDashboard.ts#L1203)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        | Renaming or retyping a setting silently corrupts user dashboards                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| **A7** | 8 ad-hoc bridges with module-global callback `Set`s                                                                            | [rendererExposeBridge.ts](../src/app/bridge/rendererExposeBridge.ts), [iracingSdkBridge.ts:27-29](../src/app/bridge/iracingSdk/iracingSdkBridge.ts#L27-L29), [dashboardBridge.ts:63-66](../src/app/bridge/dashboard/dashboardBridge.ts#L63-L66)                                                                                                                                                                                                                                                                                                                                                                                                           | Hand-wired pattern, no factory; **closed renderers and disconnected drivers both leave callbacks behind** — per Practice 2 this is the per-driver cost driving P7. Per-window subscription map provided by `defineBridge` (Phase 1 work) replaces the module-globals and gives a hook for cleanup on driver disconnect                                                                                                                                                                                                                                                                                                                                         | **CONFIRMED** implicated for driver-join leak (PERFORMANCE_TEST_SUMMARY §3.6)                                               |
| A8     | `frontend → app` import leaks                                                                                                  | [Standings.stories.tsx:22](../src/frontend/components/Standings/Standings.stories.tsx#L22), [Relative.stories.tsx:17](../src/frontend/components/Standings/Relative.stories.tsx#L17), [src/types/telemetry.ts:1](../src/types/telemetry.ts#L1)                                                                                                                                                                                                                                                                                                                                                                                                            | Layering rule violated; `_GENERATED_telemetry.ts` ownership unclear                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| A9     | `_GENERATED_telemetry.ts` regen is manual and not enforced                                                                     | [generate-var-types.js](../src/app/irsdk/native/scripts/generate-var-types.js) (not in any `package.json` script)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         | Native upgrade silently desyncs the type system                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |

### 2.3 Lifecycle, Resilience, I/O

| #              | Finding                                                                                                                                                             | Where                                                                                                                                                                                                                                        | Impact                                                                                                                                                                                                                                                                                                                                                                        | Empirical status                                                                                                   |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| **L2**         | YAML re-parsed on every `getSessionData` call (regex fixes run before each `yaml.load`)                                                                             | [irsdk-node.ts:229](../src/app/irsdk/node/irsdk-node.ts#L229)                                                                                                                                                                                | **Promoted: also a startup _memory_ concern, not just CPU.** Most plausible contributor to multi-class +1.5 GB startup baseline (L6). Memoising on `currDataVersion` would address both                                                                                                                                                                                       | **STRONGLY IMPLICATED** for startup cost                                                                           |
| **L6** _(new)_ | Multi-class race startup allocates ~+1.5 GB above single-class baseline at app start (Renderer settings 184 → 335 MB, NetworkService 53 → 231 MB, GPU 156 → 410 MB) | Configuration-dependent; manifests at `app.on('ready')` time before any race starts                                                                                                                                                          | One-time hit at session start, not gradual; pushes V8 closer to its major-GC threshold so subsequent in-race growth triggers GC pauses sooner                                                                                                                                                                                                                                 | **CONFIRMED** (PERFORMANCE_TEST_SUMMARY §3.4) — likely driven by L2; also possibly S5 for NetworkService component |
| L1             | Synchronous `fs.writeFileSync` on the main process for every dashboard / reference-lap / pit-lane / fuel save                                                       | [storage.ts:12](../src/app/storage/storage.ts#L12), [referenceLaps.ts:91](../src/app/storage/referenceLaps.ts#L91), [pitLaneData.ts:34](../src/app/storage/pitLaneData.ts#L34), [fuelDatabase.ts:36](../src/app/storage/fuelDatabase.ts#L36) | Event-loop stalls on save; reference-lap data is unbounded                                                                                                                                                                                                                                                                                                                    | **WEAKLY IMPLICATED** in tick-dip events; isolated test needed (PERFORMANCE_TEST_SUMMARY §6.6)                     |
| L3             | No `process.on('uncaughtException')` / `'unhandledRejection')` handler                                                                                              | [main.ts](../src/main.ts)                                                                                                                                                                                                                    | Silent main-process crashes                                                                                                                                                                                                                                                                                                                                                   | Not tested by Phase 0; remains a hygiene gap                                                                       |
| L4             | Reference-lap data has no size cap                                                                                                                                  | [referenceLaps.ts:24-29](../src/app/storage/referenceLaps.ts#L24-L29)                                                                                                                                                                        | Disk + parse cost grows over months — but **not implicated in measured in-race leak** (single-driver Test 1 leaks identically). Same demotion rationale as A3                                                                                                                                                                                                                 | **DISCONFIRMED** as in-race leak source; remains a real disk/IO concern                                            |
| **L5**         | Module-global callback `Set`s in bridges aren't cleared on window close _or on driver disconnect_                                                                   | [iracingSdkBridge.ts:27-29](../src/app/bridge/iracingSdk/iracingSdkBridge.ts#L27-L29), [dashboardBridge.ts:63-66](../src/app/bridge/dashboard/dashboardBridge.ts#L63-L66)                                                                    | **Now confirmed as a primary leak source in busy sessions.** Per-driver allocation pattern observed in Practice 2 with selectivity that exactly matches subscription-based callback accumulation: Primary + Left (driver-list-aware widgets) absorbed ~+260 MB across a 5-min join burst; Right (no driver-list-aware widgets) was flat. Pair with A7 — both are the same fix | **CONFIRMED** implicated for driver-join leak (PERFORMANCE_TEST_SUMMARY §3.6)                                      |

### 2.4 Security

| #   | Severity | Finding                                                                                                                                      | Where                                                                                                                                      |
| --- | -------- | -------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| S1  | **HIGH** | Renderer can persist arbitrary Chromium switches → next launch executes them (e.g. `--remote-debugging-port=9222`, `--disable-web-security`) | [chromiumFlags.ts:36-37](../src/app/storage/chromiumFlags.ts#L36-L37), [overlayManager.ts:708-722](../src/app/overlayManager.ts#L708-L722) |
| S2  | MEDIUM   | Native addon dereferences NULL on out-of-range index / pre-init `_data`                                                                      | [irsdk_node.cc:502-521](../src/app/irsdk/native/irsdk_node.cc#L502-L521), `:444`, `:178-242`                                               |
| S3  | MEDIUM   | `logBridge` invokes `logger[level](...)` with renderer-supplied `level` — should validate against `['debug','info','warn','error']`          | [logBridge.ts:6-8](../src/app/bridge/logBridge.ts#L6-L8)                                                                                   |
| S4  | MEDIUM   | No CSP, no `setWindowOpenHandler`, no `will-navigate` deny — defense-in-depth gap                                                            | [overlayManager.ts:148, 814](../src/app/overlayManager.ts#L148), [index.html](../index.html)                                               |
| S5  | LOW      | Analytics forwards every `warn`/`error` log line (including userData paths with Windows username) to PostHog                                 | [analytics.ts:99-120](../src/app/analytics.ts#L99-L120)                                                                                    |

What's already good (do not regress): contextIsolation on, nodeIntegration off, sandbox on, asar fuses enabled, `update-electron-app` over HTTPS, contextBridge used everywhere — no `ipcRenderer` / `require` leaked to the renderer.

---

## 3. Recommended Architecture

### 3.1 Target topology

```
iRacing process (shared memory @ 60 Hz)
        │
        ▼
┌─────────────────────────────────────────────────────────────┐
│  C++ N-API addon (irsdk_node)                               │
│  - Wait + memcpy + transcode only (unchanged)               │
└─────────────────────────────────────────────────────────────┘
        │
        ▼
┌─────────────────────────────────────────────────────────────┐
│  Worker thread: SDK loop                                    │
│  - Owns the blocking waitForData loop                       │
│  - postMessage / SharedArrayBuffer back to main             │
└─────────────────────────────────────────────────────────────┘
        │
        ▼
┌─────────────────────────────────────────────────────────────┐
│  Main process: Telemetry Hub                                │
│                                                             │
│   ┌──────────────────┐    ┌────────────────────────┐        │
│   │  Raw frame cache │───▶│  Session Lifecycle bus │        │
│   └──────────────────┘    └────────────────────────┘        │
│            │                        │                       │
│            ▼                        ▼                       │
│   ┌─────────────────────────────────────────────┐           │
│   │  Telemetry Processors (own tick rate)       │           │
│   │  - StandingsProcessor       (5 Hz)          │           │
│   │  - RelativeGapProcessor     (5 Hz)          │           │
│   │  - ReferenceLapProcessor    (event-driven)  │           │
│   │  - SectorTimingProcessor    (event-driven)  │           │
│   │  - FuelProjectionProcessor  (1 Hz)          │           │
│   │  - InputLiveProcessor       (60 Hz)         │           │
│   │  - TrackPositionsProcessor  (25 Hz)         │           │
│   └─────────────────────────────────────────────┘           │
│            │                                                │
│            ▼                                                │
│   ┌─────────────────────────────────────────────┐           │
│   │  Channel Bus (per-window subscription)      │           │
│   │  - 'standings.snapshot'  → typed payload    │           │
│   │  - 'fuel.projection'     → typed payload    │           │
│   │  - 'trackmap.positions'  → typed payload    │           │
│   │  - ... one channel per processor output     │           │
│   └─────────────────────────────────────────────┘           │
└─────────────────────────────────────────────────────────────┘
        │ (slim, typed IPC; no full-telemetry firehose)
        ▼
┌─────────────────────────────────────────────────────────────┐
│  Renderer windows                                           │
│  - Each window declares the channels it needs               │
│  - Widgets are near-stateless views over channel snapshots  │
│  - Visibility-aware: hidden windows pause subscriptions     │
└─────────────────────────────────────────────────────────────┘
```

### 3.2 Layering

| Layer                               | Owns                                                                         | May import from                                                                   | Must not import from       |
| ----------------------------------- | ---------------------------------------------------------------------------- | --------------------------------------------------------------------------------- | -------------------------- |
| `src/app/irsdk/native/`             | C++ addon                                                                    | —                                                                                 | anything in `src/`         |
| `src/app/irsdk/`                    | SDK wrapper, type generation                                                 | `irsdk/native`                                                                    | bridge, frontend           |
| `src/app/sessionLifecycle/` _(new)_ | Session lifecycle event bus                                                  | `irsdk`                                                                           | bridge, frontend           |
| `src/app/processors/` _(new)_       | Telemetry processors (derived data)                                          | `irsdk`, `sessionLifecycle`                                                       | bridge, frontend           |
| `src/app/bridge/`                   | Channel bus, per-window subscriptions, IPC handlers                          | `processors`, `storage`, `sessionLifecycle`                                       | frontend                   |
| `src/app/storage/`                  | Persistence (async only)                                                     | `sessionLifecycle`                                                                | bridge, frontend           |
| `src/types/`                        | Shared type contracts (snapshot shapes, settings shapes)                     | —                                                                                 | anything else              |
| `src/frontend/domain/` _(new)_      | Channel hooks, derived selectors that multiple widgets share                 | `@irdashies/types`, bridge type defs                                              | `src/app/*`                |
| `src/frontend/context/`             | Channel-snapshot stores (1 store per channel, plus `TelemetryStore` for raw) | `@irdashies/types`                                                                | `src/app/*`                |
| `src/frontend/components/<Widget>/` | One widget; pure consumer                                                    | `@irdashies/context`, `@irdashies/domain`, `@irdashies/utils`, `@irdashies/types` | other widgets, `src/app/*` |

**The "no cross-widget imports" rule is the structural invariant.** If two widgets need the same logic, it lives in `frontend/domain/` (or as a new processor + channel).

### 3.3 Principles

1. **Derived telemetry is a first-class layer**, owned by the main process. Renderers do not re-derive what processors already compute.
2. **Per-channel subscriptions, not a firehose.** Each renderer declares the channels it needs. Closed/hidden windows pause.
3. **Tick-rate budget per channel.** 60 Hz only where the eye demands it (input bars). 5 Hz for sortable/intervalled UI. Event-driven for crossings/laps.
4. **Typed bridge contracts.** Each channel has an explicit `interface SnapshotShape` in `src/types/`. The IPC payload is the snapshot, nothing more.
5. **Single session lifecycle event source.** Stores subscribe to `enter` / `exit` / `sessionNumChange` / `disconnect`; they do not invent their own detection.
6. **Self-registering widgets.** A `WidgetDefinition` object carries `{ id, component, settingsComponent, defaultConfig, displayName, alwaysEnabled }`. No god-files.
7. **Versioned settings + migrator registry.** Every widget settings shape carries a `version`; breaking changes ship a migrator.
8. **Async I/O only on the main process.** No `fs.*Sync` anywhere outside startup. Writes are debounced.
9. **Validate at the IPC boundary.** Every `ipcMain.handle` validates input. Renderer-supplied strings never become method names, file paths, or process flags without an allowlist.
10. **Profiling is on by default.** `perfMetrics` always runs; results are visible in a debug overlay.
11. **Tests cover processors.** Pure processor classes are unit-tested with recorded frame sequences. Logic is not buried in React hooks.

---

## 4. Implementation Plan

Each phase is independently shippable. Phases 0 and 0.5 are prerequisites; phases 2 and onward are the architectural move and can be delivered widget-by-widget.

### Phase 0 — Measure ✅ DONE (May 2026)

- ✅ Enabled `PERF_METRICS=1` and captured `processTelemetry` vs `broadcast` p99 across 6 controlled sessions (Test Drive, AI single-class, AI multi-class, two real-multiplayer practices, PCC).
- ✅ React DevTools Profiler traces taken; Standings-bearing renderer identified as the dominant CPU consumer.
- ✅ Per-renderer memory growth measured; in-race steady-state leak rate quantified at +13–20 MB/min (driver-count-independent).
- ✅ Multi-class startup baseline allocation quantified at ~+1.5 GB above single-class.
- ✅ Driver-join leak quantified at ~5–6 MB per joining driver (Practice 2, known burst); confirmed concentrated in driver-list-aware renderers; not released on driver leave.
- ✅ Findings published in [`PERFORMANCE_TEST_SUMMARY.md`](./PERFORMANCE_TEST_SUMMARY.md).
- ✅ Empirical baseline + targets table committed below (used as Phase 1 exit criteria).

**Baseline numbers:**

| Metric                                                          |                          Phase 0 baseline |                       Phase 1 target | Source                            |
| --------------------------------------------------------------- | ----------------------------------------: | -----------------------------------: | --------------------------------- |
| In-race steady-state app memory slope (40-car AI single-class)  |                              +16.5 MB/min |                          < +5 MB/min | PERFORMANCE_TEST_SUMMARY §3.3     |
| `processTelemetry` p99 mean (40-car AI single-class)            |                                    7.4 ms |                               < 3 ms | PERFORMANCE_TEST_SUMMARY §3.3     |
| Tick-rate stability (% samples ≥ 20 Hz)                         | ~99 % (single-class), ~91 % (multi-class) |                             ≥ 99.5 % | PERFORMANCE_TEST_SUMMARY §3.3–3.4 |
| Multi-class startup memory (app cold start, fresh instance)     |                                  2,908 MB | < 1,800 MB (≤25 % over single-class) | PERFORMANCE_TEST_SUMMARY §3.4     |
| **Per-joining-driver permanent memory cost (real multiplayer)** |                               **~5–6 MB** |                           **< 1 MB** | PERFORMANCE_TEST_SUMMARY §3.6     |
| Renderer wake-ups per second at full grid                       |                      TBD (React Profiler) |                     ≥ 50 % reduction | Phase 1 sub-task                  |

**Outstanding Phase 0 investigations** (see PERFORMANCE_TEST_SUMMARY §6 for the full list — these do not block Phase 0.5 but inform Phase 1 prioritisation):

- Empty-dashboard baseline (HIGH) — gates Phase 1 success criteria
- Single-widget isolation tests (HIGH) — identifies heaviest widget
- ~~Early-session step-change cause~~ — **RESOLVED by Practice 2** (PERFORMANCE_TEST_SUMMARY §6.7); driver joins are the cause; produced new finding P7
- Reference-lap A/B (LOW, downgraded) — does an existing reference lap raise the steady-state slope on top of P1?
- PCC dashboard config delta (MEDIUM)
- NetworkService allocation cause (MEDIUM)
- Sync-I/O tick-dip correlation (LOW)
- Cumulative driver-join cost in long sessions (MEDIUM, new) — does the per-joiner cost plateau (state keyed by car ID) or grow unboundedly?

### Phase 0.5 — Stop the bleeding (3-5 days)

Independent fixes that should not be carried forward into the new architecture. **L2 is now the highest-priority item in this phase** because Phase 0 testing confirmed it as a startup _memory_ concern (likely contributor to L6) in addition to its original CPU framing.

- **L2** (now elevated): Memoize YAML parse on `currDataVersion` ([irsdk-node.ts:229](../src/app/irsdk/node/irsdk-node.ts#L229)) — skip both regex fix-ups and `yaml.load` when version is unchanged. Addresses both startup memory (L6) and steady-state main-thread cost.
- **S1:** Allowlist `chromiumFlags` switches.
- **S2:** Null-guard the native addon (`GetTelemetryVarByIndex`, `GetTelemetryData`, `BroadcastMessage`).
- **S3:** Validate `logBridge` level argument.
- **S4:** Add `setWindowOpenHandler({action:'deny'})`, `will-navigate` deny, and a CSP via `session.webRequest.onHeadersReceived`.
- **L1:** Convert sync `fs.writeFileSync` to `fs.promises.writeFile` + 250 ms debounce. _Note:_ the one-time `migrateReferenceLaps()` at startup ([referenceLaps.ts:15-37](../src/app/storage/referenceLaps.ts#L15-L37)) may remain synchronous — R6.1 permits sync I/O during startup.
- **L3:** Add `process.on('uncaughtException')` / `'unhandledRejection')` handlers.
- **P6:** Pause broadcasts to non-visible windows (`webContents.isVisible()`).

**Exit criteria:** all HIGH/MEDIUM security findings closed; no sync I/O on the main thread outside startup; global error handlers registered; YAML parse memoised. Re-run the Phase 0 multi-class test and capture deltas in `PERFORMANCE_TEST_SUMMARY.md`.

### Phase 1 — Cheap perf wins + lifecycle bones (5–10 days)

Originally a 2–3 day "rounding hooks + memo equality" sweep. The 2026-05-12 Practice 2 test showed the **A2/A3/L5/A7 cluster is a primary leak source in busy online sessions** (P7, ~5–6 MB per joining driver, ~+260 MB across a 5-min join burst), so the SessionLifecycle skeleton and the per-window/per-driver bridge cleanup are pulled forward from Phase 2 into Phase 1. The full A2/A3 architectural rewrite (renaming, dead-code removal, migration of every store's reset path) stays in Phase 2.

**Perf wins** (original scope):

- **P2/P3/P4:** Switch raw float subscriptions to `useTelemetryValuesRounded` per the precision table in [`ARCHITECTURE_RULES.md`](./ARCHITECTURE_RULES.md#telemetry-precision).
- **P5:** Add a custom `propsAreEqual` to `memo(DriverInfoRow)` (or pre-compute primitive props in the parent).
- **P1 (interim):** Trim the IPC payload — drop string-typed and unused vars at the bridge before broadcast.

**Lifecycle bones** (pulled forward to address P7):

- **A2 (skeleton):** Introduce `src/app/sessionLifecycle/` as a single event source with at minimum `onDriverJoined(carIdx)`, `onDriverLeft(carIdx)`, `onSessionNumChange()`, `onDisconnect()`. Wired up to the existing session-data + telemetry stream in `iracingSdkBridge`. No store migrations yet — that is Phase 2.
- **L5 + A7:** Replace module-global callback `Set`s in `iracingSdkBridge` and `dashboardBridge` with per-window subscription maps. Add `onDriverLeft` → drop per-driver entries hook to whichever store(s) hold per-driver state and have a visible leak (Standings, Relative, Blindspot, FasterCarsFromBehind, SlowCarAhead — guided by the renderer-selectivity data in Practice 2). Other stores can wait for Phase 2.
- **A3 (start):** Wire `useResetOnDisconnect` to the new event source for the stores it already covers. Remove the dead-code label from it. Full reset-handler audit is Phase 2.

**Exit criteria:**

- ≥50 % reduction in renderer wake-ups per second at full grid
- In-race steady-state app memory slope < +5 MB/min (single-class AI 40-car) — _was: ≥50 % reduction_
- Per-joining-driver permanent memory cost < 1 MB (real multiplayer, Practice 2 replay)
- No widget regressions; Storybook stories still render
- Re-run Phase 0 test matrix and append the deltas to `PERFORMANCE_TEST_SUMMARY.md`

### Phase 2 — Architectural cleanup (1-2 weeks)

Must precede the channel-bus refactor. **Note:** the highest-impact pieces of A2/A3/L5/A7 have been pulled into Phase 1 to fix the driver-join leak. Phase 2 completes the cleanup.

- **A1:** Extract `frontend/domain/` from `Standings/`. Move `useDriverStandings`, `useDriverPositions`, `useDriverRelatives`, `useDriverLivePositions`, `useTrackTemperature`, `relativeGapHelpers`, `interpolation`, and the shared `Standings` type. Cross-widget imports from `Standings/` become a lint error.
- **A2/A3 (completion):** Migrate every remaining store to register reset handlers with `sessionLifecycle` (Phase 1 delivered the event source and wired the leaking stores; this completes the migration to _every_ store). Delete `useResetOnDisconnect` once nothing imports the dead version. Add `onEnter`/`onExit` events alongside the join/leave/disconnect ones; distinguish live vs replay.
- **A4:** Replace `WIDGET_MAP` + `SettingsLoader` switch + per-widget `defaultDashboard.ts` entries with a self-registering `WidgetDefinition`.
- **A5:** Remove hardcoded `'default'` profile from `overlayManager.ts`.
- **A6:** Add `version: number` per widget settings shape; introduce `src/types/migrators/<widget>.ts` registry. Run on load.
- **A7 (completion):** Roll Phase 1's per-window subscription pattern out to the remaining bridges via a `defineBridge<I>(channel, impl)` helper. The two bridges that drive P7 are already done in Phase 1; this is the rest.
- **A9:** Add a `npm run check:generated-types` script and a CI step that fails if `_GENERATED_telemetry.ts` would change.

**Exit criteria:** AGENTS.md "8-step recipe" is reduced to 2 steps. Lint forbids `frontend/components/<X>/` from importing `frontend/components/<Y>/`. CI guards regen. Every Zustand store registers a reset handler with `sessionLifecycle` (R3.1 enforced).

### Phase 3 — Channel-based bridge (1-2 weeks)

- Introduce `publishChannel('<channel>', snapshot)` on the bridge side and `useChannelSnapshot('<channel>')` on the renderer side.
- Each window's preload sends a `subscribe(channels[])` request; main process only computes/sends what's subscribed.
- Migrate one widget at a time, starting with **Fuel** (small, self-contained, big payload reduction). Keep the legacy `'telemetry'` channel running until everything's migrated.

**Exit criteria:** Fuel widget runs entirely off `'fuel.projection'`; legacy `'telemetry'` channel still works for unmigrated widgets.

### Phase 4 — Processors in main process (2-4 weeks)

Port the heavy stores to main-process `TelemetryProcessor` classes (one per phase increment to keep PRs reviewable):

1. `LapTimesProcessor`
2. `CarSpeedsProcessor`
3. `RelativeGapProcessor`
4. `ReferenceLapProcessor`
5. `SectorTimingProcessor`
6. `FuelProjectionProcessor`
7. `StandingsProcessor`

Each processor:

- Subscribes to the raw frame and `sessionLifecycle`
- Owns its tick rate
- Emits a typed snapshot on a named channel
- Has unit tests using recorded frame sequences

Renderers shrink to subscriptions + presentation.

**Exit criteria:** the legacy `'telemetry'` IPC channel can be deleted (or restricted to a dev-only debug subscriber).

### Phase 5 — Worker-thread SDK loop (3-5 days)

Move the blocking `waitForData` loop into a `worker_threads` Worker. Instantiate the native SDK _inside_ the worker (the binding holds raw-pointer state and is not thread-safe).

**Exit criteria:** main-process event loop is not blocked during normal SDK operation.

### Phase 6 — Native optimisations (only if profiling demands)

After Phase 4, re-measure. Realistic candidates _if needed_:

- Binary IPC for the highest-rate channels via SharedArrayBuffer.
- A native circular buffer for reference-lap point collection.

**Do not start Phase 6 without a profile that proves a specific calculation is the bottleneck.** Sorting ~30-64 entries and Hermite interpolation are not it.

### Supporting work — `tools/perfBench/` (cross-cutting)

Phase 0 was measured by hand (run iRacing, capture PerfMetrics CSVs, regress in Excel). That is not sustainable as a per-PR regression gate. Build a headless harness so every PR that touches a hot path produces a number:

- **Trace replay:** record one telemetry stream per scenario (single-driver Test Drive, AI 40-car single-class, AI 40-car multi-class, real-multiplayer-with-join-burst). Feed each through irDashies headlessly via the existing mock-data infrastructure ([src/app/bridge/iracingSdk/mock-data/mockSdkBridge.ts](../src/app/bridge/iracingSdk/mock-data/mockSdkBridge.ts)).
- **Memory-slope assertion:** linear-regress the renderer heap over a 5-min window and fail the bench if slope exceeds the per-scenario threshold defined in Phase 0's baseline table.
- **Synthetic driver-join test:** fire N simulated driver-join events into the bridge and assert on the heap delta. This is the regression gate for L5/A7/P7 — anything that re-introduces a per-driver leak shows up here.
- **PerfMetrics CSVs from Phase 0 are the seed corpus.** They are listed in [`PERFORMANCE_TEST_SUMMARY.md`](./PERFORMANCE_TEST_SUMMARY.md) §8.

This work should land alongside Phase 1 so Phase 1's exit numbers are measured by the harness, not by hand. It is tracked in [`IMPLEMENTATION_PLAN.md`](./IMPLEMENTATION_PLAN.md) §3.

---

## 5. Open decisions

These need a maintainer call before the relevant phase begins:

1. **Domain folder name.** `frontend/domain/` vs `frontend/derived/` vs `frontend/shared/`. Pick one. _Blocks Phase 2 (A1)._
2. **Channel subscription model.** Push-based (main process tracks subscribers and sends only to them) vs pull-based (renderer requests snapshots on demand for low-rate channels). Recommended: push for everything, including a small `'session.snapshot'` for first paint. _Blocks Phase 3._
3. **Settings migrator location.** Per-widget folder vs central registry in `src/types/migrators/`. Recommended: central registry to keep migrators discoverable. _Blocks Phase 2 (A6)._
4. **Backwards compatibility window.** How long do we keep the legacy `'telemetry'` channel running alongside the channel bus? Recommended: until all in-tree widgets have migrated, then remove in a single PR. _Blocks Phase 4._
5. **Long-term native direction.** Stay all-TypeScript above the native shim, or pursue Rust + napi-rs as a learning path? Recommended: stay all-TypeScript until Phase 6 proves a specific need. _Blocks Phase 6._
6. **SessionLifecycle event source location.** Where does the canonical session-state-machine live: in `iracingSdkBridge` (where session-data already arrives), in a sibling `src/app/sessionLifecycle/` module, or in the existing `SessionStore` (renderer-side)? Recommended: `src/app/sessionLifecycle/` in the main process — that lets bridges and stores both subscribe and is the only sensible home for the per-driver cleanup hooks that Phase 1 needs. _Blocks Phase 1 lifecycle bones._
7. **Driver-state ownership pattern.** When `onDriverLeft(carIdx)` fires, do consumers (a) drop their per-driver entries immediately, (b) mark them stale and reap on a timer, or (c) keep them and let the next `onSessionNumChange` clear everything? Recommended: (a) for stores that allocate per driver (Standings, Relative, Blindspot, etc.); (c) for stores that don't. Affects whether re-joining drivers see their state reset. _Blocks Phase 1 lifecycle bones._

---

## 6. What this review did _not_ cover

Honest list of remaining blind spots. Pick these up as separate work:

- **Test coverage gap.** No audit of which logic paths have tests vs not. Phase 4 will be much riskier without a baseline.
- **Storybook leakage into prod bundle.** Not verified that no `.stories` files end up in the production bundle.
- **Bundle size & tree-shaking.** Vite config looks fine but actual bundle was not measured.
- **`src/app/webserver/`** (`componentServer.ts`, `bridgeProxy.ts`). Surfaced briefly as a `frontend → app` import leak; functionality and attack surface not audited.
- **Analytics PII.** [analytics.ts:99-120](../src/app/analytics.ts#L99-L120) forwards every `warn`/`error` log line including image-storage paths containing the Windows username — needs a closer look.
- **Cumulative driver-join cost over a full endurance session.** Practice 2 measured a 5-minute join burst (~50 joiners → ~+260 MB). What happens over a 2-hour open practice where hundreds of drivers cycle through? If per-driver state is keyed by something stable (car ID) it may plateau; if by something ephemeral (session-relative index) it grows unboundedly. PERFORMANCE_TEST_SUMMARY §6.8 covers the test. Until measured, treat Phase 1's per-joiner cost target (`< 1 MB`) as a necessary but not sufficient condition.
- **Driver-rejoin behaviour.** When a driver leaves and rejoins, is their previous per-driver state restored, replaced, or both retained? The choice affects both correctness (laptime history, sector colours) and the L5/A7 fix design. Not exercised by Phase 0; relevant to Phase 1.
- **Per-renderer crash recovery.** Practice 2 did not exercise renderer-process crashes. Recovery logic exists in [overlayManager.ts:203-222](../src/app/overlayManager.ts#L203-L222) but is unverified in the leaked-callback scenario — does a crashed renderer's bridge subscriptions get cleaned up before the new renderer registers fresh ones?
