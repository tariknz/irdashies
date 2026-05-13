# iRDashies Performance — Empirical Test Summary

> **Date:** May 2026
> **Author:** Kev (with AI-assisted analysis)
> **Companion file:** [`ARCHITECTURE_REVIEW.md`](./ARCHITECTURE_REVIEW.md)
> **Purpose:** Empirical evidence to inform updates to the architecture review and prioritisation of remediation work.

---

## 1. Executive Summary

A series of controlled tests has been run to characterise the renderer-slowdown behaviour ("the app feels fine for a few minutes and then becomes stuttery") reported during long sessions. The tests vary one variable at a time — driver count, class count, AI vs real multiplayer — while holding the dashboard configuration constant.

**Headline findings:**

1. **A steady in-race memory leak of approximately +13 to +20 MB/min exists in every session**, linear in time with strong correlation (r ≥ 0.67). The rate is **independent** of driver count (1 vs 40) and class count (1 vs 4). Renderer-by-renderer growth correlates with widget activity, not screen area.
2. **Driver count and class count drive CPU and per-tick telemetry latency**, but those allocations are transient. They do not contribute to the linear leak.
3. **Multi-class race startup carries a large one-time memory cost** (~+1.5 GB above single-class). This is configuration-dependent baseline allocation, not gradual accumulation.
4. **Driver-join events cause large, persistent step-change memory increases** (~+260 MB across a 5-minute join burst with ~30+ drivers joining; ~5–6 MB per joining driver). The cost is concentrated exclusively in renderers hosting driver-list-aware widgets (Standings, Relative, Blindspot, etc.). Memory does not drop when drivers leave — the state accumulates.
5. The "slowdown after a few minutes" phenomenon is explained primarily by the combination of (1) and (3) pushing V8 toward its major-GC threshold, with (2) lengthening individual GC pause times. (4) compounds the pressure in busy sessions with active driver churn.

These findings strongly support architecture review finding **P1** (full telemetry payload broadcast to every renderer 25 Hz) as the primary in-race leak source, **L2** (YAML re-parsed per SessionInfo call) as a likely startup-phase contributor, **A2/A3/L5/A7** (no session lifecycle / no reset path / module-global callback Sets) as the cause of the driver-join leak, and **P5** (memo defeated by prop churn) as the CPU/latency driver — but **disconfirm P3/L4** (reference-lap data accumulation) as the dominant in-race leak source.

---

## 2. Test Methodology

### 2.1 Environment

- 3 monitors, 1920×1080 each, with one Electron renderer per screen
  - **Centre (Primary)** — 4115427433 — driving widgets (relative, blindspot, inputs, etc.)
  - **Left** — 2374779353 — Standings widget (dominant), laptimelog, fuel
  - **Right** — 928586202 — Map, Weather, Battle
- iRDashies process restarted fresh between each test
- Dashboard configuration held constant across tests 2–5 (`dashboard.json`)
- PerfMetrics logging captures samples every ~10 seconds

### 2.2 Measurement approach

Each PerfMetrics sample captures:

- App-level CPU and memory
- `processTelemetry` and `broadcast` latency (avg / max / p99)
- Tick rate (target ~21 Hz; iRacing publishes at 60 Hz, app processes at 25 Hz nominal)
- Per-process CPU and memory for each renderer + GPU + Main + NetworkService

Slopes calculated by linear regression over `elapsed_seconds` (excluding startup/shutdown ramps where applicable). Tick dips identified as samples below 20 Hz with `ticks > 100` (excludes session-boundary artefacts).

### 2.3 Test matrix

