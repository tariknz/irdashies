# Radar GPU-process CPU trace

**Reviewed 15 November 2026:** Same-session source controls did not reproduce an aggregate CPU/FPS regression. Historical cross-date drift, presentation cost, private growth, limited widget coverage and the rare overlay stall remain distinct findings. Neither canvas variant is retained.

iRacing was activated before capture and checked periodically through the UI. These point observations and the absence of other automated UI inputs support the intended foreground protocol; continuous OS foreground state was not recorded.

14 November 2026. **The dominant extra cost is localized to Windows DXGI
presentation.** In the matched central 13-second trace windows, Radar on adds
4.741 seconds of GPU-main-thread task CPU.
4.481 seconds, or **94.5%**,
falls inside DXGISwapChainImageBacking::Present scopes. This localizes the added
thread CPU in this one traced pair; it does not identify a driver fault,
prove a historical code regression or establish a hardware GPU bottleneck.

## Thread CPU and scope accounting

| CrGpuMain allocation in 13-second window | Radar on, CPU seconds | Radar off, CPU seconds |
| ---------------------------------------- | --------------------: | ---------------------: |
| Depth-0 task CPU                         |                 7.758 |                  3.017 |
| DXGI Present, within those tasks         |                 6.925 |                  2.444 |
| Remaining task CPU                       |                 0.833 |                  0.572 |

Task CPU is an enclosing total. Present and remaining task CPU partition it;
do not add the task total to its children. The values use Perfetto
slice.thread_dur, not wall-clock slice.dur. All selected task scopes are
depth 0, and each included Present scope descends from a selected task.

Present call counts are 893 on / 822 off.
Their mean thread CPU is 7.755 /
2.974 ms. Their medians are
0.061 / 0.059 ms,
with p95 46.493 / 24.434 ms.
Most calls are cheap; the costly tail dominates accumulated CPU. These are
application-window presentation calls, not individual iRacing game frames.

For comparison, RasterDecoder's raster scope uses
272.657 /
160.511 ms thread CPU; its
end-raster flush uses 345.248 /
213.783 ms. These scopes
are diagnostic, can nest with other rows, and are not additive totals.
The much larger Present difference argues against starting with Radar's
math or individual path drawing as the main CPU remedy.

Radar-on Present events include the dirty rectangle `1107,112 300x300`,
matching the saved Radar bounds. Its 135 calls account for 1.626 seconds of
thread CPU. Other events coalesce damage with neighboring widgets, so this
rectangle is corroborating evidence rather than the entire Radar cost.

## Captures and checks

Current source 711552a1, Electron 45.3.2. Two private profiles use the frozen
20-widget seed; only Radar's enabled flag changes. Three shared transparent
display overlays and Gantry are retained. Both use the same real 59-car,
two-class replay at frame 129269/session 2, focus 37/cockpit 9/1, at 1x.
Each plays for 90 seconds. A nominal 15-second trace begins after 40 seconds
of replay play; analysis selects complete slices in trace-start +1 to +14
seconds to omit trace edges. The actual bounds and acknowledgment times are
retained in the [evidence](./2026-11-14-radar-gpu-trace.json).

