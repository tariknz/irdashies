# irDashies Performance Benchmarks

This is the repeatable benchmark protocol for diagnosing iRacing FPS loss,
overlay stutter, and long-session degradation. It complements
[`PERFORMANCE_TEST_SUMMARY.md`](./PERFORMANCE_TEST_SUMMARY.md), whose earlier
runs established the memory and telemetry-processing targets.

## What the harness captures

When launched through `npm run perf:run`, irDashies records structured samples
without changing the saved dashboard:

- iRacing-reported FPS, foreground/background CPU usage, and GPU usage
- irDashies total and per-process CPU and working-set memory
- telemetry tick cadence and `processTelemetry` / IPC broadcast percentiles
- per-channel processor executions, publications, deliveries, and effective rates
- active-widget input coverage and observed channel change rates
- native telemetry/session reads, lifecycle work, payload projection, session
  publication, and renderer telemetry-callback percentiles
- Electron main-process event-loop stalls
- per-renderer animation-frame timing and frames over 25 ms / 50 ms

The metrics are disabled during normal app launches.

For quick development iteration, the default target is the Vite development
build. Before accepting a result as a release baseline, package the app and add
`--target packaged` to every run:

```powershell
npm run package
npm run perf:run -- --target packaged --mode observer --scenario release-observer --duration-seconds 420
```

Do not compare a development run with a packaged run. Vite, source maps, React
development checks, and hot-module tooling materially change renderer memory
and startup work.

The iRacing FPS values come from the simulator telemetry stream. They are good
for controlled A/B regressions but are not a substitute for PresentMon
present-to-present frame times. If these runs show an FPS-neutral hitch, use an
ETW/PresentMon trace as the second-stage investigation.

For an isolated `.irdt` tape, the iRacing FPS/CPU/GPU variables are historical
values recorded in the tape. They do not measure the host while the benchmark
is running and must not be used for A/B conclusions.

## Controlled replay benchmark

Use a replay with a representative field size and the same fixed cockpit camera
for every run. A replay is preferred because live-session traffic, weather, and
physics load change between samples.

Before starting:

1. Keep iRacing resolution, graphics, mirrors, FPS cap, and camera identical.
2. Do not resize or edit overlays during a run.
3. Close browsers, launchers, recording software, and other variable GPU loads.
4. Let the replay and camera settle for 60 seconds.
5. Run each mode for at least 6 minutes. Stop it with Ctrl+C.

For the curated native telemetry tape, pass `--replay-input`. The runner selects
the isolated SDK addon, waits until the development native rebuild is complete,
starts the publisher, and stops it with the app:

```powershell
$replay = 'test-data\telemetry\ai-race-10min.irdt'
```

### 1. SDK observer baseline

This connects to iRacing and samples telemetry, but creates no Electron overlay
or settings windows.

```powershell
npm run perf:run -- --mode observer --scenario replay-observer --duration-seconds 420 --replay-input $replay
```

### 2. Empty transparent-window baseline

This creates the normal transparent overlay windows with every widget disabled.
It measures the window, renderer bootstrap, and global-provider substrate
without widget rendering. It does not isolate Windows composition alone because
each renderer still mounts the dashboard, telemetry, session, pit-lane, and
reference-lap providers.

```powershell
npm run perf:run -- --mode empty --scenario replay-empty --duration-seconds 420 --replay-input $replay
```

To distinguish renderer/window substrate from telemetry IPC and store
notification work, run empty mode once with renderer delivery disabled and once
with it enabled:

```powershell
npm run perf:run -- --mode empty --scenario replay-empty-off --duration-seconds 420 --telemetry-delivery off --replay-input $replay
npm run perf:run -- --mode empty --scenario replay-empty-on --duration-seconds 420 --telemetry-delivery on --replay-input $replay
```

`--telemetry-delivery` controls only the dedicated raw Telemetry Inspector
stream. To isolate typed channel delivery while keeping subscribers and
processors active, use `--channel-delivery`:

```powershell
npm run perf:run -- --mode full --scenario channels-off --duration-seconds 420 --channel-delivery off --replay-input $replay
npm run perf:run -- --mode full --scenario channels-on --duration-seconds 420 --channel-delivery on --replay-input $replay
```

