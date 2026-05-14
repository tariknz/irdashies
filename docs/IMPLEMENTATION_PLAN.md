# iRDashies Architecture Implementation Plan — Running Log

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

| Phase                                                | Status           | Branch / PR                          | Notes                                                                                                                                                                                                                                      |
| ---------------------------------------------------- | ---------------- | ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Phase 0 — Measure**                                | DONE             | —                                    | Baseline captured in `PERFORMANCE_TEST_SUMMARY.md`; revised 2026-05-12 after Practice 2                                                                                                                                                    |
| **Phase 0.5 — Stop the bleeding**                    | LANDED (partial) | merged on `main`                     | S1/S2 landed; S3/S4/L1/L2/L3/P6 still open                                                                                                                                                                                                 |
| **Phase 1 — Cheap perf wins + lifecycle bones**      | LANDED           | merged on `main`                     | P1/P2/P4 typed subs, P5 propsAreEqual, IPC allowlist, SessionLifecycle skeleton, useResetOnDisconnect activated. Practice 3: Primary slope −85%; Standings became the sole remaining leak source                                           |
| **Phase 2a Tier 1 — PitLapStore + LapTimes hygiene** | LANDED           | `feat/phase-2a-tier1-allocations`    | H3 + H4. Practice 5: Left renderer slope dropped from +13.0 → +0.7 MB/min (95% reduction, under target). Standings widget no longer the dominant leak                                                                                      |
| **Phase 2a H1 — createStandings rewrite**            | IN REVIEW        | `feat/phase-2a-h1-standings-rewrite` | O(N²) → O(N) `find()` removal; `groupStandingsByClass` Map-based; `useReferenceLapStore.getState()` hoisted out of inner loop. 775/775 tests pass. Awaiting in-game functional test                                                        |
| **Phase 2a Tier 2 — Session-load cost fixes**        | NOT STARTED      | —                                    | Two findings from Practice 5: (1) reference-lap fetch fires 3× per class (per renderer instead of per app); (2) disconnect path doesn't emit per-driver leave events. Together explain ~+1 GB session-load cost. **Highest leverage next** |
| **Phase 2b — Architectural cleanup (remaining)**     | NOT STARTED      | —                                    | A1, A4, A5, A6, A7 completion, A9. Lower urgency now Standings memory issue is resolved                                                                                                                                                    |
| **Phase 3 — Channel-based bridge**                   | NOT STARTED      | —                                    | Would close remaining processTelemetry p99 gap to <3 ms                                                                                                                                                                                    |
| **Phase 4 — Main-process processors**                | NOT STARTED      | —                                    | Depends on Phase 3                                                                                                                                                                                                                         |
| **Phase 5 — Worker-thread SDK loop**                 | NOT STARTED      | —                                    |                                                                                                                                                                                                                                            |
| **Phase 6 — Native optimisations**                   | DEFERRED         | —                                    | Only if Phase 4 profiling demands                                                                                                                                                                                                          |

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

**Status: IN REVIEW on `feat/phase-2a-h1-standings-rewrite`.** Awaiting in-game functional test. Per-tick CPU / gen0 pressure reduction rather than a memory-leak fix (Standings is already under target after Tier 1).

- [x] Replace 3× `session.drivers.find(...)` calls with a single precomputed `Map<carIdx, Driver>` — eliminates O(N²) lookups (~4,800 array iterations → ~80 per `createDriverStandings` call for a 40-driver field)
- [x] Tighten `groupStandingsByClass` — replace `reduce → Object.entries → sort` with a single Map-based grouping that builds the output array directly. Same output contract
- [x] Hoist `useReferenceLapStore.getState()` out of the per-driver inner loop in `augmentStandingsWithGap` (~40 store-snapshot accesses per memo run → 1)
- [skipped] Augment-chain mutation rewrite — high risk, marginal benefit per Practice 5 results. Documented as deliberate non-goal
- [referred] Per-driver fallback allocation in `ReferenceLapStore.getReferenceLap()` (3× `Float32Array(0)` per call) — owned by the ReferenceLapStore contributor

### Phase 2a Tier 2 — Session-load cost fixes (highest leverage next)

**Status: NOT STARTED.** Two findings surfaced by Practice 5 that together explain a reproducible ~+1 GB session-load baseline cost (when iRDashies is opened while iRacing is loading into a session).

