# iRDashies Performance — Test Log

> **Purpose:** Running record of empirical performance testing across remediation phases. Updated as new tests are completed.
> **Companion documents:** [`ARCHITECTURE_REVIEW.md`](./ARCHITECTURE_REVIEW.md), [`PERFORMANCE_TEST_SUMMARY.md`](./PERFORMANCE_TEST_SUMMARY.md)
> **Audience:** Project contributors and Claude Code instances reasoning about performance changes.

---

## How to use this document

This document tracks every PerfMetrics-based performance test run against iRDashies, in chronological order. Each entry records what was tested, what the measurements showed, and how the result correlates with architecture review findings.

**For Claude Code instances:**

- The most recent entry in §3 reflects current performance state. Use it as the baseline when reasoning about whether a proposed change has performance implications.
- §4 ("Current Status of Architecture Findings") is the authoritative live record of which findings are confirmed, disconfirmed, or open. Update it when a new test resolves a finding.
- When implementing a remediation phase, refer to §5 ("Targets and Goals") for the metrics that define success.
- After completing a remediation phase, add a new entry to §3 with the post-change measurements and update §4 accordingly.

**For human contributors:**

- Add new test entries to §3 (newest at the top). Use the template in §6.
- Update the status table in §4 when a finding moves between confirmed / open / disconfirmed.
- Update §5 when targets are met or revised.

---

## 1. Test Methodology

### 1.1 Hardware/environment

- 3 monitors, 1920×1080 each, one Electron renderer per screen
  - **Centre (Primary)** — `4115427433` — driving widgets (relative, blindspot, inputs, etc.)
  - **Left** — `2374779353` — Standings widget (dominant), laptimelog, fuel
  - **Right** — `928586202` — Map, Weather, Battle
- iRDashies process restarted fresh between each test (no carry-over from prior sessions)
- Standard dashboard configuration held constant across tests unless noted

### 1.2 Measurement source

Each PerfMetrics sample (logged every ~10 seconds) captures:

- App-level CPU and memory
- `processTelemetry` and `broadcast` latency (avg / max / p99)
- Tick rate (target ~21 Hz; iRacing publishes at 60 Hz, app processes at 25 Hz nominal)
- Per-process CPU and memory (each renderer + GPU + Main + NetworkService + Settings renderer)

### 1.3 Analysis approach

- Slopes calculated by linear regression of memory vs `elapsed_seconds`
- Cleaning rule: exclude samples with `tick_hz <= 18` AND `ticks <= 100` (filters out startup/shutdown ramps)
- Tick dips identified as cleaned samples below 20 Hz
- Step changes identified by ranking single-sample `app_mem_mb` deltas

---

## 2. Test Scenarios

The standard test scenarios. Use these names consistently when adding entries.

| Name                         | Drivers | Classes | Field type       | Notes                                                     |
| ---------------------------- | ------: | ------: | ---------------- | --------------------------------------------------------- |
| **Solo Test Drive**          |       1 |       1 | Solo             | Single car on track, no opponents                         |
| **AI Race 1-Class**          |      40 |       1 | AI               | Single-class AI race, 40 cars                             |
| **AI Race Multi-Class**      |      40 |       4 | AI               | Multi-class AI race, 40 cars                              |
| **Practice (real, quiet)**   |     ~40 |       4 | Real multiplayer | Stable field, no known join activity                      |
| **Practice (real, joiners)** |     ~40 |       4 | Real multiplayer | Field actively filling with joiners                       |
| **Empty Dashboard**          |  varies |  varies | any              | All widgets disabled — substrate baseline                 |
| **Single-Widget**            |  varies |  varies | any              | Only one widget enabled — used to isolate per-widget cost |

When new scenarios are added (e.g. to test specific findings), document them here.

**Important test-conditions variable: iRDashies startup timing relative to iRacing.** Practice 5 surfaced that opening iRDashies _while iRacing is loading into a session_ costs ~+1 GB of baseline memory compared to opening it _after the session is settled_. When recording a test entry, note which condition applies. The "post-load" startup is the cleaner methodology for steady-state slope measurements; the "during session-load" startup is a legitimate user scenario worth measuring separately and currently has its own row in §5.

---

## 3. Test Entries

> Newest at the top. Each entry follows the template in §6.

---

### 2026-05-14 · Post-Phase 2a (Tier 1: H3 + H4) · Practice (real, joiners) · IMSA GT3 at Road Atlanta

**Scenario:** Practice (real, joiners) — active driver churn throughout. **Important context:** iRDashies was started while iRacing was loading into the session, capturing the session-load hydration burst.
**Build:** Post-Phase 2a (H3: no spurious `reset()` at boot; H4: defer cloning in `PitLapStore.updatePitLaps` on uneventful ticks; SessionLifecycle abstraction partly wired up)
**Source logs:** `OfficialPractice5-IMSA-GT3-RoadAtlanta.txt` (PerfMetrics) + boot log showing renderer/lifecycle events
**Spreadsheet:** `practice5_perfmetrics_analysis.xlsx`

**Top-line numbers (cleaned, 16.8 min, 102 samples) — slopes over comparable 7-min window (minute 1.5–8.5):**

