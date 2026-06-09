# irDashies Architecture Implementation Plan — Running Log

> **Purpose:** Single source of truth for _what has been done_, _what is being done now_, and _what remains_, as we work through the phased plan from [`ARCHITECTURE_REVIEW.md`](./ARCHITECTURE_REVIEW.md) under the rules in [`ARCHITECTURE_RULES.md`](./ARCHITECTURE_RULES.md).
>
> **Audience:** Maintainers and LLM coding agents. Each contributor should append to the **Activity log** at the bottom whenever they touch this work, so the next contributor can pick up cold.
>
> **Companion files:**
>
> - [`ARCHITECTURE_REVIEW.md`](./ARCHITECTURE_REVIEW.md) — findings + target architecture + phased plan
> - [`ARCHITECTURE_RULES.md`](./ARCHITECTURE_RULES.md) — enforceable rules
> - [`PERFORMANCE_TEST_SUMMARY.md`](./PERFORMANCE_TEST_SUMMARY.md) — empirical evidence underpinning Phase 0

---

## 1. Current status at a glance

| Phase                                                 | Status                   | Branch / PR                              | Notes                                                                                                                                                                                                                                                                                                                                                                     |
| ----------------------------------------------------- | ------------------------ | ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Phase 0 — Measure**                                 | DONE                     | —                                        | Baseline captured in `PERFORMANCE_TEST_SUMMARY.md`; revised 2026-05-12 after Practice 2                                                                                                                                                                                                                                                                                   |
| **Phase 0.5 — Stop the bleeding**                     | LANDED (partial)         | merged on `main`                         | S1/S2 landed; S3/S4/L1/L2/L3/P6 still open                                                                                                                                                                                                                                                                                                                                |
| **Phase 1 — Cheap perf wins + lifecycle bones**       | LANDED                   | merged on `main`                         | P1/P2/P4 typed subs, P5 propsAreEqual, IPC allowlist, SessionLifecycle skeleton, useResetOnDisconnect activated. Practice 3: Primary slope −85%; Standings became the sole remaining leak source                                                                                                                                                                          |
| **Phase 2a Tier 1 — PitLapStore + LapTimes hygiene**  | LANDED                   | `feat/phase-2a-tier1-allocations`        | H3 + H4. Practice 5: Left renderer slope dropped from +13.0 → +0.7 MB/min (95% reduction, under target). PCC race confirms +5.7 MB/min app slope during 20-min race phase (under <+5 target).                                                                                                                                                                             |
| **Phase 2a H1 — createStandings rewrite**             | LANDED                   | `feat/phase-2a-h1-standings-rewrite`     | O(N²) → O(N) `find()` removal; `groupStandingsByClass` Map-based; `useReferenceLapStore.getState()` hoisted out of inner loop. 2026-05-16 Clio Cup VIR test: no regression vs Tier 1, Standings CPU 2.3% vs 3.1% baseline. Memory benefit not isolable.                                                                                                                   |
| **Phase 2a Tier 2a — Disconnect leave cleanup**       | LANDED                   | `feat/phase-2a-tier2-disconnect-cleanup` | `sessionLifecycle._onDisconnect` emits synthetic per-driver leaves; `useDriverLivePositions` clears driver-keyed refs on `running` true→false. **GR86 Miami 2026-05-18 validated**: 196 `Driver left (disconnect)` lines symmetric with 196 joins, 4 `Released N per-driver slots` summaries match 4 disconnect events.                                                   |
| **Phase 2a Tier 2b — Reference-lap dedup**            | LANDED                   | `feat/phase-2a-tier2-reflap-dedup`       | Main-process in-memory cache + debounced async write. Collapses 3× per-renderer save bursts into one async write. **Note**: PCC, SFL, combined PR, and Miami tests all still show 3× clusters in renderer-side log lines — filesystem-level write count verification still needed to confirm debounce is engaging at the FS layer.                                        |
| **Phase 2a integration PR**                           | READY TO MERGE           | `feat/phase-2a-integration`              | Cherry-picks of Tier 1 + H1 + Tier 2a + Tier 2b + post-test docs + 2026-05-17 follow-ups (disconnect log line, empty-Drivers guard, bridge stale-state nulling) + 2026-05-19 R1+R2 (reference-lap fetch dedup, post-debounce write log). Combined PR test 2026-05-17 owner-confirmed good; spectated PCC 2026-05-18 confirms architectural state. **809/809 tests pass.** |
| **Phase 2a mid-session leave detection** (2026-05-18) | DECLINED & REVERTED      | —                                        | Identity-key approach was implemented and tested 2026-05-18, then declined the same day after cost/benefit review (see [`PERFORMANCE_TEST_LOG.md`](./PERFORMANCE_TEST_LOG.md) §4 "Declined for fix"). Working-tree changes reverted 2026-05-19 before any commit landed on the integration branch. Preserved here for institutional memory; no further action.            |
| **Phase 2a remaining items**                          | R1+R2 LANDED, R3 PENDING | `feat/phase-2a-integration` for R1+R2    | R1 (reference-lap fetch dedup) + R2 (post-debounce write log) landed 2026-05-19. R3 (Empty Dashboard substrate baseline test) is a test run, not code work — pending.                                                                                                                                                                                                     |
| **Phase 2b — Architectural cleanup (remaining)**      | NOT STARTED              | —                                        | A1, A4, A5, A6, A7 completion, A9. Lower urgency now Standings memory issue is resolved                                                                                                                                                                                                                                                                                   |
| **Phase 3 — Channel-based bridge**                    | NOT STARTED              | —                                        | Would close remaining processTelemetry p99 gap to <3 ms. Also the layer where per-widget rate throttling lives and where renderer subscribers can wire to sessionLifecycle leave events.                                                                                                                                                                                  |
| **Phase 4 — Main-process processors**                 | NOT STARTED              | —                                        | Depends on Phase 3                                                                                                                                                                                                                                                                                                                                                        |
| **Phase 5 — Worker-thread SDK loop**                  | NOT STARTED              | —                                        |                                                                                                                                                                                                                                                                                                                                                                           |
| **Phase 6 — Native optimisations**                    | DEFERRED                 | —                                        | Only if Phase 4 profiling demands                                                                                                                                                                                                                                                                                                                                         |

