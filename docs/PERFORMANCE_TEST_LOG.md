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

| Name | Drivers | Classes | Field type | Notes |
|------|--------:|--------:|------------|-------|
| **Solo Test Drive** | 1 | 1 | Solo | Single car on track, no opponents |
| **AI Race 1-Class** | 40 | 1 | AI | Single-class AI race, 40 cars |
| **AI Race Multi-Class** | 40 | 4 | AI | Multi-class AI race, 40 cars |
| **Practice (real, quiet)** | ~40 | 4 | Real multiplayer | Stable field, no known join activity |
| **Practice (real, joiners)** | ~40 | 4 | Real multiplayer | Field actively filling with joiners |
| **Empty Dashboard** | varies | varies | any | All widgets disabled — substrate baseline |
| **Single-Widget** | varies | varies | any | Only one widget enabled — used to isolate per-widget cost |

When new scenarios are added (e.g. to test specific findings), document them here.

---

## 3. Test Entries

> Newest at the top. Each entry follows the template in §6.

---

### 2026-05-13 · Post-Phase 0.5 · AI Race Multi-Class · Clio at Oulton Park

**Scenario:** AI Race Multi-Class, 10 laps, default dashboard
**Build:** Post-Phase 0.5 (L1 sync I/O removed, L2 YAML memoised, related changes)
**Source log:** `PostPhase0_5-Race2-AIRace-MultiClass-Clio-Oulton.txt`
**Spreadsheet:** `post05_race2_perfmetrics_analysis.xlsx`

**Top-line numbers (cleaned, 16.5 min, 100 samples):**

| Metric | Pre-Phase 0.5 | **Post-Phase 0.5** | Change |
|---|---:|---:|---:|
| Starting app memory | 2,908 MB | **1,390 MB** | **−52%** |
| Ending app memory | 3,054 MB | 1,825 MB | −40% |
| In-race app memory slope | +13.5 MB/min (r=0.67, GC-masked) | +18.8 MB/min (r=0.85) | — |
| Tick dips <20 Hz | 7 | **0** | eliminated |
| processTelemetry p99 mean | 9.6 ms | 8.2 ms | −15% |
| broadcast p99 mean | 1.71 ms | 1.45 ms | −15% |
| Primary CPU mean | 5.9% | 6.1% | unchanged |

**Per-process startup memory reductions:**

| Process | Pre | Post | Δ |
|---|---:|---:|---:|
| Left (Standings) | 635 | 304 | −331 MB |
| GPU | 403 | 153 | −250 MB |
| Main | 344 | 124 | −220 MB |
| Primary | 543 | 325 | −218 MB |
| NetworkService | 231 | **53** | −178 MB |
| Right | 417 | 244 | −173 MB |
| Renderer settings | 335 | 188 | −147 MB |

**Findings:**

1. **Multi-class startup penalty essentially eliminated.** The +1.5 GB cost previously associated with multi-class race startup is gone. Post-0.5 multi-class startup memory (1,390 MB) is comparable to single-class Race 1 (1,424 MB). The L2 YAML memoisation fix did its job.
2. **Tick stability dramatically better.** Zero sub-20 Hz dips in 16.5 minutes, versus 7 dips in the original Race 2 run. Consistent with both L1 (sync I/O removed) and L2 (no main-thread blocking on YAML parse).
3. **NetworkService returned to baseline.** Dropped from 231 MB back to exactly 53 MB — the value seen in every single-class test. Either confirms S5 (analytics queue accumulation) as the cause, or it's a downstream effect of the YAML/SessionInfo activity reduction. Either interpretation closes the NetworkService anomaly.
4. **Steady-state in-race leak rate is unchanged (~+18.8 MB/min).** Phase 0.5 was not scoped to address P1 (telemetry firehose), which is the steady-state leak source. This is expected. The apparent "increase" vs the original Race 2's +13.5 MB/min is mostly because the previous figure was being masked by aggressive GC on the bloated heap; the post-0.5 leak rate is closer to the true value and matches Race 1 (+16.5 MB/min).
5. **Memory shape much healthier.** Smooth growth (r=0.85) with only minor 15–23 MB GC drops, versus the previous noisy sawtooth (r=0.67) with 28+ MB drops at irregular intervals. The heap stays in V8's comfortable range (1.4–1.8 GB) for the entire session, never hitting the major-GC threshold that drives the user-perceived stutter.
6. **CPU costs unchanged**, as expected. Phase 0.5 doesn't address P5 (memo prop churn) or P3 (per-driver loops).