| Renderer             | P2 (pre-fix) |  P3 (Post-1) | P4 (Post-2a, 8.7 min) |                        **P5 (Post-2a, 16.8 min)** |
| -------------------- | -----------: | -----------: | --------------------: | ------------------------------------------------: |
| App total            | +50.8 MB/min | +18.9 MB/min |          +20.1 MB/min |                                  **+11.4 MB/min** |
| Primary              |        +20.6 |         +0.2 |                  +0.5 |                                          **+0.6** |
| **Left (Standings)** |        +18.5 |        +13.0 |                  +9.2 |                                          **+0.7** |
| Right                |         +6.0 |         +0.4 |                  +1.6 |                                              +1.1 |
| GPU                  |         +3.2 |         +2.8 |                  +6.6 | **+3.1** (P4's elevated number was session noise) |
| Main                 |         +2.4 |         +2.7 |                  +2.3 |                                              +6.0 |

**Findings:**

1. **The H4 fix decisively resolves the Standings steady-state leak.** Left renderer slope dropped from +13.0 MB/min (Post-Phase-1) to +0.7 MB/min — **a 95% reduction**, comfortably under the <+2 MB/min target. Eliminating the 25 Hz × 4-array PitLapStore clone storm on uneventful ticks is the dominant Standings memory contributor.
2. **Memory trajectory shows a clear plateau.** App memory climbs through the early hydration phase (minutes 0–1.5), then stabilises at ~2,940–2,990 MB for ~8 minutes with GC drops of 23–28 MB matching small upward steps. Steady-state behaviour has been achieved — qualitatively different from any pre-fix session.
3. **GPU regression from Practice 4 was session noise.** P4 showed +8.1 MB/min full-session and +6.6 MB/min in the comparable window. P5 shows +3.1 MB/min in the comparable window and +1.0 MB/min over the full post-startup range. The P4 number was a short-session / low-starting-heap artefact. Watch item closed.
4. **Phase 2a partially wired up the SessionLifecycle abstraction (A2).** Boot logs show `[sessionLifecycle] Driver joined: carIdx=N` events firing for each driver as iRacing populates. This is the A2 abstraction starting to land. However, the test surfaced **two new issues** with the implementation — see "Critical findings from boot log" below.
5. **Per-joining-driver cost is unchanged (~5 MB/joiner across renderers).** A driver-join cluster at minute 8.5 added ~90 MB (Primary +31, Left +23). This is consistent with the H3/H4 fixes not being designed to address driver-join lifecycle. A2/A3 work is still needed.
6. **CPU and latency slightly elevated vs P3/P4 baselines.** App CPU 17.7% (vs P3's 14.6%), processTelemetry p99 7.15 ms (vs P3's 5.23 ms). This is largely explained by the elevated starting heap — V8 GC pause times scale with heap size. Same scenario at a normal post-load starting heap would likely show better numbers.
7. **Tick stability remains excellent.** Zero sub-20 Hz dips in 16.8 minutes despite the elevated heap and driver churn.

**Critical findings from boot log (new):**

The boot log captured between iRDashies start (21:17:14) and the user starting to drive revealed two issues that PerfMetrics alone could not show:

1. **Reference lap fetch fires 3× per class (once per renderer instead of once per app).** When iRacing connects at 21:18:36, the log shows:
   ```
   Fetching reference lap for Series: 539, Track: 127, Class: 2523  (×3)
   Fetching reference lap for Series: 539, Track: 127, Class: 4011  (×3)
   Fetching reference lap for Series: 539, Track: 127, Class: 4029  (×3)
   ```
   Nine fetches instead of three. Each renderer is independently requesting reference data on its own SessionInfo event, and the main process is dutifully fetching the same data per request. This is a per-renderer duplication of work that should be app-singleton, and it costs both I/O and memory (3× the reference lap state stored across renderers).
2. **The disconnect path does not fire driver-leave events.** The log shows iRacing's connection state bouncing 3 times in 6 seconds during session-load (typical during iRacing's startup). Each `iRacing is running` event fires 41–44 `Driver joined` events. But the corresponding `iRacing is no longer publishing telemetry` events at 21:18:37 and 21:18:41 fire only a single `[sessionLifecycle] Disconnect detected` — **no per-driver leave events follow.** If the disconnect handler isn't releasing per-driver state, the second and third reconnects allocate fresh state on top of existing state. In this single session-load, ~129 driver-slot allocations were made for only 44 distinct drivers.

This is the A2/A3 finding only partly addressed: Phase 2a wired up join detection but not leave cleanup.

**Reproducible: opening iRDashies during iRacing session-load costs ~+1 GB baseline.**

App memory at first PerfMetrics sample was 2,417 MB, ~1 GB higher than P2 (1,453), P3 (1,419), and P4 (1,266) — all of which opened with iRacing already in a stable session. The cause is now understood: the rapid SessionInfo churn during session-load fires repeated reference-lap fetches, repeated driver-joined events, and (per the boot log) at least 2 connect/disconnect cycles before the session settles. Each cycle allocates state that the current implementation does not fully release. This is a real user-facing scenario any time someone boots the app after queueing for a session.

**Correlation with architecture review:**

| Finding                                              | Status                                          | Evidence from this run                                                                                          |
| ---------------------------------------------------- | ----------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| H4 — `PitLapStore.updatePitLaps` allocation storm    | **CONFIRMED implicated; FIX VALIDATED**         | Left renderer slope −95% (P3 +13 → P5 +0.7 MB/min)                                                              |
| H3 — spurious `reset()` at boot                      | **CONFIRMED implicated; FIX APPEARS VALIDATED** | Boot log shows no "Resetting lap time history" duplicates; effect on this run masked by session-load conditions |
| **Reference lap fetch per-renderer** (new)           | **NEW FINDING — confirmed implicated**          | 3× duplication on connect; should be app-singleton                                                              |
| **Disconnect leave cleanup** (new sub-finding of A3) | **CONFIRMED implicated; still outstanding**     | Boot log shows disconnects detected but no per-driver leave events emitted                                      |
| A2 — SessionLifecycle abstraction                    | **PARTIALLY FIXED** (was: confirmed implicated) | Join detection wired up; leave cleanup not                                                                      |
| A3 — `useResetOnDisconnect` has zero callers         | **Still implicated**                            | Disconnect path doesn't trigger per-driver cleanup                                                              |
| P1/P2/P4/P5                                          | Unchanged from Post-Phase-1                     | Continue holding                                                                                                |
| GPU regression (was tracking from P3→P4)             | **CLOSED — session noise**                      | P5 shows GPU back to P3-like levels                                                                             |

**Recommendations:**

1. **Fix the reference-lap fetch duplication.** Smallest change with measurable impact on session-load cost — move the fetch from per-renderer to per-app and broadcast results.
2. **Complete A3: implement disconnect leave cleanup.** When `sessionLifecycle` detects disconnect, it should fire per-driver leave events that release the state allocated during join. The fact that join events are now logged makes this easy to test — the leave path should produce a matching set of leave events.
3. **Reconsider H1 (`createDriverStandings` rewrite) prioritisation.** With Standings at +0.7 MB/min (under target), the original rationale for H1 ("Standings is the remaining leak") is no longer accurate. H1 may still be worth doing for code-quality reasons or to enable per-slot subscriptions, but it's no longer urgent for performance.
4. **Document the "opened during session-load" scenario as a known cost class.** It's reproducible and points at known remediation work (reference-lap fetch dedup, A3 disconnect cleanup).

---

### 2026-05-14 · Post-Phase 2a (Tier 1: H3 + H4) · Practice (real, joiners) · IMSA GT3 at Road Atlanta · short run

**Scenario:** Practice (real, joiners) — same setup as P5, but short session terminated before reaching steady state
**Build:** Post-Phase 2a (same as P5)
**Source log:** `OfficialPractice4-IMSA-GT3-RoadAtlanta.txt`
**Spreadsheet:** `practice4_perfmetrics_analysis.xlsx`

**Top-line numbers (cleaned, 8.7 min, 53 samples):**

| Renderer         | Comparable 7-min window slope |
| ---------------- | ----------------------------: |
| App total        |                  +20.1 MB/min |
| Left (Standings) |                   +9.2 MB/min |
| GPU              |                   +6.6 MB/min |