- [ ] **R1 Reference-lap fetch deduplication** — Each renderer independently fetches reference laps on its own SessionInfo event. The Practice 5 boot log shows 9 fetches (3 classes × 3 renderers) instead of 3. Move the fetch to a main-process singleton + broadcast results to renderers. Small targeted change, high leverage on session-load cost
- [ ] **A3 (completion) Disconnect leave cleanup** — `sessionLifecycle` detects disconnect but does not emit per-driver leave events to release state allocated during join. Practice 5 boot log showed ~129 driver-slot allocations for only 44 distinct drivers across 2 reconnect cycles. Wire `onDisconnect` to iterate the known driver set and emit synthetic leave events, then call the existing reset paths
- [ ] **Re-run Practice (real, joiners) opened during session-load** to quantify the saving from R1 and disconnect cleanup independently

**Exit criteria:**

- "Opened during session-load" startup memory closer to "opened post-load" baseline (target ≤ +200 MB delta vs ~+1 GB today)
- No driver-slot accumulation across reconnect cycles (boot log shows join/leave counts match)
- App-level slope on Practice (real, joiners) under +5 MB/min

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

These were raised but not actioned during Phase 2a. Lower urgency now, but kept on the plan to avoid losing them.

- [ ] **Empty Dashboard test post-Phase 1** — characterise substrate baseline; isolate the +107 MB Primary startup regression. Q6
- [ ] **Single-Widget isolation tests** — per-widget leak rate, identifies heaviest widget(s). Q7
- [ ] **Main process slope investigation** — persistent +4–6 MB/min across all phases; now the largest single contributor to app-level slope. Untouched by any fix so far. Candidates: telemetry buffering, log accumulation, main-process state stores not yet typed
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

6. **Empty-dashboard baseline test** _(MEDIUM, downgraded after Phase 2a)_ — does the leak persist with zero widgets? Original gating role for Phase 1 success criteria; less urgent now that the dominant leaks are resolved
7. **Single-widget isolation tests** _(MEDIUM, downgraded after Practice 5)_ — per-widget leak rate, identifies heaviest widget(s). Standings was the suspected heaviest and is now resolved; this is now an exploratory rather than gating test
8. ~~Reference-lap A/B~~ — **NOW SCOPED INTO PHASE 2A TIER 2 R1**. The Practice 5 boot log surfaced concrete duplication (3× per class per renderer) that supersedes the A/B
9. **PCC dashboard config delta** _(MEDIUM)_ — which widget(s) explain PCC's much lower leak rate?
10. **NetworkService allocation** _(MEDIUM)_ — is the multi-class 178 MB jump PostHog? _Partly addressed by Phase 0.5 S5; NetworkService back to baseline_
11. **Sync-I/O tick-dip correlation** _(RESOLVED by Phase 0.5)_ — L1 fix eliminated tick dips; correlation confirmed
12. ~~Early-session step-change cause~~ — **RESOLVED 2026-05-12 by Practice 2**: driver joins are the cause; produced finding P7
13. **Cumulative driver-join cost in long sessions** _(MEDIUM, partially resolved)_ — per-joiner cost is bounded by SDK array length (64 slots), confirmed by Practice 5 not growing unboundedly. Disconnect cleanup gap (now Phase 2a Tier 2) is the remaining mechanism for unbounded growth across reconnect cycles
14. **Session-load vs post-load startup gap** _(HIGH, new from Practice 5)_ — opening iRDashies during iRacing session-load costs ~+1 GB baseline vs opening post-load. Phase 2a Tier 2 (R1 + disconnect cleanup) directly targets both contributing mechanisms; re-test should quantify each
15. **Main process slope** _(MEDIUM, new from Practice 5)_ — persistent +4–6 MB/min across all phases, now the largest single contributor to app-level slope. Root cause not yet identified; candidates: telemetry buffering, log accumulation, main-process state stores not yet typed
16. **Per-widget rate-throttling mechanism** _(HIGH, new 2026-05-15 — blocks Phase 3 rate-throttling sub-task)_ — Per-widget property (`WidgetDefinition.updateRateHz`), named-group preset (`driverFocused` / `gapTiming` / `informational` / `static`), or both? Plus where the default bucket assignment lives (widget code, dashboard config, or both). User preference (2026-05-15): "I'd like it configurable for developers... through a grouping mechanism or as a property in the configuration of the widget." Leaning toward both — group preset as the default with per-widget override

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