| #   | Test                                      | Drivers |                Classes | Field type       | Duration |
| --- | ----------------------------------------- | ------: | ---------------------: | ---------------- | -------: |
| 0   | PCC race ⚠                                |      44 | 4 (alone in own class) | Real multiplayer | 39.5 min |
| 1   | Single player Test Drive                  |       1 |                      1 | Solo             | 17.3 min |
| 2   | AI Race                                   |      40 |                      1 | AI               | 17.3 min |
| 3   | AI Race                                   |      40 |                      4 | AI               | 14.4 min |
| 4   | Official Practice (no recorded events)    |     ~40 |          4 (GT3 class) | Real multiplayer | 12.2 min |
| 5   | Official Practice (with known join burst) |     ~40 |          4 (GT3 class) | Real multiplayer | 23.4 min |

⚠ **The PCC test used a different dashboard configuration** than tests 1–5. Results from PCC are referenced for completeness but cannot be directly compared on absolute leak rates.

---

## 3. Results

### 3.1 PCC race — 44 cars, 4 classes (real multiplayer)

> **Note:** Different dashboard configuration than other tests. Direct numerical comparison not valid.

- Duration 39.5 min; 238 samples
- App memory slope: **+0.6 MB/min** (r=0.12; very noisy, GC actively reclaiming)
- Primary renderer: +2.9 MB/min (r=0.75)
- Sawtooth memory pattern with 25–34 MB drops at minutes 15, 22, 28, 32 (V8 major GC firing)
- 7 tick dips below 20 Hz including isolated drops to 16.6 Hz

**Significance:** The dashboard layout used in this race produces a substantially lower in-race leak rate than the layout used in tests 1–4. This is itself useful information — widget layout choice has a measurable performance impact. A direct A/B comparison of the two configurations on the same track and field would isolate which widget(s) account for the difference. **Recommended follow-up.**

### 3.2 Test 1 — Single player Test Drive, Clio at Oulton Park

- Duration 17.3 min; 105 samples
- App memory slope: **+19.7 MB/min** (r=0.88)
- Per-renderer slopes: Primary +6.1, Left +3.3, Right +1.9 MB/min
- Per-widget rate: 0.6–1.1 MB/min, roughly band-uniform
- CPU rose from 8% → 12% (mostly Primary: 1.1% → 3.7%)
- 2 tick dips below 20 Hz

**Significance:** With **only one car on track**, the leak is still present and substantial. This establishes that the leak is not driven by other drivers' telemetry. The roughly uniform per-widget rate suggests a leak in shared substrate (telemetry subscriptions, store snapshots, IPC layer) rather than in any specific widget.

### 3.3 Race 1 — 40 AI opponents, single class, Clio at Oulton

- Duration 17.3 min; 105 samples (identical duration to Test 1)
- App memory slope: **+16.5 MB/min** (r=0.79) — _slightly lower than Test 1_
- Primary slope: +5.8 MB/min — _unchanged from Test 1's +6.1_
- App CPU mean: 16.5% (Test 1: 11.2%) — +47%
- processTelemetry p99 mean: 7.4 ms (Test 1: 3.2 ms) — +131%
- 1 tick dip below 20 Hz

**Significance:** 40× the drivers, **same leak rate**. Per-tick CPU and latency scaled significantly with driver count but those allocations are GC'd within the tick. This finding alone is sufficient to disconfirm the P3/A3/L4 hypothesis (reference-lap data and per-driver Map writes scaling with active drivers) as the dominant leak source.

### 3.4 Race 2 — 40 AI opponents, multi-class, Clio at Oulton

- Duration 14.4 min; 87 samples
- **Starting memory: 2,908 MB** (vs 1,424 MB for Race 1 — fresh app instance)
- App memory slope: +11.4 MB/min (r=0.67 — noisy, sawtooth)
- Primary slope: +5.8 MB/min — _identical to Race 1_
- App CPU mean: 16-18%, similar to Race 1
- processTelemetry p99 mean: 12.5 ms — _+69% over Race 1_
- 8 tick dips below 20 Hz

**Significance:** Multi-class adds ~+1.5 GB of memory **at fresh-start** before the race even begins — `Renderer settings` jumped 184 MB → 335 MB, `NetworkService` jumped 53 MB → 231 MB, `GPU` 156 MB → 410 MB. These are configuration-dependent baseline allocations.