**Findings:**

1. **Session was too short to characterise steady-state behaviour.** With only 8.7 minutes and significant startup-ramp content (the session was opened during iRacing session-load), the comparable-window slopes are dominated by hydration costs rather than steady-state behaviour.
2. **The longer Practice 5 run (16.8 min, same scenario, same build) shows the true picture.** P5's Standings slope of +0.7 MB/min in the same comparable window indicates the H4 fix is decisive — P4's +9.2 figure was the startup ramp tail rather than ongoing leak.
3. **Methodology lesson:** Practice tests need ≥15 minutes of duration to separate steady-state slope from session-load ramp. The 7-min window analysis cannot disambiguate these when the session is barely longer than the window.

This entry is retained for completeness but **supersede with Practice 5** when reasoning about Post-Phase-2a behaviour.

---

### 2026-05-13 · Post-Phase 1 · Practice (real, joiners) · IMSA GT3 at Road Atlanta

**Scenario:** Practice (real, joiners) — active driver churn throughout, including a notable join burst at 22:17
**Build:** Post-Phase 1 (P1/P2/P4 typed subscriptions, building on Phase 0.5)
**Source log:** `OfficialPractice3-IMSA-GT3-RoadAtlanta.txt`
**Spreadsheet:** `practice3_perfmetrics_analysis.xlsx`

**Top-line numbers (cleaned, 17.0 min, 103 samples):**

Same-scenario comparison (Practice with active driver churn) before and after Phase 1:

| Renderer             | Practice 2 (pre-fix, 23 min) | **Practice 3 (post-Phase 1, 17 min)** |                 Δ |
| -------------------- | ---------------------------: | ------------------------------------: | ----------------: |
| App total            |       +26.1 MB/min (+604 MB) |                +24.3 MB/min (+414 MB) |           similar |
| **Primary**          |        +9.8 MB/min (+228 MB) |              **+1.5 MB/min (+25 MB)** |          **−85%** |
| **Left (Standings)** |        +9.6 MB/min (+222 MB) |            **+13.6 MB/min (+231 MB)** |         unchanged |
| Right                |                  +2.8 MB/min |                           +2.2 MB/min | small improvement |
| GPU                  |                  +0.9 MB/min |                           +3.5 MB/min |             +290% |
| Main                 |                  +3.0 MB/min |                           +3.6 MB/min |           similar |

**Latency improvements continue from Race 2 (Post-1):**

| Metric               | Post-Phase 1 Race 2 | **Practice 3** |         Δ |
| -------------------- | ------------------: | -------------: | --------: |
| App CPU mean         |               16.6% |          14.6% |     −2.0% |
| Primary CPU mean     |                5.6% |           4.4% |     −1.2% |
| Left CPU mean        |                3.1% |           2.8% |     −0.3% |
| processTelemetry p99 |             6.95 ms |    **5.23 ms** |      −25% |
| processTelemetry max |            11.14 ms |        8.97 ms |      −20% |
| broadcast p99        |             0.67 ms |    **0.55 ms** |      −18% |
| Tick dips <20 Hz     |                   0 |          **0** | unchanged |

**The smoking-gun step change at 22:17:**

```
22:16:02  Left  448 MB   ┐ stable for ~70 sec
22:17:02  Left  440 MB   ┘
22:17:12  Left  494 MB  ◄── +54 MB step
22:17:22  Left  530 MB  ◄── +36 MB step
22:17:42  Left  531 MB   ┐ stable, does not drop
22:18:22  Left  526 MB   ┘
```

At the same time, Primary went 419 → 432 MB (+13 MB) — confirming the cost is entirely Standings-side post-Phase-1, no longer split with Primary.

**Findings:**

1. **Phase 1 eliminates Primary's driver-join leak.** Primary's slope dropped from +9.8 to +1.5 MB/min in a busy real-multiplayer session — an ~85% reduction, mirroring the ~97% steady-state reduction seen in Race 2. The typed-subscription work addresses both steady-state allocation and join-event allocation in widgets that subscribe to driver data via the new path (relative, blindspot, slowcarahead, fastercarsfrombehind).
2. **Standings (Left renderer) was not addressed by Phase 1.** It still leaks at +13.6 MB/min in a churning session — actually slightly higher than pre-fix. The renderer selectivity has _sharpened_: Standings now carries virtually the entire driver-join leak alone.
3. **The driver-join leak has narrowed from "a substrate problem" to "a Standings widget problem."** Pre-fix, the leak was split roughly evenly between Primary and Left. Post-Phase-1, only Left leaks. This is a useful narrowing for prioritisation — the next fix can target Standings specifically rather than a broad SessionLifecycle abstraction.
4. **Per-joining-driver cost roughly halved.** Pre-fix was ~5–6 MB/joiner across Primary + Left combined. Post-Phase-1, the Primary contribution is gone, but Left/Standings still carries ~5–8 MB/joiner on its own. Total is approximately halved.
5. **Latency continues to improve.** processTelemetry p99 dropped to 5.2 ms (from 6.95 ms in Race 2); broadcast p99 to 0.55 ms. The Phase 1 gains compound nicely on real multiplayer (no AI physics CPU contention). Still above <3 ms p99 target.
6. **GPU slope worsened (+0.9 → +3.5 MB/min).** Unexplained by Phase 1 changes. Could be related to new texture allocation patterns introduced by typed subscriptions, or coincidental given different track/conditions. Worth keeping an eye on.

**Correlation with architecture review:**

| Finding                        | Status                                                           | Evidence from this run                                                                                                  |
| ------------------------------ | ---------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| P1/P2/P4 — typed subscriptions | **FIX VALIDATED for Primary in driver-churn scenario**           | Primary's driver-join leak essentially eliminated (~85% reduction)                                                      |
| A2/A3/L5/A7 — driver-join leak | **CONFIRMED still present, but narrowed to Standings widget**    | Pre-fix the leak was Primary + Left; post-fix only Left. Standings has not been migrated to the new subscription model. |
| Standings widget specifically  | **NEW: identified as primary remaining driver-join leak source** | +54 MB single-sample step at 22:17 in Left only; +231 MB total growth in Left over 17 min                               |
| P5 — memo prop churn           | **Likely still present**                                         | Left CPU at 2.8% — somewhat better than Race 2's 3.1% but Standings still doing significant per-row work                |

**Phase 1 effect on driver-join leak (interpretation):**

There are two possible interpretations for why Standings still leaks while other driver-aware widgets don't:

1. **Standings has its own per-driver state allocation pattern that Phase 1's migration didn't reach.** Could be in `DriverInfoRow`, `getDriverByCarIdx`, or Standings-specific stores. Fix: explicit migration of Standings to the new typed-subscription model.
2. **Standings is hitting different A2/A3/L5/A7 code paths** that other widgets are no longer hitting because Phase 1 moved them elsewhere. Fix: the full SessionLifecycle work might still be needed for Standings.

