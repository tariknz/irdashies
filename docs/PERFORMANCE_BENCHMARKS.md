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

## Analyse and compare

Each run writes `perf-results/<run-id>.log`. Analyse a single run:

```powershell
npm run perf:analyze -- perf-results/<run-id>.log --warmup-seconds 60
```

Compare the empty or full dashboard against the observer:

```powershell
npm run perf:analyze -- perf-results/<candidate>.log --baseline perf-results/<observer>.log --warmup-seconds 60
```

The analyzer writes adjacent `.summary.json` and `.summary.md` files. Its
initial regression gates are:

| Metric                                  |              Gate |
| --------------------------------------- | ----------------: |
| iRacing average FPS vs observer         | no worse than -2% |
| iRacing sampled FPS p1 mean vs observer | no worse than -5% |
| `processTelemetry` p99 mean             |            < 3 ms |
| Minimum interval telemetry rate         |          >= 20 Hz |
| Steady-state app memory slope           |        < 5 MB/min |
| Renderer frames over 50 ms              |            < 0.1% |

Treat a failed gate as a signal to inspect, not proof of causality. Repeat any
failed A/B pair once before making an architectural decision.

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
[`IMPLEMENTATION_PLAN.md`](./IMPLEMENTATION_PLAN.md#performance-measurement-and-optimization-plan-2026-07-26).