---

## 2. Phase-by-phase work breakdown

Tick boxes are filled as the corresponding PR merges. **An item is only checked when the change is on `main`.**

### Phase 0 — Measure

- [x] App-level CPU/memory baseline captured (PerfMetrics, 10s sampling)
- [x] `processTelemetry` / `broadcast` p99 captured at single-class and multi-class AI grids
- [x] Per-renderer memory growth captured across 6 sessions (Test Drive, AI single-class, AI multi-class, two real-multiplayer practices, PCC)
- [x] Practice 2: known-driver-join-burst captured → driver-join leak quantified at ~5–6 MB/joiner (PERFORMANCE_TEST_SUMMARY §3.6)
- [x] Findings written up in `PERFORMANCE_TEST_SUMMARY.md`
- [x] Architecture review updated with empirical evidence (this PR) — _in progress on `chore/architecture-review-perf-update`_
- [x] Baseline numbers table committed alongside review (Phase 0 section of `ARCHITECTURE_REVIEW.md`, including per-joiner cost row)

**Exit blockers:** none.

### Phase 0.5 — Stop the bleeding

_Independent fixes that should not be carried forward into the new architecture._

- [x] **S1** Allowlist `chromiumFlags` switches ([chromiumFlags.ts:36-37](../src/app/storage/chromiumFlags.ts#L36-L37)) — landed 2026-05-13
- [x] **S2** Null-guard the native addon (`GetTelemetryVarByIndex`, `GetTelemetryData`, `BroadcastMessage`) — landed 2026-05-13
- [ ] **S3** Validate `logBridge` level argument ([logBridge.ts:6-8](../src/app/bridge/logBridge.ts#L6-L8))
- [ ] **S4** `setWindowOpenHandler({action:'deny'})`, `will-navigate` deny, CSP via `onHeadersReceived`
- [ ] **L1** Convert sync `fs.writeFileSync` to `fs.promises.writeFile` + 250 ms debounce (storage.ts, referenceLaps.ts, pitLaneData.ts, fuelDatabase.ts). Keep one-time `migrateReferenceLaps()` sync — it runs at startup only and that is permitted by R6.1.
- [ ] **L2** Memoize YAML parse on `currDataVersion` ([irsdk-node.ts:229](../src/app/irsdk/node/irsdk-node.ts#L229)) — confirmed by tests as a startup _memory_ concern in addition to a CPU one. _(Note: a separate contributor's PR that memoised YAML parsing landed and validated the L2 fix empirically — multi-class startup memory dropped from 2,908 MB to 1,390 MB. Bookkeeping still pending here.)_
- [ ] **L3** Add `process.on('uncaughtException')` and `process.on('unhandledRejection')` handlers in [main.ts](../src/main.ts)
- [ ] **P6** Pause broadcasts to non-visible windows (`webContents.isVisible()`)

**Exit criteria:** all HIGH/MEDIUM security findings closed; no sync I/O on the main thread outside startup; global error handlers registered.

### Phase 1 — Cheap perf wins + lifecycle bones

**Status: LANDED on `main`.** Practice 3 results: Primary renderer slope dropped from +9.8 to +1.5 MB/min in active churn (−85%); broadcast p99 −54%; processTelemetry p99 −25%. **The driver-join leak narrowed from substrate-wide to Standings-widget-specific** — addressed by Phase 2a Tier 1.

**Perf wins:**

- [x] **P2/P3/P4** Switch raw float subscriptions to `useTelemetryValuesRounded` per the precision table in `ARCHITECTURE_RULES.md` — 9 files updated (3dp for position, 4dp for reference lap)
- [x] **P5** Custom `propsAreEqual` on `memo(DriverInfoRow)` — element-wise array comparison for `lapTimeDeltas` and `displayOrder`. _Practice 5 indicates the comparator is not catching all churn (Left CPU still ~2.8%); revisit in a future phase if CPU becomes a constraint._
- [x] **P1 interim** Trim the IPC payload via `TELEMETRY_ALLOWLIST` (~340 keys → ~60 keys) before broadcast — −58% broadcast latency

**Lifecycle bones** (pulled forward from Phase 2 after Practice 2 confirmed P7):

- [x] **A2 (skeleton)** Introduce `src/app/sessionLifecycle/` event source: `onDriverJoined(carIdx)`, `onDriverLeft(carIdx)`, `onSessionNumChange()`, `onDisconnect()` — wired up to `iracingSdkBridge`. **Join detection landed**; leave/disconnect cleanup outstanding (see Phase 2a Tier 2)
- [ ] **L5 + A7 (leaking bridges)** Replace module-global callback `Set`s in `iracingSdkBridge` and `dashboardBridge` with per-window subscription maps + driver-keyed cleanup on `onDriverLeft`. _Investigation showed callback Sets are subscribed once by webserver, not per-window — the actual leak was elsewhere. Re-scoping deferred to Phase 2b._
- [x] **A3 (start)** Wire `useResetOnDisconnect` (currently dead) to the new event source for the stores it already covers; remove the dead-code label — `useResetOnDisconnect(running)` activated in `OverlayContainer.tsx`

**Exit criteria evaluation:**

- ✅ Renderer wake-ups reduced (broadcast latency halved, payload trimmed)
- ⚠️ In-race steady-state memory slope: +10.4 MB/min on AI multi-class (target was <+5). Phase 2a Tier 1 brought app slope to +9.4 MB/min in real multiplayer
- ⚠️ Per-joining-driver permanent memory cost: ~5 MB across renderers (target <1 MB). **Still outstanding — addressed by Phase 2a Tier 2**
- ✅ Phase 0 test matrix re-run — see `PERFORMANCE_TEST_LOG.md` Practice 3/4/5 entries

### Phase 2a Tier 1 — PitLapStore allocation storm + LapTimes hygiene

**Status: LANDED on `feat/phase-2a-tier1-allocations`.** Practice 5 result: **Left renderer slope dropped from +13.0 MB/min (Post-Phase-1) to +0.7 MB/min — a 95% reduction, comfortably under the <+2 MB/min target.** Standings is no longer the dominant leak.

- [x] **H4** `PitLapStore.updatePitLaps` defers cloning the 4 driver-keyed arrays (`pitEntryTime`, `pitExitTime`, `prevOnPitRoad`, `entryLap`) until a slot actually changes; early-exits the `set()` when nothing changed; fixes the in-place-mutate-then-set anti-pattern on `prevCarTrackSurface`/`actualCarTrackSurface`
- [x] **H3** `LapTimesStoreUpdater` skips `reset()` on the initial undefined render and the undefined→0 SDK-connect transition. Uses a ref to track the previous sessionNum so reset only fires on real session changes
- [N/A] **H2** Driver-array subscriptions exact-equality concern — investigation confirmed `useTelemetryValues` already uses `arrayCompare` element-wise equality. No fix needed; report was incorrect

### Phase 2a H1 — createStandings rewrite

**Status: LANDED on `feat/phase-2a-h1-standings-rewrite`, cherry-picked into integration branch.** Per-tick CPU / gen0 pressure reduction rather than a memory-leak fix (Standings is already under target after Tier 1).

- [x] Replace 3× `session.drivers.find(...)` calls with a single precomputed `Map<carIdx, Driver>` — eliminates O(N²) lookups (~4,800 array iterations → ~80 per `createDriverStandings` call for a 40-driver field)
- [x] Tighten `groupStandingsByClass` — replace `reduce → Object.entries → sort` with a single Map-based grouping that builds the output array directly. Same output contract
- [x] Hoist `useReferenceLapStore.getState()` out of the per-driver inner loop in `augmentStandingsWithGap` (~40 store-snapshot accesses per memo run → 1)
- [skipped] Augment-chain mutation rewrite — high risk, marginal benefit per Practice 5 results. Documented as deliberate non-goal
- [referred] Per-driver fallback allocation in `ReferenceLapStore.getReferenceLap()` (3× `Float32Array(0)` per call) — owned by the ReferenceLapStore contributor

**Test result (2026-05-16 Clio Cup VIR race, 35.1 min, race steady-state phase minutes 15–31):** No regression vs Tier 1-only baseline. App slope +5.2 MB/min (under target), Standings CPU 2.3% vs 3.1% Tier-1 baseline (small CPU win). Memory advantage over Tier 1 alone is not directly demonstrable — Tier 1's H4 already achieved the bulk of the Standings memory fix. **H1 is justified primarily on code-quality grounds** (O(N²) → O(N), simpler grouping); the gen0 pressure reduction is real but small.

### Phase 2a Tier 2 — Session-load cost fixes

**Status: BOTH BRANCHES LANDED on individual branches, cherry-picked into `feat/phase-2a-integration`.** Two findings surfaced by Practice 5 / PCC race that together explain a reproducible ~+1 GB session-load baseline cost (and a ~+1 GB race-start transition cost). Each shipped as a separate branch so test deltas can be attributed independently.

#### Tier 2a — Disconnect leave cleanup (`feat/phase-2a-tier2-disconnect-cleanup`) — VALIDATED

- [x] **`sessionLifecycle._onDisconnect`** emits synthetic `onDriverLeft(carIdx)` for every known driver before firing `onDisconnect()`. Previously `knownDriverCarIdxs` was cleared silently — the PCC race + Practice 5 boot logs showed zero leave events firing across all tests. Infrastructure fix: no current renderer subscribers (that channel is Phase 3/4), but main-process consumers and future renderer subscribers need this contract to hold
- [x] **`useDriverLivePositions`** clears its driver-keyed refs (`lastProgressRef`, `prevTrackSurfaceRef`, `lastLapSnapshotRef`, `p1LapCompletedRef`, `p1CarRef`) when `useRunningState` transitions true → false. These component-level Maps aren't Zustand stores so Phase 1's `useResetOnDisconnect` didn't cover them
- [x] Added `sessionLifecycle.spec.ts` (10 tests): join, leave, disconnect ordering (leaves fire before disconnect), idempotent repeated disconnect, sessionNum change semantics, unsubscribe disposer, error isolation

**Tier 2a follow-up fixes (2026-05-17, prompted by SFL Hungary test):**

- [x] **Disconnect log line** — `_onDisconnect` now logs `Driver left (disconnect): carIdx=N` per synthetic leave + `Released N per-driver slots on disconnect` summary. Before this, the leave callbacks fired but produced no log evidence, making validation impossible.
- [x] **Empty-Drivers guard** — `_onSession` ignores a session payload with empty `DriverInfo.Drivers` while drivers are known, with a `Session published with no drivers; ignoring (N still tracked)` warn. Prevents false-positive leave storms during transient SDK/YAML races.
- [x] **Bridge stale-state nulling** — `iracingSdkBridge` nulls `latestTelemetry` / `latestSession` on disconnect so new overlay windows opened during a disconnect don't get re-seeded with stale data, and the references are released for GC.
- [x] Spec coverage expanded to 16 tests (added 6: disconnect log assertions, no Released-0 summary, empty-Drivers guard, missing-Drivers guard).

**Tier 2a mid-session leave detection (2026-05-18, DECLINED 2026-05-18, REVERTED 2026-05-19):**

Identity-key implementation was written and tested 2026-05-18, then declined the same day after cost/benefit review. Working tree reverted to HEAD on 2026-05-19 before any commit landed on the integration branch. Full rationale in [`PERFORMANCE_TEST_LOG.md`](./PERFORMANCE_TEST_LOG.md) §4 "Declined for fix"; summarised here:

- The dominant real-world case (driver leaves, iRacing keeps the slot populated as a "ghost" with the original identity) is **not detectable from SessionInfo alone** — confirmed by GR86 Miami (196 joins, 0 mid-session leaves over 10 min despite confirmed departures) and the spectated PCC race (zero mid-session leaves over 20 min).
- The partial fix the working-tree code did deliver — slot-reuse detection via identity change — carries non-trivial false-positive risk because real iRacing SessionInfo updates have transient driver-entry omissions during qualifying-to-race transitions and driver swaps.
- The empirical memory cost is already small post-H4. Bridge-disconnect cleanup catches everything eventually. The user-visible "ghost driver in Standings" symptom is mild and arguably matches iRacing's own behaviour.
- Remaining engineering effort better spent on the reference-lap fetch dedup (R1) and Tier 2b verification (R2), both of which landed 2026-05-19.

#### Tier 2b — Reference-lap save/fetch dedup (`feat/phase-2a-tier2-reflap-dedup`) — PARTIALLY VALIDATED

- [x] **In-memory cache** in `src/app/storage/referenceLaps.ts`. Lazy-loaded on first access, subsequent `getReferenceLap()` calls are O(1) Map lookups instead of full file read+parse+revive
- [x] **Debounced async write** (250 ms window) via `fs.promises.writeFile`. Multiple `saveReferenceLap()` calls within the window collapse into one write — collapses the PCC race's 51-saves-for-17-events pattern (3× per save per renderer) into 1 write per fast lap. Also removes `fs.writeFileSync` from the save path
- [x] **`flushReferenceLapsOnShutdown()`** wired to `app.on('before-quit')` so the last save before close is never lost
- [x] Added `referenceLaps.spec.ts` (9 tests): cache hit, Float32Array revival, immediate read-after-save, debounce coalescing, latest-value-wins, separate keys, shutdown flush, no-cache no-op
- [x] Renderer surface unchanged — `bridge.getReferenceLap` / `saveReferenceLap` signatures preserved. `ReferenceLapStore` (other contributor's lane) untouched
- [ ] **Filesystem-level verification** — PCC race, SFL Hungary, combined PR test, and GR86 Miami **all still show 3× save log clusters**. The renderer-side log fires before the main-process debounce, so the log evidence is misleading. Need either (a) an additional log line on the actual post-debounce file write, or (b) a test that counts `.json` writes in the reference-lap directory during a fast-lap burst, to confirm the debounce is engaging at the FS layer.

#### Phase 2a Integration PR (`feat/phase-2a-integration`)

**Status: READY TO MERGE after reverting the declined mid-session-leave working-tree changes.** Cherry-picks of all the above branches plus follow-up fixes into a single PR off `irdashies-fork/main`. Lets project owner test one branch instead of four.

Includes:

- Tier 1 (`ce3d0f30`) — PitLapStore + LapTimes hygiene
- Post-PCC docs (`f79b55d2`)
- Plan-update for Tier 2 branches (`0ab10a31`)
- H1 (`5329db8a`) — createStandings rewrite
- Tier 2a (`502a197c`) — disconnect leave cleanup
- Tier 2b (`5e937eca`) — reference-lap dedup
- Practice 3 docs (`82b2c96a`)
- Follow-up commits on the integration branch:
  - 2026-05-17: disconnect log line + empty-Drivers guard + bridge stale-state nulling (committed)

Working-tree (uncommitted, **to be reverted**):

- 2026-05-18: mid-session leave detection via identity key — declined; see §4 of the test log

**Exit criteria for Phase 2a Tier 2:**

- ✅ "Opened during session-load" startup memory closer to "opened post-load" baseline — Combined PR test shows peak memory −40% vs Tier 1-alone baseline (1,777 MB vs 2,914 MB)
- ✅ No driver-slot accumulation across reconnect cycles — GR86 Miami shows 196 joins matched by 196 `Driver left (disconnect)` lines
- ⚠️ Reference-lap save log lines still show 3× clusters; filesystem-level verification still required (tracked as a remaining item below)
- ✅ App-level slope on Practice (real, joiners) under +5 MB/min — SFL Hungary steady-state +1.30 MB/min

### Phase 2a remaining items

**Status: R1 + R2 LANDED 2026-05-19 on `feat/phase-2a-integration`; R3 still pending (test run, not code).**

#### R1 — Reference-lap fetch dedup — LANDED 2026-05-19

Each renderer independently called `bridge.getReferenceLap` on connect and SessionNum transitions, producing 3× IPC invokes per class per event. The 2026-05-18 spectated PCC race captured the misleading log signal: **24 `[Main] Fetching reference lap` lines in 30 seconds at session-load** (4 classes × 3 renderers × 2 transitions) where 4 would suffice.

Implementation: `ipcMain.handle('reference:get', ...)` in [`src/app/bridge/referenceLapsBridge.ts`](../src/app/bridge/referenceLapsBridge.ts) now keeps a small `Map<key, timestamp>` of recent invokes with a 5s TTL. The first invoke per key logs the `[Main] Fetching reference lap ...` INFO line; subsequent invokes within the TTL log `[Main] Reference lap fetch dedup'd ...` at DEBUG level. The underlying storage-layer cache already prevents duplicate disk reads (Tier 2b); R1 just cleans up the misleading log signal that the test author was counting. 6 new spec tests in [`src/app/bridge/referenceLapsBridge.spec.ts`](../src/app/bridge/referenceLapsBridge.spec.ts).

#### R2 — Tier 2b debounce filesystem verification — LANDED 2026-05-19

Save log clusters of 3 had persisted across all Phase 2a tests. The renderer-side log line fires before the main-process debounce, so log evidence was misleading. R2 adds an explicit log line on the actual post-debounce `fs.promises.writeFile` call.

Implementation: `flushAsync` in [`src/app/storage/referenceLaps.ts`](../src/app/storage/referenceLaps.ts) now logs `[Main] Reference laps written to disk (N entries)` after each successful write. The ratio of pre-log (`[Main] Saving reference lap`) to post-log lines is the dedup factor visible in test analysis. 3 new spec tests covering once-per-write log, entry count in message, no-log-on-write-failure.

#### R3 — Empty Dashboard substrate baseline test

Long-standing test backlog item (originally Q6, now restated as a concrete deliverable).

- [ ] Configure irDashies with all widgets disabled
- [ ] Run a solo practice for ~20 minutes with PerfMetrics enabled
- [ ] Record the substrate slope (app-level + per-renderer + per-process)
- [ ] Add the result to `PERFORMANCE_TEST_LOG.md` and update §5 targets with the substrate baseline

**Estimated effort:** small (configuration change + one test run)
**Estimated impact:** diagnostic — useful baseline for future regression detection. Specifically isolates whether residual slope is widget-attributable or substrate-attributable. Also informs the long-pending +107 MB Primary startup question.

### Phase 2b — Architectural cleanup (remaining)

_The highest-impact slices of A2/A3/L5/A7 landed in Phase 1 + Phase 2a Tier 1 + Phase 2a Tier 2. Phase 2b is the residual architectural work that does not directly affect performance._

- [ ] **A1** Extract `frontend/domain/` from `Standings/`; lint forbids cross-widget imports. _Blocked on Q1 (folder name decision)_
- [ ] **A2/A3 (full migration)** Migrate _every_ remaining store to register reset handlers with `sessionLifecycle`; delete `useResetOnDisconnect` once unused; add `onEnter`/`onExit` events; distinguish live vs replay
- [ ] **A4** Replace god-files with self-registering `WidgetDefinition`
- [ ] **A5** Remove hardcoded `'default'` profile from `overlayManager.ts`
- [ ] **A6** Add `version: number` per widget settings; introduce `src/types/migrators/<widget>.ts` registry. _Blocked on Q3 (migrator location decision)_
- [ ] **A7 (completion)** Roll out `defineBridge<I>(channel, impl)` helper to the remaining 6 bridges
- [ ] **A9** `npm run check:generated-types` script + CI guard
- [ ] **L5 (re-scoped)** If callback `Set` retention turns out to matter after Phase 2a Tier 2 lands (TBC from re-test) — original hypothesis disconfirmed but worth a second look

### Phase 2c — Outstanding investigations

Lower-urgency investigations kept on the plan to avoid losing them. The Empty Dashboard test that used to live here has been promoted to Phase 2a remaining item R3.

- [ ] **Single-Widget isolation tests** — per-widget leak rate, identifies heaviest widget(s). Q7
- [ ] **Main process slope investigation** — was +4–6 MB/min across early phases, now at or near target after Phase 2a side effects. Watch item only — re-investigate if it re-elevates in a future test.
- [ ] **P5 / `DriverInfoRow` memo follow-up** — Phase 1's `propsAreEqual` is in place but Left CPU is only marginally lower than pre-Phase-1. If CPU becomes the next constraint after memory is solved, revisit whether the comparator is being hit or whether parent re-renders pass new objects (e.g. inline `style={...}`)

### Phase 3 — Channel-based bridge

Replaces the single firehose `'telemetry'` IPC broadcast with per-channel publish/subscribe so each renderer only receives the data its mounted widgets ask for, at the rate they ask for it.

**Core plumbing:**

- [ ] `publishChannel(channel, payload)` / `useChannelSnapshot(channel)` plumbing
- [ ] Per-window subscription map driven by preload `subscribe(channels[])`. Unsubscribes when widgets unmount or the window closes (replaces today's app-wide `TELEMETRY_ALLOWLIST` with per-window allowlists)
- [ ] Pilot migration: Fuel widget runs entirely off `'fuel.projection'`

**Per-widget update-rate throttling** (new, 2026-05-15):

Today every renderer wakes 25 times/sec regardless of what's mounted. A weather widget only needs ~1 Hz; a brake-input bar wants 60 Hz. The channel bus is the right plumbing layer to control this because it owns the publish path per subscriber.

- [ ] **Rate-aware subscriptions** — `subscribe([{channel, rateHz}])` carries an optional `rateHz` per channel. The main-process publisher coalesces frames so each subscriber receives at most `rateHz` updates/sec for that channel. Subscribers that don't specify a rate default to the channel's native publish rate (25 Hz for telemetry, on-change for session)
- [ ] **Developer-configurable rate** — Two complementary mechanisms (the same plumbing supports both, decision deferred to Q16 below):
  - **Per-widget property** — `WidgetDefinition.updateRateHz?: number | Partial<Record<Channel, number>>`. Lets a widget author declare "I'm fine at 5 Hz" without changing global config
  - **Group / preset** — Named buckets the dashboard config picks from: `{ driverFocused: 25, gapTiming: 10, informational: 2, static: 0 }` (0 = on-change only). Widget authors pick a bucket; advanced users can override per-widget
- [ ] **Default rate guidance** (codified in `ARCHITECTURE_RULES.md`):

  | Bucket          |      Rate | Example widgets                                  |
  | --------------- | --------: | ------------------------------------------------ |
  | `driverFocused` |  25–60 Hz | Inputs, Steering, Pedal trace, Relative          |
  | `gapTiming`     |   5–10 Hz | Standings positions, Sector deltas, Battle       |
  | `informational` |    1–5 Hz | Weather, Track temperature, Fuel projection      |
  | `static`        | on-change | Track map background, Session bar, Widget chrome |

- [ ] **Settings UI exposure** — Once the mechanism is wired, expose the rate per widget (or the group selection) in the widget's settings panel for power users
- [ ] **Migration safety** — Default any unmigrated widget to the legacy 25 Hz path so the rollout can be incremental
- [ ] **Telemetry / instrumentation** — Add a debug overlay or PerfMetrics line that shows wake-ups per renderer per second so we can confirm the throttling is taking effect

**Exit criteria for Phase 3:**

- Each renderer's wake-up rate scales with the slowest mounted widget's rate, not the SDK loop rate
- Per-widget rate is configurable via either widget property or named group (mechanism choice resolved by Q16)
- Re-run Practice (real, joiners): app-level CPU and renderer wake-ups/sec measurably lower than Post-Phase-2a baseline
- Fuel widget pilot demonstrates a widget can opt out of the legacy `'telemetry'` channel entirely

### Phase 4 — Main-process processors

- [ ] LapTimesProcessor
- [ ] CarSpeedsProcessor
- [ ] RelativeGapProcessor
- [ ] ReferenceLapProcessor
- [ ] SectorTimingProcessor
- [ ] FuelProjectionProcessor
- [ ] StandingsProcessor
- [ ] Legacy `'telemetry'` channel removed or dev-only

### Phase 5 — Worker-thread SDK loop

- [ ] SDK loop in `worker_threads`; native SDK instantiated _inside_ the worker

### Phase 6 — Native optimisations (only if needed)

- [ ] _Pending Phase 4 re-profile_

---

## 3. Supporting work (cross-cutting)

These do not belong to a single phase; tracked separately so they do not get lost.

- [ ] **`tools/perfBench/`** — headless trace-replay harness with memory-slope assertion (per `PERFORMANCE_TEST_SUMMARY.md` §7.3). Use the existing per-session CSVs as the seed corpus.
- [ ] **ESLint boundaries plugin** — enforce R1.x layering and R7.x widget isolation
- [ ] **CI hash check on `_GENERATED_telemetry.ts`** — R10.4
- [ ] **Pre-PR checklist enforcement** — either PR template additions or a CI step that scans for the checklist in the PR description
- [ ] **Test coverage baseline** — document what is currently tested so Phase 4 risk is measurable

---

## 4. Open questions (still need a decision)

These block specific phases. They are duplicated from `ARCHITECTURE_REVIEW.md` §5 and from `PERFORMANCE_TEST_SUMMARY.md` §6 so contributors do not have to chase them across files.

### From the architecture review

1. Domain folder name: `frontend/domain/` vs `derived/` vs `shared/` _(blocks Phase 2 A1)_
2. Channel subscription model: push-only vs push+pull _(blocks Phase 3)_
3. Settings migrator location: per-widget vs central registry _(blocks Phase 2 A6)_
4. Backwards-compat window for the legacy `'telemetry'` channel _(blocks Phase 4)_
5. Long-term native direction: stay TS vs Rust + napi-rs _(blocks Phase 6)_

### From the performance summary (still requires investigation)

6. **Empty-dashboard baseline test** _(SCOPED 2026-05-19 — now tracked as Phase 2a remaining item R3)_ — substrate baseline measurement with all widgets disabled. Promoted from open question to concrete deliverable.
7. **Single-widget isolation tests** _(MEDIUM, downgraded after Practice 5)_ — per-widget leak rate, identifies heaviest widget(s). Standings was the suspected heaviest and is now resolved; this is now an exploratory rather than gating test
8. ~~Reference-lap A/B~~ — **ADDRESSED by Phase 2a Tier 2b** (`feat/phase-2a-tier2-reflap-dedup`). Main-process cache + debounced write collapses 3× per-renderer save bursts into 1 write
9. **PCC dashboard config delta** _(MEDIUM)_ — which widget(s) explain PCC's much lower leak rate?
10. **NetworkService allocation** _(MEDIUM)_ — is the multi-class 178 MB jump PostHog? _Partly addressed by Phase 0.5 S5; NetworkService back to baseline_
11. **Sync-I/O tick-dip correlation** _(RESOLVED by Phase 0.5)_ — L1 fix eliminated tick dips; correlation confirmed
12. ~~Early-session step-change cause~~ — **RESOLVED 2026-05-12 by Practice 2**: driver joins are the cause; produced finding P7
13. **Cumulative driver-join cost in long sessions** _(RESOLVED)_ — per-joiner cost is bounded by SDK array length (64 slots), confirmed by Practice 5. Disconnect cleanup gap addressed by Phase 2a Tier 2a and validated by GR86 Miami (196 leave events match 196 joins on bridge disconnects).
14. **Session-load vs post-load startup gap** _(HIGH → SUBSTANTIALLY ADDRESSED, 2026-05-17)_ — opening irDashies during iRacing session-load originally cost ~+1 GB baseline vs opening post-load. Combined PR test 2026-05-17 shows peak memory −40% vs Tier 1-alone baseline (1,777 MB vs 2,914 MB) and session-load delta −72%. The dominant fix turned out to be Tier 2a's session-boundary cleanup rather than Tier 2b's reference-lap dedup. **Remaining cost** is concentrated in the reference-lap fetch storm at session-load (now scoped as R1); see §2 "Phase 2a remaining items".
15. **Main process slope** _(MEDIUM → SUBSTANTIALLY ADDRESSED, 2026-05-17)_ — previously +4–6 MB/min, the largest single contributor. Combined PR test 2026-05-17 shows +0.5 MB/min (at target). The Phase 2a session-boundary cleanup picked this up as a side effect. **Watch item**: still elevated in some scenarios (PCC race standalone Tier 1 showed +2.3); needs further investigation if it re-emerges.
16. **Per-widget rate-throttling mechanism** _(HIGH, new 2026-05-15 — blocks Phase 3 rate-throttling sub-task)_ — Per-widget property (`WidgetDefinition.updateRateHz`), named-group preset (`driverFocused` / `gapTiming` / `informational` / `static`), or both? Plus where the default bucket assignment lives (widget code, dashboard config, or both). User preference (2026-05-15): "I'd like it configurable for developers... through a grouping mechanism or as a property in the configuration of the widget." Leaning toward both — group preset as the default with per-widget override
17. ~~Mid-session per-driver leave detection~~ — **RESOLVED BY DECLINE 2026-05-18.** Cost/benefit review concluded the architectural completeness isn't worth the implementation risk: the dominant case (ghost slots) is undetectable from SessionInfo alone, the partial fix (slot-reuse detection) carries false-positive risk, and per-driver allocation is already small post-H4. See [`PERFORMANCE_TEST_LOG.md`](./PERFORMANCE_TEST_LOG.md) §4 "Declined for fix" for the full rationale.
18. **Reference-lap save debounce filesystem verification** _(SCOPED 2026-05-19 — now tracked as Phase 2a remaining item R2)_ — every Phase 2a test (PCC, SFL, combined PR, GR86 Miami, spectated PCC) shows save log lines in 3× clusters despite the Tier 2b debounce. The renderer-side log line fires _before_ the main-process debounce, so log evidence is misleading. Promoted from open question to concrete deliverable.
19. **Reference-lap fetch dedup** _(NEW 2026-05-19 — tracked as Phase 2a remaining item R1)_ — spectated PCC race captured the cost clearly: 24 fetches in 30 seconds at session-load (4 classes × 3 renderers × 2 transitions) where 4 would suffice. Highest-priority remaining performance item; pattern established by Tier 2b's save work. Promoted from observation to concrete deliverable.

---

## 5. How to use this file

If you are about to start work on any phase item:

1. Update the relevant row in §1 with your branch name and "IN PROGRESS".
2. Tick the item in §2 _only when the PR has merged into `main`_.
3. Append a one-line entry to §6 below — date, item ID, branch, outcome.
4. If you discover new work, add it to §2 or §3 in the right place. Do not create a parallel doc.
5. If you make a decision on something from §4, remove the question and add a one-line note explaining the resolution to the relevant entry in §2.

LLM agents: read this file at the start of any session that touches the architecture work. Do not duplicate analysis already captured here.

---

## 6. Activity log

Append-only. Newest entries at the top. Format: `YYYY-MM-DD — item — branch — outcome`.

- **2026-05-19** — R1 reference-lap fetch dedup + R2 post-debounce write log landed on integration branch. R1: 5s-TTL invoke dedup in `referenceLapsBridge.ts` collapses 3× per-renderer `[Main] Fetching reference lap` log lines to 1 per class per transition; subsequent invokes log at DEBUG level. R2: `flushAsync` in `referenceLaps.ts` logs `[Main] Reference laps written to disk (N entries)` after each successful `fs.promises.writeFile`, giving ground-truth save-count evidence to discriminate against the misleading renderer-side log clusters. 9 new spec tests (6 new bridge spec file + 3 in referenceLaps spec). 809/809 tests pass — `feat/phase-2a-integration` — landed
- **2026-05-19** — Working-tree identity-key implementation for mid-session leave detection reverted to HEAD on `feat/phase-2a-integration`. Decline decision from 2026-05-18 enacted before any commit landed; sessionLifecycle.ts and its spec match the post-2026-05-17 state again. The 2026-05-17 follow-up work (empty-Drivers guard, disconnect log line, Released summary, bridge stale-state nulling) was also still uncommitted and got re-applied cleanly in the same revert+restore operation, then committed separately
- **2026-05-18** — Spectated PCC race at GR86 Navarra (23.5 min, 4-class spectated race): zero `Driver left (session-update)` events in 20 min despite genuine driver departures. Mid-session per-driver leave detection **declined for fix** after cost/benefit review — see PERFORMANCE_TEST_LOG.md §4 "Declined for fix". Reference-lap fetch storm at session-load captured: 24 fetches in 30s where 4 would suffice — promoted to highest-priority remaining performance item (R1, landed 2026-05-19)
- **2026-05-18** — Mid-session per-driver leave detection IMPLEMENTED (working tree only): identity-key approach using `knownDrivers: Map<carIdx, identityString>` with UserID/UserName fallback. Declined the same day after cost/benefit review; reverted 2026-05-19 — `feat/phase-2a-integration` — declined, reverted
- **2026-05-18** — Q17 added (mid-session leave detection limitations); Q18 added (reference-lap save debounce filesystem verification); Q14 and Q15 marked substantially addressed by combined PR test results
- **2026-05-17** — Phase 2a Tier 2a follow-up fixes (prompted by SFL Hungary test, log+memory audit). (1) `_onDisconnect` now logs `Driver left (disconnect): carIdx=N` per synthetic leave + `Released N per-driver slots on disconnect` summary — previously callbacks fired silently, making validation impossible. (2) Empty-Drivers guard in `_onSession` ignores transient SDK/YAML races with a warn log. (3) `iracingSdkBridge` nulls `latestTelemetry`/`latestSession` on disconnect. 6 new spec tests (16 total). Validated by GR86 Miami test 2026-05-18: 196 joins, 196 `Driver left (disconnect)` lines, 4 `Released N per-driver slots` summaries match 4 disconnect events — `feat/phase-2a-integration` — committed
- **2026-05-17** — Integration PR test (Practice → Ghost Race · PCup at Spa, 24.4 min): peak memory −40% vs Tier 1-alone baseline (1,777 MB vs 2,914 MB), processTelemetry p99 4.6 ms (target <3 ms, closest yet), broadcast p99 0.45 ms (under target), Main process slope +0.5 MB/min (at target, down from +2.3). Session-load delta −72%. Standings −0.4 MB/min (actively declining) — `feat/phase-2a-integration` — owner-tested, performance confirmed good
- **2026-05-17** — Phase 2a integration PR created off `irdashies-fork/main`: 7 commits cherry-picked (Tier 1, post-PCC docs, plan update, H1, Tier 2a, Tier 2b, Practice 3 docs). Linear history, no merge commits. 794/794 tests pass at integration time — `feat/phase-2a-integration` — pushed to fork
- **2026-05-16** — Phase 2a H1 standalone test (Race · Clio Cup at VIR, 35.1 min): no regression vs Tier 1-only baseline. App slope +5.2 MB/min, Standings CPU 2.3% vs 3.1% baseline (small CPU win). H1 justified on code-quality grounds rather than measurable memory impact — `feat/phase-2a-h1-standings-rewrite` — landed
- **2026-05-16** — Phase 2a Tier 2 standalone test (Practice · TCR at Watkins Glen): new `Disconnect detected (N known drivers)` diagnostic infrastructure validated. Per-driver leave callbacks still unverified (6 disconnect events logged but no `Driver left` lines — fixed in the 2026-05-17 follow-up). Main process slope dropped to +0.3 MB/min. Standings elevated in single-class scenarios (+6.4 MB/min) — `feat/phase-2a-tier2-disconnect-cleanup` — landed
- **2026-05-15** — Phase 2a Tier 2b reference-lap dedup: main-process in-memory cache + 250ms debounced async write via `fs.promises.writeFile`. Collapses 3× per-renderer save bursts (51-for-17 pattern from PCC race) into 1 write. `getReferenceLap` lazy-loads once then O(1) cache hits. `flushReferenceLapsOnShutdown()` wired to `before-quit`. Renderer surface unchanged; `ReferenceLapStore` (other contributor's lane) untouched. 9 new tests; 784/784 pass — `feat/phase-2a-tier2-reflap-dedup` — in review (commit cb5aaa08)
- **2026-05-15** — Phase 2a Tier 2a disconnect leave cleanup: `sessionLifecycle._onDisconnect` now emits synthetic per-driver leaves before clearing state; `useDriverLivePositions` clears driver-keyed refs on running true→false. Added `sessionLifecycle.spec.ts` covering join/leave/disconnect ordering/idempotent disconnect/sessionNum change/unsubscribe/error isolation. 10 new tests; 785/785 pass — `feat/phase-2a-tier2-disconnect-cleanup` — in review (commit 3abe70a7)
- **2026-05-15** — Phase 3 plan expanded: added per-widget update-rate throttling as a sub-task on the channel-bus work, with developer-configurable rates via either per-widget property or named-group preset (`driverFocused` / `gapTiming` / `informational` / `static`). Added Q16 to track mechanism-design decision — `docs/IMPLEMENTATION_PLAN.md` — planning
- **2026-05-14** — Phase 2a H1 createStandings rewrite: O(N²) `find()` → Map lookup; `groupStandingsByClass` Map-based grouping; `useReferenceLapStore.getState()` hoisted out of inner loop. Augment-chain mutation rewrite skipped (high risk, marginal benefit given Tier 1 results). Per-driver fallback allocation in `ReferenceLapStore.getReferenceLap` referred to that store's contributor. 775/775 tests pass — `feat/phase-2a-h1-standings-rewrite` — in review, awaiting in-game test
- **2026-05-14** — Phase 2a Tier 1 perf wins: H4 PitLapStore defer-cloning + early-exit + mutate-then-set fix; H3 LapTimesStoreUpdater no spurious reset on undefined→0 SDK-connect. Practice 5 result: Left renderer slope +13.0 → +0.7 MB/min (95% reduction, under target). H2 investigation concluded N/A (`useTelemetryValues` already uses `arrayCompare`). Two new findings surfaced from Practice 5 boot log: reference-lap fetch fires 3× per class, disconnect doesn't emit per-driver leave events — became Phase 2a Tier 2 — `feat/phase-2a-tier1-allocations` — landed
- **2026-05-14** — Phase 2 investigation: deep audit of Standings widget tree, driver-keyed stores, and IPC session ingestion. Produced 7 ranked hypotheses (H1–H7) with file:line evidence. Key conclusion: the leak is gen0 GC pressure forcing premature tenuring during join bursts, not retained-reference. Recommended 3-tier branch plan with Tier 1 (H2/H3/H4) first — `feat/phase-1-perf-and-lifecycle` — investigation report
- **2026-05-13** — Phase 1 perf wins + lifecycle bones LANDED on `main`: P2/P3/P4 CarIdxLapDistPct rounded (3dp/4dp) in 9 files; P5 DriverInfoRow custom memo comparator; P1 interim IPC payload trimmed ~340→~60 keys via TELEMETRY_ALLOWLIST; A2 `src/app/sessionLifecycle/` created + wired to iracingSdkBridge; A3 `useResetOnDisconnect` activated in OverlayContainer; 775/775 tests pass. Practice 3 result: Primary renderer slope −85%, Standings became the sole remaining leak source. Per-Phase-1 fix to `useLapTimeLog.ts` infinite loop (functional bug surfaced during testing) included — `feat/phase-1-perf-and-lifecycle` — landed
- **2026-05-13** — Phase 0.5 S1/S2 landed (chromiumFlags allowlist + native addon null-guards). L2 YAML memoisation independently landed via a different PR and validated empirically (multi-class startup −1.5 GB)
- **2026-05-12** — Practice 2 results incorporated: new finding P7 (driver-join leak, ~5–6 MB/joiner); A2/A3/L5/A7 reclassified CONFIRMED; SessionLifecycle skeleton + leaking-bridge cleanup pulled forward from Phase 2 into Phase 1; Q12 resolved; Q13 added; per-joiner-cost row added to Phase 0 baseline table — `chore/architecture-review-perf-update` — in progress
- **2026-05-11** — Phase 0 evidence written up; architecture review being updated with empirical findings — `chore/architecture-review-perf-update` — in progress
- **2026-05-11** — Initial Phase 0 measurement complete — `main` — `docs/PERFORMANCE_TEST_SUMMARY.md` committed
- **2026-05-11** — Architecture documents created (review + rules + AGENTS.md pointer) — `main` — landed