**Recommended next test:**

- **Single-Widget with only Standings enabled** for ~10 min in a busy practice. If Standings alone leaks at ~13 MB/min in active churn, it confirms Standings is the sole remaining source and motivates either of the above fixes. If Standings alone leaks less, there's residual substrate leak that needs separate investigation.

---

### 2026-05-13 · Post-Phase 1 · AI Race Multi-Class · Clio at Oulton Park

**Scenario:** AI Race Multi-Class, 10 laps, default dashboard
**Build:** Post-Phase 1 (P1/P2/P4 typed subscriptions and payload work, building on Phase 0.5)
**Source log:** `PostPhase1-Race2-AIRace-MultiClass-Clio-Oulton.txt`
**Spreadsheet:** `post1_race2_perfmetrics_analysis.xlsx`

**Top-line numbers (cleaned, 16.3 min, 99 samples):**

| Metric                 |                 Original |     Post-0.5 |                **Post-1** |  Δ vs 0.5 |
| ---------------------- | -----------------------: | -----------: | ------------------------: | --------: |
| App memory slope       | +13.5 MB/min (GC-masked) | +18.8 MB/min |          **+10.4 MB/min** |  **−44%** |
| **Primary slope**      |              +4.1 MB/min |  +5.2 MB/min | **+0.16 MB/min** (r=0.14) |  **−97%** |
| Left (Standings) slope |              +1.8 MB/min |  +6.5 MB/min |               +3.3 MB/min |      −51% |
| Right slope            |              +0.9 MB/min |  +0.4 MB/min |               +0.8 MB/min |      +0.4 |
| Main slope             |              +6.0 MB/min |  +4.6 MB/min |               +4.0 MB/min |      −13% |
| GPU slope              |              +0.6 MB/min |  +2.2 MB/min |               +2.2 MB/min | unchanged |
| processTelemetry avg   |                  2.82 ms |      2.73 ms |               **2.14 ms** |      −22% |
| processTelemetry p99   |                  9.64 ms |      8.24 ms |               **6.95 ms** |      −16% |
| **broadcast avg**      |                  0.66 ms |      0.64 ms |               **0.27 ms** |  **−58%** |
| **broadcast p99**      |                  1.71 ms |      1.45 ms |               **0.67 ms** |  **−54%** |
| App CPU mean           |                    17.6% |        17.7% |                     16.6% |     −1.0% |
| Primary CPU mean       |                     5.9% |         6.1% |                      5.6% |     −0.5% |
| Tick dips <20 Hz       |                        7 |            0 |                     **0** | unchanged |

**Per-process startup memory comparison:**

| Process        | Post-0.5 | **Post-1** |        Δ |
| -------------- | -------: | ---------: | -------: |
| App total      |    1,390 |      1,459 |      +69 |
| **Primary**    |      325 |        432 | **+107** |
| Left           |      304 |        308 |       +4 |
| Right          |      244 |        200 |      −44 |
| GPU            |      153 |        165 |      +12 |
| Main           |      124 |        118 |       −6 |
| NetworkService |       53 |         51 |       −2 |

**Findings:**

1. **Primary renderer leak essentially eliminated.** Primary's slope dropped from +5.2 to +0.16 MB/min (r=0.14 — essentially flat noise). This is the largest single steady-state improvement in any phase so far. Primary hosts the driver-aware widgets (relative, blindspot, slowcarahead, fastercarsfrombehind) — exactly the renderer where P1/P2/P4 would do most of their damage.
2. **Broadcast latency more than halved.** broadcast_avg dropped from 0.64 ms to 0.27 ms (−58%); broadcast_p99 from 1.45 to 0.67 ms (−54%). This is the unambiguous signature of P1's payload trimming — smaller structured-clone across IPC, less work per tick.
3. **processTelemetry latency improved 16–22%.** The upstream processing pipeline is doing less per tick. p99 still has headroom against the <3 ms target; Phase 3 (channel bus) would address the remaining gap.
4. **Left (Standings) leak halved but still present (+3.3 MB/min).** Standings is the most complex driver-aware widget; partial progress here is consistent with the harder migration being scoped later. Left CPU also stayed at 3.1% (down 0.3% from 0.5) — **P5 (memo prop churn) appears not to have been touched** by Phase 1. If P5 was in scope and landed, Left CPU would show a larger drop.
5. **Memory shape qualitatively better.** Heap climbs from 1,459 MB → ~1,800 MB by minute 12, then plateaus around 1,800 MB for the final 4 minutes. Plateau behaviour is a qualitative shift versus continuous linear growth — if it holds for longer sessions, the app would stabilise at a usable heap size rather than growing indefinitely.
6. **Slight startup regression on Primary (+107 MB).** Plausibly explained by new typed-subscription/store abstractions having one-time registration costs. Worth confirming with an empty-dashboard test post-Phase 1 to separate substrate cost from widget-registration cost. Trade-off is acceptable in exchange for the 97% reduction in steady-state Primary leak.
7. **Tick stability maintained.** Zero sub-20 Hz dips for the second phase running. Phase 0.5's L1/L2 wins are sticking.

**Correlation with architecture review:**

| Finding                                          | Status                                                        | Evidence from this run                                                                                                              |
| ------------------------------------------------ | ------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| P1 — telemetry firehose                          | **CONFIRMED implicated; FIX LARGELY VALIDATED**               | Primary slope -97%, broadcast latency halved. Some residual leak in Left/Main/GPU but the dominant payload-clone cost is addressed. |
| P2 — `useDriverPositions` raw subscription       | **CONFIRMED implicated; FIX VALIDATED (implicit in P1 work)** | Primary leak elimination is consistent with raw subscriptions being replaced                                                        |
| P4 — `SectorTimingStore.tick()` raw subscription | **CONFIRMED implicated; FIX VALIDATED (implicit in P1 work)** | Same evidence as P2                                                                                                                 |
| P5 — memo prop churn                             | **Not addressed by Phase 1**                                  | Left CPU and remaining slope consistent with `DriverInfoRow` re-render churn still present                                          |
| L1, L2, S5                                       | Validated Phase 0.5, no regression                            | broadcast_p99/processTel improvements show the Phase 0.5 gains compounded                                                           |
| A2/A3/L5/A7 — driver-join leak                   | Not exercised by this test                                    | Re-run Practice (real, joiners) to verify no regression introduced                                                                  |

**Phase 1 success criteria evaluation:**