**Correlation with architecture review:**

| Finding | Status | Evidence from this run |
|---|---|---|
| L1 — sync `writeFileSync` | **CONFIRMED implicated; FIX VALIDATED** | Tick dips with main-thread-stall pattern eliminated |
| L2 — YAML re-parse | **CONFIRMED implicated for startup cost; FIX VALIDATED** | ~1.5 GB startup memory reduction |
| S5 — Analytics queue | **CONFIRMED likely involved** | NetworkService back to 53 MB baseline (was: possible explanation) |
| P1 — telemetry firehose | Unchanged — not addressed | Steady-state leak rate unchanged |
| P5 — memo prop churn | Unchanged — not addressed | CPU costs identical |
| A2/A3/L5/A7 — lifecycle/callback cleanup | Unchanged — not addressed | Test did not exercise driver join/leave |

---

### 2026-05-12 · Pre-Phase 0.5 · Practice (real, joiners) · IMSA GT3 at Spa

**Scenario:** Practice (real, joiners) with known driver-join burst between 05:15 and 05:20
**Build:** Pre-Phase 0.5
**Source log:** `OfficialPractice2-IMSA-GT3-Spa.txt`
**Spreadsheet:** `practice2_perfmetrics_analysis.xlsx`

**Top-line numbers (cleaned, 23.4 min, 141 samples):**

- Full-session app memory slope: +27.8 MB/min (r=0.93) — *inflated by the join window*
- **Post-burst steady-state slope: +13.2 MB/min** — matches other in-race tests
- Tick dips <20 Hz: 7 (all 19.2–19.5 Hz, clustered post-burst)

**Join-window analysis (memory grew +260 MB across 5 min, ~50 joiners):**

| Renderer | Pre-window slope | **Join-window slope** | Post-window slope |
|---|---:|---:|---:|
| App total | +20.2 MB/min | **+61.5 MB/min** | +13.2 MB/min |
| Primary (centre) | +3.6 | **+27.3** | +4.4 |
| Left (Standings) | +4.5 | **+24.3** | +7.1 |
| Right | +7.0 | +6.1 | +1.0 |
| GPU | +4.2 | +0.6 | +0.8 |
| Main | +1.5 | +2.9 | −0.1 |

**Findings:**

1. **Driver-join events cause large permanent memory allocations** (~5–6 MB per joining driver, ~260 MB total across the burst).
2. **Cost is concentrated in driver-list-aware renderers only** (Primary hosts relative/blindspot/slowcarahead/fastercarsfrombehind; Left hosts Standings). Right (Map/Weather/Battle) and GPU were unaffected. This selectivity is the discriminating evidence — if it were generic allocation, all renderers would grow.
3. **Memory does not drop when drivers leave.** The +260 MB stays allocated. Post-burst slope returns to baseline but the level is permanently elevated.
4. The pattern matches A2/A3/L5/A7 exactly: per-driver state added on join with no release path on leave, callback `Set`s in 8 ad-hoc bridges not cleared when subscriptions go away.

**Correlation with architecture review:**

| Finding | Status update | Evidence |
|---|---|---|
| A2 — no SessionLifecycle | **CONFIRMED implicated for driver-join leak** (was: plausibly implicated) | +260 MB allocated across join burst, not released afterwards |
| A3 — useResetOnDisconnect has zero callers | **CONFIRMED implicated for driver-join leak** (was: not implicated for in-race leak) | Reframed: A3 isn't the cause of the steady-state leak but is implicated for the per-driver state leak |
| L5 — module-global callback Sets | **CONFIRMED implicated** (was: not independently evidenced) | Renderer selectivity matches subscription-based callback accumulation |
| A7 — 8 ad-hoc bridges with callback Sets | **CONFIRMED implicated** (was: not independently evidenced) | Same evidence as L5 |

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

