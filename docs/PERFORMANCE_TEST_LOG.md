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

---

## 3. Test Entries

> Newest at the top. Each entry follows the template in §6.

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

| ID     | Description                                                             | Validation                                                                         |
| ------ | ----------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| **L1** | Synchronous `writeFileSync` on main process                             | Phase 0.5 — tick dips eliminated                                                   |
| **L2** | YAML re-parsed on every `getSessionData` call                           | Phase 0.5 — multi-class startup cost eliminated                                    |
| **S5** | Analytics forwards every warn/error log line to PostHog                 | Phase 0.5 — NetworkService returned to 53 MB baseline                              |
| **P1** | Full 340-key telemetry payload structured-cloned to every overlay 25 Hz | Phase 1 — Primary slope −97%, broadcast latency −54%                               |
| **P2** | `useDriverPositions` subscribes to raw `CarIdxLapDistPct`               | Phase 1 — implicit in P1 fix; Primary leak elimination consistent with replacement |
| **P4** | `SectorTimingStore.tick()` subscribes to raw `LapDistPct`/`SessionTime` | Phase 1 — implicit in P1 fix                                                       |

### Confirmed implicated, fix outstanding

| ID                         | Description                                                                                                                         | Phase scope                                                                                          |
| -------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| **P5**                     | `memo(DriverInfoRow)` defeated by prop churn                                                                                        | Phase 1 (apparently not in latest Phase 1 work — Left CPU still elevated); Phase 2                   |
| **Standings widget** (new) | Per-driver allocation pattern in Standings not migrated to typed subscriptions; sole remaining driver-join leak source post-Phase-1 | Standings-specific migration, or Phase 2 SessionLifecycle if root cause is deeper                    |
| **A2**                     | No `SessionLifecycle` abstraction                                                                                                   | Phase 2 — may or may not be required depending on Standings investigation (see Practice 3 entry, §3) |
| **A3**                     | `useResetOnDisconnect` has zero callers                                                                                             | Phase 2 — driven by A2 lifecycle abstraction                                                         |
| **L5**                     | Module-global callback `Set`s in bridges not cleared on window close                                                                | Phase 2 — driven by A2 lifecycle                                                                     |
| **A7**                     | 8 ad-hoc bridges with module-global callback `Set`s                                                                                 | Phase 2 — driven by A2 lifecycle                                                                     |

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

- **Standings widget per-driver allocation pattern.** Practice 3 isolated the remaining driver-join leak to Left renderer (Standings) specifically. Single-Widget Standings-only test would confirm. If Standings alone leaks at ~13 MB/min in active churn, the fix is targeted at Standings rather than requiring the full SessionLifecycle work.
- **Phase 1 startup regression on Primary (+107 MB).** Cause not confirmed — most likely typed-subscription/store registration cost. Empty Dashboard test post-Phase 1 would isolate substrate vs widget contribution.
- **Main process slope (+3.6–4.0 MB/min).** Persistent across all phases. Untouched by Phase 1. Possibly related to telemetry buffering, log accumulation, or main-process state stores not yet typed.
- **GPU slope regression in Practice 3 (+0.9 → +3.5 MB/min).** Unexplained by Phase 1 changes. Could be related to new texture allocation patterns introduced by typed subscriptions, or coincidental given different track/conditions. Worth tracking across future tests to see if it's systematic.

---

## 5. Targets and Goals

Empirical baselines and post-remediation targets. Updated as targets are met.

| Metric                                   |       Pre-remediation |                 Post-0.5 |               Post-1 (Race 2) |               **Practice 3** |                Target | Source                         |
| ---------------------------------------- | --------------------: | -----------------------: | ----------------------------: | ---------------------------: | --------------------: | ------------------------------ |
| Multi-class startup memory               |              2,908 MB |              1,390 MB ✅ |                   1,459 MB ✅ |                  1,419 MB ✅ |            < 1,800 MB | AI Race Multi-Class / Practice |
| Tick dips <20 Hz (16+ min)               |                     7 |                     0 ✅ |                          0 ✅ |                     **0** ✅ |                   < 1 | AI Race Multi-Class / Practice |
| processTelemetry p99 mean                |               12.5 ms |                   8.2 ms |                       6.95 ms |                  **5.23 ms** |                < 3 ms | AI Race Multi-Class / Practice |
| broadcast p99 mean                       |               1.71 ms |                  1.45 ms |                    0.67 ms ✅ |               **0.55 ms** ✅ |                < 1 ms | AI Race Multi-Class / Practice |
| In-race app memory slope (stable field)  |    +13.5/+18.8 MB/min |             +18.8 MB/min |                  +10.4 MB/min |                        n/a ¹ |           < +5 MB/min | AI Race Multi-Class            |
| **Primary renderer slope**               |    +5.8 / +9.8 MB/min |              +5.2 MB/min |               +0.16 MB/min ✅ |           **+1.5 MB/min** ✅ |   < +1 MB/min (close) | AI Race / Practice             |
| **Left renderer slope (churning field)** |           +9.6 MB/min |                      n/t |                           n/t |             **+13.6 MB/min** |           < +2 MB/min | Practice (real, joiners)       |
| Per-joining-driver permanent memory cost |               ~5–6 MB |                 untested |                      untested | **~5–8 MB (Standings only)** |                < 1 MB | Practice (real, joiners)       |
| Renderer stutter (subjective)            | Choppy after 5–10 min | Smooth throughout 16 min | Smooth, heap plateau observed |     Smooth throughout 17 min | No stutter at 30+ min | All in-race tests              |

¹ Practice 3 has active driver churn throughout, so its app-level slope (+22.3 MB/min) isn't comparable to a stable-field race.

**Phase 0.5 success criteria:** Met for L1 and L2 (startup memory and tick stability). S5 fix also appears successful.

**Phase 1 success criteria:** Largely met for P1/P2/P4 in driver-aware widgets _except Standings_. Primary in-race AND driver-join leaks both essentially eliminated (~85–97% reduction). Broadcast latency under target. processTelemetry p99 still has headroom against the <3 ms target. **Driver-join leak has narrowed from substrate-wide to Standings-widget-specific.** This is a useful narrowing for prioritisation.

**Remaining Phase 2+ goals:**

- Standings widget migration (highest priority — single remaining driver-join leak source)
- Memo prop churn (P5) in `DriverInfoRow`
- Driver-join lifecycle (A2/A3/L5/A7) — may or may not be required depending on whether Standings fix can be Standings-local
- Phase 3 channel bus would close the remaining processTelemetry p99 gap to <3 ms

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