- ✅ Primary in-race leak addressed (target was significant reduction; got −97%)
- ✅ Broadcast latency significantly reduced (−54% p99)
- ⚠️ App-level in-race slope improved but still above target (+10.4 vs <+5 MB/min target). The residual is in Left, Main, GPU — outside Phase 1's typed-subscription scope.
- ✅ Tick stability maintained
- ✅ No regression in Phase 0.5 wins (startup memory, tick dips)

**Recommended follow-up tests before declaring Phase 1 done:**

1. **Re-run Practice (real, joiners)** — confirm Phase 1 didn't accidentally affect the driver-join leak. Hypothesis: no change (A2/A3/L5/A7 are lifecycle issues separate from subscription mechanism).
2. **Empty Dashboard at this build** — characterise substrate baseline. The +107 MB Primary startup increase needs explanation: substrate growth (acceptable) vs widget-registration regression (worth investigating).

---

### 2026-05-13 · Post-Phase 0.5 · AI Race Multi-Class · Clio at Oulton Park

**Scenario:** AI Race Multi-Class, 10 laps, default dashboard
**Build:** Post-Phase 0.5 (L1 sync I/O removed, L2 YAML memoised, related changes)
**Source log:** `PostPhase0_5-Race2-AIRace-MultiClass-Clio-Oulton.txt`
**Spreadsheet:** `post05_race2_perfmetrics_analysis.xlsx`

**Top-line numbers (cleaned, 16.5 min, 100 samples):**

| Metric                    |                    Pre-Phase 0.5 |    **Post-Phase 0.5** |     Change |
| ------------------------- | -------------------------------: | --------------------: | ---------: |
| Starting app memory       |                         2,908 MB |          **1,390 MB** |   **−52%** |
| Ending app memory         |                         3,054 MB |              1,825 MB |       −40% |
| In-race app memory slope  | +13.5 MB/min (r=0.67, GC-masked) | +18.8 MB/min (r=0.85) |          — |
| Tick dips <20 Hz          |                                7 |                 **0** | eliminated |
| processTelemetry p99 mean |                           9.6 ms |                8.2 ms |       −15% |
| broadcast p99 mean        |                          1.71 ms |               1.45 ms |       −15% |
| Primary CPU mean          |                             5.9% |                  6.1% |  unchanged |

**Per-process startup memory reductions:**

| Process           | Pre |   Post |       Δ |
| ----------------- | --: | -----: | ------: |
| Left (Standings)  | 635 |    304 | −331 MB |
| GPU               | 403 |    153 | −250 MB |
| Main              | 344 |    124 | −220 MB |
| Primary           | 543 |    325 | −218 MB |
| NetworkService    | 231 | **53** | −178 MB |
| Right             | 417 |    244 | −173 MB |
| Renderer settings | 335 |    188 | −147 MB |

**Findings:**

1. **Multi-class startup penalty essentially eliminated.** The +1.5 GB cost previously associated with multi-class race startup is gone. Post-0.5 multi-class startup memory (1,390 MB) is comparable to single-class Race 1 (1,424 MB). The L2 YAML memoisation fix did its job.
2. **Tick stability dramatically better.** Zero sub-20 Hz dips in 16.5 minutes, versus 7 dips in the original Race 2 run. Consistent with both L1 (sync I/O removed) and L2 (no main-thread blocking on YAML parse).
3. **NetworkService returned to baseline.** Dropped from 231 MB back to exactly 53 MB — the value seen in every single-class test. Either confirms S5 (analytics queue accumulation) as the cause, or it's a downstream effect of the YAML/SessionInfo activity reduction. Either interpretation closes the NetworkService anomaly.
4. **Steady-state in-race leak rate is unchanged (~+18.8 MB/min).** Phase 0.5 was not scoped to address P1 (telemetry firehose), which is the steady-state leak source. This is expected. The apparent "increase" vs the original Race 2's +13.5 MB/min is mostly because the previous figure was being masked by aggressive GC on the bloated heap; the post-0.5 leak rate is closer to the true value and matches Race 1 (+16.5 MB/min).
5. **Memory shape much healthier.** Smooth growth (r=0.85) with only minor 15–23 MB GC drops, versus the previous noisy sawtooth (r=0.67) with 28+ MB drops at irregular intervals. The heap stays in V8's comfortable range (1.4–1.8 GB) for the entire session, never hitting the major-GC threshold that drives the user-perceived stutter.
6. **CPU costs unchanged**, as expected. Phase 0.5 doesn't address P5 (memo prop churn) or P3 (per-driver loops).

**Correlation with architecture review:**

| Finding                                  | Status                                                   | Evidence from this run                                            |
| ---------------------------------------- | -------------------------------------------------------- | ----------------------------------------------------------------- |
| L1 — sync `writeFileSync`                | **CONFIRMED implicated; FIX VALIDATED**                  | Tick dips with main-thread-stall pattern eliminated               |
| L2 — YAML re-parse                       | **CONFIRMED implicated for startup cost; FIX VALIDATED** | ~1.5 GB startup memory reduction                                  |
| S5 — Analytics queue                     | **CONFIRMED likely involved**                            | NetworkService back to 53 MB baseline (was: possible explanation) |
| P1 — telemetry firehose                  | Unchanged — not addressed                                | Steady-state leak rate unchanged                                  |
| P5 — memo prop churn                     | Unchanged — not addressed                                | CPU costs identical                                               |
| A2/A3/L5/A7 — lifecycle/callback cleanup | Unchanged — not addressed                                | Test did not exercise driver join/leave                           |

---

### 2026-05-12 · Pre-Phase 0.5 · Practice (real, joiners) · IMSA GT3 at Spa

**Scenario:** Practice (real, joiners) with known driver-join burst between 05:15 and 05:20
**Build:** Pre-Phase 0.5
**Source log:** `OfficialPractice2-IMSA-GT3-Spa.txt`
**Spreadsheet:** `practice2_perfmetrics_analysis.xlsx`

**Top-line numbers (cleaned, 23.4 min, 141 samples):**

- Full-session app memory slope: +27.8 MB/min (r=0.93) — _inflated by the join window_
- **Post-burst steady-state slope: +13.2 MB/min** — matches other in-race tests
- Tick dips <20 Hz: 7 (all 19.2–19.5 Hz, clustered post-burst)

**Join-window analysis (memory grew +260 MB across 5 min, ~50 joiners):**

| Renderer         | Pre-window slope | **Join-window slope** | Post-window slope |
| ---------------- | ---------------: | --------------------: | ----------------: |
| App total        |     +20.2 MB/min |      **+61.5 MB/min** |      +13.2 MB/min |
| Primary (centre) |             +3.6 |             **+27.3** |              +4.4 |
| Left (Standings) |             +4.5 |             **+24.3** |              +7.1 |
| Right            |             +7.0 |                  +6.1 |              +1.0 |
| GPU              |             +4.2 |                  +0.6 |              +0.8 |
| Main             |             +1.5 |                  +2.9 |              −0.1 |

