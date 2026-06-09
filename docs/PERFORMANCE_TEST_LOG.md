# irDashies Performance — Test Log

> **Purpose:** Running record of empirical performance testing across remediation phases. Updated as new tests are completed.
> **Companion documents:** [`ARCHITECTURE_REVIEW.md`](./ARCHITECTURE_REVIEW.md), [`PERFORMANCE_TEST_SUMMARY.md`](./PERFORMANCE_TEST_SUMMARY.md)
> **Audience:** Project contributors and Claude Code instances reasoning about performance changes.

---

## How to use this document

This document tracks every PerfMetrics-based performance test run against irDashies, in chronological order. Each entry records what was tested, what the measurements showed, and how the result correlates with architecture review findings.

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
- irDashies process restarted fresh between each test (no carry-over from prior sessions)
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

**Important test-conditions variable: irDashies startup timing relative to iRacing.** Practice 5 surfaced that opening irDashies _while iRacing is loading into a session_ costs ~+1 GB of baseline memory compared to opening it _after the session is settled_. When recording a test entry, note which condition applies. The "post-load" startup is the cleaner methodology for steady-state slope measurements; the "during session-load" startup is a legitimate user scenario worth measuring separately and currently has its own row in §5.

---

## 3. Test Entries

> Newest at the top. Each entry follows the template in §6.

---

### 2026-05-18 · Combined Phase 2a · PCC race spectated · GR86 at Navarra

**Scenario:** Real multiplayer PCC race at Navarra, 4 classes, 42 drivers. User joined and spectated the first ~15 min of the race rather than driving. 23.5 min log capturing warmup → race start → 15 min of spectating → end.
**Build:** Combined Phase 2a + 2026-05-18 sessionLifecycle changes (same as GR86 Miami entry).
**Source log:** `SpectateRace-PCC-GR86-Navarra.txt`
**Spreadsheet:** `spectate_race_perfmetrics_analysis.xlsx`

**Lifecycle event counts:**

| Event                          | Count | When                                                         |
| ------------------------------ | ----: | ------------------------------------------------------------ |
| `Driver joined`                |   126 | 42 × 3 bridge connect cycles (no mid-session joins observed) |
| `Driver left (disconnect)`     |   126 | 42 × 3 bridge disconnect cycles                              |
| `Driver left (session-update)` |     0 | Never                                                        |
| `Disconnect detected`          |     3 | All at bridge bounces (21:43, 22:03, 22:03)                  |
| `SessionNum changed: 1 → 2`    |     1 | Warmup → race at 21:42:10                                    |
| Reference lap fetches          |    24 | 2 clusters of 12 (4 classes × 3 renderers × 2 transitions)   |
| Reference lap saves            |     6 | 2 clusters of 3                                              |

**Steady-state slopes (race window minute 5–22, 17 min, 105 samples):**

| Renderer         | Slope (MB/min) |
| ---------------- | -------------: |
| App total        |         +12.79 |
| Left (Standings) |          +4.21 |
| Primary          |          +2.57 |
| Right            |          +0.24 |
| Settings         |          +0.01 |
| GPU              |          +1.63 |
| Main             |          +4.16 |

**Latency:**

| Metric                    |                  Value |   Target |
| ------------------------- | ---------------------: | -------: |
| processTelemetry p99 mean |                7.49 ms |    <3 ms |
| broadcast p99 mean        |                0.51 ms | <1 ms ✅ |
| Tick dips <20 Hz          | 1 (bridge bounce only) |    <1 ✅ |

**Findings:**

1. **Memory slopes elevated vs SFL Hungary's clean numbers, but this is not treated as a Phase 2a regression.** Per the project lead's call, the slope difference is attributable to a combination of (a) scenario difference (4-class race vs 1-class practice — multi-class scenarios consistently show elevated slopes across the test history), (b) reference-lap fetch storm at session-load (24 fetches at 21:41:41 and 21:42:10), and (c) likely environmental/PC-side noise contributing to the steady-state read. The architectural Phase 2a changes are working as intended; the slope numbers here aren't a useful signal for further code-side investigation.
2. **Mid-session per-driver leave detection not firing.** Zero `Driver left (session-update)` events in 20 minutes of continuous race spectating despite drivers genuinely leaving (retirements, lapped cars). After review, this finding is being **declined for fix** — see §4 for the architectural rationale. The bridge-disconnect cleanup remains correct, and per-driver allocation is already small thanks to H4.
3. **The 4-class fetch storm at session-load is the most visible identifiable cost in this run.** 24 reference lap fetches in 30 seconds at session-load and SessionNum-transition. With reference-lap fetch dedup implemented, this would be 8 fetches instead of 24, eliminating most of the ~+114 MB single-sample jump at 21:42:08.
4. **Tick stability and broadcast latency remain at target.** processTelemetry p99 at 7.49 ms is elevated vs SFL Hungary's 3.03 ms but consistent with the multi-class history (4 classes × 42 drivers exercises more code paths per tick). Not flagged as a problem.

**Correlation with architecture review:**

| Finding                         | Status                                                                                                                   |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| Disconnect-path leave (Tier 2a) | Continues to validate (126 leaves match 126 joins on bridge events)                                                      |
| Mid-session per-driver leave    | **Declined for fix** — see §4                                                                                            |
| **Reference lap fetch dedup**   | **Confirmed implicated as the most visible remaining session-transition cost** — now the highest-priority remaining item |
| Tier 2b save debounce           | Still unverified at filesystem level (saves still cluster 3-at-a-time in logs)                                           |

---

### 2026-05-18 · Combined Phase 2a + Tier 2a logging/empty-Drivers guard · Practice (real, churn) · GR86 at Miami

**Scenario:** Real multiplayer GR86 practice at Miami, 10.2 min. Field of ~48–50 drivers; many drivers known to be departing mid-session to head to an official race lobby.
**Build:** Combined Phase 2a + new changes to `src/app/sessionLifecycle/sessionLifecycle.ts` (per-driver leave logging on disconnect, empty-Drivers guard) and `src/app/bridge/iracingSdk/iracingSdkBridge.ts` (null latestTelemetry/latestSession on disconnect).
**Source log:** `OfficialPractice-GR86-Miami.txt`
**Spreadsheet:** `gr86_practice_perfmetrics_analysis.xlsx`
**Display layout:** Same as 2026-05-17 (Left=2968111571=Standings, Centre=1231991429=Primary, Right=3296583556=Map/Weather).

**Lifecycle event counts:**

| Event                                       | Count | Notes                                                                                                                                  |
| ------------------------------------------- | ----: | -------------------------------------------------------------------------------------------------------------------------------------- |
| `Driver joined`                             |   196 | 144 at 05:07 (initial connect-disconnect-reconnect cycles), 2 mid-session (05:10, 05:11), 50 at 05:16 (end-of-session bridge bouncing) |
| `Driver left (disconnect)`                  |   196 | Symmetric with joins — but only at bridge-disconnect events                                                                            |
| `Released N per-driver slots on disconnect` |     4 | New summary line confirms cleanup on each disconnect                                                                                   |
| `Disconnect detected (N known drivers)`     |     4 | All four cycles logged                                                                                                                 |
| `ignoring (N still tracked)` warns          |     0 | Empty-Drivers guard didn't fire — no false-positive leave storms                                                                       |

