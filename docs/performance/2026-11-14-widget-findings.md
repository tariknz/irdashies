# Reviewed replay benchmark findings

Reviewed 15 November 2026 against the retained raw logs, CSVs, traces and
source snapshots. Captures use development source 711552a1 and the old
a5200766 source where stated; these are not packaged-release acceptance tests.

**Current disposition:** an aggregate CPU/FPS regression is not reproduced
in the same-session source controls. Presentation cost, short-window private
growth and the rare long overlay stall remain open. Both canvas experiments
are reverted. The retained changes improve benchmark isolation and reporting.

iRacing was activated before capture and checked periodically through the UI. These point observations and the absence of other automated UI inputs support the intended foreground protocol; continuous OS foreground state was not recorded.

## F1 - Historical CPU/pacing drift, source regression not established

Initial current-profile CPU is 6.300 / 6.143% versus 4.483 / 4.604% in the
cross-date reference. GPU-process CPU explains 93.1% of that absolute change.
This locates the observed process cost; it does not identify a widget/driver
fault or prove a code regression. Later source controls do not reproduce
the aggregate increase (F8/F11). Overlay pacing remains poor in both sources.

The apparent historical Map rate doubling was a denominator artifact.
The rendering-window rates are 74.694 / 74.718 Hz old and 52.036 / 50.180 Hz
in the initial current captures. Rates across different zero-window
populations must not be compared. See F13 and the [initial audit](./2026-11-14-widget-regressions.md).

## F2 - Private growth exceeds target; no new persistent leak established

Initial current app-private growth is +18.398 / +32.936 MiB/min over the
six-minute window, above the unchanged <5 target. Pearson r is 0.820 / 0.730.
Peaks are lower than the old reference, while growth ranges overlap it.
These are qualified short-window trends, not proof of a new or persistent
leak. The memory gate is unmet; overall performance is not cleared.

## F3 - Class label unavailable in the replay's source data

Faster Cars From Behind displays a dash and an accessible class-unavailable
label. The saved SDK session has 60 empty CarClassShortName strings out of
60 drivers; createStandings copies that field and the widget has an explicit
fallback. A metadata fallback is a possible separate usability improvement.
Introduction by current main is unproven.

## F4 - Every ID is recorded, active functional coverage is incomplete

All 37 manifest IDs are accounted for, but enabled/inspected does not mean
all states were exercised. Lap Trace is hidden in the saved Race policy and
its isolate has no populated reference plot. Fuel/control values are mostly
zero or unavailable. Event warnings, named corners, finish cards, live
devices/chat and populated strategy progression remain limited or untested.
Channel traffic alone cannot establish visible or functional coverage.
Gantry CPU/private memory is measured, but its two saved-profile process rows
have no renderer timing samples; p99/slow-frame values are unavailable.
The [per-widget matrix](./2026-11-14-widget-regressions.md) remains authoritative.

## F5 - Flat Map and Broadcast Tower need repeated scoped memory tests

In coverage 1b, Flat Map has +5.740 MiB/min private growth (r = 0.892);
the whole six-widget group is +7.525. In coverage 2b, Broadcast Tower has
+6.527 MiB/min (r = 0.744), whole-group +12.526. Their observed pacing spikes
are overlay metrics, not game frames. Each is one scoped layout with no old
matching per-widget reference. Repeat the layout before diagnosing a leak
or attributing a code regression.

## F6 - Descriptive current-app game-frame cost

The four off/on/on/off PresentMon captures show 75.168 / 73.893 presented
FPS off/on (1.70% cost) and 13.543 / 19.971 displayed intervals >25 ms per
minute. There are 3 / 3 displayed intervals >50 ms across 700 analyzed seconds
per condition and none >100 ms. Two repeats are descriptive, not a statistical
equivalence or severe-stutter verdict. These are actual game-frame streams;
SDK FPS samples and overlay rAF p99 are separate measurements.
See the [game report](./2026-11-14-game-stutter.md); F11 adds short source controls.