**Findings:**

1. **Driver-join events cause large permanent memory allocations** (~5–6 MB per joining driver, ~260 MB total across the burst).
2. **Cost is concentrated in driver-list-aware renderers only** (Primary hosts relative/blindspot/slowcarahead/fastercarsfrombehind; Left hosts Standings). Right (Map/Weather/Battle) and GPU were unaffected. This selectivity is the discriminating evidence — if it were generic allocation, all renderers would grow.
3. **Memory does not drop when drivers leave.** The +260 MB stays allocated. Post-burst slope returns to baseline but the level is permanently elevated.
4. The pattern matches A2/A3/L5/A7 exactly: per-driver state added on join with no release path on leave, callback `Set`s in 8 ad-hoc bridges not cleared when subscriptions go away.

**Correlation with architecture review:**

| Finding                                    | Status update                                                                        | Evidence                                                                                              |
| ------------------------------------------ | ------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------- |
| A2 — no SessionLifecycle                   | **CONFIRMED implicated for driver-join leak** (was: plausibly implicated)            | +260 MB allocated across join burst, not released afterwards                                          |
| A3 — useResetOnDisconnect has zero callers | **CONFIRMED implicated for driver-join leak** (was: not implicated for in-race leak) | Reframed: A3 isn't the cause of the steady-state leak but is implicated for the per-driver state leak |
| L5 — module-global callback Sets           | **CONFIRMED implicated** (was: not independently evidenced)                          | Renderer selectivity matches subscription-based callback accumulation                                 |
| A7 — 8 ad-hoc bridges with callback Sets   | **CONFIRMED implicated** (was: not independently evidenced)                          | Same evidence as L5                                                                                   |

---

### 2026-05-12 · Pre-Phase 0.5 · Practice (real, quiet) · IMSA GT3 at Spa

**Scenario:** Practice (real, quiet) — no known events during measurement window
**Build:** Pre-Phase 0.5
**Source log:** `OfficialPractice-IMSA-GT3-Spa.txt`
**Spreadsheet:** `practice_perfmetrics_analysis.xlsx`

**Top-line numbers (cleaned, 12.2 min):**

- App memory slope: +13.4 MB/min (r=0.70)
- Per-renderer slopes: Primary +2.4, Left +4.3, Right +1.2, GPU +4.8 MB/min
- Tick dips <20 Hz: 1
- Step-change memory jumps in first 3 minutes:
  - Minute 1:00 — Left +42 MB
  - Minute 1:20 — Left +51 MB
  - Minute 2:50 — Primary +47 MB

**Findings:**

1. Steady-state leak rate matches other in-race tests (+13–20 MB/min band).
2. Real multiplayer has dramatically better tick stability than AI multi-class (1 dip vs 8 dips at similar field size), empirically confirming that Race 2's tick drops were inflated by AI physics environmental contention.
3. The early-session step changes seen here were originally attributed to driver-join events but the cause could not be confirmed until the next test (Practice with known joiners) resolved the ambiguity.

---

### 2026-05-11 · Pre-Phase 0.5 · AI Race Multi-Class · Clio at Oulton Park

**Scenario:** AI Race Multi-Class, 10 laps
**Build:** Pre-Phase 0.5
**Source log:** `Race2-AIRace-MultiClass-Clio-Oulton.txt`
**Spreadsheet:** `race2_perfmetrics_analysis.xlsx`

**Top-line numbers (cleaned, 14.4 min, 87 samples):**

- **Starting app memory: 2,908 MB** (vs 1,424 MB for single-class — _+1,484 MB premium for multi-class on a fresh-start_)
- App memory slope: +11.4 MB/min (r=0.67 — noisy sawtooth, indicating active GC)
- Primary slope: +5.8 MB/min — identical to single-class Race 1
- App CPU mean: 16–18%
- processTelemetry p99 mean: 12.5 ms (vs single-class 7.4 ms — +69%)
- Tick dips <20 Hz: 8 (partially inflated by AI physics contention, confirmed by later practice test)

**Findings:**

1. **Multi-class adds ~1.5 GB at fresh-start before driving begins.** Configuration-dependent baseline allocation, not gradual accumulation. Consistent with L2 (YAML re-parse) and possibly A2/A6.
2. **In-race leak rate unchanged from single-class.** Class count doesn't add to the linear leak.
3. **Multi-class adds per-tick CPU/latency cost.** Class-aware widget logic (sorting by class, class colours, per-class deltas) drives p99 up 69%. Confirms P5 as the CPU/latency driver.

---

### 2026-05-11 · Pre-Phase 0.5 · AI Race 1-Class · Clio at Oulton Park

**Scenario:** AI Race 1-Class, 10 laps, 39 AI opponents
**Build:** Pre-Phase 0.5
**Source log:** `Race1-AIRace-39_Opponents-Clio-Oulton.txt`
**Spreadsheet:** `race1_perfmetrics_analysis.xlsx`

**Top-line numbers (cleaned, 17.3 min, 105 samples):**

- Starting app memory: 1,424 MB
- App memory slope: +16.5 MB/min (r=0.79)
- Primary slope: +5.8 MB/min — _identical to solo Test Drive_
- App CPU mean: 16.5% (vs solo 11.2%, +47%)
- processTelemetry p99 mean: 7.4 ms (vs solo 3.2 ms, +131%)
- Tick dips <20 Hz: 1

**Findings:**

1. **40× the drivers, same leak rate.** Driver count does not affect the linear memory leak rate. **This disconfirms P3/A3/L4 as the dominant in-race leak source** — those would scale with driver count.
2. Per-tick CPU and latency scale with driver count but those allocations are GC'd within the tick.
3. Confirms the leak is per-tick constant, not per-driver-tick.

---

### 2026-05-11 · Pre-Phase 0.5 · Solo Test Drive · Clio at Oulton Park

**Scenario:** Solo Test Drive (1 car, 1 class)
**Build:** Pre-Phase 0.5
**Source log:** `TestDrive-SinglePlayer-Clio-Oulton.txt`
**Spreadsheet:** `test1_perfmetrics_analysis.xlsx`

**Top-line numbers (cleaned, 17.3 min, 105 samples):**

- Starting app memory: 1,298 MB
- App memory slope: **+19.7 MB/min (r=0.88)**
- Per-renderer slopes: Primary +6.1, Left +3.3, Right +1.9 MB/min
- Per-widget rate: 0.6–1.1 MB/min, roughly band-uniform
- App CPU: 8% → 12%
- Tick dips <20 Hz: 2

**Findings:**

