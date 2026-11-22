# Performance diagnostics CLI

Use these tools to reproduce overlay performance issues with recorded iRacing
telemetry, compare two revisions under the same workload, and decide where to
profile next.

This change adds a host and replay preflight (`doctor`), performance diagnosis
from captures (`diagnose`), CPU and event-loop tracing (`trace`), and automated
scenario and branch comparisons (`ab`, `branches`, `report`). It also adds Linux
private-memory sampling, replay speed controls, and opt-in SDK wait metrics.

## Before you start

Run the examples from the repository root. Use Node.js 24 or later, install the
project dependencies with `npm ci`, and have a local iRacing telemetry tape
(`.irdt`). Replace `/path/to/session.irdt` with your tape's path. Build the native
replay tools with `npm run irsdk:build` if the preflight reports missing binaries.

```sh
npm run perf -- --help
npm run perf -- doctor --input "/path/to/session.irdt"
```

The examples use the development target. For a Windows packaged benchmark,
build with `npm run package` and use `--target packaged` on both sides of the
comparison.

## Capture and diagnose one run

```sh
npm run perf -- run --mode full --scenario replay-full --run-id replay-full --duration-seconds 420 --replay-input "/path/to/session.irdt" --user-data-dir perf-results/replay-full-profile
npm run perf -- analyze perf-results/replay-full.log --warmup-seconds 60
npm run perf -- diagnose perf-results/replay-full.log --warmup-seconds 60
```

Read `replay-full.summary.md` for the metrics and
`replay-full.diagnosis.md` for likely areas to investigate. Both commands also
write JSON next to the raw log. Use a new run ID and isolated profile directory
for a fresh capture. Add `--replay-speed 2` to test twice-normal playback or
`--sdk-wait` to collect wait metrics on a build that supports them.

## Compare two branches

```sh
npm run perf -- branches --baseline main --candidate HEAD --input "/path/to/session.irdt" --output perf-results/main-vs-head
```

Use the local ref that represents your baseline. The default ABBA order runs
baseline, candidate, candidate, baseline. The runner gives each capture a
separate profile and checks every pair before reporting an aggregate effect in
`perf-results/main-vs-head/BRANCH_REPORT.md`. Pass `--profile <directory>` to
start every capture from the same saved dashboard.

Use `--dry-run` to preview the refs and affected files, or `--smoke` with a
fresh output directory to verify that the harness starts. A smoke run is too
short for the normal evidence gates. If the branches change native SDK files,
use `--rebuild-native` or `--install`. If dependency files differ, use
`--install` to benchmark each branch with its own dependencies.

## Choose the next command

| Command | When to use it |
| --- | --- |
| `npm run perf -- ab --input "/path/to/session.irdt"` | Isolate the cost of SDK observation, empty overlay windows, and the full dashboard on one revision. Read `AB_REPORT.md` in the output directory. |
| `npm run perf -- trace --input "/path/to/session.irdt" --duration-seconds 20 --output perf-results/stall.json` | Capture a short DevTools trace to investigate a stall. Open the JSON in Chromium tracing or read the generated trace summary. |
| `npm run perf -- trace-analyze perf-results/stall.json` | Summarize an existing trace. |
| `npm run perf -- report left.summary.json right.summary.json` | Aggregate existing branch comparison summaries by source commit. |

Keep the replay, playback speed, dashboard, target, and analysis window matched
across comparisons. Treat `INCONCLUSIVE` as a reason to inspect the evidence
and repeat the run. FPS embedded in an isolated tape describes the original
recording. Use live iRacing measurements for conclusions about simulator FPS.
Run traces separately from the benchmark because tracing adds overhead.

See the [benchmark guide](../../docs/PERFORMANCE_BENCHMARKS.md) for the full
protocol, platform details, and thresholds.