## F7 - Lower CPU alone is insufficient for an optimization

Presentation/window/backend controls and both canvas options are complete.
None meets the CPU-and-pacing acceptance criteria. The final matched long
pair is summarized in F12. All temporary widget/window/flag changes are
restored; no application optimization is retained.

## F8 - Full-window source controls do not reproduce aggregate CPU increase

One full-window pair measures 5.471% app CPU old / 5.268% current. Both have
poor overlay pacing; current contains a 6088.5 ms renderer interval versus
633.8 ms old. These are overlay intervals, not six-second game frames.
Neither one pair nor the negative Input Trace SVG/runtime controls establish
statistical equivalence or exonerate every dependency/initialization change.
See the [code-directed report](./2026-11-14-cpu-sniff.md).

## F9 - Development-server benchmark interference is corrected

Earlier startup logs show generated HTML reloads and locked-profile watcher
errors under perf-results. Vite now ignores that tree; a watcher check keeps
source events while excluding benchmark output. No reload was logged at the
six-second stall, so this is measurement isolation, not a demonstrated stall fix.

## F10 - Presentation cost is supported; rare stall remains unresolved

One matched traced pair puts 94.5% of additional GPU-main task CPU inside
DXGI Present descendants. Strict complete-task/thread-time recalculation
reproduces this result. Native CPU samples independently show a prominent
Electron/DXGI/D3D11/NVIDIA/Windows scheduling path. Module categories overlap;
this does not identify a driver bug or hardware GPU bottleneck.

The bounded diagnostic records no JS long tasks and does not reproduce the
six-second renderer gap. That absence cannot explain or clear the earlier
event. PresentMon closed/reopened controls are limited, Radar-only windowing
is rejected, and OpenGL is excluded for invisible overlays. The native ETL
produces no usable PresentMon CSV and supplies no additional game-frame verdict.
See the [trace report](./2026-11-14-radar-gpu-trace.md).

## F11 - Short repeated game-frame source comparison

Old/current/current/old repeats measure 6.178 / 5.902% app CPU and 76.53 /
77.07 presented FPS. Each build has one present interval >50 ms over 180
measured seconds; only current has one displayed interval >50 ms. These
short, low-count observations do not reproduce an aggregate CPU/FPS loss,
prove equivalence or settle rare-stall attribution.

## F12 - Canvas candidates rejected after matched acceptance checks

The low-latency hint increases CPU in its short control. The readback/software
hint saves CPU in short repeats, but the long pair has 5.745 / 5.167% CPU,
27.89 / 25.07 Radar paints/s and 87.73 / 100.04 ms overlay p99 mean for
stock/variant. The observed cadence/pacing loss fails acceptance. One pair
does not prove a causal regression; it does not justify retaining the change.
Game presented FPS is 73.539 / 73.514. All canvas edits are reverted.

## F13 - Zero-only renderer counters diluted widget rates

The analyzer now excludes zero-only windows from each widget measure's rate
denominator while preserving idle intervals in observed painting windows.
Track Map, Input Trace, Radar and both Lap Trace measures share this rule.
CPU and PresentMon metrics are unaffected. Historical reported rates remain
recorded, with audited corrections beside affected values in JSON evidence.

## Final review validation

28 app-run summaries, six presentation controls, 26 scoped process rows and
14 distinct game-frame summaries are checked against raw data without numeric
mismatches. Referenced capture hashes and four trace hashes match; the 1592
archived src files match a5200766 after CRLF normalization, and Track 262's
geometry is identical. No widget runtime edit remains.

The full suite passes 6,950 tests with 5 skipped; 579 files pass and 5 are
skipped. TypeScript/ESLint passes with private capture artifacts excluded.
Private SDK/profile data, raw captures and large traces are not committed;
their local availability is required to independently repeat the numeric audit.
