# Latest-main replay widget audit

**Reviewed 15 November 2026:** Same-session source controls did not reproduce an aggregate CPU/FPS regression. Historical cross-date drift, presentation cost, private growth, limited widget coverage and the rare overlay stall remain distinct findings. Neither canvas variant is retained.

iRacing was activated before capture and checked periodically through the UI. These point observations and the absence of other automated UI inputs support the intended foreground protocol; continuous OS foreground state was not recorded.

14 November 2026. Runtime source is latest fetched `origin/main` at
`711552a1598a0d3258eb61a5d94e34a37f85547d`; the application source is unchanged.
This series compares two saved-profile development captures with the
[1 November reference](./2026-11-01-main-full-profile.md), then records new
coverage for the 17 widget types absent from that profile and its hidden
Lap Trace. Application fixes are deliberately left to the
[separate findings queue](./2026-11-14-widget-findings.md).

## Saved-profile drift

Both current runs use the reference's frozen profile seed, SHA-256
`53cfe4ec5cf2f1160ed81cc2a83bfc4723c46abf4bfeb2f8c7cac27c6c382c8c`.
Its 20 enabled widget types and disabled duplicate Fuel instance are retained.
The same replay starts at frame 129269, session 2, time 59.88 seconds, focus
car 37, cockpit group 9/camera 1. Playback is 1x. Each run lasts 420 seconds;
analysis includes seconds 60–420. Captures start after the simulator is loaded.

| Metric                                        | November reference R1 / R2 | Current main R1 / R2 |
| --------------------------------------------- | -------------------------: | -------------------: |
| App CPU                                       |             4.483 / 4.604% |       6.300 / 6.143% |
| GPU-process CPU                               |             1.697 / 1.723% |       3.317 / 3.229% |
| SDK-sampled simulator FPS, mean               |            72.872 / 72.760 |      73.925 / 74.295 |
| Sampled simulator FPS p1, mean                |            70.271 / 70.097 |      71.265 / 71.550 |
| Peak app private memory, MiB                  |          3974.08 / 3594.32 |    1379.45 / 1474.70 |
| App private growth, MiB/min                   |          +43.683 / +20.320 |    +18.398 / +32.936 |
| Telemetry-processing p99, mean ms             |              1.305 / 1.350 |        1.468 / 1.433 |
| Display-renderer frame-time p99, mean ms      |            16.804 / 16.808 |      72.470 / 74.162 |
| Display-renderer frames over 50 ms            |                     0 / 0% |       7.881 / 8.184% |
| Reported Map rate, Hz (different populations) |            24.898 / 24.906 |      52.036 / 50.180 |

The reported Map rate is not directly comparable across these versions.
Old instrumentation reports zero-count Map statistics in all three display
windows; current instrumentation omits windows that never exercise Map.
Recomputing from the raw logs over the active Map window gives reference
**74.694 / 74.718** draws per second versus current **52.036 / 50.180**.
There is no measured doubling of Map drawing work. Its animation hook is
unchanged between the two revisions.

Mean app CPU rises **36.9%** (4.544% to 6.222%); most of the absolute
increase is in the GPU process. Renderer pacing deteriorates in both repeats.
Sampled simulator FPS does not regress in these captures. This does not rule
out individual game hitches or quantify the overlay-on/off game-FPS cost.
Private-memory peaks are
lower, but both growth slopes still fail the unchanged **<5 MiB/min** target.
Growth ranges overlap the historical reference; these runs do not establish
a new memory-growth regression or a stable long-running leak rate.

This is repeatable cross-date drift, not a causal attribution to a widget,
PR, or dependency. The subsequent same-session source comparisons are recorded in the
[CPU report](./2026-11-14-cpu-sniff.md). They do not reproduce an aggregate
source CPU increase, while the renderer pacing issue remains open. The small Linux Input microbenchmarks from 8 November use a different
target and workload and are not substituted for this application comparison.

