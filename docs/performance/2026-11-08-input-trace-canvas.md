# InputTrace: SVG versus Canvas 2D

8 November 2026. Baseline: `53274314` (`fix/renderer-update-cost`). Candidate:
`fix/input-trace-canvas`, based on that baseline. Dependencies are identical
in both variants; this comparison does not mix the earlier dependency update
with the rendering change.

## Implementation

D3's persistent `line`/`area` generators now use `.context(ctx)` to issue
Canvas path commands. They retain `curveBasis`, the 400x100 logical coordinate
system, channel order, steering normalization, stroke widths, clamping and
both ABS styles. No SVG path strings, `Path2D` string parsing, sample
reduction or change to input precision is involved.

A drawing object owns the bounded sample ring and reusable generators.
Painting is separate from sampling: ResizeObserver, device-pixel-ratio resize
events and widget-scale changes repaint existing history without moving its
time axis. Only an input/config update schedules a sample, with the latest
update winning before RAF. Unmount cancels RAF and releases resize listeners.
Capacity changes reset all channels together. Invalid capacities cannot
produce a zero-sized ring or non-finite coordinates.

The canvas has explicit CSS sizing and a backing buffer derived from its
logical dimensions, device pixel ratio and widget scale. `inputTraceFrameMs`
continues to measure the complete data frame (configuration, sample insertion
and painting); resize-only repaints use the same measure.

## Controlled CPU microbenchmark

Linux, Node 24.22.2, Chromium 158.0.8127.18 headless, React 19.3.1 development
build and D3 7.9.2. The baseline component was extracted from `53274314`;
the candidate loaded the working source in the same Vite harness. Both used
an explicit 400x100 CSS-pixel container at DPR 1, a 400-sample history, four
control curves, ABS bar mode and the same deterministic inputs.

Each run warms up for 300 samples, then measures 2,000 samples. RAF delivery
is manual: the draw interval measures the complete callback, including sample
insertion and SVG attribute updates or Canvas commands. React update time is
measured separately around synchronous root updates. Order is A-B-B-A-A-B.

| Run | Variant | Mean RAF callback, ms | Mean React update, ms |
| --- | ------- | --------------------: | --------------------: |
| 1   | SVG     |               0.65140 |               0.07415 |
| 2   | Canvas  |               0.11010 |               0.01645 |
| 3   | Canvas  |               0.11845 |               0.01740 |
| 4   | SVG     |               0.63260 |               0.07055 |
| 5   | SVG     |               0.64645 |               0.08265 |
| 6   | Canvas  |               0.12055 |               0.00910 |

Median mean RAF callback cost is **0.64645 -> 0.11845 ms/sample**, about
**81.7% lower (5.46x faster)**. Median React update cost is 0.07415 ->
0.01645 ms. This measures browser-main-thread work, not completed asynchronous
GPU rasterization/composition, actual frame rate or a packaged iRacing run.
No game-FPS or long-running memory-slope improvement is claimed.

## Visual and lifecycle checks

A deterministic 400-sample Input/Radar fixture was rendered in Chromium.
The trace occupied the same 395.421875x144 CSS-pixel rectangle in both
variants. Curves, clipping, grid, colors and ABS highlighting were inspected.
Rasterization is not pixel-identical: the DPR 1 crops have mean absolute
R/G/B differences of approximately 1.53/1.18/0.63 on a 0..255 scale.

DPR 2 browser checks cover widget scales 100% and 150%, plus a responsive
resize. Backing dimensions match physical dimensions to within one pixel.
At 100%, a 395.421875x144 CSS-pixel trace uses a 791x288 buffer. At 150%,
the fixture's 387.421875x135.984375 physical CSS-pixel trace uses 775x272.
Both ABS overlay and bar modes were inspected in Chromium. No browser
JavaScript errors were observed. Screenshots, benchmark results
and the standalone review harness are outside the repository under
`/tmp/irdashies-canvas-review/`.

Tests record numerical Canvas commands and verify ring-buffer wraparound,
capacity changes, latest-input coalescing, cancellation, channel order,
steering/brake coordinates, ABS fill opacity and overlay width, disabled
channel clearing, resize without sampling, DPR/widget scale, and invalid
capacities. Existing Input stories cover random controls, out-of-range input,
ABS bar mode and stroke widths; a 150% widget-scale story is added.

A matched packaged replay with renderer measures and simulator frame timing
remains necessary to establish the benefit for real driving.

Validation: the full suite passed 6,172 tests with 40 skipped; four additional
invalid-capacity cases then passed in the final 80-test Input run. TypeScript,
ESLint, Storybook build and Linux Electron packaging pass. Windows/iRacing
and macOS were not exercised by these checks.