1. **The leak exists with a single car on track.** The leak is not driver-data-shaped.
2. The roughly uniform per-widget leak rate (0.6–1.1 MB/min per widget across screens) suggests the leak is in shared substrate — telemetry subscriptions, store snapshots, IPC layer — rather than in any single widget.
3. Establishes the in-race leak baseline against which subsequent tests are compared.

---

## 4. Current Status of Architecture Findings

Live record of which architecture review findings have empirical support. Update as new tests resolve open questions.

### Confirmed implicated, fix validated

| ID                   | Description                                                             | Validation                                                                                                                                                   |
| -------------------- | ----------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **L1**               | Synchronous `writeFileSync` on main process                             | Phase 0.5 — tick dips eliminated                                                                                                                             |
| **L2**               | YAML re-parsed on every `getSessionData` call                           | Phase 0.5 — multi-class startup cost eliminated                                                                                                              |
| **S5**               | Analytics forwards every warn/error log line to PostHog                 | Phase 0.5 — NetworkService returned to 53 MB baseline                                                                                                        |
| **P1**               | Full 340-key telemetry payload structured-cloned to every overlay 25 Hz | Phase 1 — Primary slope −97%, broadcast latency −54%                                                                                                         |
| **P2**               | `useDriverPositions` subscribes to raw `CarIdxLapDistPct`               | Phase 1 — implicit in P1 fix; Primary leak elimination consistent with replacement                                                                           |
| **P4**               | `SectorTimingStore.tick()` subscribes to raw `LapDistPct`/`SessionTime` | Phase 1 — implicit in P1 fix                                                                                                                                 |
| **H3**               | Spurious `reset()` calls at boot on undefined→0 SDK-connect transitions | Phase 2a Tier 1 — no duplicate "Resetting lap time history" log lines in P5 boot                                                                             |
| **H4**               | `PitLapStore.updatePitLaps` clone storm on uneventful ticks             | Phase 2a Tier 1 — Left renderer slope dropped 95% (P3 +13 → P5 +0.7 MB/min)                                                                                  |
| **Standings widget** | Per-driver allocation pattern in Standings                              | Phase 2a Tier 1 (via H4) — slope now under target. Was the "sole remaining driver-join leak source" identified in P3; resolved as a memory leak by Phase 2a. |

### Partially fixed, work outstanding

| ID     | Description                             | What's done / what remains                                                                                                                                                                                                          |
| ------ | --------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **A2** | No `SessionLifecycle` abstraction       | Phase 2a — join detection wired up (`[sessionLifecycle] Driver joined: carIdx=N` events fire correctly per P5 boot log). **Leave/disconnect cleanup not implemented** — disconnect detected but no per-driver leave events emitted. |
| **A3** | `useResetOnDisconnect` has zero callers | Phase 2a — disconnect detection works but does not trigger per-driver state release. The infrastructure exists now, but the disconnect path doesn't invoke the cleanup.                                                             |

### Confirmed implicated, fix outstanding

| ID                                                          | Description                                                                                                                                                                                                       | Phase scope                                                                                                                     |
| ----------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| **Reference lap fetch per-renderer** (new from P5 boot log) | When iRacing connects, each renderer independently fetches reference laps for each class. Results in 3× I/O and 3× memory cost during session-load. Should be main-process singleton + broadcast.                 | Targeted small fix — recommended next step, high leverage on session-load cost                                                  |
| **Disconnect leave cleanup** (sub-finding of A3)            | When iRacing disconnects, the lifecycle abstraction logs the disconnect but does not release per-driver state allocated during join. Per-driver state from rapid connect/disconnect/reconnect cycles accumulates. | Phase 2 — completes A2/A3                                                                                                       |
| **P5**                                                      | `memo(DriverInfoRow)` defeated by prop churn                                                                                                                                                                      | Phase 1 (not addressed); Phase 2. Lower priority now — Standings memory leak is resolved, so the residual P5 CPU cost is small. |
| **L5**                                                      | Module-global callback `Set`s in bridges not cleared on window close                                                                                                                                              | Phase 2 — driven by completing A2/A3 lifecycle                                                                                  |
| **A7**                                                      | 8 ad-hoc bridges with module-global callback `Set`s                                                                                                                                                               | Phase 2 — driven by completing A2/A3 lifecycle                                                                                  |

### Partially confirmed

| ID     | Description                                                                   | Status                                       |
| ------ | ----------------------------------------------------------------------------- | -------------------------------------------- |
| **P3** | `ReferenceLapStoreUpdater` runs `collectLapData` for every driver every frame | CPU cost confirmed, not a memory leak source |

### Not yet tested

| ID     | Description                                               | Test to confirm                                              |
| ------ | --------------------------------------------------------- | ------------------------------------------------------------ |
| **P6** | Hidden / minimised overlays still receive every broadcast | Requires test with windows minimised or behind other windows |
| **L4** | Reference-lap data has no size cap                        | Test with pre-existing saved reference lap                   |

### Disconfirmed as dominant cause

(None — A3 was previously listed here for the steady-state leak but has been reclassified as confirmed for the driver-join leak.)

### Open questions raised by recent tests

- **Session-load startup cost (~+1 GB).** Practice 5 captured the first reproducible measurement of "iRDashies opened while iRacing is loading into a session" vs the prior "opened post-load" baseline. Cost is ~1 GB higher. Two underlying contributors are now identified: reference lap fetch duplication (3× per class) and disconnect cleanup gap. Both have targeted fixes available. **Fixing these and re-running this scenario will quantify how much of the +1 GB is attributable to each.**
- **Phase 1 startup regression on Primary (+107 MB).** Cause not confirmed — most likely typed-subscription/store registration cost. Empty Dashboard test post-Phase 1 would isolate substrate vs widget contribution. Lower priority now that overall behaviour is healthy.
- **Main process slope (+3.6–6.0 MB/min).** Persistent across all phases. Not directly addressed by any fix so far. Possibly related to telemetry buffering, log accumulation, or main-process state stores not yet typed. Now the largest single contributor to remaining app-level slope.
- **GPU regression P4 → P5.** Resolved as session noise — P4's +6.6 MB/min comparable-window slope dropped to P5's +3.1 MB/min on a longer, more representative session. Watch item closed.

### Resolved open questions

- **Standings widget per-driver allocation pattern** (raised by P3, resolved by P5) — Phase 2a's H4 fix dropped the Standings slope from +13 MB/min to +0.7 MB/min. Standings is no longer the dominant leak source.

---

## 5. Targets and Goals

Empirical baselines and post-remediation targets. Updated as targets are met.