The off run still records processor executions and channel publications. It
suppresses snapshot seeding, coalescing timers, structured cloning, IPC sends,
and renderer callbacks, making the on/off delta attributable to delivery.

### 3. Full dashboard

This loads the current dashboard, but omits the settings and gamepad-host
windows so the measurement is focused on overlays.

```powershell
npm run perf:run -- --mode full --scenario replay-full --duration-seconds 420 --replay-input $replay
```

`--telemetry-payload raw` is a benchmark-only counterfactual for measuring the
cost of sending every SDK variable. Normal launches and the default benchmark
path retain the renderer allowlist.

### 4. Widget isolation

Repeat only if the full dashboard materially regresses FPS or frame pacing.
Comma-separated widget types can be tested together. The filter is applied in
memory and is never persisted.

```powershell
npm run perf:run -- --mode full --widgets standings --scenario replay-standings --duration-seconds 420 --replay-input $replay
npm run perf:run -- --mode full --widgets relative --scenario replay-relative --duration-seconds 420 --replay-input $replay
npm run perf:run -- --mode full --widgets map --scenario replay-map --duration-seconds 420 --replay-input $replay
```

Use the widget type from `WidgetIndex.tsx`, not a widget instance ID.

The runner reads each selected widget's `widgetRuntimeDefinition.ts` and embeds
its declared input channels in the structured scenario metadata. The analyzer
reports whether every declared channel was exercised and its publication
(change) and delivery rates. A memory claim is inconclusive when an active
widget's declared inputs did not change during the measured window.

## Visibility phases

Use a fixed visibility schedule to verify that hidden windows stop channel
demand and resume cleanly. If `--duration-seconds` is omitted, the phase
durations determine the capture duration.

```powershell
npm run perf:run -- --mode full --scenario visibility-demand --visibility-phases visible:120,hidden:120,visible:120 --replay-input $replay
```

The app emits one capture-origin marker after overlays are created. Phase zero
and the fixed-duration timer start from that same origin; analyzer window
offsets are relative to it rather than process startup or the first periodic
report. Each transition is also written as a structured visibility marker.

Evidence is evaluated per phase. Visible phases require at least one
publication from every declared active-widget input. Hidden phases instead
require zero demand-driven processor executions and zero channel deliveries.
Intervals that straddle a transition are excluded from that phase's evidence
so visible work cannot be attributed to the hidden phase.

## Scenario metadata

Record the conditions required to reproduce the run:

```powershell
npm run perf:run -- --target packaged --mode full --scenario phase4-full --duration-seconds 420 --replay-input $replay --field-count 59 --class-count 4 --display-geometry 7680x1440 --fps-cap 120 --sync-mode gsync
```

The runner always records target, live/replay mode, requested and active widget
types, channel/Inspector delivery modes, telemetry payload mode, and widget
input requirements. The optional field count, class count, display geometry,
FPS cap, and sync mode flags complete the controlled-workload record.

## Analyse and compare

Each run writes `perf-results/<run-id>.log`. Analyse a single run:

```powershell
npm run perf:analyze -- perf-results/<run-id>.log --warmup-seconds 60
```

Compare the empty or full dashboard against the observer:

```powershell
npm run perf:analyze -- perf-results/<candidate>.log --baseline perf-results/<observer>.log --warmup-seconds 60
```

Use a fixed interval when the relevant workload occupies only part of the
capture:

```powershell
npm run perf:analyze -- perf-results/<candidate>.log --baseline perf-results/<baseline>.log --warmup-seconds 0 --analysis-start-seconds 120 --analysis-end-seconds 360
```

Analysis rejects inconclusive evidence by default after writing the summary.
It exits non-zero when the measured interval is shorter than five minutes,
private bytes are incomplete or too sparsely sampled, scenario/widget metadata
is missing or inconsistent, or a visibility phase violates its workload
expectations. Use `--allow-inconclusive` only for exploratory inspection of a
partial run.

The analyzer writes adjacent `.summary.json` and `.summary.md` files. Its
initial regression gates are:

