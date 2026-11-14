# Direct iRacing game-frame benchmark

**Reviewed 15 November 2026:** Same-session source controls did not reproduce an aggregate CPU/FPS regression. Historical cross-date drift, presentation cost, private growth, limited widget coverage and the rare overlay stall remain distinct findings. Neither canvas variant is retained.

iRacing was activated before capture and checked periodically through the UI. These point observations and the absence of other automated UI inputs support the intended foreground protocol; continuous OS foreground state was not recorded.

14 November 2026. PresentMon 2.6.0 captures the actual iRacingSim64DX11.exe
frame stream on current main 711552a1. Four passes alternate **off → on → on → off**.
iRacing is activated before every capture, with periodic UI focus-state checks
and no other app UI work during the measured intervals.

## Measured overlay cost

Mean presented FPS is **75.17 off / 73.89 on**,
a **1.70%** (1.27 FPS) cost in this
saved-profile replay. Long display intervals above 25 ms average
**13.54 / 19.97 per minute**
off/on. There are **3 / 3** display intervals above
50 ms across the two analyzed repeats per condition, and
**0 / 0** above 100 ms.
These are descriptive observations from two repeats, not an equivalence test.

### Game presentation timing

| Run         | Mean FPS | 1% low FPS | 0.1% low FPS | p99 interval, ms | Maximum interval, ms |
| ----------- | -------: | ---------: | -----------: | ---------------: | -------------------: |
| game-off-a1 |    75.17 |      50.29 |        42.60 |           18.792 |               46.496 |
| game-on-b1  |    74.01 |      49.11 |        40.76 |           19.091 |               55.370 |
| game-on-b2  |    73.78 |      48.58 |        41.38 |           19.291 |               48.673 |
| game-off-a2 |    75.17 |      49.63 |        40.19 |           18.839 |               54.580 |

### Delivery to the display

| Run         | Mean displayed FPS | Intervals >25 ms | Intervals >50 ms | Intervals >100 ms | Maximum interval, ms |
| ----------- | -----------------: | ---------------: | ---------------: | ----------------: | -------------------: |
| game-off-a1 |              59.74 |               73 |                1 |                 0 |               50.060 |
| game-on-b1  |              59.64 |              105 |                2 |                 0 |               50.056 |
| game-on-b2  |              59.58 |              128 |                1 |                 0 |               50.023 |
| game-off-a2 |              59.70 |               85 |                2 |                 0 |               66.740 |