The later [short foreground source/runtime controls](./2026-11-14-cpu-sniff.md)
do not reproduce a total CPU regression: the old source also uses about 6.6%
today with the matched seed. Disabling Radar saves 28.4% of current app CPU,
but this identifies optimization scope rather than a newly introduced fault.
The later full-window pair measures 5.471% old / 5.268% current CPU.
Neither that one pair nor short repeats prove equivalence or explain the
historical host/graphics drift.

## Conditions and evidence

The host remains a Ryzen 7 9800X3D with 16 logical processors and an RTX 2070
SUPER, with three 2560×1440 displays. iRacing is foreground, borderless at
7680×1440 with the configured 84 FPS limit. Its renderer configuration hash
still matches the reference exactly:
`1f8c44edd8f43466787204e86f9b7bc8198391d03ba1da14bca5652b15d712ce`.
Driver-level synchronization and background host activity are not independently
controlled. Node is 24.16.0, Electron 45.3.2 and React 19.3.1; the old Electron
version was 45.2.0. Current development results do not establish a packaged
release gate pass.

The user requested direct game-stutter measurement during this series.
PresentMon was absent during the initial widget captures and was installed
for the completed follow-ups below. The subsequent off/on series retains
individual present/display frame times, tail percentiles, slow-frame counts,
dropped frames and a timeline. See the
[official console documentation](https://github.com/GameTechDev/PresentMon/blob/main/README-ConsoleApplication.md).

**Follow-up completed:** after installation, four foreground PresentMon passes
measure a 1.70% presented-FPS cost and more display intervals over 25 ms with
the app, with equal counts over 50 ms and none over 100 ms. Those measurements
are kept in the separate [direct-game report](./2026-11-14-game-stutter.md)
and do not turn this widget audit's renderer timings into game frame times.

The replay is Gesamtstrecke VLN, Track ID 262, 59 non-pace cars/two classes.
Native replay observations verify session, camera, frame progression and
normal speed. Raw logs, native/build fingerprints, immutable profile seeds,
replay observations and generated summaries remain in ignored `perf-results/`.
No demo mode or fabricated telemetry is used. Screenshots and accessibility
inspection establish rendered states separately from channel counters.
The first full run's Fuel inspection extends approximately five seconds into
its analysis window; the second repeat's inspection is within warmup. Both
runs are retained, and the second reproduces the pacing/CPU drift.

Formal full-workload acceptance remains inconclusive: some event channels
never change; warning panels require real triggers; Fuel has no live fuel
burn; Lap Trace is hidden by the saved Race policy. A channel marked covered
does not prove that a plot or warning was visible. The additional groups below
must not be compared directly with the saved-profile totals.

## Additional benchmark coverage

All unselected widgets are explicitly disabled in isolated copies. Each
selected widget uses its own window so process CPU/private memory and renderer
timing can be attributed by window name. The six panels are positioned without
overlap across the three displays. Defaults are used, with on-track/session
visibility enabled for replay inspection. Broadcast Weather uses a one-minute
popup interval and 30-second display time so real cards occur after warmup.

| Run                         | Widget types                                                                              | App CPU | Private growth, MiB/min | Status                                         |
| --------------------------- | ----------------------------------------------------------------------------------------- | ------: | ----------------------: | ---------------------------------------------- |
| `main-711552a1-coverage-1b` | Lap Trace, Flat Map, Wind, Shift Light, Car Systems, Delta Speed                          |  1.858% |                  +7.525 | Complete; reference/controls limitations below |
| `main-711552a1-coverage-2b` | Broadcast, Broadcast Weather, Podium, Ticker, Events, Info Bar                            |  2.317% |                 +12.526 | Complete; podium/event conditions incomplete   |
| `main-711552a1-coverage-3`  | Garage Cover, Heart Rate, Stream Chat, Telemetry Inspector, Stint Plan, Strategy Timeline |  0.695% |                  +5.156 | Complete; mostly empty/idle states             |

These are first scoped measurements for the extra widget sets. They have no
matching older per-widget reference, so they establish qualified observations
rather than historical regression verdicts.

## Scoped process measurements

These renderer CPU/private-memory and RAF timing values cover the individual
windows in the additional groups, including the idle/placeholder states listed
below. They are not game frame times or measurements of unexercised active
plots, devices, chat, strategy or alert workloads.

| Widget               |    CPU | Peak private, MiB | Private growth, MiB/min | Renderer p99 mean, ms | Frames >50 ms |
| -------------------- | -----: | ----------------: | ----------------------: | --------------------: | ------------: |
| `flatmap`            | 0.356% |            143.64 |                   5.740 |                68.592 |        3.993% |
| `wind`               | 0.121% |             75.94 |                  -0.080 |                71.138 |        4.593% |
| `shiftlight`         | 0.109% |             76.28 |                   0.488 |                16.800 |        0.000% |
| `deltaspeed`         | 0.091% |             76.27 |                   0.574 |                16.800 |        0.000% |
| `laptrace`           | 0.076% |            115.52 |                   1.021 |                16.800 |        0.000% |
| `carsystems`         | 0.063% |             71.91 |                   0.830 |                16.800 |        0.000% |
| `broadcast`          | 0.290% |            213.10 |                   6.527 |                53.760 |        1.672% |
| `broadcastticker`    | 0.163% |            136.88 |                   0.842 |                78.331 |        8.658% |
| `infobar`            | 0.078% |            121.18 |                   0.722 |                19.796 |        0.079% |
| `broadcastweather`   | 0.075% |            114.07 |                   0.517 |                49.176 |        3.600% |
| `broadcastevents`    | 0.069% |            135.06 |                   0.769 |                32.065 |        1.563% |
| `broadcastpodium`    | 0.065% |            116.31 |                   0.441 |                16.800 |        0.000% |
| `telemetryinspector` | 0.116% |             78.39 |                   0.342 |                16.800 |        0.000% |
| `garagecover`        | 0.064% |             69.75 |                   0.799 |                16.801 |        0.000% |
| `heartrate`          | 0.056% |            110.37 |                   0.868 |                16.803 |        0.000% |
| `streamchat`         | 0.054% |            112.78 |                   0.748 |                16.800 |        0.000% |
| `stintplan`          | 0.053% |            131.29 |                   0.834 |                16.801 |        0.000% |
| `strategytimeline`   | 0.052% |            128.28 |                   0.644 |                16.801 |        0.000% |

## Every registered widget

“Idle” means the widget was enabled and inspected but its required event or
input was absent. It does not mean its active workload passed.

| Widget ID              | Run                | Observed state and remaining coverage                                                                                                           |
| ---------------------- | ------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `standings`            | Full R1/R2         | Live rows, classes, ratings, gaps, headers and footer render; reference/radio/history inputs incomplete.                                        |
| `input`                | Full R1/R2         | Trace, controls, gear/speed and steering render; replay driving values are mostly zero/steady.                                                  |
| `relative`             | Full R1/R2         | Driver rows and changing relative gaps render; radio and historical lap paths incomplete.                                                       |
| `map`                  | Full R1/R2         | Track and moving markers render; rate comparison corrected above; sector/reference inputs idle.                                                 |
| `weather`              | Full R1/R2         | Track/air temperature, wind, humidity, wetness and rubber render.                                                                               |
| `fastercarsfrombehind` | Full R1/R2         | Driver/rating/gap rows render; class labels unavailable in source session data.                                                                 |
| `fuel`                 | Full R1/R2         | Gauge, consumption and prediction panels render with zero/unavailable replay fuel; no live stint/history workload.                              |
| `blindspotmonitor`     | Full R1/R2         | Idle; no changing blind-spot warning input.                                                                                                     |
| `rejoin`               | Full R1/R2         | Idle; no qualifying off-track rejoin warning observed.                                                                                          |
| `pitlanehelper`        | Full R1/R2         | Idle outside pit lane; limiter/countdown/traffic warning paths not exercised.                                                                   |
| `flag`                 | Full R1/R2         | No-flag lamp grid renders; warning/flag transitions incomplete.                                                                                 |
| `tachometer`           | Full R1/R2         | Temperature/LED content renders; no full RPM/shift sweep.                                                                                       |
| `laptimelog`           | Full R1/R2         | Timing panel renders; no completed live lap sequence.                                                                                           |
| `slowcarahead`         | Full R1/R2         | Idle; no qualifying stopped/slow-car warning observed.                                                                                          |
| `sectordelta`          | Full R1/R2         | Sector strip/placeholders render; no sector/reference timing changes.                                                                           |
| `cornername`           | Full R1/R2         | Enabled; named-corner label not visually established.                                                                                           |
| `battle`               | Full R1/R2         | Nearby-driver table renders; lap-history input incomplete.                                                                                      |
| `gantry`               | Full R1/R2         | Standings and controls render; explicit replay banner explains absent recorded event log.                                                       |
| `laptrace`             | Full + coverage 1b | Hidden in saved Race policy; visible in isolate with “Drive a clean lap” prompt. No saved reference for Track 262; no populated plot/brake cue. |
| `radar`                | Full R1/R2         | Rings/player/nearby-car markers render; rate/cost measured.                                                                                     |
| `flatmap`              | Coverage 1b        | Track line and car-number markers render; memory and pacing follow-up recorded.                                                                 |
| `wind`                 | Coverage 1b        | Direction/speed dial renders; timing spikes recorded.                                                                                           |
| `shiftlight`           | Coverage 1b        | RPM display renders (1478 in warmup); no full shift-threshold/flash exercise.                                                                   |
| `carsystems`           | Coverage 1b        | BB/ABS/TC/TC2/THR columns render with unavailable values; replay does not provide adjustment workload.                                          |
| `deltaspeed`           | Coverage 1b        | “No clean lap” placeholder; no valid session-best speed trace.                                                                                  |
| `broadcast`            | Coverage 2b        | Multiclass tower, rotating timing view, starting grid and focus-driver card render.                                                             |
| `broadcastweather`     | Coverage 2b        | Real weather popup renders temperatures, rain, surface, wind and rubber.                                                                        |
| `broadcastpodium`      | Coverage 2b        | Idle before race finish; finish-state card not established.                                                                                     |
| `broadcastticker`      | Coverage 2b        | Scrolling team/car/position ticker renders.                                                                                                     |
| `broadcastevents`      | Coverage 2b        | Idle in inspected state; incident/flag toast not established.                                                                                   |
| `infobar`              | Coverage 2b        | Race/time/lap/incidents/clock/temperature bar renders.                                                                                          |
| `garagecover`          | Coverage 3         | Idle; garage screen is not open in replay.                                                                                                      |
| `heartrate`            | Coverage 3         | Blank as expected; user's saved profile has no configured device. No live sensor workload.                                                      |
| `streamchat`           | Coverage 3         | Blank as expected; no configured Twitch/YouTube channel or incoming messages.                                                                   |
| `telemetryinspector`   | Coverage 3         | Speed with m/s unit and changing Session Time with seconds render from raw telemetry.                                                           |
| `stintplan`            | Coverage 3         | “No race plan loaded” notice renders. Populated strategy progress is not tracked in loaded replays.                                             |
| `strategytimeline`     | Coverage 3         | “No race plan loaded” notice renders. Populated timeline/stint transitions require a separate applicable session.                               |

## Reproduction and exclusions

The controller accepts an optional isolated seed-directory name after duration:

```powershell
node tools/perf/live-full-profile.cjs run main-711552a1-full-r1 420
node tools/perf/live-full-profile.cjs run main-711552a1-full-r2 420
node tools/perf/live-full-profile.cjs run main-711552a1-coverage-1b 420 coverage-seed-1
node tools/perf/live-full-profile.cjs run main-711552a1-coverage-2b 420 coverage-seed-2
node tools/perf/live-full-profile.cjs run main-711552a1-coverage-3 420 coverage-seed-3
node tools/perf/analyze.ts perf-results/<run-id>.log --warmup-seconds 60 --analysis-start-seconds 60 --analysis-end-seconds 420 --allow-inconclusive
```

Use fresh run IDs. Create each seed by copying the frozen profile, keeping a
manifest entry for every unselected widget with `enabled: false`, and using
the selected manifests' default configurations/layout sizes with the listed
visibility/layout overrides. The controller snapshots seed hashes and the
actual source revision. Save the user's replay state before seeking and restore
it after the series. Personal profile/history data is intentionally not shipped.

`main-711552a1-coverage-1` is excluded: omitted default widgets were restored by
dashboard migration, adding Standings/Input/Relative/Map/Weather to the isolate.
It was stopped and rerun with explicit disabled entries. `coverage-2` is
excluded: default Broadcast Weather timing left its card hidden after warmup;
it was stopped and rerun with the shorter real popup interval. Neither
preflight is promoted to an authoritative measurement.

## Validation and handback

All five accepted captures have 72 app/private-memory observations and 72
native replay observations in the analysis interval. Expected and effective
widget sets match exactly, and all replay checks pass. There are no logged
application warnings/errors in those runs. The 37 registered widget IDs all
appear in at least one accepted capture. The
[sanitized evidence](./2026-11-14-widget-regressions.json) retains per-process
metrics, per-widget channel coverage, all 360 app CPU/private-memory/FPS
observations, run/build/native/seed hashes and replay-integrity summaries.
The unchanged runtime manifest has 2405 files and SHA-256
`44f16b7568589969a8542f9ebed292e447b0c2532bdc9e56ed431229261b18ff`.

At the initial widget-capture stage, four targeted benchmark/config test
files passed 40 tests. The final review validation is recorded below. TypeScript
and full-project ESLint pass with `npm run lint -- --ignore-pattern perf-results/**`.
The unqualified lint command also scans the ignored, private capture scripts
and rejects their one-off CommonJS/unused declarations; those artifacts are
excluded from the successful check and are not committed. No application
runtime or production lint configuration was changed.

An additional SDK-only inspection at frame 777900 finds session 2 still
Racing (state 4), flags 0, no blind-spot warning, no garage UI, and the player
on pit road/in its stall. No race-finish state was established by this
near-end check, so the podium remains unexercised. That late pit scene is a useful
follow-up for active Pitlane Helper inspection; it is not part of the timed
coverage or a claimed visible-warning test.

All benchmark application processes have exited. The saved user config hash
is unchanged. The simulator was restored to original frame 8065/session 0,
focus car 37/cockpit group 9/camera 1 and playback speed 1; the verified
snapshot is frame 8095 after the expected half-second of playback. A transient
SDK snapshot during the end-of-replay seek delayed the first restoration
attempt; restoration was retried after the replay loaded and then verified.
The last benchmark focus action returned iRacing to the foreground. The
subsequent PresentMon/source/canvas series have their own restoration
records; their results are linked above.

## Review validation and interpretation

All 37 manifest IDs and 26 scoped process rows were checked against the
recorded evidence. Enabled/inspected IDs are not proof of every active widget
state; named corners, event warnings, populated reference plots, external
devices/chat and strategy progression remain limited or unexercised.

The memory growth figures remain valid short-window observations. For the
two saved-profile app-private trends, Pearson r is 0.820 / 0.730. Flat Map
in coverage 1b has r = 0.892; Broadcast Tower in coverage 2b has r = 0.744.
These associations do not establish a persistent leak. Per-widget p99 means
are arithmetic means of report p99s; main analyzer p99 means are weighted by
frame count. Neither is a pooled percentile of all individual frames.

The offline review recomputes 28 app-run summaries, six presentation controls
and 14 distinct game-frame CSV summaries, checks raw fingerprints and
recalculates the trace CPU allocation. No numeric mismatches are found in
those checks. The game analyzer now selects the dominant swap chain inside
the requested measured window and rejects nonfinite durations. Existing
captures keep the same numeric game-frame results.

Final validation: 579 test files passed, 5 skipped; 6,950 tests passed,
5 skipped, via `npm run test -- --run`. TypeScript/ESLint passes with private
`perf-results` artifacts excluded. Raw captures remain local; committed
fingerprints and selected summaries are not a substitute for the raw files.

Two Gantry process rows have CPU/private-memory measurements but no renderer
timing samples. Their JSON p99/slow-frame values are now null rather than
zero; they do not establish a Gantry rendering-performance pass.