| Metric                                  |              Gate |
| --------------------------------------- | ----------------: |
| iRacing average FPS vs observer         | no worse than -2% |
| iRacing sampled FPS p1 mean vs observer | no worse than -5% |
| `processTelemetry` p99 mean             |            < 3 ms |
| Minimum interval telemetry rate         |          >= 20 Hz |
| Steady-state app private-memory slope   |        < 5 MB/min |
| Renderer frames over 50 ms              |            < 0.1% |

Treat a failed gate as a signal to inspect, not proof of causality. Repeat any
failed A/B pair once before making an architectural decision.

Private memory is the acceptance metric because aggregate working set includes
shared Chromium pages and can double-count them across processes. Working-set
slope remains in the report as diagnostic context. The private-memory gate is
reported as **INCONCLUSIVE**, never pass/fail, unless the analysis contains at
least five minutes of private-byte samples covering every included Electron
process, at least two observations with adequate span and no gap over 60
seconds, consistent scenario metadata, and valid per-phase channel evidence.
When either side of an A/B comparison is inconclusive, every comparison check
is reported as **INCONCLUSIVE**.

## Live-session benchmark

Use a real multiplayer practice after the replay A/B matrix. Run the full
dashboard for at least 20 minutes, ideally covering a join burst and a session
transition:

```powershell
npm run perf:run -- --mode full --scenario live-practice-churn --duration-seconds 1500
```

Record these notes alongside the result:

- session and series
- car/track and field/class count
- monitor resolution and refresh rate
- iRacing FPS cap and whether VSync/G-Sync is active
- approximate times of joining, entering the car, session transition, and any
  visible stutter

The live run validates memory slope, join/transition spikes, and subjective
stutter. Do not compare its FPS directly with the replay baseline.

## Interpreting the mode deltas

| Observation                                        | Likely next investigation                                           |
| -------------------------------------------------- | ------------------------------------------------------------------- |
| Observer already hurts iRacing                     | SDK polling/main loop or CPU scheduling                             |
| Empty regresses vs observer                        | renderer/provider bootstrap, transparent composition, window bounds |
| Full regresses vs empty                            | React work, canvas/SVG paint, telemetry fanout, widget allocation   |
| One widget reproduces most of the full delta       | profile that widget's render/paint path                             |
| FPS is stable but 50 ms renderer frames rise       | renderer main-thread stalls or GC                                   |
| Renderer timing is clean but visible hitch remains | compositor/GPU present trace with PresentMon/ETW                    |

## Radar geometry microbenchmark

`npm run perf:radar-geometry` is a separate, much narrower measurement than
the runs above. It replays the recorded road america field at the 25 Hz rate
`RadarProcessor` publishes and reports duration and bytes allocated per call
to `computeRadarBlips`, swept over how many cars are inside the range.

Density is swept rather than assumed. A full grid spread over a 6.4 km lap
leaves a 15 m radar looking at almost nothing, so the bunched, safety-car and
race-start traffic that actually allocates is a different regime again. The
figure to watch is the per-blip slope, not any single row.

Two things about the method, because without them the numbers are not
comparable:

- Every result a batch produces is retained for the batch's duration, so the
  collector has nothing to free and the heap delta is the bytes allocated
  rather than the bytes that survived. A batch that still saw a collection is
  discarded.
- Each density runs in a process of its own. Measuring several densities in one
  process does not work: the heap the previous density left behind shifts when
  the next one compacts, and the figure for the densest field comes out below
  the figure for a sparser one, which cannot be true.

### Result of the 2026-09-25 cleanup

KiB allocated per call, before and after the per-snapshot cleanup, each
measured in its own process:

| Cars in range | Blips | Before (KiB/call) | After (KiB/call) | Change |
| ------------- | ----- | ----------------: | ---------------: | -----: |
| 0             | 0     |              2.73 |             1.82 |   -33% |
| 5             | 4     |              5.15 |             3.93 |   -24% |
| 10            | 9     |              7.94 |             5.48 |   -31% |
| 15            | 14    |              9.90 |             7.02 |   -29% |
| 20            | 19    |             13.17 |             8.95 |   -32% |
| 25            | 24    |             15.18 |            10.55 |   -31% |
| 30            | 29    |      not reliable |            12.11 |      — |

At the published rate, with 24 cars in range, that is roughly 379 KiB/s of
garbage down to roughly 264 KiB/s.