Presented and displayed FPS are different populations. Missing display timing
is retained as unavailable, not converted to zero or called a stutter. The
CSV presentation mode is retained per run. Mean FPS is 1000 divided by mean
frame interval; low FPS is 1000 divided by the mean of the slowest 1% or 0.1%
of intervals (rounding the tail count up). p99/p99.9 use nearest rank. These
definitions are independent of the separate GUI stats CSV. Frame fields follow
the [official PresentMon capture documentation](https://github.com/GameTechDev/PresentMon/blob/v2.6.0/README-CaptureApplication.md).

The much larger overlay-renderer p99 from the
[widget audit](./2026-11-14-widget-regressions.md) is not an iRacing frame time.
Current on/off game cost also does not establish historical game-frame drift:
the November reference has no matched PresentMon stream. The later short
old/current source captures below are same-session controls, not a recovered
November game-frame reference.

## Workload and protocol

The off condition has no irDashies application process. The on condition is
the same isolated saved Default profile as the widget audit: 20 enabled
widget types, including its Race-hidden Lap Trace; three shared display
overlays plus Gantry. Every on pass starts from the frozen seed hash
53cfe4ec5cf2f1160ed81cc2a83bfc4723c46abf4bfeb2f8c7cac27c6c382c8c.
Its existing replay-visibility adjustments remain active. No demo data is used.
The app is the development/performance-instrumented target; this is not a
packaged-release gate or a full live fuel/control/chat/device workload.

Each pass seeks to frame 129269/session 2/time 59.88, focus car 37,
cockpit group 9/camera 1, then plays at 1×. It is the same 59-car/two-class
Gesamtstrecke VLN replay. Graphics remain borderless 7680×1440, configured
84 FPS cap, with the unchanged renderer configuration hash retained in evidence.
PresentMon's GUI/service collects in every condition with its own overlay
hidden during capture. Its console failed trace-session access under the
agent token, so no administrative or security settings were changed.

The GUI target is the simulator, not iRacing UI; auto-targeting is off.
Capture duration is 420 seconds, with no delayed start. After setup, iRacing
is activated, Ctrl+Shift+K starts capture, then the native SDK starts playback.
The recorded hotkey-to-play delay is sub-second. Analysis uses CSV seconds
60–410, a 350-second window that excludes warmup and shutdown edges. The
replay controller samples every five seconds and pauses after 425 seconds.
This is closely aligned capture-relative replay analysis, not exact
frame-locked alignment across traces. No builds/tests run in capture windows.

The dominant game swap chain is selected by frame count within the measured
window. A startup/retired chain outside that window cannot displace it. Raw CSVs remain in
Documents/PresentMon/Captures and ignored perf-results copies. The
[sanitized evidence](./2026-11-14-game-stutter.json) includes hashes, exact
distributions, swap-chain/mode metadata, replay
observations, focus checks and individual run provenance. The 10-second
setup smoke capture is excluded from results.

Reanalyze a copied GUI capture with:

    node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON tools/perf/analyze-game.ts perf-results/<run>.presentmon.csv

## Validation and restoration

All four captures contain the full analysis window and verified normal-speed
replay progression. Every recorded foreground check identifies the simulator.
Six analyzer tests cover quoted CSV, missing display values, display-specific
hitches, swap-chain selection, window trimming and tail definitions. All five
targeted test files pass 46 tests; TypeScript and full-project ESLint pass with
ignored private capture artifacts excluded (`npm run lint -- --ignore-pattern perf-results/**`).
The application source remains unchanged; benchmark tooling is separate.
User irDashies configuration is unchanged and the replay's pre-series scene,
camera and playback state are restored. PresentMon's original ten-second
duration value and disabled timed-capture setting are restored, with iRacing
still selected. Remaining follow-ups are kept in the
[separate findings queue](./2026-11-14-widget-findings.md).

## Short matched old/current game-frame follow-up

Four foreground PresentMon captures run exact benchmark source a5200766 /
current 711552a1 / current / benchmark source. Their Electron versions are
45.2.0 / 45.3.2 respectively. Each plays the same replay for 122 seconds
with the frozen 20-widget seed; analysis covers playback 30-120 seconds.
Capture-relative windows account for the recorded hotkey-to-play delay;
GUI latency remains unmeasured, so alignment is not exact per-frame.
No native recorder or other analysis runs during the measured segments.
All recorded foreground and replay scene checks pass.

| Capture order         | App CPU | Game presented FPS | Present p99 | Present >50 ms | Display >50 ms |
| --------------------- | ------: | -----------------: | ----------: | -------------: | -------------: |
| game-source-old-1     |  6.277% |              76.64 |   16.230 ms |              0 |              0 |
| game-source-current-1 |  5.729% |              77.14 |   15.768 ms |              0 |              0 |
| game-source-current-2 |  6.075% |              77.00 |   15.843 ms |              1 |              1 |
| game-source-old-2     |  6.080% |              76.41 |   16.258 ms |              1 |              0 |

Mean app CPU is 6.178% old / 5.902% current
(-0.277 percentage points). Mean presented FPS
is 76.53 / 77.07 (0.71%
higher current); present p99 averages 16.244 / 15.805 ms.
These short observations do not reproduce the suspected CPU/FPS regression.
They do not prove statistical equivalence or a performance improvement.

Each build has one game-present interval above 50 ms over 180 measured
seconds, and zero above 100 ms. Current has one displayed interval above
50 ms versus zero old. This isolated event is retained, not attributed to
source changes. Display timing is near 60 Hz under composition and is
separate from the roughly 77 FPS game submission stream.

GPU utilization averages 98.80% old /
98.86% current, temperature 82.95 /
82.97 C and frequency 1765.4 /
1766.5 MHz. Thermal/power limitation flags are unavailable;
high temperature alone is not a throttling diagnosis.

The five-minute duration and replay/visibility coverage gates remain unmet.
This is a repeated sniff test, not a packaged-release or rare-stall clearance.
Track the suspected aggregate CPU regression as **not reproduced in this
workload**. Radar presentation cost, private growth and the earlier six-second
overlay stall remain separate open findings. No widget change is retained.
Original replay frame/camera and 1x playback are restored; user config and
graphics hashes match, and PresentMon capture is stopped. The JSON evidence
retains capture/build/source hashes, alignment and foreground checks.

## Offline review

All 14 distinct original/source/canvas CSV summaries are recalculated with
the final analyzer and match the recorded game-frame values. CSV fingerprints
match. The parser selects the primary stream within the measured window,
rejects nonfinite windows/durations and avoids argument-count limits when
finding capture bounds. Existing captures are numerically unchanged. The
full suite passes 6,950 tests with 5 skipped; TypeScript/ESLint passes.

Per-second timelines are omitted from the committed summaries. The analyzer regenerates them from the fingerprinted local CSVs; frame distributions and slow-frame counts are retained. Source-repeat evidence is stored once here and referenced by the CPU evidence.
