# Renderer update cost: Input and Radar

8 November 2026. Baseline: `b89b4e8d` (SDK recovery and dependency updates).
This renderer work is a separate branch on top of that baseline. The comparison
uses the same updated dependencies in both variants.

## Changes

- Input mounts its controls and flash consumers only while its session/on-track
  visibility rules permit content. Track/session subscriptions remain active
  so it can become visible again.
- Input selects signals used by its actual layout. Raw pedal/steering precision
  is unchanged. Gear-only layouts ignore unrelated RPM/pedal updates; speed
  changes notify only when the displayed integer or unit changes. The shared
  shift-flash hook selects its boolean result instead of the whole snapshot.
- A visible trace still selects the source version: filtering out steady pedal
  values must not stop its sampling clock. Flash-only rerenders do not append
  extra samples. D3 generators and index arrays are reused across samples;
  bounded circular history and existing curves are preserved.
- Radar carries a 60 Hz paint deadline across refreshes. Source extrapolation,
  fade/visibility behavior and the 25 Hz source cadence are unchanged. It does
  not try to replay missed paints after a stall.
- `inputTraceFrameMs` and `radarFrameMs` are recorded through the existing
  renderer perf bridge. `perf:analyze` reports their rates and p99 costs and
  compares them with a baseline, excluding windows that never ran a measure.

## Controlled evidence

Tests drive actual channel hooks with 60 synthetic snapshots. A gear-only
Input has zero additional React renders for 60 RPM-only updates, while a
visible trace retains all 60 steady-control source updates. Visibility tests
verify that the high-frequency subtree unmounts and remounts, including session
visibility changes. These are synthetic tests, not an actual full-grid replay.

Radar tests simulate 60/120/144/240 display refreshes over one second. Every
case paints 61 times including the initial synchronous paint: 60 scheduled
paints. At 30 Hz it paints each available refresh. Tests also cover a long
stall, source changes, inactivity and unmount cancellation. At 144 Hz this
removes about 58% of scheduled paint calls; it does not establish a matching
reduction in GPU or application CPU consumption.

Chromium 158 on Linux loaded the baseline and candidate components in one
Vite development harness. A 400-sample deterministic fixture supplied the
same controls to both. InputTrace's SVG path strings match exactly after
those updates. Input/Radar screenshots were inspected; review media and the
standalone harness remain outside the repository under
`/tmp/irdashies-renderer-review/`.

The InputTrace CPU microbenchmark uses the same React/D3 dependencies, manual
RAF delivery and input sequence in both variants. Each run warms up for 300
samples and measures 2,000 samples, with all four control curves and ABS bar
rendering enabled. The measured RAF section includes D3 path generation and
SVG attribute writes; the commit section measures synchronous React updates.
It does not include browser paint, GPU work or simulator frame timing.

| Run | Variant   | Mean RAF work, ms | Mean React update, ms |
| --- | --------- | ----------------: | --------------------: |
| 1   | Baseline  |           0.63350 |               0.06565 |
| 2   | Candidate |           0.61760 |               0.08950 |
| 3   | Candidate |           0.62700 |               0.07005 |
| 4   | Baseline  |           0.62850 |               0.08320 |
| 5   | Baseline  |           0.62915 |               0.06855 |
| 6   | Candidate |           0.62440 |               0.07945 |

This shows no convincing overall CPU improvement in the trace microbenchmark:
SVG-string construction still dominates, and React-update timings vary.
Generator reuse removes repeated generator/accessor construction, not the
cost of rebuilding the curves. No memory-slope or game-FPS improvement is
claimed. Counters and named measures make a matched application capture the
next step; compare packaged builds on the same replay/profile before drawing
conclusions about game FPS or long-running memory growth.