The 29-blip row has no trustworthy "before". The old code allocated enough at
that density for a mark-compact to land mid-batch, and the resulting figure was
bimodal across attempts — 8.71, 8.75, 8.76, 9.52 and 9.60 KiB on most runs but
18.28 KiB when that density ran alone, and it sat below the 24-blip row in
every low reading. The after figure is stable at 12.11 KiB across every run and
is linear in blip count, so the row is reported as measured on the new code
only. If a future change needs a before number at that density, raise
`BATCH_FRAMES`' headroom further rather than trusting a single reading.

### What is left, and why

The per-blip slope fell from about 0.50 KiB to about 0.32 KiB per car, and the
remaining cost is the widget's own output: the blip array and one object per
car in range. Neither is reused. The blips are handed to the display and
interpolated on the animation frame loop, so a buffer reused across frames
would be read while the next frame overwrote it. The fixed per-call cost that
is left, about 1.8 KiB with an empty radar, is the result object and the
projection work itself.

## Radar track geometry noise

`npm run perf:radar-lateral-noise` measures the other side of the Radar
geometry path: not how long the arithmetic takes, but how much the sampled
track geometry it consumes wobbles a blip between frames.

`tracks.json` stores the centerline as points the SDK sampled on its own
schedule, not at even distance along the road. The spacing between neighbouring
points therefore varies with how the sim happened to sample, and any lateral
noise in that sampling is carried straight into blip position and heading. The
drawings are quantised to a whole-unit grid, and one unit is 2.5 to 3.2 m on the
bundled tracks, so the raw path can place a blip most of a car width from where
the road is.

The tool replays a recorded field at the 25 Hz rate `RadarProcessor`
publishes, takes the blip the raw points place and the blip the shipped path
places, and compares both against a high-resolution resample of the same lap.
Straight sections are reported separately, because that is where wobble reads as
jitter; in a corner a real lateral displacement and sampling noise are the same
thing in the frame.

### Result of the 2026-09-27 filtering

Three tracks at 252 km/h, a 20 m gap between snapshots, against a high-
resolution resample of the same lap:

| Track        | Path                      | Straight p95 | Straight max | Rotation p95 | Rotation max |
| ------------ | ------------------------- | -----------: | -----------: | -----------: | -----------: |
| Interlagos   | Raw drawing points        |      0.374 m |      0.593 m |    1.022 deg |    1.271 deg |
|              | `filteredTrackPathPoints` |      0.110 m |      0.363 m |    0.341 deg |    0.468 deg |
| Watkins Glen | Raw drawing points        |      0.562 m |      0.947 m |    0.953 deg |    1.201 deg |
|              | `filteredTrackPathPoints` |      0.166 m |      0.508 m |    0.205 deg |    0.331 deg |
| Brands Hatch | Raw drawing points        |      0.391 m |      0.591 m |    0.980 deg |    1.446 deg |
|              | `filteredTrackPathPoints` |      0.145 m |      0.263 m |    0.313 deg |    0.528 deg |

The straight-section figures are the ones the fix targets. The whole-lap
maximum is dominated by corner apexes, where a filtered path deliberately lags
the true apex, and is reported for completeness rather than as a target.

The kernel radius is derived from the drawing's own point spacing, and on 457 of
the 477 bundled drawings that works out to a single point. Widening the target
reach from one unit to four makes no measurable difference to any figure here:
the radius floor dominates, and the residual wobble is already well under one
grid unit. The reach is therefore left at the value the noise calls for rather
than tuned to a number the drawings cannot reach.

## Architectural decision rule

Do not begin the worker-thread SDK loop, channel bus, binary IPC, or native
rewrite solely from subjective stutter. Use the smallest change matching the
measured layer:

- SDK observer regression: investigate the blocking SDK loop and worker thread.
- Full-vs-empty CPU regression: reduce renderer wake-ups or move derived
  telemetry to typed, rate-limited channels/processors.
- Empty-window GPU regression: reduce transparent surface area/window count or
  change the Chromium composition path.
- A single widget's paint regression: optimize that renderer before moving
  application-wide architecture.

Follow-up work, evidence gates, and measurable exit criteria are tracked in
[archived implementation plan](./archive/architecture-2026/IMPLEMENTATION_PLAN.md#performance-measurement-and-optimization-plan-2026-07-26).