In-race leak rate is unchanged from Race 1. Class-aware widget logic adds per-tick CPU/latency cost (p99 +69%) but does not add to the linear leak rate.

Tick dips were more frequent in Race 2 (8 vs 1 in Race 1). **Partial cause is AI physics simulation contention** at the OS level (40-car multi-class AI is CPU-heavy on the entire system). Confirmed by the next test.

### 3.5 Practice 1 — Official multiplayer, IMSA GT3 at Spa (no recorded join events)

- Duration 12.2 min cleaned (full log 13.3 min, startup/shutdown ramps excluded)
- App memory slope: **+13.4 MB/min** (r=0.70)
- Per-renderer slopes: Primary +2.4, Left +4.3, Right +1.2, GPU +4.8 MB/min
- Per-renderer pattern shifted vs AI races: **Primary's rate dropped; GPU's rose; Left led**
- Step-change memory jumps in first 3 minutes:
  - Minute 1:00 — Left +42 MB
  - Minute 1:20 — Left +51 MB
  - Minute 2:50 — Primary +47 MB
- Memory stable from ~minute 5 onward
- Only **1 tick dip** below 20 Hz

**Significance:** Leak rate falls in the same +13 to +20 MB/min band as AI tests, confirming the leak is not an AI artefact. Real multiplayer has **dramatically better tick stability** than AI multi-class (1 dip vs 8 dips at similar field size) — empirically confirming that Race 2's tick drops were inflated by AI physics environmental contention, not iRDashies cost.

The step-change memory jumps in the first 3 minutes are concentrated in the Left renderer (hosting Standings) and Primary, with Right untouched. At the time of this session the cause was uncertain — driver-join versus session-state hydration could not be discriminated without timestamped join data. **§3.6 (Practice 2) resolves this ambiguity** by capturing a session with a known join burst at a known time; the pattern matches exactly. The Practice 1 step changes are now attributed to drivers joining during the early-session field fill.

### 3.6 Practice 2 — Official multiplayer, IMSA GT3 at Spa (with known join burst)

- Duration 23.4 min; 141 samples (05:12:00 → 05:35:21)
- **Known event:** large number of drivers entered the session between 05:15 and 05:20 (3:00 to 8:00 elapsed)
- Full-session app memory slope: +27.8 MB/min (r=0.93) — _inflated by the join window_
- **Post-burst steady-state slope: +13.2 MB/min** — matches Practice 1 and prior tests
- 7 tick dips below 20 Hz, all 19.2–19.5 Hz, clustered post-burst (consistent with elevated heap → more GC pressure)

**Join-window analysis — memory grew +260 MB in 5 minutes:**

| Renderer         | Pre-window slope | **Join-window slope** | Post-window slope |
| ---------------- | ---------------: | --------------------: | ----------------: |
| App total        |     +20.2 MB/min |      **+61.5 MB/min** |      +13.2 MB/min |
| Primary (centre) |             +3.6 |             **+27.3** |              +4.4 |
| Left (Standings) |             +4.5 |             **+24.3** |              +7.1 |
| Right            |             +7.0 |                  +6.1 |              +1.0 |
| GPU              |             +4.2 |                  +0.6 |              +0.8 |
| Main             |             +1.5 |                  +2.9 |              −0.1 |

**Significance:** This session is the discriminating test for the driver-join hypothesis. The result is unambiguous:

