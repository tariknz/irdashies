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

| Phase                                           | Status      | Branch / PR                       | Notes                                                                                                             |
| ----------------------------------------------- | ----------- | --------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| **Phase 0 — Measure**                           | DONE        | —                                 | Baseline captured in `PERFORMANCE_TEST_SUMMARY.md`; revised 2026-05-12 after Practice 2                           |
| **Phase 0.5 — Stop the bleeding**               | NOT STARTED | —                                 | Triggered next once review-doc update lands                                                                       |
| **Phase 1 — Cheap perf wins + lifecycle bones** | IN PROGRESS | `feat/phase-1-perf-and-lifecycle` | Now includes SessionLifecycle skeleton + bridge per-window cleanup (pulled forward from Phase 2 after 2026-05-12) |
| **Phase 2 — Architectural cleanup**             | NOT STARTED | —                                 | A2/A3/L5/A7 highest-impact slice moved to Phase 1; the rest remains here                                          |
| **Phase 3 — Channel-based bridge**              | NOT STARTED | —                                 |                                                                                                                   |
| **Phase 4 — Main-process processors**           | NOT STARTED | —                                 | Depends on Phase 3                                                                                                |
| **Phase 5 — Worker-thread SDK loop**            | NOT STARTED | —                                 |                                                                                                                   |
| **Phase 6 — Native optimisations**              | DEFERRED    | —                                 | Only if Phase 4 profiling demands                                                                                 |

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