**Top-line numbers (clean window minute 2.5–8.5, 36 samples):**

| Renderer         | Slope (MB/min) |
| ---------------- | -------------: |
| App total        |          +21.9 |
| Left (Standings) |           +4.3 |
| Primary          |           +4.8 |
| Right            |           +1.8 |
| GPU              |           +6.3 |
| Main             |           +4.7 |

**Latency means:**

| Metric                    |   Value | Status                       |
| ------------------------- | ------: | ---------------------------- |
| processTelemetry p99 mean | 4.80 ms | Slightly above SFL's 3.03 ms |
| broadcast p99 mean        | 0.45 ms | ✅ Under target              |
| Tick dips <20 Hz          |       0 | ✅                           |

**Findings:**

1. **The disconnect-path per-driver leave code is confirmed firing.** 196 `Driver left (disconnect)` lines symmetric with 196 joins; 4 `Released N per-driver slots on disconnect` summaries match 4 disconnect events. The previous open question about whether Tier 2a's leave callbacks were invoked is **definitively answered for the disconnect case**.
2. **HOWEVER — mid-session per-driver leave detection is NOT implemented.** All 196 leave events cluster into exactly two minute-buckets: 05:07 (96 leaves, initial bridge bouncing) and 05:16 (100 leaves, end-of-session bridge bouncing). Zero leave events in the 8m 43s of continuous driving between. The user has confirmed drivers were definitely leaving mid-session during that window (heading to the official race lobby). **The "leave path" code added in the recent PR only covers the iRacing-bridge-disconnect case, not the per-driver-departure-during-active-session case.** `_onSession` emits joins for newly-seen carIdxs (2 such events visible at 05:10 and 05:11) but does not emit leaves for previously-known carIdxs that are no longer in the incoming SessionInfo. This is a one-way diff bug.
3. **The empty-Drivers guard is working correctly.** Zero "ignoring (N still tracked)" warns appeared — the test conditions didn't trigger the case it guards against, and no false-positive leave storms occurred either.
4. **Memory slopes look elevated but this is largely a too-short-session artifact.** Session was only 8 min of usable post-startup data; the clean window still includes part of the startup ramp. SFL Hungary's 22-minute steady-state plateau hadn't established yet. Settings renderer also stayed at 180 MB (the Electron suspension didn't trigger in this short window).
5. **Architectural bug is bounded but still real.** With H4 having reduced per-driver allocation to near-zero, the memory impact of "ghost" drivers (departed drivers whose state isn't released until the next bridge disconnect) is small enough to be masked by GC. But the bug means the Standings widget shows departed drivers as still-present until the next iRacing-bridge disconnect — a visible UX bug independent of memory.
6. **Reference lap save still shows 3× clusters in logs.** 4 clusters of 3 saves each = 12 log lines. Unchanged from every Phase 2a test. Filesystem-level verification still required.

**Correlation with architecture review:**

| Finding                                            | Status                                                                                                                                                                         |
| -------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Tier 2a leave-on-disconnect (bridge drop)          | **VALIDATED** — log evidence is unambiguous                                                                                                                                    |
| Tier 2a empty-Drivers guard                        | **VALIDATED** — no false-positive leave storms                                                                                                                                 |
| Tier 2a stale-state nulling (iracingSdkBridge)     | Architecturally fixed; no observed regression                                                                                                                                  |
| **Tier 2a per-driver leave during active session** | **NEW FINDING — NOT IMPLEMENTED.** `_onSession` does a one-way diff (new drivers → join) but never emits leaves for previously-known drivers absent from incoming SessionInfo. |
| Tier 2b save debounce                              | Still not validated by logs (3× clusters persist)                                                                                                                              |

**Recommended next implementation:**

Extend `_onSession` to do a two-way diff against `knownDrivers`:

- For carIdxs in new SessionInfo but not in knownDrivers → emit `Driver joined` (existing behaviour)
- For carIdxs in knownDrivers but not in new SessionInfo → emit `Driver left (session-update): carIdx=N` and invoke the same per-driver release callbacks as the disconnect path

Defensive considerations:

- Real iRacing SessionInfo updates occasionally have transient driver-entry omissions during qualifying-to-race transitions or driver swaps. Either require N consecutive absences before emitting leave (suggest N=2 or 3), or use a stronger identity key (carIdx + UserName/UserID) to detect "same slot, different driver" as leave-then-join.
- The `(session-update)` log suffix distinguishes it from `(disconnect)` so next test analysis can count each path independently.

---

### 2026-05-17 · Combined Phase 2a · Practice (real, driver churn) · SFL at Hungary

**Scenario:** Real multiplayer SFL (Super Formula Lights) practice at Hungary, 27.4 min. Set up specifically to exercise driver-leave conditions — field churned through the session with multiple joins and (we believe) leaves.
**Build:** Combined Phase 2a PR (same as 2026-05-17 Practice → Ghost Race entry)
**Source log:** `OfficialPractice-SFL-Hungary.txt`
**Spreadsheet:** `sfl_practice_perfmetrics_analysis.xlsx`
**Display layout:** Same as 2026-05-17 combined PR test:

- Left (x=−1920): Renderer 2968111571 — Standings
- Centre/Primary (x=0): Renderer 1231991429 — Driving widgets (Primary)
- Right (x=+1920): Renderer 3296583556 — Map/Weather

**Top-line numbers (steady-state, minute 6 onwards, 22 min, 129 samples):**

| Renderer                        | Slope (MB/min) | Status                      |
| ------------------------------- | -------------: | --------------------------- |
| **App total**                   |   **+1.30** ✅ | Far under <+5 target        |
| Left (Standings, 2968111571)    |       +0.35 ✅ | Effectively flat            |
| Primary (1231991429)            |       +0.73 ✅ | Under <+1 target            |
| Right (Map/Weather, 3296583556) |       −0.03 ✅ | Flat                        |
| Settings                        |       −0.01 ✅ | Flat                        |
| GPU                             |       −0.85 ✅ | **Actively declining**      |
| Main                            |       +1.09 ✅ | Under <+0.5 target¹ (close) |

¹ Main slightly above the <+0.5 target but well within the previous +2.3 baseline.

**Latency:**

| Metric                    |                                         Value | Target | Status                           |
| ------------------------- | --------------------------------------------: | -----: | -------------------------------- |
| processTelemetry p99 mean |                                   **3.03 ms** |  <3 ms | ✅ Essentially at target         |
| processTelemetry avg      |                                       1.65 ms |      — | —                                |
| processTelemetry max      |                                       4.48 ms |      — | —                                |
| broadcast p99 mean        |                                       0.47 ms |  <1 ms | ✅ Under                         |
| broadcast avg             |                                       0.24 ms |      — | —                                |
| Tick dips <20 Hz          | 2 (both at iRacing bridge bouncing minute 22) |     <1 | Effectively zero in steady-state |

**Findings:**

1. **This is the cleanest in-race steady-state result captured to date.** App memory grew +30 MB across 22 minutes of steady-state practice. processTelemetry p99 mean is at the <3 ms target. Tick rate held 21.7 Hz mean with zero dips outside the brief iRacing bridge-bouncing event at minute 22. Subjectively this would feel completely smooth from a driver's perspective.
2. **Per-driver-join cost is dramatically reduced.** Six observable mid-session driver joins (carIdx 10, 11, 12, 13, 15, 16, 17) produced memory deltas of typically 0–12 MB across all renderers combined, often dominated by GC noise. Pre-fix baseline was ~5–6 MB per driver in Left alone. Phase 2a Tier 1 + Tier 2a together have effectively closed the per-driver-join cost.
3. **The −335 MB drop at minute 5 is V8 GC + settings renderer suspension, NOT lifecycle cleanup.** Two events combined in one sample window: V8 major GC fired across driver-aware renderers (Left −64, Primary −60, GPU −22), and the settings renderer dropped 179 → 75 MB and stayed there. The settings drop is Electron suspending the inactive settings window — normal and beneficial. The drop is not correlated with the driver-10 join 32 seconds earlier (the join was only +16 MB net).
4. **NO `Driver left` events fire — third test in a row to confirm this.** The test was specifically set up to surface leave events: 27 minutes of practice with field churn, ending with iRacing bridge events. The log shows 49 `Driver joined` events, 3 `Disconnect detected (N known drivers)` events, and **zero leave events of any kind**. The "Disconnect detected" events at 21:43:45, 21:43:58, 21:49:12 are iRacing bridge bouncing or session end, not driver departures.
5. **Smoking gun: carIdx 14 is missing from the join sequence.** Joins go 9 → 10 → 11 → 12 → 13 → **15** → 16. Either slot 14 was never occupied (and there's no missing leave), or a driver was at slot 14 and left silently. The 3-minute gap between drivers 13 (21:37:57) and 15 (21:41:02) is suspicious. Either way, no leave event was logged. **We have no positive evidence across any test that the per-driver-leave callback fires.**
6. **Reference lap save dedup still shows 3× clusters in logs.** Six save events × 3 log lines each = 18 saves logged. Same pattern as PCC race, combined PR test, and earlier runs. Either Tier 2b's debounce works but the log line fires pre-debounce, or the debounce isn't engaging. Filesystem-level verification still required.
7. **Reference lap fetch still 3× per session.** 3 fetches at session start for the single SFL class. Not addressed by Tier 2b.
8. **App memory stayed remarkably low for the entire session.** Peak was 1,559 MB (briefly, before settings suspension), settled at ~1,250 MB for most of the session. Comfortably below the <2,000 MB target.

**Correlation with architecture review:**

| Finding                                            | Status                                             | Evidence from this run                                                                                                             |
| -------------------------------------------------- | -------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| Tier 1 / H4 + H1 (Standings/per-driver allocation) | **Continues to validate strongly**                 | Standings slope +0.35 MB/min; per-join cost typically 0–12 MB total across renderers                                               |
| Combined Phase 2a (overall)                        | **Strongly validated as steady-state remediation** | App slope +1.3 MB/min, latency p99 at target, peak memory <1.6 GB                                                                  |
| Tier 2a per-driver-leave path                      | **NOT FIRING — third confirmed test**              | 49 joins, 0 leaves. Two possible underlying causes (see §4): silent firing without log line, or leave callback not invoked at all. |
| Tier 2b save debounce                              | **Logs still show 3× clusters**                    | 6 save events × 3 logs each. Needs filesystem-level verification.                                                                  |
| Reference lap fetch per-renderer                   | Still 3× per session                               | Not in Tier 2b scope                                                                                                               |
| Main process slope                                 | **Holding under target**                           | +1.09 MB/min, well under previous +2.3 baseline                                                                                    |

---

### 2026-05-17 · Combined Phase 2a (Tier 1 + H1 + Tier 2a + Tier 2b) · Practice → Ghost Race · PCup at Spa

**Scenario:** Integrated test of all Phase 2a changes. Practice session for ~12 min, then SessionNum transitions to spectated/ghost race for ~12 min (user could drive but was not being scored; full standings and timing visible — telemetrically identical to a normal race).
**Build:** Combined PR containing Tier 1 (`ce3d0f30`), H1 (`5329db8a`), Tier 2a (`502a197c`), Tier 2b (`5e937eca`)
**Source log:** `Practice_to_GhostRace-PCup-Spa.txt`
**Spreadsheet:** `combined_perfmetrics_analysis.xlsx`
**Display layout confirmed:** Same dashboard as prior tests, IDs reshuffled after Windows update:

- Left (x=−1920): Renderer 2968111571 — Standings
- Centre/Primary (x=0): Renderer 1231991429 — Driving widgets
- Right (x=+1920): Renderer 3296583556 — Map/Weather

**Top-line numbers (cleaned, 24.4 min, 130 samples):**

| Metric                              | Pre-remediation | PCC Race (Tier 1 alone) |      **This run (combined)** |                  Δ vs PCC |
| ----------------------------------- | --------------: | ----------------------: | ---------------------------: | ------------------------: |
| **Peak app memory**                 |       ~3,000 MB |                2,914 MB |                 **1,777 MB** |                  **−39%** |
| App slope (ghost race steady state) |    +18.8 MB/min |             +5.7 MB/min |                  +7.1 MB/min |                small +1.4 |
| Primary slope                       |     +9.8 MB/min |             +1.8 MB/min |                  +3.5 MB/min | regression worth checking |
| **Left/Standings slope**            |    +18.5 MB/min |             +0.9 MB/min |           **−0.4 MB/min** ✅ |         flat-to-declining |
| Main slope                          |     +6.0 MB/min |             +2.3 MB/min |           **+0.5 MB/min** ✅ |        **−78%** at target |
| GPU slope                           |     +3.2 MB/min |             +0.6 MB/min |                  +3.0 MB/min |        scenario-dependent |
| processTelemetry p99 mean           |         12.5 ms |                  7.4 ms |                   **4.6 ms** |                  **−38%** |
| broadcast p99 mean                  |         1.71 ms |                 0.57 ms |               **0.45 ms** ✅ |              under target |
| Tick dips <20 Hz                    |               8 |        1 (startup only) | 4 (clustered at transitions) |                 see notes |

**Session-transition memory cost dramatically reduced:**

| Event                                       |                  PCC Race (Tier 1) |       **This run (combined)** |        Δ |
| ------------------------------------------- | ---------------------------------: | ----------------------------: | -------: |
| Session-load (driver hydration burst)       | +1,010 MB across one sample window | **+280 MB across 40 seconds** | **−72%** |
| Practice → ghost race SessionNum transition |                                n/a |            +75 MB across ~20s |        — |

**Findings:**

1. **Peak app memory is down ~40% vs the equivalent Tier-1-only baseline** (1,777 MB vs 2,914 MB). Across two scenarios (practice, ghost race) the app never exceeded ~1,800 MB despite a 48-driver field. The cumulative effect of Tier 2a + Tier 2b on session-boundary allocations is substantial — even though the per-component evidence is harder to isolate, the integrated result is the clearest single performance gain since Phase 0.5.
2. **Standings renderer is essentially flat across both phases.** Practice phase slope was effectively zero; ghost race phase slope is −0.4 MB/min (actively declining). The H4 fix from Tier 1 continues to hold, and H1 (createStandings rewrite) has not regressed it. Note: the test didn't surface driver-leave events (the field was stable throughout — no drivers actually left), so the per-driver leave path itself isn't validated by this run.
3. **Main process slope dropped from +2.3 to +0.5 MB/min — at target.** This is the cleanest individual metric improvement. Main is no longer the dominant remaining in-race leak source. The app-level slope of +7.1 MB/min is now distributed mostly across Primary (+3.5) and GPU (+3.0).
4. **Latency targets closing in.** processTelemetry p99 mean of 4.6 ms is the lowest measured since testing began (target <3 ms). broadcast p99 of 0.45 ms is comfortably under its <1 ms target.
5. **Tier 2a's per-driver leave path was not exercised by this test.** The test conditions had a stable 48-driver field for the entire measurement window. The "Disconnect detected (N known drivers)" log lines all correspond to either iRacing session-bridge bouncing during load (events at 20:44:21 and 20:48:19–20:48:27) or intentional SessionNum changes (20:48:53, 20:57:04) — none represent actual driver departures. **The memory improvement evidence credits the cleanup that fires at session-boundary transitions** (most likely the SessionNum-change path), not the per-driver-leave path. The leave path needs a churn-heavy practice session to validate.
6. **Tier 2b reference lap save dedup is not visible in logs.** The PR description says "removes 3× per-renderer save bursts" but the log still shows save clusters of 9 saves in 4 seconds (3 events × 3 renderers each). Three possibilities: (a) the log line fires at the renderer subscribe point before the debounced write, so file-system writes are deduplicated but log lines are not; (b) the debounce isn't engaging; (c) the fix didn't land in this build. Filesystem-level write counts would discriminate.
7. **Reference lap fetch dedup remains unfixed.** 12 fetches across the session for 1 class = 3× per SessionNum transition (× 4 events). Not in Tier 2b's stated scope.
8. **Tick stability is excellent during steady-state.** All 4 sub-20 Hz dips clustered between minutes 1.5 and 5.8, during the iRacing session-bridge bouncing on initial load. After minute 6, zero dips for the remaining 18 minutes.
9. **Primary renderer slope (+3.5 MB/min) is slightly elevated** vs PCC's +1.8. Could be scenario-dependent, could be a small H1 side effect. Not at target (<+1 MB/min) but well below the +9.8 pre-remediation baseline.

**Correlation with architecture review:**

| Finding                                             | Status                                           | Evidence from this run                                                                           |
| --------------------------------------------------- | ------------------------------------------------ | ------------------------------------------------------------------------------------------------ |
| Tier 1 / H4 (PitLapStore allocation storm)          | **Continues to validate**                        | Standings slope at −0.4 MB/min in ghost race phase                                               |
| Tier 2a (SessionLifecycle session-boundary cleanup) | **Partially validated** — boundary cleanup works | Peak memory −40%, session-load delta −72%                                                        |
| Tier 2a (per-driver leave on disconnect)            | **NOT tested in this run**                       | Field was stable throughout — no drivers actually left                                           |
| Tier 2b (reference lap save debounce)               | **NOT validated by log evidence**                | Save clusters still appear in logs. Needs filesystem-level write-count confirmation.             |
| H1 (createStandings rewrite)                        | **No regression, isolated benefit unclear**      | Standings memory excellent but Tier 1 alone achieved similar. CPU benefit not directly measured. |
| Reference lap fetch per-renderer                    | Still 3× per event                               | Not in Tier 2b scope                                                                             |

**Two unresolved verification questions for this build:**

1. **Is Tier 2a's per-driver-leave path actually firing on driver disconnects?** This test did not exercise it.
2. **Is Tier 2b's save debounce engaging at filesystem level?** Log shows 9-save clusters but actual file writes could be deduplicated.

**Recommendations for next test:**

1. **Churn-heavy practice session** to validate Tier 2a per-driver-leave path. Open a busy practice session, observe for 15+ minutes while drivers come and go. If `Driver left` log lines appear (or driver count decreases over time without driver-joined events), Tier 2a is firing correctly.
2. **Add a log line on the actual file write (post-debounce)** for Tier 2b validation, or count `.json` writes in the reference-lap directory during a test where the user sets multiple fast laps in quick succession.
3. **The PR is mergeable on memory and latency grounds.** Remaining concerns are diagnostic-verification rather than performance gaps.

---

### 2026-05-16 · Post-Phase 2a (H1 branch: createStandings rewrite) · Race · Clio Cup at VIR

**Scenario:** Real multiplayer race in Clio Cup at VIR, single-class. Testing the `phase-2a-h1-standings-rewrite` branch (separate from the Tier 2 branch).
**Build:** Phase 2a H1 branch only (createStandings rewrite, O(N²) `find()` removed, Map-based grouping, store snapshot hoisted)
**Source log:** `Race-ClioCup-Clio-VIR.txt`
**Spreadsheet:** `h1_race_perfmetrics_analysis.xlsx`

**Top-line numbers (cleaned, 35.1 min, 205 samples) — race steady-state phase (minutes 15–31):**

| Renderer                         | Slope (MB/min) | Notes                                               |
| -------------------------------- | -------------: | --------------------------------------------------- |
| App total                        |        +5.2 ✅ | Under target                                        |
| Primary                          |        +0.6 ✅ | Excellent                                           |
| Right (3875737098)               |       +0.04 ✅ | Flat                                                |
| **Left (Standings, 1673143397)** |       **+4.1** | Elevated vs PCC's +0.9 in same metric; see findings |
| GPU                              |        +0.3 ✅ | Flat                                                |
| Main                             |        +0.2 ✅ | At target                                           |

**Latency means (full session):**

| Metric               |   Value |        Target |
| -------------------- | ------: | ------------: |
| processTelemetry p99 | 3.97 ms | <3 ms (close) |
| broadcast p99        | 0.52 ms |      <1 ms ✅ |
| App CPU mean         |   13.8% |             — |

**Findings:**

1. **Steady-state performance is broadly equivalent to Tier-1-only.** App-level slope, Primary, Right, GPU, Main all comparable to or better than the PCC race baseline. Main process in particular dropped to +0.2 MB/min — at target.
2. **Left/Standings slope at +4.1 MB/min is elevated** vs PCC's +0.9 in the equivalent comparison. **Caveats:** different scenario (single-class Clio Cup vs PCC 4-class multi-class), different display rig. The Practice 6 (Tier 2 branch) test also showed an elevated Standings slope in single-class scenarios (+6.4 MB/min), suggesting this pattern is **shared across both branches** rather than introduced by H1 specifically. Most plausible explanation: single-class scenarios stress different Standings code paths than the multi-class scenarios H4 was tuned for.
3. **H1's isolated value not directly demonstrated.** The rewrite was scoped to remove O(N²) cost and provide CPU win, but CPU savings vs Tier 1 are subtle (Standings renderer CPU was 2.3% here vs 3.1% in the Tier-1-only baseline — small improvement). Memory-wise, no clear advantage over Tier 1 alone.
4. **The −269 MB drop at minute 32 is V8 major GC**, not lifecycle cleanup. No corresponding log event. Same pattern as PCC race's mid-race GC drop.
5. **13 disconnects at session-load** and 1 app-restart during the first 90 seconds — unusually noisy session-load, possibly user-initiated app restart during connection. The steady-state analysis (minute 15+) is the clean data.
6. **App quit and restart within test window** at 05:59:20 — looks like the user closed and reopened the app, not a crash.

**Correlation with architecture review:**

| Finding                          | Status                                                                                                                                     |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| H1 (createStandings rewrite)     | **No regression, isolated benefit modest**                                                                                                 |
| Single-class Standings elevation | Pattern reproducing across two parallel branches (Tier 2, H1) — suggests scenario sensitivity in Standings code paths, not branch-specific |

---

### 2026-05-16 · Phase 2a Tier 2 branch (disconnect cleanup wiring) · Practice (real, joiners) · TCR at Watkins Glen

**Scenario:** Real multiplayer practice in TCR at Watkins Glen, testing `phase-2a-tier2-disconnect-cleanup` branch.
**Build:** Phase 2a Tier 2 branch (separate from H1) — adds `[sessionLifecycle] Disconnect detected (N known drivers)` diagnostic and infrastructure for per-driver leave cleanup
**Source log:** `OfficialPractice6-TCR-Watkins.txt`
**Spreadsheet:** `practice6_perfmetrics_analysis.xlsx`

**Top-line numbers (cleaned, 13.3 min, 80 samples):**

| Renderer                         | Post-startup slope (min 1.5+) |
| -------------------------------- | ----------------------------: |
| App total                        |                  +10.5 MB/min |
| Primary                          |               +0.85 MB/min ✅ |
| Right (3875737098)               |               +0.68 MB/min ✅ |
| **Left (Standings, 1673143397)** |             **+6.4 MB/min** ⚠ |
| GPU                              |                   +2.4 MB/min |
| Main                             |                +0.3 MB/min ✅ |

**Findings:**

1. **New diagnostic infrastructure landed: `[sessionLifecycle] Disconnect detected (N known drivers)` logging.** Lifecycle abstraction now reports how many drivers it tracks at disconnect time. This is genuinely useful observability infrastructure.
2. **However, the disconnect cleanup is not visibly firing.** 6 disconnect events logged in this session, zero `Driver left` (or equivalent) log lines, no memory drops correlated with the disconnect events. Memory continues to climb across the session despite repeated disconnect events. **Interpretation:** Either the leave path is wired up but firing silently (no log message), or the infrastructure is in place but the consumer-side cleanup callbacks aren't yet hooked up.
3. **Main process slope dropped substantially** (PCC race: +2.3 → this run: +0.3 MB/min). Significant improvement, though potentially scenario-dependent (single-class practice vs 4-class race).
4. **Standings slope re-emerged at +6.4 MB/min** vs PCC race's +0.9. Similar to H1 branch finding — pattern appears in single-class scenarios across both Phase 2a parallel branches.
5. **Reference lap fetch still 3× per class** at session-load (3 fetches for the single TCR class).
6. **Tick stability excellent** — 1 dip (startup ramp only).

**Correlation with architecture review:**

| Finding                                | Status                                                                       |
| -------------------------------------- | ---------------------------------------------------------------------------- |
| Tier 2 disconnect diagnostic           | **CONFIRMED implemented** — useful new observability                         |
| Tier 2 per-driver leave cleanup firing | **Not visible** — no log evidence, no memory correlation. May fire silently. |
| Single-class Standings elevation       | Reproduces — see H1 entry                                                    |

---

### 2026-05-15 · Post-Phase 2a (Tier 1) · PCC Race Multi-Class · Clio at Navarra · 42-minute full session

**Scenario:** Real multiplayer 4-class PCC race (15 laps, ~25 min racing + warmup/qualifying/post-race). **First test capturing a complete user journey** from session-load through warmup → qualifying → 15-lap race → post-race.
**Build:** Post-Phase 2a (no changes since Practice 5)
**Source log:** `Race1-PCC-Clio-Navarra.txt`
**Spreadsheet:** `pcc_race_perfmetrics_analysis.xlsx`
**Lap-time correlation:** Provided by user — race ran from rolling start at 05:43:53 (clock time matched via +10h offset from GMT lap data) to chequered at ~06:15:42

**Top-line numbers (42.5 min, 256 samples):**

| Phase   | Minutes | Activity                       |       App slope |   Mean memory | Notes                                   |
| ------- | ------- | ------------------------------ | --------------: | ------------: | --------------------------------------- |
| **A**   | 0–10    | Warmup / qualifying / pre-grid |     +6.4 MB/min |      1,607 MB | Stable plateau                          |
| **B+C** | 11–31   | **Race (laps 1–~9)**           | **+5.7 MB/min** |      2,863 MB | At <+5 MB/min target                    |
| **D**   | 31      | Mid-race lap 9 — V8 major GC   |    −304 MB drop | 2,910 → 2,621 | Routine GC, not lifecycle cleanup       |
| **E**   | 32–42   | Laps 10–15 + chequered         |  flat ~2,580 MB |      2,594 MB | Slight downward drift to GC equilibrium |

**Per-renderer slopes during the 20-min race phase (B+C):**

| Renderer         | Slope (MB/min) | Status                             |
| ---------------- | -------------: | ---------------------------------- |
| App total        |           +5.7 | At target                          |
| Primary          |           +1.8 | Slightly above <+1 target          |
| Left (Standings) |           +0.9 | ✅ Under <+2 target                |
| Right            |           +0.3 | ✅ Flat                            |
| GPU              |           +0.6 | ✅ Flat                            |
| **Main**         |       **+2.3** | Most visible remaining leak source |

**CPU and latency (full session means):**

| Metric               |                 Value | Target | Status              |
| -------------------- | --------------------: | -----: | ------------------- |
| App CPU mean         |                 16.6% |      — | Stable              |
| processTelemetry p99 |               7.37 ms |  <3 ms | Above target        |
| broadcast p99        |               0.57 ms |  <1 ms | ✅ Under target     |
| Tick dips <20 Hz     | 1 (startup ramp only) |     <1 | ✅ Effectively none |

**Findings:**

1. **In-race steady-state confirmed at scale.** The +5.7 MB/min app-level slope during a 20-minute real-multiplayer 4-class race is at the <+5 MB/min target. Phase 2a's H4 fix continues to hold — Left/Standings slope is +0.9 MB/min, comfortably under target. The first three phases of remediation have produced a genuinely working baseline for in-race behaviour.
2. **Race-start session transition is the dominant remaining memory cost.** At 05:44:36 (43 seconds before lap 1 properly began, during the rolling start), app memory jumped +681 MB in a single 10-second sample, with another +329 MB in the next sample. **+1 GB allocated in ~20 seconds at race-start** — consistent with per-driver state hydrating across ~50 drivers in 4 classes (~250+ MB just for the driver state, plus session/timing/weather hydration). All driver-aware processes grow together; NetworkService jumps 53 → 230 MB (the PostHog queue accumulation we've documented). This is the same fundamental issue Practice 5's boot log identified, now confirmed at race-start as well as app-boot.
3. **The −304 MB drop at minute 31 is V8 major GC, NOT lifecycle cleanup.** Initial analysis suggested this might be session-end release. The lap data corrects this — the drop happened mid-lap 9, with the race continuing for another 6 laps after it. The uniform drop across all renderers, combined with the heap approaching ~2,940 MB (close to V8's default major-GC threshold for the renderer processes), is consistent with routine GC. **This is a significant correction: we have zero observed evidence of the disconnect/session-end cleanup path firing successfully in any test to date.** Every memory drop we've seen has been GC, not lifecycle.
4. **Reference lap save duplication is a new finding.** Beyond the fetch duplication identified in Practice 5, this race captured **51 reference lap save log lines for 17 distinct save events** — each save fires 3× in 15–60 ms intervals, matching the per-renderer pattern. This is more impactful than the fetch case because saves happen _during gameplay_ (every time the user sets a new fast lap), not just at session boundaries. Three synchronous file writes per fast lap is a user-experience risk during hot laps.
5. **Subjective performance is now genuinely good.** Lap times during the race were remarkably consistent (1:56.3–1:57.1 across 13 hot laps, ±0.4s variance — normal human inconsistency, not app-induced jitter). Combined with the zero tick dips during 42 minutes of measurement, this is the first dataset where the in-race driving experience appears smooth from both the metrics and the user's perspective.
6. **Main process is now the largest single in-race leak source.** At +2.3 MB/min during the race steady-state, it's roughly double the next-largest renderer contribution and untouched by any fix to date. Worth profiling next.

**Correlation with architecture review:**

| Finding                                    | Status                                      | Evidence from this run                                                                                                                                        |
| ------------------------------------------ | ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| H4 fix (steady-state Standings)            | **Continues to hold at scale**              | Left at +0.9 MB/min over 20 min of real racing                                                                                                                |
| P1/P2/P4 (telemetry firehose)              | **Continues to hold at scale**              | Primary at +1.8 MB/min during racing                                                                                                                          |
| Session-transition cost (A2/A3 incomplete) | **CONFIRMED — race-start allocates ~+1 GB** | Single-sample +681 MB jump at rolling start                                                                                                                   |
| **Reference lap save per-renderer** (new)  | **NEW finding — confirmed implicated**      | 51 saves observed for 17 distinct events; 3× per save; happens during gameplay                                                                                |
| Reference lap fetch per-renderer           | Continues to reproduce                      | 24 fetches for 4 classes × 2 transitions = 3× per event                                                                                                       |
| Disconnect leave cleanup                   | **CONFIRMED still not firing**              | The −304 MB drop initially suggested cleanup was working; lap correlation proves it was GC. Zero positive observations of lifecycle cleanup across all tests. |
| Main process slope                         | Persistent across all phases                | +2.3 MB/min in steady-state race; untouched by H3/H4                                                                                                          |

**Methodological note for future analyses:**

When a memory drop coincides with a possible lifecycle event, **always verify against external session timing**. The −304 MB drop in this session was initially attributed to session-end cleanup before the lap-time data was provided. The drop's clean shape (uniform across renderers, occurring near V8's known major-GC threshold) was the more likely interpretation but the lifecycle hypothesis felt plausible without timing data. **Future test logs should include session-event timestamps** (race start, race end, qualifying transitions) where available, so memory events can be correctly attributed.

**Updated recommendations for next implementation phase:**

1. **Reference lap save + fetch deduplication (combined fix)** — both are the same root cause (per-renderer I/O that should be main-process singleton + broadcast). The save case is now confirmed as the higher-impact half because it fires during gameplay. Estimated effort: small. Estimated impact: meaningful — eliminates 2 of every 3 file writes during a race.
2. **Disconnect / session-transition cleanup** — the missing piece of A2/A3. The +1 GB race-start allocation has no matching release path. Implementing the leave cleanup would close most of the gap between "app at end of race" (~2,580 MB) and "app before race started" (~1,540 MB). Estimated effort: medium (requires designing what state belongs to a session vs the app). Estimated impact: large — directly addresses the ~+1 GB per-session retained cost.
3. **Main process leak investigation** — now the largest visible in-race leak at +2.3 MB/min. Worth a Main-process-only memory profile to identify the source. Estimated effort: investigation; fix likely follows from findings.

H1 (`createDriverStandings` rewrite) and P5 (`DriverInfoRow` memo) remain deprioritised — the race steady-state numbers don't motivate them. They may be worth pursuing later for code quality or to enable per-slot subscriptions, but not for performance.

---

### 2026-05-14 · Post-Phase 2a (Tier 1: H3 + H4) · Practice (real, joiners) · IMSA GT3 at Road Atlanta

**Scenario:** Practice (real, joiners) — active driver churn throughout. **Important context:** irDashies was started while iRacing was loading into the session, capturing the session-load hydration burst.
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

The boot log captured between irDashies start (21:17:14) and the user starting to drive revealed two issues that PerfMetrics alone could not show:

1. **Reference lap fetch fires 3× per class (once per renderer instead of once per app).** When iRacing connects at 21:18:36, the log shows:
   ```
   Fetching reference lap for Series: 539, Track: 127, Class: 2523  (×3)
   Fetching reference lap for Series: 539, Track: 127, Class: 4011  (×3)
   Fetching reference lap for Series: 539, Track: 127, Class: 4029  (×3)
   ```
   Nine fetches instead of three. Each renderer is independently requesting reference data on its own SessionInfo event, and the main process is dutifully fetching the same data per request. This is a per-renderer duplication of work that should be app-singleton, and it costs both I/O and memory (3× the reference lap state stored across renderers).
2. **The disconnect path does not fire driver-leave events.** The log shows iRacing's connection state bouncing 3 times in 6 seconds during session-load (typical during iRacing's startup). Each `iRacing is running` event fires 41–44 `Driver joined` events. But the corresponding `iRacing is no longer publishing telemetry` events at 21:18:37 and 21:18:41 fire only a single `[sessionLifecycle] Disconnect detected` — **no per-driver leave events follow.** If the disconnect handler isn't releasing per-driver state, the second and third reconnects allocate fresh state on top of existing state. In this single session-load, ~129 driver-slot allocations were made for only 44 distinct drivers.

This is the A2/A3 finding only partly addressed: Phase 2a wired up join detection but not leave cleanup.

**Reproducible: opening irDashies during iRacing session-load costs ~+1 GB baseline.**

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

| ID                     | Description                                                             | Validation                                                                                                                                   |
| ---------------------- | ----------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| **L1**                 | Synchronous `writeFileSync` on main process                             | Phase 0.5 — tick dips eliminated                                                                                                             |
| **L2**                 | YAML re-parsed on every `getSessionData` call                           | Phase 0.5 — multi-class startup cost eliminated                                                                                              |
| **S5**                 | Analytics forwards every warn/error log line to PostHog                 | Phase 0.5 — NetworkService returned to 53 MB baseline                                                                                        |
| **P1**                 | Full 340-key telemetry payload structured-cloned to every overlay 25 Hz | Phase 1 — Primary slope −97%, broadcast latency −54%                                                                                         |
| **P2**                 | `useDriverPositions` subscribes to raw `CarIdxLapDistPct`               | Phase 1 — implicit in P1 fix; Primary leak elimination consistent with replacement                                                           |
| **P4**                 | `SectorTimingStore.tick()` subscribes to raw `LapDistPct`/`SessionTime` | Phase 1 — implicit in P1 fix                                                                                                                 |
| **H3**                 | Spurious `reset()` calls at boot on undefined→0 SDK-connect transitions | Phase 2a Tier 1 — no duplicate "Resetting lap time history" log lines in P5 boot                                                             |
| **H4**                 | `PitLapStore.updatePitLaps` clone storm on uneventful ticks             | Phase 2a Tier 1 — Left renderer slope dropped 95%; combined PR shows Standings at −0.4 MB/min (declining)                                    |
| **Standings widget**   | Per-driver allocation pattern in Standings                              | Phase 2a Tier 1 (via H4) and H1 rewrite — slope now under target across multi-class scenarios                                                |
| **Main process slope** | Persistent +2–6 MB/min steady-state growth in main process              | Phase 2a combined — Main slope dropped to +0.5 MB/min in combined PR test, at target. Likely attributed to Tier 2a session-boundary cleanup. |

### Partially fixed, work outstanding

| ID                                        | Description                                               | What's done / what remains                                                                                                                                                                                                                                                                                                      |
| ----------------------------------------- | --------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **A2**                                    | No `SessionLifecycle` abstraction                         | Phase 2a — join detection, disconnect-cleanup, empty-Drivers guard, stale-state nulling all implemented and validated. **Mid-session per-driver leave detection declined as a fix** — see "Declined for fix" subsection below. The abstraction is considered functionally complete for the purposes of this remediation effort. |
| **A3**                                    | `useResetOnDisconnect` callers                            | Phase 2a wired up callers; firing confirmed on disconnect events. Mid-session per-driver invocation declined for the same reason as A2.                                                                                                                                                                                         |
| **Tier 2a — disconnect-path leave**       | Per-driver leave emission when iRacing bridge disconnects | **VALIDATED 2026-05-18 GR86 Miami test.** 196 `Driver left (disconnect)` events symmetric with 196 joins; 4 `Released N per-driver slots` summaries match 4 disconnect events. Empty-Drivers guard validated (0 false-positive leave storms).                                                                                   |
| **Tier 2b — reference lap save debounce** | 3× per-renderer save burst                                | Phase 2a Tier 2b added 250ms debounced async write per the PR description. **Not validated by log evidence in any of the five Phase 2a tests** — saves still cluster 3-at-a-time in logs. Either log line fires pre-debounce or fix isn't engaging. Needs filesystem-level write-count confirmation.                            |

### Declined for fix

| ID                                         | Description                                                                                                                                                                                                        | Rationale                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Mid-session per-driver leave detection** | `_onSession` does a one-way diff: new carIdx → emit join, but never emits leave for previously-known carIdx absent from incoming SessionInfo. Surfaced in GR86 Miami (2026-05-18) and spectated race (2026-05-18). | **Declined after cost/benefit review.** The empirical memory cost is small (per-driver allocation is already minimal post-H4, and bridge-disconnect cleanup catches everything eventually). The implementation cost is non-trivial because real iRacing SessionInfo updates have transient driver-entry omissions during qualifying-to-race transitions and driver swaps, so any naive "missing this update = leave" diff would risk introducing false-positive leave storms — possibly worse than the bug being fixed. The user-visible "ghost driver in Standings" symptom is mild and arguably matches iRacing's own behaviour during real races. The remaining engineering effort is better spent on reference-lap fetch dedup and Tier 2b verification, both of which deliver clearer wins. |

### Confirmed implicated, fix outstanding

| ID                                               | Description                                                                                                                                                                                                                                                                                                                                                                                                                          | Phase scope                                                                                                   |
| ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------- |
| **Reference lap fetch per-renderer**             | When iRacing connects, each renderer independently fetches reference laps for each class. Results in 3× I/O per session transition. Should be main-process singleton + broadcast. Not in Tier 2b scope.                                                                                                                                                                                                                              | Targeted small fix — still recommended                                                                        |
| **Tier 2a per-driver-leave path verification**   | Tier 2a code is in place but the leave path has not been exercised by any test scenario to date. Needs a churn-heavy practice session to validate.                                                                                                                                                                                                                                                                                   | Test required, not new fix                                                                                    |
| **P5**                                           | `memo(DriverInfoRow)` defeated by prop churn                                                                                                                                                                                                                                                                                                                                                                                         | Phase 1 (not addressed); now low priority — Standings memory leak is resolved, residual P5 CPU cost is small. |
| **L5**                                           | Module-global callback `Set`s in bridges not cleared on window close                                                                                                                                                                                                                                                                                                                                                                 | Phase 2 — driven by completing A2/A3 lifecycle                                                                |
| **A7**                                           | 8 ad-hoc bridges with module-global callback `Set`s                                                                                                                                                                                                                                                                                                                                                                                  | Phase 2 — driven by completing A2/A3 lifecycle                                                                |
| **Single-class Standings slope elevation** (new) | Both H1 and Tier 2 branches independently showed elevated Standings slope (+4–6 MB/min) in single-class scenarios vs PCC's +0.9 MB/min in 4-class. Pattern reproduces across both parallel branches, suggesting scenario sensitivity in Standings code paths rather than a branch-specific regression. Combined PR test (multi-class ghost race) shows Standings −0.4 MB/min, consistent with the scenario-dependent interpretation. | Watch item — investigate if single-class scenarios become a focus                                             |

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

(None — A3 was reclassified as implicated for the driver-join leak, now partially fixed via Phase 2a.)

### Open questions raised by recent tests

- **Tier 2b debounce verification.** Save log clusters of 3 still appear in all five Phase 2a tests. Either the dedup works at filesystem level but logs fire pre-debounce, or the dedup doesn't engage. Filesystem-level write count during a fast-lap-heavy test would discriminate. **This is now the highest-priority open verification item.**
- **Single-class Standings slope elevation.** Reproduced across two parallel Phase 2a branches in earlier single-class scenarios but SFL Hungary shows it under target — likely branch-specific rather than scenario-dependent. Watch item only.
- **Phase 1 startup regression on Primary (+107 MB).** Cause not confirmed — most likely typed-subscription/store registration cost. Lower priority. Empty Dashboard test would isolate.

### Resolved open questions

- **Tier 2a disconnect-path leave verification** (raised by Practice 6, elevated to "likely defect" by SFL Hungary, **resolved 2026-05-18 GR86 Miami**) — Per-driver leave logging confirmed the disconnect-path callbacks fire correctly.
- **Mid-session per-driver leave detection** (raised by GR86 Miami 2026-05-18, **resolved by decline 2026-05-18**) — Cost/benefit review concluded the architectural completeness isn't worth the implementation risk. See §4 "Declined for fix".
- **Standings widget per-driver allocation pattern** (raised by P3, resolved by Phase 2a) — Tier 1's H4 fix and H1's rewrite together dropped the Standings slope to flat-to-declining across multiple scenarios.
- **Main process slope** (was open across all phases, resolved in combined PR test) — At or near target across consecutive tests.
- **GPU regression P4 → P5** — Session noise. Closed.
- **Whether memory drops indicate lifecycle cleanup** — Combined PR's session-boundary memory behaviour is positive evidence of session-boundary cleanup firing.

---

## 5. Targets and Goals

Empirical baselines and post-remediation targets. Updated as targets are met.

| Metric                                   |       Pre-remediation |      Post-0.5 |           Post-1 |           Post-2a Tier 1 (PCC) | Combined Phase 2a (ghost race) |           **Combined Phase 2a (SFL practice)** |                Target |
| ---------------------------------------- | --------------------: | ------------: | ---------------: | -----------------------------: | -----------------------------: | ---------------------------------------------: | --------------------: |
| Peak app memory (race scenarios)         |             ~3,000 MB |             — |                — |                       2,914 MB |                    1,777 MB ✅ |                                **1,559 MB** ✅ |            < 2,000 MB |
| Session-load transition cost             |                   n/t |           n/t |              n/t |                +1,010 MB / 20s |               +280 MB / 40s ✅ |                                          n/a ⁷ |             < +200 MB |
| Tick dips <20 Hz (16+ min)               |                     7 |          0 ✅ |             0 ✅ |                           0 ✅ |                4 (transitions) |                       **0 in steady-state** ✅ |                   < 1 |
| processTelemetry p99 mean                |               12.5 ms |        8.2 ms |          6.95 ms |                        7.37 ms |                         4.6 ms |                                 **3.03 ms** ✅ |             < 3 ms ✅ |
| broadcast p99 mean                       |               1.71 ms |       1.45 ms |       0.67 ms ✅ |                     0.57 ms ✅ |                     0.45 ms ✅ |                                 **0.47 ms** ✅ |                < 1 ms |
| In-race app memory slope (steady-state)  |          +18.8 MB/min |  +18.8 MB/min |     +10.4 MB/min |                 +5.7 MB/min ✅ |                 +7.1 MB/min ✅ |                            **+1.30 MB/min** ✅ |           < +5 MB/min |
| Primary renderer slope                   |    +5.8 / +9.8 MB/min |   +5.2 MB/min |  +0.16 MB/min ✅ |                 +1.8 MB/min ✅ |                    +3.5 MB/min |                            **+0.73 MB/min** ✅ |           < +1 MB/min |
| Left/Standings slope (multi-class)       |          +18.5 MB/min |           n/t |     +13.0 MB/min |                 +0.9 MB/min ✅ |                 −0.4 MB/min ✅ |                            **+0.35 MB/min** ✅ |           < +2 MB/min |
| Main process slope (steady-state)        |           +6.0 MB/min |   +4.6 MB/min |      +4.0 MB/min |                    +2.3 MB/min |                 +0.5 MB/min ✅ |                            **+1.09 MB/min** ✅ | < +0.5 MB/min (close) |
| Per-joining-driver permanent memory cost |               ~5–6 MB |      untested |          ~5–8 MB |         ~5 MB across renderers |                not exercised ⁶ |  **typically 0–12 MB across all renderers** ✅ |        < 1 MB (close) |
| Renderer stutter (subjective)            | Choppy after 5–10 min | Smooth 16 min | Plateau observed | Smooth 42 min, consistent laps |      Smooth, peak <1,800 MB ✅ | **Smooth throughout, plateau at ~1,250 MB** ✅ | No stutter at 30+ min |

⁶ Combined PR ghost race had a stable 48-driver field — leave path was not exercised.
⁷ SFL Hungary practice was a steady multi-join practice, not a session transition — different scenario.

**Phase 0.5 success criteria:** Met. L1, L2, S5 all validated.

**Phase 1 success criteria:** Met for P1/P2/P4. Primary in-race leak essentially eliminated.

**Phase 2a Tier 1 success criteria:** Met. PCC race validated.

**Phase 2a Combined PR success criteria — strongly validated by SFL Hungary practice:**

- ✅ Peak app memory consistently below target across two combined-PR tests (1,777 MB and 1,559 MB; target <2,000 MB)
- ✅ In-race app slope at +1.30 MB/min — far under <+5 target
- ✅ processTelemetry p99 mean at 3.03 ms — at <3 ms target
- ✅ Standings slope flat-to-positive but well under <+2 target
- ✅ Per-driver-join cost typically 0–12 MB across all renderers, often dominated by GC noise
- ⚠️ Tier 2a per-driver-leave path: 3 consecutive tests with zero observed leave events. Needs code-level investigation, not just more testing.
- ⚠️ Tier 2b save debounce not visible in logs across any Phase 2a test. Needs filesystem-level verification.

**Remaining work, in priority order:**

The Phase 2a remediation effort is now substantially complete. The three remaining items are concrete and bounded:

1. **Reference lap fetch dedup.** Each renderer independently fetches reference laps on connect and SessionNum transitions, producing 3× I/O per class per event. The spectated race captured this clearly: 24 fetches in 30 seconds at session-load (4 classes × 3 renderers × 2 transitions) where 4 would suffice. Fix pattern is already established from Tier 2b's save work — move the fetch to a main-process singleton with broadcast to renderers. Estimated effort: small. Estimated impact: meaningful on session-load and SessionNum-transition cost, particularly in multi-class scenarios.
2. **Tier 2b debounce filesystem verification.** Save log clusters of 3 persist across all five Phase 2a tests. The actual behaviour is unknown — either the debounce works at filesystem level but the log line fires pre-debounce (in which case fix the log), or the debounce doesn't engage (in which case the fix didn't land properly). Either outcome is a one-line resolution once the actual behaviour is known. Approach: add a log line at the post-debounce write point, OR instrument a fast-lap-heavy test with `.json` write-count tracking.
3. **Empty Dashboard substrate baseline test.** Long-standing test backlog item. Run irDashies with all widgets disabled for ~20 minutes during a solo practice and measure the slope. Useful baseline for future regression detection. Estimated effort: small (configuration change plus a test run).

**Items now resolved or deprioritised:**

- **Tier 2a disconnect-path leave verification** — validated by GR86 Miami test.
- **Mid-session per-driver leave detection** — declined for fix (see §4 "Declined for fix" subsection).
- **Standings memory leak** — resolved by Tier 1 + H1.
- **Main process leak** — at or near target across consecutive tests.
- **Investigate Primary slope sensitivity to scenarios** — combined PR ghost race showed +3.5 MB/min, but subsequent SFL Hungary showed +0.73 MB/min. The variation appears to be scenario-related, not a regression. No action needed.
- **H1 (`createDriverStandings` rewrite)** and **P5 (`DriverInfoRow` memo)** — H1 is in the combined PR; P5 remains deprioritised.

Phase 3 channel bus remains deprioritised — processTelemetry p99 mean is at target.

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
- **Include session timing data where available** (race start/end, qualifying transitions, lap times). The PCC race demonstrated that memory events can be misattributed to lifecycle when they're actually V8 GC, and timing data is what discriminates. If you have iRacing's race results export or lap data, attach it.
- Update §4 and §5 as part of adding a new entry — the entry isn't complete until those sections reflect what it changed.

---

## 7. Excluded / Historical Data

Tests run during early diagnostic work that are not part of the standard scenarios:

- **Sportscar practice** (2026-05-10) — first investigation, ~30 cars practice session. Excluded from the standard analysis because the dashboard configuration may have differed and because the duration was short (9 min). Useful only as an early data point showing the leak existed.
- **PCC race** (2026-05-11) — 44-car multiclass real-multiplayer race. Used a **different dashboard configuration** than current tests, so absolute numbers don't compare cleanly. The PCC config had a substantially lower in-race leak rate (+0.6 MB/min app slope vs +13–20 MB/min for standard config), suggesting layout choice has measurable impact. An A/B comparison of the two configs is a useful future test.

---

_End of test log. To add a new test, follow §6._
