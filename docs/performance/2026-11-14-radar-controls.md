# Radar CPU follow-up controls

**Reviewed 15 November 2026:** Same-session source controls did not reproduce an aggregate CPU/FPS regression. Historical cross-date drift, presentation cost, private growth, limited widget coverage and the rare overlay stall remain distinct findings. Neither canvas variant is retained.

iRacing was activated before capture and checked periodically through the UI. These point observations and the absence of other automated UI inputs support the intended foreground protocol; continuous OS foreground state was not recorded.

14 November 2026. **Radar already had a measurable cost in the old source,
but these short controls show a larger effect in current main.** This does
not establish a newly introduced Radar bug or complete a source bisect.

The later [GPU-process trace](./2026-11-14-radar-gpu-trace.md) localizes most
of the extra CPU to DXGI presentation. It narrows the next experiment to
transparent-window/compositor behavior while leaving source attribution open.

## Radar on/off

| Source                     | App CPU with Radar, % | App CPU without Radar, % | Saving, percentage points | Saving, % |
| -------------------------- | --------------------: | -----------------------: | ------------------------: | --------: |
| a5200766 / Electron 45.2.0 |                 6.576 |                    5.752 |                     0.825 |      12.5 |
| 711552a1 / Electron 45.3.2 |                 6.528 |                    4.671 |                     1.857 |      28.4 |

Current Radar-on is the two-run mean; other cells are single accepted passes
from the same session. All play 90 seconds at 1x from frame 129269/session 2,
focus 37/cockpit 9/1. The existing analyzer selects five-second report buckets
overlapping replay-play seconds 30–90. Percentages are total machine CPU.
GPU-process CPU means CPU execution in Electron's GPU process, not GPU usage.

Old-source GPU-process CPU falls from 3.542% to
2.846% with Radar disabled. Current main's corresponding
values are 3.932% and 2.161%.
The same frozen seed is used, and both Radar-off seeds have the same hash;
only Radar's enabled flag is changed. Other active widget IDs match.

The result supports an existing cost, but does not support calling the entire
current effect unchanged. These are total-profile marginal costs, which can
include interactions with other widgets and the compositor. Current total
Radar-on CPU still resembles old-source total CPU, so savings elsewhere may
offset the larger observed Radar contribution. Repeated on/off pairs are
needed before treating the difference in contributions as stable.

## Paint-loop isolate

A temporary current-main experiment restores Radar painting on every rAF,
while retaining its timing counter. Everything else stays on current main,
including Input and track loading. The stock full-profile mean is
6.528% app CPU; the uncapped experiment uses
6.835%, with 4.177% in the GPU process.
Radar drawing is exercised at 33.108 draws/second
versus the stock repeats' 29.759 mean.
Removing the 60-paint cap therefore does not remove the measured cost. This
one-pass experiment gives no reason to revert that cap as a fix; it does
not prove the precise rendering/compositing cause.

Two archived-build attempts are excluded: the first records no Radar draws
in its analysis window; the second is aborted before measurement when the
preflight still fails that check. Their low or absent CPU results are not
used. The accepted experiment uses the established development build and
confirms Radar drawing before the foreground play gate.

## Evidence, restoration and next work

The [evidence](./2026-11-14-radar-controls.json) retains both additional runs,
source/runtime/seed/build fingerprints, interval CPU series, real replay
snapshots, focus checks, exclusions, and the exact temporary source change.
Earlier accepted controls remain in the
[CPU sniff report](./2026-11-14-cpu-sniff.md). iRacing focus checks pass in
both measured passes; no other app UI, builds or tests run during measurement.

The temporary tracked Radar file is restored to its exact original hash.
The regular user configuration is unchanged from the fresh backup, simulator
graphics are unchanged, and the replay's pre-follow-up frame/session/camera
and 1x playback are restored. No application change is retained.

The [later presentation and native-trace follow-ups](./2026-11-14-radar-gpu-trace.md)
and matched long canvas/PresentMon pair are complete. They support the
presentation path as an optimization lead but justify no retained widget
change. The source-level regression remains unproven; these single short
on/off marginal costs cannot establish a stable source attribution.
