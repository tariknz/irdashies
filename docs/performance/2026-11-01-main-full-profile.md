# Pinned local-main full saved-profile development baseline

Source is local `main` at `a5200766d2d47b5088e6c73436baa4e62cc79faf`.
During preparation, remote `main` advanced to `ddf3f69e`, including Input fix
#857. This capture series does not measure that newer source. No Input/GPU
investigation or performance fix belongs to this series.

Two completed 420-second development captures establish a descriptive baseline
for the **full saved Default profile**, with 60-second warmup excluded. Fuel
and Radar visibly render. CPU and simulator FPS are close across repeats;
private-memory slopes vary substantially and exceed the unchanged target in
both. Formal full-workload gates remain inconclusive because event-driven
inputs are missing. This is not a release acceptance result.

The [sanitized evidence](./2026-11-01-main-full-profile.json) includes per-run
build/native fingerprints, profile hashes, missing-input lists, replay checks
and all 72 private-memory observations per repeat. The [baseline
register](../PERFORMANCE_TEST_LOG.md#current-baseline-register) keeps this
separate from the six-instance experiment and archived packaged reference.

## Measured results

| Metric, analysis 60–420 seconds       |        Repeat 1 |        Repeat 2 |
| ------------------------------------- | --------------: | --------------: |
| App CPU                               |          4.483% |          4.604% |
| Actual simulator FPS, average         |          72.872 |          72.760 |
| Sampled FPS p1, mean                  |          70.271 |          70.097 |
| Peak app private memory               |     3974.08 MiB |     3594.32 MiB |
| App private-memory slope              | +43.683 MiB/min | +20.320 MiB/min |
| Telemetry-processing p99, mean        |        1.305 ms |        1.350 ms |
| Display-renderer frame-time p99, mean |       16.804 ms |       16.808 ms |
| Display-renderer frames over 50 ms    |              0% |              0% |
| App / private-memory samples          |              72 |              72 |
| Private-memory observation span       |       355.415 s |       355.388 s |

Mean app CPU is 4.544%, mean simulator FPS is 72.816, and the mean of the two
per-run private-memory peaks is 3784.20 MiB. The observed private-memory slope
range is **20.32–43.68 MiB/min** (arithmetic mean 32.00), above **<5 MiB/min**
in both repeats. The difference between slopes limits their precision as a
baseline; it is not evidence of a stable long-running leak rate. Preserve
both runs, including their peaks, rather than selecting the lighter result.
Two repeats are descriptive observations, not a statistical equivalence test.

The app has four renderer processes: three shared display overlays and the
existing Gantry window. Animation-frame summaries cover the three display
renderers (216 samples per run); they do not cover Gantry or the simulator's
present-to-present frame timing. Simulator FPS comes from current-host SDK
telemetry, not a historical tape or PresentMon.

Each run has 72 native replay observations in its analysis window, at no more
than approximately 5.02 seconds apart. Both verify 1x playback, session 2,
focus car 37, cockpit group 9/camera 1 and increasing replay frames. The
runtime/source manifest has 1,599 files and SHA-256
`25269fe90ed75692f2f5347dc1b98a62271375be0d94e6b1a74b8c1a03df4353`;
none changed during capture. At capture time, `src/` had no diff from
`a5200766`; only benchmark tools and report/evidence documents differed in
the worktree. The publication branch may be rebased without changing which
source these captures measured. Node is 24.16.0,
Electron 45.2.0 and React 19.3.1. Per-run native binaries differ after Forge
rebuilds and are individually fingerprinted; matching source is pinned.

Both repeats start from seed config SHA-256
`53cfe4ec5cf2f1160ed81cc2a83bfc4723c46abf4bfeb2f8c7cac27c6c382c8c`.
Their resulting profile configs have the same SHA-256
`3f8cfbc47daf7f92a14aee14e8f5238479858e9e467e71dd331be865865bf274`.

## Acceptance and drift limits

The analyzer's duration, private-byte sampling and metadata checks are
satisfied. Full declared-input coverage is not satisfied. The same seven
channels lack changes in both analysis windows: `blind-spot.snapshot`,
`lap-history.snapshot`, `lap-times.snapshot`, `radio.snapshot`,
`reference-laps.snapshot`, `sector-timing.snapshot` and `replay.context`.
The attached evidence maps these to Battle, Blind Spot Monitor, Gantry, Map,
Relative, Sector Delta and Standings. Some are event-driven states that were
seeded at startup but did not change after warmup; this is not proof that
rendered content was blank. Fuel and Radar were visually checked separately.
No missing input is waived or invented. `--allow-inconclusive` retains the
descriptive analyzer output and does not make a gate pass.

The measured source predates upstream Input optimization #857, remote `main`
`ddf3f69e`, and the separately published root feature `3172180e`. Neither
newer source was measured here. Historical release drift remains unmeasured:
no genuinely matched old/current-source A/B exists on the same target. Do
not calculate drift from this development profile versus the archived August
packaged/tape workload or versus the earlier six-instance window experiment.

## Workload and target

The target is the supported Electron/Vite development application. The known
Windows Application Control block on the packaged executable is not retried
or bypassed. Development evidence cannot establish a release gate pass.
Current remote-main performance and release drift since the archived August
reference remain unmeasured; there is no matched historical-source A/B here.

The saved Default dashboard has 20 enabled instances: Standings, Input,
Relative, Map, Weather, Faster Cars From Behind, Fuel, Blind Spot Monitor,
Rejoin, Pitlane Helper, Flags, Tachometer, Lap Time Log, Slow Car Ahead,
Sector Delta, Corner Name, Battle, Gantry, Lap Trace and Radar. The second
Fuel instance is saved disabled and remains disabled. Gantry has its existing
separate renderer in this source; the three display overlays use shared
windows. Lap Trace is saved disabled for Race sessions. Conditional warning
panels need an applicable event before they show content.

An isolated copy of the saved profile and JSON/history files supplies each
fresh app process. Each repeat starts from the same seed, rather than history
written by the preceding run. Only enabled widgets receive replay visibility
overrides: existing `showOnlyWhenOnTrack: true` values become false; Radar's
`autoHide`, `hideInPit` and `hideInPitBox` become false; Flags gets
`showNoFlagState: true`. Enabled states, layout, session visibility and visual
subsections remain as saved. No demo mode or fabricated telemetry is used.
Profile/configuration hashes and compact per-instance layout evidence are
recorded with the results. Private copies and raw logs stay in ignored
`perf-results/`.

The actual simulator replay uses the normal live SDK connection, not an
isolated `.irdt` publisher. The source scene is Gesamtstrecke VLN, 59 cars in
two classes. Each run seeks to frame 129269 in session 2, approximately
59.88 seconds, with focus car index 37, cockpit group 9/camera 1. Playback
starts at 1x when the harness records its capture origin. Native samples
verify playback speed, frame progression, session and camera every five
seconds. iRacing remains foreground after launch. Simulator telemetry FPS is
a current-host observation, not PresentMon frame timing.

The desktop has three 2560×1440 displays at x=-2560, 0 and 2560, all y=0.
iRacing is borderless windowed at 7680×1440. Its configuration enables the
84 FPS limit; the renderer configuration file is fingerprinted. Driver-level
sync behavior is not independently verified.

The capture protocol is 420 seconds per repeat, with the first 60 seconds
excluded and analysis restricted to 60–420 seconds from capture origin.
The unchanged app private-memory target is **<5 MiB/min**. Short-run slopes
describe this interval and do not establish a long-running leak.

## Excluded preparation captures

`main-full-preflight` stopped before app launch because the controller held
the native addon open while Forge tried to rebuild it. The controller now
uses a private addon copy, leaving the build output unlocked.

`main-full-preflight2` and `main-full-preflight3` are excluded: Windows npm
forwarding preserved quotes inside the Electron user-data argument, and the
app used the normal profile instead of the isolated visibility override.
Visual inspection exposed hidden Fuel/Radar. Temporary startup diagnostics
confirmed the incorrect data path. The saved configuration was restored from
the initial byte-for-byte snapshot, with matching SHA-256. These captures
must never be promoted to visible full-profile measurements.

The publication-check hold ended before the corrected preflight and repeats.
Those root checks are not validation of this worktree or part of these captures.

## Visible content and replay coverage

Corrected preflight `a520-full-preflight4` ran for 90 seconds and is retained
only as a visibility check. After startup settled, native window screenshots
and accessibility text confirmed the following without enabling edit/demo mode:

- Left display: Fuel, Standings and Weather. Fuel renders the header, tank
  gauge, consumption grid, pit window, fuel-at-finish and time-empty panels.
  Its replay fuel/consumption values are zero or unavailable. This does not
  exercise live fuel burn, an accumulated stint or a populated history graph.
- Primary display: Radar rings, player and nearby-car markers; Flags'
  no-flag lamp grid; Input; Relative; Battle; Lap Time Log; Sector Delta and
  Tachometer content. Warning panels remain governed by real replay events.
- Right display: the track map and car markers. A corner-name label requires
  a named corner; an enabled instance is not proof that a label is visible.
- Gantry: standings, controls and an explicit notice that irDashies was not
  recording when the session ran, so there is no event log for this replay.
  Its unpinned window remains behind foreground iRacing during measurement.
  Its existing always-fed telemetry behavior remains active.

Fuel and Radar were checked again during each measured repeat's warmup.
Lap Trace remains hidden by its saved Race-session policy. Blind-spot and
other conditional inputs must be reported as idle if no event occurs; window
or widget counts cannot establish full-workload coverage.

## Reproduction, validation and handback

The capture helper is `tools/perf/live-full-profile.cjs`; the existing runner
now accepts `--user-data-dir` and `--simulator-mode replay`. The former is
forwarded through Forge without embedded Windows quotes; the latter labels
actual replay metadata without starting an isolated publisher. The helper
seeks and validates the actual simulator before launching, starts playback
at capture origin, samples replay integrity and pauses at completion. Its
native controller uses a private addon copy so Forge can rebuild its own
output. No application runtime performance change was made.

The local ignored `perf-results/full-profile-seed/` contains the frozen copy
of the saved profile's JSON files plus `lap-history/` and `incidents/` where
present. `full-start.json` pins the benchmark replay frame/camera and
`full-original.json` preserves the handback scene. Create the seed from the
saved profile, apply only the listed overrides, and retain its hashes before
reproducing on another machine. Personal configuration/history and raw logs
are intentionally not shipped with the report. Reproducing these exact
measurements requires runtime source `a5200766`; a run on a newer source is
a separate measurement. The helper derives each new scenario label from the
actual checked-out revision rather than reusing this baseline's source label.

```powershell
node tools/perf/live-full-profile.cjs run a520-full-r1 420
node tools/perf/live-full-profile.cjs run a520-full-r2 420
npm run perf:analyze -- perf-results/a520-full-r1.log --warmup-seconds 60 --analysis-start-seconds 60 --analysis-end-seconds 420 --allow-inconclusive
npm run perf:analyze -- perf-results/a520-full-r2.log --warmup-seconds 60 --analysis-start-seconds 60 --analysis-end-seconds 420 --allow-inconclusive
node tools/perf/live-full-profile.cjs restore
```

Run IDs must be fresh because profile directories are not overwritten.
Keep the original graphics/camera settings and simulator foreground; avoid
concurrent builds, tests and other benchmark captures. The frozen profile
copies are located beneath ignored `perf-results/`, which is part of this
development-target setup. Capture origins were 09:24:22 and 09:32:12 NZDT;
heavy publication checks finished before either run.

Validation in this isolated worktree: TypeScript passes; all 23 targeted
tests in `perfRunConfig.spec.ts`, `analyze.spec.ts` and
`widgetInputMetadata.spec.ts` pass; ESLint passes for both benchmark tools;
the standalone controller passes Node's syntax check. The root feature's
separate test/build results are not claimed as this worktree's validation.

Publication checks after rebasing the report onto `ddf3f69e`: the full suite
passes with 5,557 tests passed and four skipped. `npm run lint` (TypeScript
and ESLint) passes with ignored private `perf-results/` capture artifacts
excluded from ESLint. These checks do not constitute a new performance
measurement on the publication source.

The benchmark application processes have exited. The saved user config hash
still matches its initial snapshot. iRacing was restored to frame **3331**,
session **0**, original cockpit camera and focus car, **paused**, and returned
to the foreground. The root checkout was not edited, reset, stashed or used
as the measured application source. Publishing this report does not add a
measurement of the publication branch or newer main.
