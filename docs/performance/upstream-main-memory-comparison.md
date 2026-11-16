# Memory fixes versus upstream main

Comparison on 2026-11-16: upstream `tariknz/main` at `668d457e`, versus
`fix/replay-memory-resources` at `da06344c`. The latter contains upstream main
through a merge. The Radar import conflict was resolved by retaining upstream's
rings/visibility implementation and the branch's canvas cleanup hook.

## Result

The branch processes recorded frames about **8.7% faster**, with **3.2% lower
application CPU** in this local max-speed stress test. It does **not** demonstrate
a lower retained footprint with widgets continuously enabled: both versions
settle near **274 MiB private memory** after collection. Disabling every widget
releases the overlay renderer only in the fixed build, reducing the remaining
application footprint in the separate lifecycle check.

These are Linux replay results, not live Windows/iRacing validation or proof
that a long-session memory leak has been eliminated.

## Method

- Two independent Linux production builds; same dependencies and native build
  settings. Ryzen 5 9600X environment exposing 9 logical CPUs, 2560x1009 display.
- One isolated, identical profile with 31 enabled widgets, display-window mode,
  Input trace enabled, and replay visibility overrides. Heart Rate, Stream Chat,
  Garage Cover, Gantry, Stint Plan and Strategy Timeline excluded. Web server
  disabled. Settings absent/closed; replay controls remain included.
- Recording: `memory-diagnostic.irdt`, 38,410 source frames, 641.5 seconds.
  SHA-256: `2b234fbee7cd8b5f5b81ff9d30a48ee28b3598bc9a3694fc256365a0d35237ec`.
- Identical **temporary instrumentation** in both builds: native max/every-frame
  transport, `setImmediate` replay scheduling instead of the normal 25/60 Hz
  poll limit, source counters, and a signal-triggered pause/GC checkpoint. This
  instrumentation is excluded from the product branch and final packaged build.
  Channel publication rates and widget/display drawing cadences remain normal.
- Sequential ABBA order: main, fixed, fixed, main. Each fresh application warms
  for 10 seconds, then runs two 30-second blocks. No concurrent benchmark apps.
  Between blocks, pause replay, collect main and every renderer twice, settle
  for 200 ms after each pass, then sample process-private memory from
  `/proc/*/smaps_rollup`. Counters must not change during checkpoints and every
  renderer must have a heap sample. All six runs, including lifecycle, completed.
- CPU and drawing measurements use existing one-second performance reports;
  interval boundaries near pauses/collections are excluded. Each stress run
  contributes 53 or 54 main intervals and 54 overlay intervals. Values below
  average the two runs for each build. CPU uses Electron's summed application
  CPU metric, not an inferred core count. P95 below is the weighted mean of
  per-interval P95 values, not a reconstructed global percentile.

## Stress-test averages

| Metric                                  | Upstream main | Fixed branch |                                               Change |
| --------------------------------------- | ------------: | -----------: | ---------------------------------------------------: |
| Delivered source frames / wall second   |        1380.2 |       1500.4 |                                                +8.7% |
| Application CPU                         |        22.32% |       21.61% |                                       -3.2% relative |
| SDK telemetry read / delivered tick     |     0.5623 ms |    0.5126 ms |                                                -8.8% |
| Process telemetry / delivered tick      |     0.6209 ms |    0.5690 ms |                                                -8.4% |
| Overlay frame interval, mean            |      16.75 ms |     16.72 ms |                              approximately unchanged |
| Overlay interval P95, mean              |      17.09 ms |     16.80 ms |                                     small difference |
| Overlay frames over 25 ms               |        0.217% |       0.093% | rare events; insufficient repeats for a strong claim |
| Private memory after warmup + GC        |    250.08 MiB |   250.04 MiB |                              approximately unchanged |
| Private memory after 30 s + GC          |    272.26 MiB |   274.61 MiB |                                            +2.34 MiB |
| Private memory after 60 s + GC          |    273.35 MiB |   273.94 MiB |                                            +0.59 MiB |
| Main V8 heap after 60 s + GC            |     14.65 MiB |    14.41 MiB |                                            -0.24 MiB |
| Combined renderer heaps after 60 s + GC |     25.56 MiB |    25.54 MiB |                              approximately unchanged |

Map, Input trace and Radar draw costs did not show a consistent material change:
means were 0.0946/0.0967 ms, 0.1070/0.1074 ms and 0.8490/0.8568 ms respectively
(main/fixed). Radar costs varied substantially between individual runs.

## Individual runs

| Run      | Source frames during measured blocks | Source frames/s |    CPU | Warm private | 30 s private | 60 s private |
| -------- | -----------------------------------: | --------------: | -----: | -----------: | -----------: | -----------: |
| main A1  |                               82,078 |          1367.9 | 22.27% |   250.32 MiB |   273.54 MiB |   271.80 MiB |
| fixed B1 |                               89,856 |          1497.5 | 21.37% |   250.89 MiB |   274.98 MiB |   273.42 MiB |
| fixed B2 |                               90,204 |          1503.3 | 21.84% |   249.18 MiB |   274.23 MiB |   274.46 MiB |
| main A2  |                               83,550 |          1392.5 | 22.38% |   249.83 MiB |   270.98 MiB |   274.90 MiB |

All observed consumed/delivered source counters agree. This is equal wall time,
not equal total source work: the faster branch processes more frames and reaches
a different recording position. Recording looping is enabled. Most post-warmup
memory growth occurs before the first 30-second checkpoint in both builds; the
short follow-up segment does not establish a long-term growth rate. The small
active-memory difference is within the observed between-run range.

## Disable-all lifecycle check

One additional fresh run per build, same profile and 10-second warmup. Pause and
collect, disable all widgets through the existing dashboard bridge, wait three
seconds, then repeat the full application checkpoint. Replay stays paused and
source counters remain unchanged. The replay-control renderer remains open.

| Build         | Before disabling | After disabling | Released | Renderer processes before / after |
| ------------- | ---------------: | --------------: | -------: | --------------------------------: |
| Upstream main |        252.1 MiB |       231.3 MiB | 20.8 MiB |                             2 / 2 |
| Fixed branch  |        244.3 MiB |       177.0 MiB | 67.3 MiB |                             2 / 1 |

The fixed application ends about 54.3 MiB lower in this check. Accounting for
unequal starting footprints, it releases about 46.5 MiB more. This supports the
empty-overlay process cleanup; a single lifecycle pair is not a statistical
estimate of expected savings across machines and profiles.

## Validation and artifacts

- `npm run lint` passed after the upstream merge.
- 213 tests passed across SDK/native, overlay lifecycle, canvas cleanup, colors,
  Radar display and capped map-animation suites.
- Both instrumented production builds packaged successfully. Temporary source
  changes are removed before the final production rebuild.
- Raw logs, per-process/heap checkpoints, profile, ASAR/native hashes,
  instrumentation patches and runner/summarizer scripts are preserved locally
  under `perf-results/upstream-memory-comparison/` and excluded from Git.