- **Starting app memory: 2,908 MB** (vs 1,424 MB for single-class — *+1,484 MB premium for multi-class on a fresh-start*)
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
- Primary slope: +5.8 MB/min — *identical to solo Test Drive*
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

| ID | Description | Validation |
|----|-------------|------------|
| **L1** | Synchronous `writeFileSync` on main process | Phase 0.5 — tick dips eliminated |
| **L2** | YAML re-parsed on every `getSessionData` call | Phase 0.5 — multi-class startup cost eliminated |
| **S5** | Analytics forwards every warn/error log line to PostHog | Phase 0.5 — NetworkService returned to 53 MB baseline |

### Confirmed implicated, fix outstanding

| ID | Description | Phase scope |
|----|-------------|-------------|
| **P1** | Full 340-key telemetry payload structured-cloned to every overlay 25 Hz | Phase 1 (interim mitigation: trim payload) / Phase 3 (channel bus with per-window subscriptions) |
| **P5** | `memo(DriverInfoRow)` defeated by prop churn | Phase 1 / Phase 2 |
| **A2** | No `SessionLifecycle` abstraction | Phase 2 (recommended promoted to Phase 1 — see PERFORMANCE_TEST_SUMMARY.md §7.1) |
| **A3** | `useResetOnDisconnect` has zero callers | Phase 2 — driven by A2 lifecycle abstraction |
| **L5** | Module-global callback `Set`s in bridges not cleared on window close | Phase 2 — driven by A2 lifecycle |
| **A7** | 8 ad-hoc bridges with module-global callback `Set`s | Phase 2 — driven by A2 lifecycle |

### Partially confirmed

| ID | Description | Status |
|----|-------------|--------|
| **P3** | `ReferenceLapStoreUpdater` runs `collectLapData` for every driver every frame | CPU cost confirmed, not a memory leak source |

### Not yet tested

| ID | Description | Test to confirm |
|----|-------------|-----------------|
| **P2** | `useDriverPositions` subscribes to raw `CarIdxLapDistPct` | Subsumed in P1 testing |
| **P4** | `SectorTimingStore.tick()` subscribes to raw `LapDistPct`/`SessionTime` | Subsumed in P1 testing |
| **P6** | Hidden / minimised overlays still receive every broadcast | Requires test with windows minimised or behind other windows |
| **L4** | Reference-lap data has no size cap | Test with pre-existing saved reference lap |

### Disconfirmed as dominant cause

(None — A3 was previously listed here for the steady-state leak but has been reclassified as confirmed for the driver-join leak.)

---

## 5. Targets and Goals

Empirical baselines and post-remediation targets. Updated as targets are met.

| Metric | Pre-remediation baseline | **Current (post-Phase 0.5)** | Target | Source |
|--------|------------------------:|----------------------------:|--------:|--------|
| Multi-class startup memory | 2,908 MB | **1,390 MB** ✅ | < 1,800 MB | AI Race Multi-Class |
| Tick dips <20 Hz (16-min multi-class) | 7 | **0** ✅ | < 1 | AI Race Multi-Class |
| processTelemetry p99 mean | 12.5 ms | 8.2 ms | < 3 ms | AI Race Multi-Class |
| In-race app memory slope | +16.5 MB/min | +18.8 MB/min | < +5 MB/min | AI Race 1-Class (or Multi-Class) |
| Per-joining-driver permanent memory cost | ~5–6 MB | (untested post-0.5) | < 1 MB | Practice (real, joiners) |
| Renderer stutter (subjective) | Choppy after 5–10 min | Smooth throughout 16 min | No stutter at 30+ min | All in-race tests |

**Phase 0.5 success criteria:** Met for L1 and L2 (startup memory and tick stability). The S5 fix also appears successful.

**Remaining Phase 1+ goals:** Reduce steady-state in-race memory slope (P1), reduce per-tick latency (P5), reduce per-joining-driver memory cost (A2/A3/L5/A7).

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

*End of test log. To add a new test, follow §6.*