| Metric                                                      |       Pre-remediation |      Post-0.5 |           Post-1 | Post-2a (P3 baseline) |              **Post-2a (P5)** |                Target | Source                              |
| ----------------------------------------------------------- | --------------------: | ------------: | ---------------: | --------------------: | ----------------------------: | --------------------: | ----------------------------------- |
| Multi-class startup memory (post-load)                      |              2,908 MB |   1,390 MB ✅ |      1,459 MB ✅ |           1,419 MB ✅ |                         n/a ² |            < 1,800 MB | AI Race Multi-Class / Practice      |
| **Multi-class startup memory (during session-load)**        |                   n/t |           n/t |              n/t |                   n/t |                  **2,417 MB** |            < 1,500 MB | Practice opened during session-load |
| Tick dips <20 Hz (16+ min)                                  |                     7 |          0 ✅ |             0 ✅ |                  0 ✅ |                      **0** ✅ |                   < 1 | AI Race Multi-Class / Practice      |
| processTelemetry p99 mean                                   |               12.5 ms |        8.2 ms |          6.95 ms |               5.23 ms |                 **7.15 ms** ³ |                < 3 ms | AI Race Multi-Class / Practice      |
| broadcast p99 mean                                          |               1.71 ms |       1.45 ms |       0.67 ms ✅ |            0.55 ms ✅ |                **0.61 ms** ✅ |                < 1 ms | AI Race Multi-Class / Practice      |
| In-race app memory slope (stable field)                     |          +18.8 MB/min |  +18.8 MB/min |     +10.4 MB/min |                 n/a ¹ |             **+9.4 MB/min** ⁴ |           < +5 MB/min | AI Race / Practice                  |
| **Primary renderer slope**                                  |    +5.8 / +9.8 MB/min |   +5.2 MB/min |  +0.16 MB/min ✅ |        +1.5 MB/min ✅ |            **+0.6 MB/min** ✅ |           < +1 MB/min | AI Race / Practice                  |
| **Left renderer slope (churning field, comparable window)** |          +18.5 MB/min |           n/t |     +13.0 MB/min |          +13.6 MB/min |            **+0.7 MB/min** ✅ |           < +2 MB/min | Practice (real, joiners)            |
| Per-joining-driver permanent memory cost                    |               ~5–6 MB |      untested |          ~5–8 MB |                   n/t |    **~5 MB across renderers** |                < 1 MB | Practice (real, joiners)            |
| Renderer stutter (subjective)                               | Choppy after 5–10 min | Smooth 16 min | Plateau observed |         Smooth 17 min | **Clear plateau at min 8** ✅ | No stutter at 30+ min | All in-race tests                   |

¹ Practice 3 has active driver churn throughout, so its app-level slope (+22.3 MB/min) isn't comparable to a stable-field race.
² Practice 5 was opened during iRacing session-load and so doesn't measure the post-load startup baseline; expected to be similar to P4 if reproduced.
³ Post-2a p99 mean is likely inflated by the elevated heap from session-load startup. A fresh-start post-load run would isolate the true Phase 2a latency.
⁴ Practice 5 has active driver churn throughout (same as P3), so this slope is from the post-startup full range rather than the same metric as the stable-field tests.

**Phase 0.5 success criteria:** Met for L1 and L2 (startup memory and tick stability). S5 fix also appears successful.

**Phase 1 success criteria:** Largely met for P1/P2/P4 in driver-aware widgets _except Standings_. Primary in-race AND driver-join leaks both essentially eliminated (~85–97% reduction). Driver-join leak narrowed from substrate-wide to Standings-widget-specific. (Standings was subsequently resolved by Phase 2a — see below.)

**Phase 2a Tier 1 success criteria:**

- ✅ Standings steady-state leak resolved (target was significant reduction; got 95% reduction, now under target)
- ✅ No regression in Phase 0.5/Phase 1 wins
- ⚠️ A2 partially completed — join detection wired up but leave/disconnect cleanup not implemented
- ⚠️ Two new findings surfaced during Phase 2a testing: reference-lap fetch duplication (3× per class) and disconnect leave cleanup gap. Both have targeted fixes.

**Remaining work, in priority order:**

1. **Reference-lap fetch deduplication** (small, high-leverage targeted fix; addresses ~1 GB session-load cost)
2. **Disconnect leave cleanup** (completes A2/A3; addresses per-driver-join cost)
3. **Main process slope** (now the largest single contributor to app-level slope at +4–6 MB/min; root cause not yet identified)
4. Phase 3 channel bus would close the remaining processTelemetry p99 gap to <3 ms

H1 (`createDriverStandings` rewrite) and P5 (`DriverInfoRow` memo) are no longer urgent given Phase 2a's results — Standings is now under target. They may still be worth doing for code quality but should be deprioritised against items 1–3 above.

---

## 6. Template for New Test Entries

Copy this template when adding new test results to §3.

```markdown
### YYYY-MM-DD · [Phase / Build description] · [Scenario name] · [Track/Car if relevant]

**Scenario:** [Scenario name from §2, or new scenario description]
**Build:** [Phase, branch, commit SHA, or build description]
**Source log:** `filename.txt`
**Spreadsheet:** `filename.xlsx`

**Top-line numbers (cleaned, duration, sample count):**

[Memory, CPU, latency, tick dips, etc. — table format if comparing to a prior run]

**Findings:**

1. [What the data shows]
2. [What it confirms or disconfirms]
3. [Any unexpected observations]

**Correlation with architecture review:**

[Table or list mapping observations to architecture findings, with status updates]
```

### What makes a good test entry

- Lead with **top-line numbers** in a table. Don't make the reader hunt for the headline.
- When comparing to a prior run, always show **both** values and the delta — never just the delta.
- Be specific about **what the test does and doesn't address.** If a test wasn't designed to exercise a particular finding, say so.
- Quote slopes with **r values**. A high slope with low r is noise; a low slope with high r is a real trend.
- Note any **environmental confounds** (AI physics CPU contention, sync I/O during test, etc.).
- Update §4 and §5 as part of adding a new entry — the entry isn't complete until those sections reflect what it changed.

---

## 7. Excluded / Historical Data

Tests run during early diagnostic work that are not part of the standard scenarios:

- **Sportscar practice** (2026-05-10) — first investigation, ~30 cars practice session. Excluded from the standard analysis because the dashboard configuration may have differed and because the duration was short (9 min). Useful only as an early data point showing the leak existed.
- **PCC race** (2026-05-11) — 44-car multiclass real-multiplayer race. Used a **different dashboard configuration** than current tests, so absolute numbers don't compare cleanly. The PCC config had a substantially lower in-race leak rate (+0.6 MB/min app slope vs +13–20 MB/min for standard config), suggesting layout choice has measurable impact. An A/B comparison of the two configs is a useful future test.

---

_End of test log. To add a new test, follow §6._