- [ ] **S1** Allowlist `chromiumFlags` switches ([chromiumFlags.ts:36-37](../src/app/storage/chromiumFlags.ts#L36-L37))
- [ ] **S2** Null-guard the native addon (`GetTelemetryVarByIndex`, `GetTelemetryData`, `BroadcastMessage`)
- [ ] **S3** Validate `logBridge` level argument ([logBridge.ts:6-8](../src/app/bridge/logBridge.ts#L6-L8))
- [ ] **S4** `setWindowOpenHandler({action:'deny'})`, `will-navigate` deny, CSP via `onHeadersReceived`
- [ ] **L1** Convert sync `fs.writeFileSync` to `fs.promises.writeFile` + 250 ms debounce (storage.ts, referenceLaps.ts, pitLaneData.ts, fuelDatabase.ts). Keep one-time `migrateReferenceLaps()` sync — it runs at startup only and that is permitted by R6.1.
- [ ] **L2** Memoize YAML parse on `currDataVersion` ([irsdk-node.ts:229](../src/app/irsdk/node/irsdk-node.ts#L229)) — confirmed by tests as a startup _memory_ concern in addition to a CPU one
- [ ] **L3** Add `process.on('uncaughtException')` and `process.on('unhandledRejection')` handlers in [main.ts](../src/main.ts)
- [ ] **P6** Pause broadcasts to non-visible windows (`webContents.isVisible()`)

**Exit criteria:** all HIGH/MEDIUM security findings closed; no sync I/O on the main thread outside startup; global error handlers registered.

### Phase 1 — Cheap perf wins + lifecycle bones

**Perf wins** (original scope):

- [ ] **P2/P3/P4** Switch raw float subscriptions to `useTelemetryValuesRounded` per the precision table in `ARCHITECTURE_RULES.md`
- [ ] **P5** Custom `propsAreEqual` on `memo(DriverInfoRow)` (or pre-compute primitive props in the parent)
- [ ] **P1 interim** Trim the IPC payload — drop string-typed and unused vars at the bridge before broadcast

**Lifecycle bones** (pulled forward from Phase 2 after Practice 2 confirmed P7):

- [ ] **A2 (skeleton)** Introduce `src/app/sessionLifecycle/` event source: `onDriverJoined(carIdx)`, `onDriverLeft(carIdx)`, `onSessionNumChange()`, `onDisconnect()` — wired up to `iracingSdkBridge`
- [ ] **L5 + A7 (leaking bridges)** Replace module-global callback `Set`s in `iracingSdkBridge` and `dashboardBridge` with per-window subscription maps + driver-keyed cleanup on `onDriverLeft`
- [ ] **A3 (start)** Wire `useResetOnDisconnect` (currently dead) to the new event source for the stores it already covers; remove the dead-code label

**Exit criteria:**

- ≥50 % reduction in renderer wake-ups per second at full grid
- In-race steady-state memory slope < +5 MB/min (single-class AI 40-car)
- **Per-joining-driver permanent memory cost < 1 MB** (real multiplayer, Practice 2 replay)
- Re-run Phase 0 test matrix and append the deltas to `PERFORMANCE_TEST_SUMMARY.md`

### Phase 2 — Architectural cleanup

_Note:_ The highest-impact pieces of A2/A3/L5/A7 ship in Phase 1. Phase 2 finishes the migration.

- [ ] **A1** Extract `frontend/domain/` from `Standings/`; lint forbids cross-widget imports
- [ ] **A2/A3 (completion)** Migrate _every_ remaining store to register reset handlers with `sessionLifecycle`; delete `useResetOnDisconnect` once unused; add `onEnter`/`onExit` events; distinguish live vs replay
- [ ] **A4** Replace god-files with self-registering `WidgetDefinition`
- [ ] **A5** Remove hardcoded `'default'` profile from `overlayManager.ts`
- [ ] **A6** Add `version: number` per widget settings; introduce `src/types/migrators/<widget>.ts` registry
- [ ] **A7 (completion)** Roll out `defineBridge<I>(channel, impl)` helper to the remaining 6 bridges (the 2 driving P7 are done in Phase 1)
- [ ] **A9** `npm run check:generated-types` script + CI guard

### Phase 3 — Channel-based bridge

- [ ] `publishChannel` / `useChannelSnapshot` plumbing
- [ ] Per-window subscription map driven by preload `subscribe(channels[])`
- [ ] Pilot migration: Fuel widget runs entirely off `'fuel.projection'`

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

6. **Empty-dashboard baseline test** _(HIGH priority — gates Phase 1 success criteria)_ — does the leak persist with zero widgets?
7. **Single-widget isolation tests** _(HIGH)_ — per-widget leak rate, identifies heaviest widget(s)
8. **Reference-lap A/B** _(LOW, downgraded after Practice 2)_ — does an existing reference lap raise the steady-state slope on top of P1?
9. **PCC dashboard config delta** _(MEDIUM)_ — which widget(s) explain PCC's much lower leak rate?
10. **NetworkService allocation** _(MEDIUM)_ — is the multi-class 178 MB jump PostHog?
11. **Sync-I/O tick-dip correlation** _(LOW)_ — are `writeFileSync` calls causing the tick dips?
12. ~~Early-session step-change cause~~ — **RESOLVED 2026-05-12 by Practice 2**: driver joins are the cause; produced finding P7
13. **Cumulative driver-join cost in long sessions** _(MEDIUM, new)_ — does per-joiner cost plateau (state keyed by stable car ID) or grow unboundedly across a 2-hour open practice? PERFORMANCE_TEST_SUMMARY §6.8

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

- **2026-05-13** — Phase 1 perf wins + lifecycle bones: P2/P3/P4 CarIdxLapDistPct rounded (3dp/4dp) in 9 files; P5 DriverInfoRow custom memo comparator; P1 interim IPC payload trimmed ~340->~60 keys via TELEMETRY_ALLOWLIST; A2 `src/app/sessionLifecycle/` created + wired to iracingSdkBridge; A3 `useResetOnDisconnect` activated in OverlayContainer; 775/775 tests pass — `feat/phase-1-perf-and-lifecycle` — in progress
- **2026-05-12** — Practice 2 results incorporated: new finding P7 (driver-join leak, ~5–6 MB/joiner); A2/A3/L5/A7 reclassified CONFIRMED; SessionLifecycle skeleton + leaking-bridge cleanup pulled forward from Phase 2 into Phase 1; Q12 resolved; Q13 added; per-joiner-cost row added to Phase 0 baseline table — `chore/architecture-review-perf-update` — in progress
- **2026-05-11** — Phase 0 evidence written up; architecture review being updated with empirical findings — `chore/architecture-review-perf-update` — in progress
- **2026-05-11** — Initial Phase 0 measurement complete — `main` — `docs/PERFORMANCE_TEST_SUMMARY.md` committed
- **2026-05-11** — Architecture documents created (review + rules + AGENTS.md pointer) — `main` — landed