Tracing uses Electron's
[contentTracing API](https://www.electronjs.org/docs/latest/api/content-tracing),
controlled through the main process's loopback-only Node inspector. No app
source patch or renderer DevTools window is used. Analysis runs locally with
[Perfetto's Python TraceProcessor](https://perfetto.dev/docs/analysis/trace-processor-python),
package 0.59.1 and its pinned v59.1 Windows binary. Tracing changes overhead,
so these runs remain separate from the earlier untraced CPU baselines.

Radar-on drawing counters are active; Radar-off counters show no drawing.
All recorded iRacing foreground checks pass, and replay progression, session,
speed and camera checks pass. No other app UI work, builds or analysis run
during measured passes. Trace buffer use stays below its configured limit.
The category-enumeration API returns an empty list, but the recorded events
verify the requested GPU/Viz/Skia/task categories and native samples.

Native GPU-main samples have unresolved function names, mostly in ntdll with
some NVIDIA and Electron module frames. These are wall-time samples, can
include waits, and do not establish which driver function consumes the CPU.
The off trace has one empty-callstack/parser error; the CPU result above
uses independent slice thread timings rather than the sampled stacks.

Raw files remain in ignored perf-results/radar-trace-on-1.perfetto-trace
and perf-results/radar-trace-off-1.perfetto-trace; their hashes, sizes,
selected operation tables, dirty rectangles, native module counts, and
foreground/replay verification are in the sanitized evidence. Runtime source
is unchanged, user configuration and simulator graphics hashes are unchanged,
and the original replay frame/session/camera/playback are restored.

## Follow-up disposition

The presentation/window/backend controls, native CPU capture and matched
long canvas pair below have completed. None establishes a safe widget
optimization. Presentation cost and the unreproduced long renderer stall
remain separate open findings; see the [current queue](./2026-11-14-widget-findings.md).

## Presentation controls and canvas follow-up

After the user dismissed a Python firewall prompt, an unobstructed visual
preflight and foreground check preceded every measured control. The earlier
stock attempt timed out before its foreground gate and is excluded. No public
or private network permission was granted by the agent.

All short controls use playback seconds 30-90 with a 15-second diagnostic
trace. CPU percentages are whole-machine app/process CPU; frame p99 is an
overlay renderer metric, not an iRacing frame time.

| Control                   | App CPU | GPU-process CPU | Radar paints/s | Overlay p99 mean |
| ------------------------- | ------: | --------------: | -------------: | ---------------: |
| presentation-stock-2      |  6.762% |          4.013% |          28.92 |         69.79 ms |
| presentation-waitable-1   |  9.046% |          6.367% |          28.77 |         68.15 ms |
| presentation-interval0-1  |  6.884% |          4.142% |          29.90 |         69.92 ms |
| presentation-novsync-1    |  6.860% |          4.135% |          27.51 |         73.83 ms |
| presentation-cpu-canvas-1 |  5.492% |          2.519% |          28.30 |         72.34 ms |
| cpu-long-canvas-1         |  5.254% |          2.258% |          23.59 |        111.70 ms |

Disabling DirectComposition made overlay content invisible and was rejected
before replay measurement, despite active drawing counters. Enabling
`DXGIWaitableSwapChain` increased CPU; `DXGISwapChainPresentInterval0` and
`disable-gpu-vsync` did not improve it. All flags were private-profile changes.

Requesting a CPU-backed Radar canvas with `willReadFrequently: true` reduced
CPU in the short control. A separate untraced 422-second repeat analyzes
playback seconds 60-420: CPU remains lower, but Radar paints fall to 23.59/s
and overlay renderer p99 averages 111.70 ms. This longer test is not a matched
long stock comparison, so it does not establish a causal pacing regression.
The poor timing prevents accepting the CPU result as a production fix. It
also retains 20.80 MiB/min private growth. No new PresentMon capture validates
this candidate, and the historical CPU target is not yet met.

The temporary source edit was restored byte for byte. Regular user config
and simulator graphics hashes match their originals. The original replay
frame/session/camera was restored and its original 1x playback resumed. No
production flag or app-source change is retained. The later matched long stock/canvas pair with direct game-frame validation
is recorded below; that candidate also fails the cadence/pacing acceptance.

## Synchronized-stall follow-up

The stock full-window run has a roughly 6.09-second animation gap in all
three display renderers. Around that gap, telemetry polling and the main
event loop continue; recorded renderer channel callbacks and Radar drawing
callbacks stay below 1 ms. SDK FPS samples also fall in the same interval.
This is a shared graphics/host lead, not proof of a 6-second game frame or
identification of a driver fault. No reload is logged at the stall itself.

Vite does watch the benchmark output tree: earlier startup logs show full
page reloads for generated comparison HTML and locked-profile database watch
errors. The renderer development config now ignores perf-results/**. A
real watcher integration check verifies ignored output produces no event
while a source control file still does. Full TypeScript and ESLint pass.
This corrects test isolation; absence of a later stall does not establish
that file watching caused the original one.

A new roughly three-minute diagnostic injects bounded rAF, 100 ms timer and
Long Tasks probes into the three display windows and records a circular
GPU/V8/scheduler trace. Long Tasks reporting is supported and records zero
long tasks. Per-window maximum rAF gaps are 183.3, 150.2 and 216.8 ms; timer
maximums are 115.2, 114.6 and 278.3 ms. The large-stall trigger never fires.
No benchmark-triggered reload or locked-profile watcher error is logged.

The retained circular trace covers about 78 seconds of complete thread
events. Complete renderer main-thread RunTask roots stay below 12 ms; the
longest recorded MajorGC is 6.372 ms. Asynchronous GC envelopes are not
treated as blocking pauses. Complete GPU-main RunTask roots contain
50.452307 CPU seconds; their DXGI Present descendants contain 44.879533
CPU seconds (89.0%). This supports native presentation as the persistent-cost
lead in this diagnostic. It does not retrospectively prove the cause of the
unreproduced long stall. Trace processing uses the local CLI, with no RPC
listener or upload.

| Short control (playback 30-90 s)                    | App CPU | GPU-process CPU | Overlay p99 mean | Radar draws/s |
| --------------------------------------------------- | ------: | --------------: | ---------------: | ------------: |
| PresentMon app closed (service remains)             |  6.217% |          3.752% |         60.26 ms |         32.72 |
| PresentMon app reopened and iRacing target restored |  6.289% |          3.846% |         66.87 ms |         32.23 |
| Radar in its own window, others shared              |  6.803% |          4.090% |         81.86 ms |         26.45 |

The single PresentMon app closed/reopened pair leaves the background service
unchanged. It does not explain the large CPU difference or the long stall.
PresentMon is reopened through its installed launcher with iRacing selected,
auto-target off and the original 10-second duration value disabled. An
earlier setup attempt expired without a foreground gate and is excluded.
These are SDK/overlay controls, not new PresentMon game-frame captures.

The Radar-only window is visually verified and its draw counter occurs in
only its assigned renderer, but CPU and cadence worsen. The experiment is
rejected and both temporary source files are restored byte for byte. OpenGL
is also rejected before measurement: the backend applies, DirectComposition
is unavailable, and overlays are invisible despite enabled metadata. Its
flags were private-profile changes. No widget optimization is retained.

## Native Windows capture completed

The user starts the prepared CPU/GPU recorder as administrator after the
initial profiling-rights error. Capture `native-wpr-1` completes and the
helper exits successfully; no WPR process remains. The local ETL is
20734541824 bytes (SHA-256 `aac110b55147d3edbdacf730147dde67543bb111dbb054722a32f86b6c181517`)
and reports zero lost events. Trace times are 2026-11-14T09:56:25.0127Z to
2026-11-14T09:59:04.7077709Z. The replay plays for 92 seconds, with iRacing selected
at the start and all three later foreground checks. Subsequent SDK samples
verify 1x playback, session 2 and the same car/cockpit camera throughout.

Offline native analysis uses playback 30-90 seconds (2026-11-14T09:57:40.489Z
to 2026-11-14T09:58:40.489Z). It contains 292378 system CPU sample events
and 20114 non-DPC/ISR GPU-process CPU samples;
20112 of the latter have at least one matched stack part.
The hottest GPU-process thread has 13082 samples; 7207 contain
DXGI in the recovered stack and 7322 contain NVIDIA's user driver.
These categories overlap. Kernel/user stack parts match by thread ID and
sampled QPC, and are counted once per sample for module attribution.

A common recovered user stack runs from Electron through DXGI, D3D11 and
`nvwgf2umx.dll` into Windows sleep/timing entries. Local PE exports place
the relevant Windows addresses near `SleepEx`, `RtlDelayExecution`,
`NtDelayExecution` and `RtlQueryPerformanceCounter`. Function-level
PDB resolution is not performed, and incomplete user unwinds remain
unattributed. This independently supports native presentation/scheduling
as a persistent-cost lead; it does not identify a driver fault or explain
the earlier six-second stall.

The worst reported renderer interval across this playback is 100.2 ms;
the six-second event does not recur. Instrumented app CPU is
5.016%, with GPU-process CPU
2.100%, but long setup idle and recording overhead
make this a diagnostic, not an optimization comparison. Duration and widget
visibility gates remain inconclusive. Offline PresentMon exits successfully
but produces no game-frame CSV from this ETL, so this capture supplies no
new actual game-frame stutter or FPS result.

The original replay position, camera and playback speed are restored. User
configuration and simulator graphics hashes match the saved originals.
No widget source change is retained. The original aggregate CPU regression
remains unconfirmed; performance overall remains uncleared.

## Canvas-context controls with matched game frames

15 November local time (capture timestamps remain 14 November UTC). Six
foreground replay passes compare stock, a low-latency canvas hint and a
readback-optimized canvas hint commonly used to select software rendering.
Only Radar's getContext options change; drawing, alerts and the 60-paint
limit remain identical. Effective desynchronized / willReadFrequently flags
are verified at playback +15 seconds, and both variants remain visible.
The final stock/software passes play for 422 seconds, measuring 60-420.

| Run                  | Measured window | App CPU | GPU-process CPU | Radar paints/s, corrected | Overlay p99 mean | Game presented FPS |
| -------------------- | --------------- | ------: | --------------: | ------------------------: | ---------------: | -----------------: |
| canvas-path-stock-1  | 30-90 s         |  6.478% |          3.841% |                     26.71 |         70.44 ms |              75.56 |
| canvas-path-desync-1 | 30-90 s         |  8.360% |          5.947% |                     22.71 |         92.53 ms |              75.54 |
| canvas-path-cpu-1    | 30-90 s         |  5.023% |          2.228% |                     28.53 |         73.23 ms |              75.14 |
| canvas-path-cpu-2    | 30-90 s         |  4.854% |          2.242% |                     27.26 |         74.02 ms |              75.49 |
| canvas-path-stock-2  | 60-420 s        |  5.745% |          2.972% |                     27.89 |         87.73 ms |              73.54 |
| canvas-path-cpu-3    | 60-420 s        |  5.167% |          2.286% |                     25.07 |        100.04 ms |              73.51 |

The low-latency hint raises CPU and is rejected. The software-canvas option
saves CPU in two short runs, but the long pair has app CPU
5.745% stock / 5.167% variant
(-10.05%), Radar cadence
27.89 / 25.07 Hz
(-10.14%), and overlay p99 mean
87.73 / 100.04 ms.
The lower CPU comes with worse observed cadence/pacing, so it fails the
acceptance criteria and is reverted. A single long pair does not establish
a causal pacing regression; it does not justify retaining this optimization.

Actual game presented FPS in the long pair is
73.539 / 73.514. Both have zero
present intervals over 50 ms, one displayed interval over 50 ms, and no
displayed interval over 100 ms in their measured windows. These counts do
not demonstrate stutter equivalence. GPU utilization is near 99% and its
temperature near 83 C in both passes. The earlier six-second overlay gap
does not recur. Replay/hidden/event/device coverage limits remain.

A reporting bug is fixed separately: zero-only renderer counters diluted
widget frame rates. Radar's long stock rate originally reported
13.95 Hz; the painting renderer reports
27.89 Hz. Only renderers observed painting a
measure now enter its denominator; their genuinely idle intervals still
count. Track Map, Input Trace and Lap Trace use the same accounting.
Historical raw rates are preserved and should not be compared across
different zero-window denominators. CPU and game-frame metrics are unaffected.
Independent per-PID whole-interval audits corroborate the corrected cadence.

All variant source files are restored byte for byte. Original replay frame,
camera and 1x speed are restored before game handback; user config and
graphics hashes match, and PresentMon recording is stopped. Further work is
offline and the user can close iRacing. No widget optimization is retained.
The benchmark fix passes 73 tests across 10 files, full TypeScript/ESLint
with perf-results excluded, and Prettier checks. The JSON evidence retains
capture/source hashes, context flags, focus checks, limits and restoration.

## Offline review

The raw trace hashes, including the local ETL, are rechecked. Recalculation
requires complete depth-zero tasks and complete descendant Present scopes
with valid thread CPU timestamps; it reproduces the 94.5% allocation. The
known off-trace stack-parser issue affects sampled stacks, not this slice
CPU calculation. Native stack module categories overlap and are never added
as independent CPU shares. No full PDB function attribution is claimed.

The final suite passes 6,950 tests with 5 skipped. Capture-stage validation
counts above describe those stages, not the final PR validation.
