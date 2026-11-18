# irDashies Performance Benchmarks

Current references and their evidence qualifications are listed in the
[baseline register](./PERFORMANCE_TEST_LOG.md#current-baseline-register).
Choose a reference with the same target and workload; the most recent capture
does not automatically replace the release baseline. Attached compact evidence
under `docs/performance/` survives when local `perf-results/` logs are absent.

This is the repeatable benchmark protocol for diagnosing iRacing FPS loss,
overlay stutter, and long-session degradation. It complements
[`PERFORMANCE_TEST_SUMMARY.md`](./PERFORMANCE_TEST_SUMMARY.md), whose earlier
runs established the memory and telemetry-processing targets. Every tool is
also reachable through `npm run perf -- <command>` (`doctor`, `diagnose`,
`run`, `analyze`, `ab`, `branches`, `report`, `trace`, `trace-analyze`); subcommand `--help` prints
its strict option list.

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

For a replay running inside the actual simulator, keep the normal live SDK
connection and pass `--simulator-mode replay` to label the metadata. This flag
does not start a tape publisher; `--replay-input` selects the isolated publisher.
Pin and verify replay frame/session/camera and normal-speed playback separately.

`--user-data-dir <directory>` forwards an isolated profile directory to
Electron, including through Forge for the development target. Use a path
without spaces or shell metacharacters. Seed it from the saved profile,
document any benchmark-only visibility overrides, and start each repeat from
the same seed. Verify visible content after startup settles, especially when
`IsOnTrack` is false in replay. Counts of windows or enabled widgets do not
prove content visibility or input coverage. The [full saved-profile capture
report](./performance/2026-11-01-main-full-profile.md) records a worked example.

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

For the curated native telemetry tape, pass `--replay-input`. On Windows the
runner selects the isolated SDK addon, waits until the development native
rebuild is complete, starts `irsdk_replay.exe`, and stops it with the app. On
Linux it points the app at the tape through `IRDASHIES_TELEMETRY_REPLAY` and
uses the in-process native tape addon; no separate publisher is started. Use
an `.irdt` tape on both platforms; an `.ibt` recording must be converted first
(the `doctor --input` check validates either format).

```powershell
$replay = 'test-data\telemetry\ai-race-10min.irdt'
```

```bash
replay=test-data/telemetry/ai-race-10min.irdt
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

### Individual overlay windows

General Settings → Individual Overlay Windows enables one transparent window
per enabled widget while locked. This mode increases CPU usage compared with
shared display windows. The default remains one shared window per display.
Edit Layout temporarily restores shared display windows for dragging
and resizing; locking restores individual windows. Completely off-screen
widgets temporarily recover onto the primary display without changing their
saved positions. Individual windows can span connected displays. Profile-name
banners are shown in shared mode only; individual windows still hide and reveal
together during a profile switch.

Individual windows use a dedicated locked-widget renderer, without the layout
editor or Settings/Gantry startup imports. Widget registration stays automatic;
each `widget.ts` uses `lazyWidget` from `@irdashies/domain/lazyWidget` to defer
its implementation until rendered. Shared display windows also benefit from
deferred widget loading, while retaining their existing layout editor. Supporting
pit-lap, push-to-pass and timing subscriptions in an individual window are scoped
to that widget's type and configuration.

Changing the mode or entering/leaving Edit Layout recreates renderers. Local
chart history and an in-progress Lap Trace recording restart; saved laps and
main-process telemetry calculations are retained. Set up the layout before
starting a lap you want to record.

Compare the same packaged build, layout, widget set and replay using the
benchmark-only `--window-mode` override. It does not save the selected mode to
the profile. The effective mode is recorded as `overlayWindowMode` in each
sample's scenario metadata.

```powershell
npm run perf:run -- --target packaged --mode full --window-mode display --scenario windows-display --duration-seconds 420 --replay-input $replay
npm run perf:run -- --target packaged --mode full --window-mode widget --scenario windows-widget --duration-seconds 420 --replay-input $replay
npm run perf:analyze -- perf-results/<widget-run>.log --baseline perf-results/<display-run>.log --warmup-seconds 60
```

Add the same `--widgets` filter to both commands to compare a subset. A filter
selects widget types and includes every instance of those types. Include
total app CPU, aggregate private memory, renderer process count and frame
timing; do not compare a single renderer's memory against the combined default
window. Repeat regressions with the run order reversed. A single-monitor or
remote desktop result does not establish multi-monitor compositor performance.
Tape FPS values remain historical and cannot measure current game FPS impact.

For an actual iRacing replay, `IsOnTrack` can remain false and suppress expensive
widgets even when their windows exist. Add `--replay-visible-widgets` to both
captures to override `showOnlyWhenOnTrack` in memory, keep Radar visible without
pit/proximity hiding, and show Flags' no-flag state. This does not alter saved
settings or invent missing simulator data. Verify actual Fuel/Radar content
before measuring; the blind-spot channel can still remain idle in a replay.

If Windows Application Control blocks an unsigned packaged executable, use
`--target dev` for both captures instead. Development captures can compare modes
within that build, but cannot establish a release baseline or be compared with
earlier packaged measurements.

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
input requirements. Stable host facts (CPU model, logical cores, total memory,
platform, display server) are recorded automatically; dynamic host state is
not. The optional field count, class count, display geometry, FPS cap, and
sync mode flags complete the controlled-workload record.

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

A comparison is only conclusive when all controlled conditions match. The
variable under test must be declared instead:

```powershell
npm run perf:analyze -- perf-results/full.log --baseline perf-results/observer.log --contrast overlay
```

`--contrast` accepts `overlay`, `widgets`, `channels` and `scenario`. It removes
those fields from the matched-workload check while still printing the expected
differences in the report. Without it, `observer` versus `full` is correctly
reported as a workload mismatch and every gate is inconclusive.

Evidence is now granular: a short analysis window or mismatched workload
invalidates the CPU and frame gates, while unavailable private-memory samples
only invalidate the memory gate. FPS gates are reported as `NOT_APPLICABLE`
when both sides use an isolated `.irdt`, because those FPS values are historical
tape data. `--ignore-gates <names>` skips selected gates explicitly.

Analysis rejects inconclusive evidence by default after writing the summary.
It exits non-zero when the measured interval is shorter than five minutes,
private bytes are incomplete or too sparsely sampled, scenario/widget metadata
is missing or inconsistent, or a visibility phase violates its workload
expectations. Use `--allow-inconclusive` only for exploratory inspection of a
partial run.

The analyzer writes adjacent `.summary.json` and `.summary.md` files. For a
concise follow-up checklist, diagnose a raw log, analyzer summary, or analyzer
comparison:

```powershell
npm run perf -- diagnose perf-results/<candidate>.log --warmup-seconds 60
npm run perf -- diagnose perf-results/<candidate>.summary.json
```

This writes adjacent `.diagnosis.json` and `.diagnosis.md` files. For a raw
`.log`, the diagnosis also correlates timestamped FPS dips with main sections,
event-loop stalls, renderer measures and channel publication spikes; use
`--no-correlate` to skip it. `--format json|md` writes the diagnosis to stdout
and `--fail-on caution` (or `attention`) returns a non-zero exit code, which is
useful in CI. Before a benchmark, check prerequisites without launching the
app:

```powershell
npm run perf -- doctor --input perf-results/<recording>.irdt
npm run perf -- doctor --target packaged
```

`doctor` reports missing runtime dependencies, native replay addons, inaccessible
recordings/results directories, build provenance, target availability, CPU
governor, free memory, remote display sessions, the presence of the Linux
private-memory sampler and a read-only iRacing process probe. Use `--format json` for machine-readable output. Warnings such as a dirty
worktree do not block the check; hard failures return a non-zero exit code. It
does not launch an application or modify files. Live iRacing SDK and game-frame
measurements still require a supported Windows/iRacing setup.

### Tracing a stall with `chrome://tracing`

When `diagnose` reports an event-loop stall that no timed main-process section
explains, capture a short browser trace:

```bash
npm run perf:trace -- --input /path/to/session.irdt --duration-seconds 20 --output perf-results/stall.json
```

The runner starts the app with an isolated profile, replays the tape, records
the DevTools `Tracing` JSON stream for all processes (V8 GC, Blink/toplevel,
compositor, GPU, Electron) and stops the app afterwards. It also writes
`<trace>.trace-summary.md` and `.trace-summary.json`, ranking V8 CPU self time,
long tasks and GC events. Open `chrome://tracing` in a Chromium browser, choose
**Load**, select the JSON file, and inspect long tasks around the stall. Use
`--warmup-seconds` to start recording after replay has settled, or
`--no-analyze` to skip the generated summary. An existing trace can be
summarized later with `npm run perf:trace-analyze -- <trace.json>`. The
`CpuProfiler::StartProfiling` task at the start of every trace is excluded from
the long-task count. The analyzer reports nested complete events as leads, not
additive CPU time.

Tracing adds overhead, so keep these runs separate from A/B baselines. Use the
same replay segment for paired runs, and pass `--speed`, `--port` or
`--user-data-dir` when needed.

### Running a full A/B matrix

For overhead attribution, run observer/empty/full scenarios with the same tape
and identical analysis windows, then compare each stage with the previous one:

```bash
npm run perf:ab -- --input /path/to/session.irdt --duration-seconds 420 --warmup-seconds 60
```

The runner writes per-scenario captures, analyzer summaries and diagnoses into
`perf-results/ab-<timestamp>/`. `AB_REPORT.md` groups deltas by unit and lists
the gate checks and evidence status. Use `--scenarios observer,empty,full,map`
to add per-widget stages: names other than `observer`, `empty` or `full` are
widget types and run with `--widgets <name>` (as does `widgets:<name>`).
`--profile <directory>` seeds every run from the same saved dashboard. The
runner declares `overlay` or `widgets` contrast automatically for each stage;
`--contrast` overrides it and `--ignore-gates memory,FPS` skips named gates.
Full scenarios set
`PERF_FORCE_PROCESSOR_DEMAND=1` so widget channels publish even when renderer
windows have not settled yet; observer and empty baselines stay
undemand-driven. Analysis now fails on inconclusive evidence by default; pass
`--allow-inconclusive` to the A/B runner for exploratory captures and repeat
any failed pair in reverse order before drawing a conclusion.

### Profiling two branches or a diff

To compare committed refs under identical conditions, use the branch runner.
It creates detached worktrees, seeds each side with the same profile, runs the
same replay and writes a `BRANCH_REPORT.md` with both commits, the changed
file list and the normal comparison gates:

```bash
npm run perf:branches -- --baseline main --candidate HEAD \
  --input test-data/telemetry/ai-race-10min.irdt --output perf-results/main-vs-pr
```

`--diff main...HEAD` (or `main..HEAD`, or a single commit) replaces the two ref
flags. `--dry-run` resolves the refs and prints the changed files without
launching the app. `--pr 949` resolves the PR base/head through `gh` automatically.

The default order is ABBA: `base, candidate, candidate, base` per pair;
`--pairs 2` repeats that cycle, and `--order ab` restores the old two-run
behaviour. The report aggregates each metric by commit with median/range,
compares the effect to the observed run noise, and prints a verdict such as
`NO REPRODUCIBLE EFFECT`. A short harness check is available via `--smoke`
(60 s, two runs, inconclusive allowed), and `--coverage-probe-seconds 30`
adds a short probe that narrows `--widgets` to fully covered types.
Several existing comparisons can be combined with
`npm run perf:report -- <summary.json>...`. Generated worktrees are cached by
commit SHA under `perf-results/.cache/branches` and reused by default; use
`--no-reuse` for fresh checkouts and `--clean-cache` to remove the cache.
`--ignore-gates memory,FPS` skips named gates. Temporary non-cached worktrees
are removed afterwards unless `--keep-worktrees` is set. Dependencies and the native build are linked from the current checkout;
use `--install` for a clean `npm ci`, and add `--rebuild-native` when the diff
touches `binding.gyp` or `src/app/irsdk/native/`. For a PR branch that is not
local yet, fetch the ref first, for example `git fetch origin pull/123/head:pr-123`.
To include uncommitted local changes, pass `--candidate-dir .` instead of a ref.

The diagnosis reuses the analyzer's evidence and project gates to highlight investigation
leads and suggest next measurements. It does not identify root causes, and an
inconclusive run remains inconclusive; use the full analyzer report for detailed
metrics and baseline comparisons. Warmup and analysis-window options apply only
to raw `.log` inputs. The diagnosis ranks main-process sections separately by
interval p99 and estimated accumulated work; nested-section values overlap and
must not be summed. Instrumented renderer callbacks are ranked by p99. These
rankings are leads, not proof of root cause or complete React/game-frame cost.

Comparison reports include each run's source commit and worktree state, plus
workload metadata with source identity excluded. A workload-metadata mismatch
makes performance gates inconclusive; source revisions are expected to differ
in a before/after optimization test. Older captures without provenance are
marked as not recorded.

The analyzer's initial regression gates are:

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
shared Chromium pages and can double-count them across processes. Electron does
not expose `privateBytes` on Linux, so while `PERF_METRICS=1` is active the
collector also samples `Private_Clean` plus `Private_Dirty` from
`/proc/<pid>/smaps_rollup` (falling back to `/proc/<pid>/status` where
available) for every app process and reports them as `privateMemoryMB` and
`totalAppPrivateMemoryMB`. Working-set slope remains in the report as
diagnostic context. The private-memory gate is
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