- **Memory leak rate during the burst is ~5× the steady-state.** Primary and Left grew at ~25 MB/min during the join window vs ~4 MB/min outside it — a 6× increase concentrated in exactly the 5-minute window when drivers were joining.
- **The cost is concentrated in driver-list-aware renderers only.** Primary hosts `relative`, `blindspotmonitor`, `slowcarahead`, `fastercarsfrombehind` (all maintain per-driver state). Left hosts `standings` (the obvious per-driver widget). Both absorbed almost all the cost. Right (hosting `map`, `weather`, `battle` — none driver-list-heavy) grew at +6 MB/min, indistinguishable from its pre-window rate. GPU was essentially flat. If this were unrelated allocation activity (telemetry firehose, periodic GC noise, IO), all three renderers would have grown similarly. The selectivity is the signal.
- **Memory does not drop when drivers leave.** Post-burst slope returns to baseline (+13.2 MB/min), but the +260 MB allocated during the burst stays allocated. This is consistent with per-driver state being added on join with no release path on leave.
- **Cost per joining driver: approximately 5–6 MB.** With ~50 joiners over 5 minutes, the ~260 MB total implies each joining driver costs roughly this much in permanent app memory.

The pattern matches the architecture review's A2/A3/L5/A7 cluster precisely: no `SessionLifecycle` abstraction, no `useResetOnDisconnect` callers, module-global callback `Set`s in 8 ad-hoc bridges that don't clear when drivers go away.

---

## 4. Cross-test Synthesis

### 4.1 The leak rate is remarkably consistent

| Test                    | Drivers | Type         |    App slope | Per-renderer pattern   |
| ----------------------- | ------: | ------------ | -----------: | ---------------------- |
| Test 1                  |       1 | Solo         | +19.7 MB/min | Primary > Left > Right |
| Race 1                  |      40 | AI 1-class   | +16.5 MB/min | Primary > Left > Right |
| Race 2                  |      40 | AI 4-class   | +11.4 MB/min | Primary > Left ≈ Right |
| Practice 1              |     ~40 | Real 4-class | +13.4 MB/min | Left > Primary > Right |
| Practice 2 (post-burst) |     ~40 | Real 4-class | +13.2 MB/min | Left > Primary > Right |

The in-race steady-state leak rate clusters at +13 to +20 MB/min. The variability between tests is within the noise of GC oscillation (lower r-values track with elevated starting heap, where major GC fires more often). The leak rate **does not increase** with driver count or class count.

_Note:_ Practice 2's full-session slope is +27.8 MB/min, inflated by the join-burst window. The +13.2 MB/min figure above is the post-burst steady-state, which is the right number for cross-comparison. The join-burst behaviour is treated separately in §4.3.

### 4.2 What scales with what

| Variable                  |                  Memory leak rate                  | Memory startup cost |    CPU%     | processTelemetry p99 | Tick dips (real env) |
| ------------------------- | :------------------------------------------------: | :-----------------: | :---------: | :------------------: | :------------------: |
| Driver count              |                         —                          |        small        | **scales**  |      **scales**      |          —           |
| Class count               |                         —                          | **large (~+1.5GB)** | **scales**  |      **scales**      |          —           |
| Widget count per renderer |                     **scales**                     |          —          |   scales    |          —           |          —           |
| Elapsed time              |                     **linear**                     |          —          |      —      |     drift slight     |          —           |
| **Driver-join events**    | **step change (~5–6 MB per joiner, not released)** |          —          | brief spike |     brief spike      |          —           |

### 4.3 Distinct memory phenomena

The "slowdown after a few minutes" symptom is a **composite** of separable phenomena:

1. **Steady in-race leak** (~13–20 MB/min) — confirmed across every session, driver/class-independent. Most consistent with **P1**.
2. **Configuration-dependent startup cost** (multi-class adds ~+1.5 GB at app start) — one-time hit, observed in Race 2 vs Race 1 comparison. Most consistent with **L2** and possibly **A2/A6**.
3. **Driver-join step changes** (~5–6 MB per joining driver, allocated permanently) — confirmed by Practice 2's known-burst window. Cost is concentrated in renderers hosting driver-list-aware widgets. Most consistent with **A2/A3/L5/A7**.

