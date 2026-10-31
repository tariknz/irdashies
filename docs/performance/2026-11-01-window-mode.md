# Actual iRacing replay: shared versus individual windows

**Recorded:** 1 November 2026, Pacific/Auckland. **Build:**
`feat/per-widget-overlay-windows`, based on `a5200766d2d47b5088e6c73436baa4e62cc79faf`
with uncommitted feature changes. This is a development workload reference,
not a replacement for the packaged release reference.

**Publication note:** The feature was subsequently rebased onto `ddf3f69e`,
which includes the upstream Input optimization in PR #857. The measurements
below predate that fix and have not been repeated on the rebased feature.
Input's measured growth is a finding for the captured build, not proof that it
persists after #857.

The attached [machine-readable evidence](./2026-11-01-window-mode.json) preserves
the per-run figures, qualifications, source-manifest fingerprint and raw-log
hashes even when the local `perf-results/` directory is unavailable. See the
[baseline register](../PERFORMANCE_TEST_LOG.md#current-baseline-register) for
which captures may be compared.

Four corrected development captures ran in shared → individual → individual → shared order. Each lasted 420 seconds with the first 60 seconds excluded. All 1,608 recorded source-file hashes remained unchanged. Native replay samples confirm normal-speed playback, session 2, the same cockpit camera and focus car, and monotonically increasing replay frames during all four measured windows (72 replay samples per run).

## Setup and visibility verification

- Actual simulator replay, using the normal live SDK connection; no `.irdt` publisher. FPS values are current simulator telemetry.
- Gesamtstrecke VLN, 59-car field, two classes. Start frame 129269, race session time approximately 59.88 seconds. Same cockpit camera throughout.
- Three connected 2560×1440 desktop displays. Widgets occupy two displays: shared mode uses two renderer windows; individual mode uses six.
- Six widget instances: Input, Fuel twice, Radar, Flags, Blind Spot Monitor. The widget-type filter includes the normally disabled second Fuel instance in memory.
- The original `live-windows-*` captures are **excluded**: Fuel and Radar were hidden by `showOnlyWhenOnTrack` because that SDK flag is false during replay. They are not evidence for visible Fuel performance.
- Corrected runs used `--replay-visible-widgets` on both modes. It disables the on-track visibility restriction, disables Radar proximity/pit hiding, and shows Flags' no-flag state. It does not manufacture simulator data or save settings. Both Fuel panels and Radar content were visually verified in preflight; Fuel content was also verified in both capture modes.
- The main Fuel panel renders its header, gauge, consumption grid, pit window/finish data and time-empty section. The second shows a smaller header/confidence layout. This is not a stress test of a populated fuel-history graph.

## Per-run application and simulator measurements

| Run, in capture order | Game FPS, average | App CPU | GPU-process CPU | Peak app private memory | Private-memory slope |
| --------------------- | ----------------: | ------: | --------------: | ----------------------: | -------------------: |
| Shared A1             |            73.695 |  2.071% |          0.831% |             1143.09 MiB |        9.657 MiB/min |
| Individual B1         |            73.319 |  4.811% |          3.146% |             1478.64 MiB |       19.680 MiB/min |
| Individual B2         |            73.157 |  4.587% |          3.072% |             1473.79 MiB |       20.762 MiB/min |
| Shared A2             |            73.707 |  1.949% |          0.825% |             1151.64 MiB |       10.048 MiB/min |

Across the two runs per mode, observed average game FPS was 73.701 shared and 73.238 individual, approximately 0.63% lower with individual windows. The first pair changed by −0.51%; the reverse-order pair changed by −0.75%. These are descriptive observations from this replay, not a statistical equivalence claim or release acceptance result.

Average app CPU increased from 2.010% to 4.699%, about 134%. The mean of the two per-run private-memory peaks increased from 1147.36 to 1476.21 MiB, about 29%. Most of the CPU increase is recorded in Electron's GPU process: 0.828% → 3.109%. This is **CPU consumption by that process**, not GPU engine utilization, and does not by itself identify the precise graphics/compositor operation responsible.

Renderer frame-time p99 means were approximately 16.80 ms shared and 16.90 ms individual. Frames over 50 ms were 0% in three runs and 0.000772% in Individual B2. Simulator FPS telemetry is not a PresentMon present-to-present trace.

## Fuel findings

In individual mode, the two Fuel renderer processes together averaged 0.443% CPU in B1 and 0.382% in B2, approximately 0.413% combined across repeats. Their combined mean private memory was approximately 252.37 MiB. Their combined private-memory slope was slightly negative in both repeats (−0.330 and −0.344 MiB/min).

For context, Input alone averaged approximately 0.448% renderer CPU across those runs. Radar averaged approximately 537.54 MiB private memory, the largest renderer footprint. Input's private-memory growth averaged approximately 9.75 MiB/min; the two Fuel renderers did not exhibit that growth in these captures. These are process measurements and include renderer overhead; they are not isolated React component timings.

The main-process fuel-projection processor averaged approximately 0.0178 ms per operation at about 5 Hz, in both modes. Fuel is not the dominant cost in this layout/replay. Live fuel burn, accumulated stint history, and a populated history graph require their own workload before generalizing this finding to live driving.

## Evidence limits and recommendation

The blind-spot input never published a changing snapshot in this replay. The existing analyzer therefore marks all four captures **inconclusive for full declared-workload acceptance**. `--allow-inconclusive` was used to preserve descriptive output, not to waive that limitation. All other selected widgets' declared inputs were exercised. No full-workload gate pass is claimed.

Observed app private-memory growth averages 9.85 MiB/min shared and 20.22 MiB/min individual; both exceed the project's 5 MiB/min target. The captures establish observed growth over six measured minutes, not the presence or absence of a long-running leak. Keep individual windows experimental; investigate the GPU-process CPU increase and the Input/GPU memory-growth pattern before considering a default change.

These are development-build results. Earlier packaged launches were blocked by Windows Application Control. Do not compare these values numerically with the earlier isolated tape runs or infer release performance. Racelab was not runtime-benchmarked.

The benchmark processes have exited. The simulator was returned to the original frame 3331 in session 0 and left paused, with the original camera. Saved mode remains `display`, original Fuel retains `showOnlyWhenOnTrack: true`, and the second Fuel instance remains disabled in the saved profile.

## Reproduction and artifacts

Load the same actual iRacing replay, set the same start frame/camera, and use the native controls to reset before each capture. The harness does not reset an actual simulator replay automatically. The task-local controller and per-run provenance record the resets used here.

```powershell
npm run perf:run -- --target dev --mode full --window-mode display --replay-visible-widgets --widgets input,fuel,radar,flag,blindspotmonitor --duration-seconds 420 --scenario live-visible-display
npm run perf:run -- --target dev --mode full --window-mode widget --replay-visible-widgets --widgets input,fuel,radar,flag,blindspotmonitor --duration-seconds 420 --scenario live-visible-widget
```

Corrected log IDs are `live-visible-display-a1`, `live-visible-widget-b1`, `live-visible-widget-b2`, and `live-visible-display-a2`. Each has `.log`, `.provenance.json`, `.replay.jsonl`, and generated `.summary.json`/`.summary.md` files. `live-visible-results.json` contains the combined measurements; `live-visible-source.json` records source hashes. The benchmark-only visibility override has a passing immutability/activation test, TypeScript check, and targeted ESLint check.

Raw logs and control scripts remain local under ignored `perf-results/`; the
attached JSON is the durable summary, not a promise that raw artifacts are
shipped with the repository.