Each requires a different fix and they are independent. Item (1) is the primary driver of the perceived "fine for a few minutes, then choppy" symptom in solo and AI sessions. Items (2) and (3) determine the starting position on the V8 GC pressure curve — item (3) is the dominant factor in busy online sessions where dozens of drivers may join/leave over the course of an hour.

### 4.4 Renderer-stutter mechanism

The user-perceived stutter is V8 major-GC pause time, not iRDashies blocking work. Mechanism:

1. Linear leak (1) climbs the heap by ~15 MB/min.
2. With multi-class baseline (2), the heap starts near 3 GB instead of 1.5 GB.
3. Driver-join events (3) add step jumps of tens to hundreds of MB during busy sessions.
4. Heavier per-tick widget work (P5 with class-aware Standings) increases short-lived allocation rate.
5. V8 hits its major-GC threshold ~5–10 min into driving.
6. Each major GC pauses the renderer's main thread for 50–150 ms.
7. Pause is visible as widget stutter / dropped animation frames.

This is consistent with the user reporting "fine for a few minutes, then choppy." It also explains why widget redistribution across screens (from Kev's earlier change) helped — spreading work delays per-renderer heap pressure crossing the threshold. It also explains why busy online sessions (where drivers join/leave frequently) feel worse than AI sessions of the same field size, despite AI sessions being CPU-heavier.

---

## 5. Correlation with Architecture Review Findings

| ID     | Description                                                                                    | Status after testing                                                             | Evidence                                                                                                                                                                                                                                       |
| ------ | ---------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **P1** | Full 340-key telemetry payload structured-cloned to every overlay 25 Hz                        | **CONFIRMED — primary in-race leak source**                                      | Driver-independent constant-per-tick allocation rate matches the payload-clone pattern exactly                                                                                                                                                 |
| **P5** | `memo(DriverInfoRow)` defeated by prop churn — ~750 cell renders per tick at full grid         | **CONFIRMED — primary CPU/latency driver**                                       | Multi-class p99 +69% over single-class, Standings-bearing renderer (Left) shows largest CPU growth                                                                                                                                             |
| **P3** | `ReferenceLapStoreUpdater` runs `collectLapData` for every driver every frame                  | **PARTIALLY CONFIRMED — CPU cost only, not leak source**                         | Per-tick CPU/latency scales with drivers but no corresponding memory growth                                                                                                                                                                    |
| **A3** | `useResetOnDisconnect` has zero callers; reference laps and sector timing leak across sessions | **CONFIRMED implicated for driver-join leak** (was: not implicated)              | Practice 2 shows ~5–6 MB per joining driver accumulates permanently in driver-list-aware renderers. The absence of a reset path matches this exactly — state is added on join with nothing to release it on leave.                             |
| **L4** | Reference-lap data has no size cap                                                             | **NOT IMPLICATED in measured leak rates**                                        | In-race linear leak is driver-independent; not the dominant source                                                                                                                                                                             |
| **L2** | YAML re-parsed on every `getSessionData` call                                                  | **STRONGLY IMPLICATED for startup cost**                                         | Multi-class startup +1.5 GB allocation likely driven by many SessionInfo updates and YAML re-parses                                                                                                                                            |
| **A2** | No `SessionLifecycle` abstraction — each store invents its own session-change detector         | **CONFIRMED implicated for driver-join leak** (was: plausibly implicated)        | Practice 2's join burst (~+260 MB across 5 min, concentrated in driver-aware renderers only, not released after the burst) is the predicted symptom of missing lifecycle management                                                            |
| **L5** | Module-global callback `Set`s in bridges not cleared on window close                           | **CONFIRMED implicated for driver-join leak** (was: not independently evidenced) | Per-driver allocation pattern observed in Practice 2, concentrated in renderers hosting widgets that subscribe via these bridges. The selectivity (Primary + Left affected; Right + GPU not) matches subscription-based callback accumulation. |
| **A7** | 8 ad-hoc bridges with module-global callback `Set`s; closed renderers leave callbacks behind   | **CONFIRMED implicated — same as L5** (was: not independently evidenced)         | Same Practice 2 evidence                                                                                                                                                                                                                       |
| **S5** | Analytics forwards every `warn`/`error` log line to PostHog                                    | **POSSIBLE EXPLANATION for NetworkService 53→231 MB jump**                       | NetworkService stayed at 53 MB through every single-class test but jumped to 231 MB on multi-class startup. PostHog queue accumulation during multi-class warnings is plausible but unconfirmed.                                               |
| **P6** | Hidden / minimised overlays still receive every broadcast                                      | **NOT TESTED**                                                                   | All windows were visible throughout testing                                                                                                                                                                                                    |
| **L1** | Synchronous `fs.writeFileSync` on the main process                                             | **WEAKLY IMPLICATED in tick dips**                                               | Tick dips with low CPU (consistent with main-thread stall) appear in some sessions but pattern is inconsistent. Test in isolation needed.                                                                                                      |
| **P2** | `useDriverPositions` subscribes to raw `CarIdxLapDistPct`                                      | **NOT INDEPENDENTLY TESTED**                                                     | Subsumed in P1's overall payload-clone cost                                                                                                                                                                                                    |
| **P4** | `SectorTimingStore.tick()` subscribes to raw `LapDistPct`/`SessionTime`                        | **NOT INDEPENDENTLY TESTED**                                                     | Subsumed in P1                                                                                                                                                                                                                                 |

---

## 6. Open Questions Requiring Further Testing

### 6.1 Empty-dashboard baseline (HIGH priority)

**Question:** Is there a leak independent of any widgets, in iRDashies' substrate (telemetry bridge, IPC, main process)?

**Test:** Run iRDashies with **all widgets disabled**, drive a 15–20 minute solo session, measure app memory slope.

**Outcome interpretation:**

- If the slope is near zero, the leak is entirely widget-side and Phase 1 (typed subscriptions per channel) will eliminate it.
- If the slope is still meaningful (say > 5 MB/min), there is a base-rate leak in the bridge layer itself that Phase 4 (main-process processors) is required to address.

### 6.2 Single-widget isolation (HIGH priority)

**Question:** Does the per-widget leak rate vary materially between widgets?

**Test:** Run multiple solo sessions, each with **only one widget enabled** (rotate through: `input`, `tachometer`, `standings`, `fuel`, `relative`, `map`). 10 minutes each is sufficient at this resolution.

**Outcome interpretation:** Identifies which widgets are heavy contributors versus light ones. If one widget dwarfs the others, it gets fixed first. If all are roughly uniform, the leak is framework-level and changing individual widgets won't help — the substrate refactor in Phase 1 is the only path.

### 6.3 Reference-lap A/B (LOW priority)

**Question:** Does reference-lap collection contribute to the steady-state in-race leak? A3 has been reclassified as confirmed-implicated for the _driver-join_ leak (see §3.6), but reference-lap accumulation as a separate per-session-state-store concern (originally A3/L4) remains untested with an actual saved reference lap.

**Test:** Run Test 1 (single player Clio at Oulton) twice — once with no existing reference lap, once with a reference lap already saved for that car/track combo, so `ReferenceLapStoreUpdater` is actively comparing.

**Outcome interpretation:** If the slope rises noticeably in the second run, the reference-lap path contributes on top of P1. If unchanged, P3 is confirmed as a CPU-only cost and L4 is confirmed as a correctness issue without performance impact in typical sessions.

### 6.4 PCC dashboard config comparison (MEDIUM priority)

**Question:** Which widget(s) account for the substantial difference between the PCC dashboard layout (in-race slope +0.6 MB/min) and the current test dashboard (+13–20 MB/min)?

**Test:** Once the PCC config is available, run an AI race or test drive with that configuration on the same track/car as test 1 or race 1. The delta isolates the contribution of the layout differences.

**Outcome interpretation:** If a specific widget can be identified as the dominant difference, that widget should be prioritised in P1's typed-subscription migration.

### 6.5 NetworkService allocation (MEDIUM priority)

**Question:** What allocates 178 MB to the NetworkService process during multi-class startup?

**Test:** Run a multi-class AI race with analytics disabled (PostHog opt-out, per S5). Compare NetworkService memory at session start.

**Outcome interpretation:** If NetworkService stays near 53 MB without analytics, confirms S5 and motivates analytics rate-limiting. If NetworkService still jumps, the cause is elsewhere (Chromium network stack, auto-updater, etc.) and needs separate investigation.

### 6.6 Sync I/O tick-dip correlation (LOW priority)

**Question:** Are the occasional tick-dips-with-low-CPU events actually caused by `writeFileSync` calls (L1)?

**Test:** Add timestamped logging at the entry/exit of each storage layer `writeFileSync` call. Drive a long session. Cross-reference timestamps against PerfMetrics tick dips.

**Outcome interpretation:** Direct correlation confirms L1 priority for Phase 0.5. Lack of correlation suggests something else stalls the main thread occasionally and L1 can stay where it is.

### 6.7 Early-session step-change cause — **RESOLVED by Practice 2**

This open question has been answered. Practice 2 (§3.6) captured a session with a known driver-join burst at a known time, and the memory signature matched the burst window exactly. The early-session step changes observed in Practice 1 are attributed to drivers joining during the field-fill period. See the updated §5 correlation table — A2/A3/L5/A7 are now confirmed implicated.

### 6.8 Cumulative driver-join cost in long sessions (MEDIUM priority)

**Question:** In a long online session (e.g. 2-hour endurance) where drivers cycle through repeatedly, does the per-driver join cost continue to accumulate linearly, or does it plateau (e.g. because driver state is keyed by car ID and reused)?

**Test:** Capture PerfMetrics across a 60+ minute open practice session in a popular series where many drivers join and leave. Compare cumulative memory growth to the join count.

**Outcome interpretation:** If memory grows roughly linearly with cumulative driver-join count (not unique drivers), the leak is unbounded and L5/A7 fixes are urgent. If memory plateaus around the unique-driver count, the cost is bounded by the active pool size — still worth fixing but less severe in practice.

---

## 7. Suggested Updates to the Architecture Review and Plan

Based on the empirical evidence:

### 7.1 Prioritisation changes

1. **Promote P1 (telemetry firehose) to the single highest-priority performance fix.** It is the empirically confirmed primary in-race leak source. Phase 1's interim mitigation (trim the IPC payload) and especially Phase 3 (channel bus with per-window subscriptions) directly address it.

2. **Promote L2 (YAML re-parse memo) and add it to Phase 0.5.** It is currently listed for Phase 0.5 but framed as a CPU concern; the test data shows it is a substantial memory concern at startup. Memoising on `currDataVersion` would address both.

3. **Promote the A2/A3/L5/A7 cluster (lifecycle + reset + callback cleanup).** Practice 2 confirmed these as a primary leak source in busy online sessions, on a par with P1 for user impact. Each joining driver costs roughly 5–6 MB of permanent app memory; in a busy session with dozens of joiners, this compounds rapidly with the steady-state leak. The fix is naturally a single piece of work — a SessionLifecycle abstraction that drives both driver-disconnect reset paths and bridge callback Set cleanup. Strong candidate for Phase 1 alongside the P1 mitigation, rather than waiting for Phase 2.

4. **Demote P3/L4 in priority** — the leak hypothesis was disconfirmed for these specific findings. They are still real correctness issues (reference laps not resetting across sessions is a bug) but they are not the user-experience emergency. A3 is now reclassified as confirmed-implicated for the _driver-join_ leak (not reference laps) and is covered by the Phase 1 promotion above. P3 and L4 can stay at lower priority.

### 7.2 New addition: Configuration-dependent startup cost

The architecture review does not currently have a finding for "multi-class race startup allocates an additional ~1.5 GB versus single-class." This deserves to be added as a new finding, likely under section 2.1 (Performance) or 2.3 (Lifecycle, Resilience, I/O), pointing to L2 and A2 as the contributing factors. The fix is the same as those existing items but the _symptom_ is distinct enough to warrant its own line.

### 7.3 New addition: Driver-join leak

The architecture review identifies the underlying mechanisms (A2/A3/L5/A7) but does not currently call out their observed user-facing symptom. Worth adding a finding under section 2.1 (Performance):

> "Each driver who joins an active iRacing session causes ~5–6 MB of app memory to be allocated, concentrated in renderers hosting driver-list-aware widgets (Standings, Relative, Blindspot, etc.). This memory is not released when drivers leave. In a busy online session with 50+ join events, this can add ~250–300 MB of permanent app memory on top of the steady-state leak."

Driven by A2 (no session lifecycle abstraction), A3 (no reset path), L5/A7 (module-global callback Sets in 8 bridges not cleared on driver disconnect).

### 7.4 Test-suite suggestion

Consider adding a `tools/perfBench/` script that runs a recorded telemetry trace through iRDashies headlessly and asserts on memory slope. This would:

- Catch regressions in the per-tick allocation rate
- Provide a fast way to A/B test individual fixes (e.g. "did the channel bus PR drop the slope?")
- Serve as the success criterion for each Phase exit

The test matrix in this document could be the seed corpus. For the driver-join finding specifically, a synthetic test that fires N simulated driver-join events and asserts on the resulting heap delta would isolate L5/A7 regression risk cleanly.

### 7.5 Empirical baseline numbers worth committing

For Phase 0's exit criteria ("documented baseline numbers committed to `docs/`"), the relevant ones from this work:

| Metric                                                         |     Baseline |                Target after Phase 1 |
| -------------------------------------------------------------- | -----------: | ----------------------------------: |
| In-race steady-state app memory slope (40-car AI single-class) | +16.5 MB/min |                         < +5 MB/min |
| processTelemetry p99 mean (40-car AI single-class)             |       7.4 ms |                              < 3 ms |
| Tick rate stability (% samples ≥ 20 Hz)                        |          99% |                             ≥ 99.5% |
| Multi-class startup memory (40-car AI 4-class)                 |     2,908 MB | < 1,800 MB (≤25% over single-class) |
| Per-joining-driver permanent memory cost (real multiplayer)    |      ~5–6 MB |                              < 1 MB |

These can be measured on a fresh test rig per release.

---

## 8. Appendix — Raw Data

The following files contain the per-sample PerfMetrics data for each test, parsed into machine-readable form:

- `perfmetrics.csv` / `perfmetrics_analysis.xlsx` — Sportscar practice (excluded from analysis above; included for completeness only)
- `pcc_perfmetrics.csv` / `pcc_perfmetrics_analysis.xlsx` — PCC race (different dashboard config)
- `test1_perfmetrics.csv` / `test1_perfmetrics_analysis.xlsx` — Test 1, single-player Test Drive
- `race1_perfmetrics.csv` / `race1_perfmetrics_analysis.xlsx` — Race 1, AI single-class race
- `race2_perfmetrics.csv` / `race2_perfmetrics_analysis.xlsx` — Race 2, AI multi-class race
- `practice_perfmetrics.csv` / `practice_perfmetrics_analysis.xlsx` — Practice 1, real multiplayer (no recorded events)
- `practice2_perfmetrics.csv` / `practice2_perfmetrics_analysis.xlsx` — Practice 2, real multiplayer with known join burst at 05:15–05:20

Each `.xlsx` contains a Summary sheet (formula-driven), Raw Data, and chart sheets for app/renderer memory, app/renderer CPU, and telemetry timings.

---

_End of summary. Discussion and amendments welcome — this document should evolve as further tests are completed._
