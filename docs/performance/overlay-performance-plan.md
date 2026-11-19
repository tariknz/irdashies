# Overlay Performance Improvement Plan

Date: 2026-11-12. Branch: `perf`.
Base: `tariknz/irdashies`, `main`,
`94f0264170c61b34bac61a57c296484e8f4d8c03`.

## Branch synchronization — 2026-11-15

Merged author main `9b9edbcce1918af94137068e2e24fcbf89fef735` into `perf`.
Retained native Radar visibility and rings caching, IBT Inspector exports,
and separate TrackMap commit/RAF metrics alongside the updated frame scheduler
and painter-aware rate calculation. Targeted merge checks passed (83 tests
across analyzer, TrackMap, Radar and IBT Inspector). TypeScript and repository-wide
ESLint checks passed.
At the user's request, this plan is the only file retained in this directory;
historical evidence links refer to files available in Git history.

## PR separation — 2026-11-15

Split the existing `perf` snapshot `a66f072b` against author main `9b9edbcc`
into independently buildable branches. The original campaign remains on `perf`;
these branches package completed work for review and are not new performance
campaigns or acceptance results.

- `feat/replay-cli`: isolated replay CLI, capture tools and runtime diagnostics.
- `feat/ibt-inspector`: interactive Inspector, replay controls and saved scenarios.
- `fix/overlay-widget-performance`: widget drawing, selectors and native visibility.
- `chore/performance-documentation`: workflow/architecture documentation and the
  previously requested removal of historical performance files.

CLI and Inspector share the same replay/metrics foundation commit so either PR
can merge first; neither requires the other's feature commit. The widget branch
starts directly at author main. Documentation is kept out of runtime PRs.

Verification on the separated branches: shared foundation 149 tests; CLI 126
Vitest tests and 49 Node capture tests; Inspector 46 tests; widgets 112 tests.
TypeScript and repository-wide ESLint passed on each code branch. These checks
validate separation only and do not replace the campaign's performance gates.
PR publication, screenshots and simulator testing remain separate work.

## DEV-1 review corrections — 2026-11-15

Fixed two review findings in `feat/replay-cli` and carried the fixes into `perf`:
recording field coverage now uses selected widget types while mount assertions
still check every instance ID, including duplicate widgets. Matrix preparation
uses the reachable full `94f02641` revision for all six baseline files; their
contents match the former snapshots, including the files previously read from
the local-only `02e8e07e` backup. An optional output directory allows isolated
preparation checks without overwriting a capture's source manifest.

Regression verification: 22 replay Vitest tests and 50 Node capture tests pass;
TypeScript, repository-wide ESLint, Prettier and diff whitespace checks pass.
Tests cover complete/missing fields for duplicate Input instances, independent
mount assertions, baseline ancestry, snapshot bytes and manifest hashes. These
are tooling correctness fixes, not new performance acceptance evidence. Windows
and simulator end-to-end checks remain outside this verification.

## Document ownership

This file is the sole active source for performance status, decisions,
acceptance gaps, and next priorities. Update it when evidence changes; link to
the detailed report instead of copying result tables or backlog items.

- [`../PERFORMANCE_BENCHMARKS.md`](../PERFORMANCE_BENCHMARKS.md): repeatable
  capture and analysis protocol only.
- Dated reports in this directory: experiment evidence; link them instead of
  copying their result tables or chronology into the plan.

The original saved user profile is unavailable; reconstructed workloads do not
represent it. See [`ARCHITECTURE_RULES.md`](../ARCHITECTURE_RULES.md) for
performance constraints.

## IRSDK cache and wait diagnostic — 2026-11-19

- [x] **IRSDK-CACHE-1 — fix cached telemetry array layout handling and measure
      synchronous polling.** Corrected count/type invalidation in the JS SDK
      wrapper, added opt-in `waitForData()` metrics, and ran a 2x2 ABBA replay
      comparison of `WAIT_TIMEOUT=16` against a temporary zero-timeout build.
      The diagnostic is complete; the broader Stage G acceptance remains open.
      Evidence: [`irsdk-cache-and-wait-validation.md`](./irsdk-cache-and-wait-validation.md).
      Result: cache correctness fixed with no reproducible unchanged-layout
      regression; zero timeout showed **NO REPRODUCIBLE EFFECT** on CPU, event
      loop or cadence in connected Linux replay. Paused/disconnected and Windows
      conditions remain unmeasured. Recommendation: keep synchronous polling;
      investigate native isolation only with Windows/iRacing evidence.

## Continuation protocol

1. Read this plan first, then only the linked evidence and benchmark procedure
   relevant to the selected task. Inspect `git status` and recent commits before
   editing; preserve unrelated user changes.
2. Continue on the existing `perf` branch. Do not create temporary branches,
   another plan, handoff or status log. Isolated capture worktrees are allowed
   only when required by the benchmark, without a new development branch.
3. Select one open task by ID from the execution queue below. Check its existing
   evidence first. Stages A–G describe scope and acceptance, not an instruction
   to restart at A. Completed experiments stay complete even when acceptance
   is inconclusive. Reopen work only for a documented regression, changed input
   or a specific missing measurement.
4. Before measuring, state the hypothesis, missing evidence and completion
   criterion. Reuse existing helpers. Prefer a short targeted diagnostic;
   reserve long A/B runs for a concrete candidate. Never rerun an unchanged
   experiment solely to obtain a passing verdict.
5. After each completed step, update that task in this file with its result,
   checks, evidence link or artifact location, remaining limitation and next
   action. Update affected stage checkboxes in the same change. Use `[x]` only
   when the stated criterion is met; partial or blocked work remains `[ ]`.
   A completed diagnostic may have an inconclusive outcome without closing
   the broader acceptance requirement.
6. Commit each completed step together with its plan update on `perf`, using an
   English conventional commit message. Run TypeScript/ESLint before committing
   and appropriate behavioral checks for code changes. For documentation-only
   steps, verify links, formatting and consistency. Stage explicit task files.
   The commit containing the note identifies its checkpoint; do not add a
   follow-up commit solely to insert its own hash.
7. Before ending a run, leave the selected task's next action or exact blocker
   here and report the commit hash. If blocked, select another actionable task;
   if none is actionable, report the blockers instead of repeating closed work.
   Do not commit incomplete code merely to satisfy the checkpoint rule.

## Execution queue

This queue owns task selection and progress; the stage checklists below retain
technical acceptance detail. Blocked items are not completed. Conditional Stage
G work and reusable delivery checks are not additional queue items.

- [x] **DEV-1 — make recorded replay practical for widget development.**
      User priority completed 2026-11-15. [Guide](../REPLAY_DEVELOPMENT.md)
      documents baseline field coverage for twelve widget types (unknown for
      unaudited types), Inspector seek/restart, native single-frame stepping,
      A–B loops and one explicitly saved scenario (file/profile/speed/position/
      range). Native loops expose the existing disconnect/reconnect reset;
      they do not reconstruct earlier history. Frame stepping stays paused.
      Mutating replay controls are blocked during a capture. Scenario storage
      is bounded, validated and atomic; restoration is explicit and rejects
      another dashboard profile. Capture JSON includes baseline coverage.
      CLI `--profile defaults` discovers current manifest files without the
      Vite-only registry. Opt-in `--check smoke|complete`, expected channel
      deliveries and baseline coverage checks persist assertions and return
      nonzero on failure after cleanup. These do not prove pixel correctness,
      changing values, listener leak absence or complete event coverage.

      Verification: fresh Linux native build, 320 tests in 24 files and full
      TypeScript/ESLint passed. Native tests cover one-frame delivery, reset
      before range repetition and looping when B equals the end marker.
      Positive real-IBT CLI smoke with manifest defaults returned 722 frames,
      zero supersession and positive Input deliveries; a limited complete-check
      run returned exit 1 solely for incomplete playback. Linux Electron
      Inspector exercised paused load, one 1/60-second step, seek, a 4.0–4.2 s
      loop, capture, source restoration and the visible Restore scenario action.
      Evidence and screenshots (untracked, outside the repository):
      `/tmp/irdashies-inspector-controls-check-20261115/verification.json`,
      `before.png` / `after.png` in that directory;
      `/tmp/irdashies-replay-defaults-smoke-20261115/` and
      `/tmp/irdashies-replay-negative-check-20261115/`.
      Logs: `/tmp/irdashies-replay-controls-native-build.log`,
      `/tmp/irdashies-replay-development-final-tests.log`,
      `/tmp/irdashies-replay-final-lint.log`.
      `perf-results` remains empty; the temporary Inspector recording and
      normalized CLI inputs were removed. These are functional developer
      checks, not a performance comparison. Native Windows execution remains
      unavailable and INSPECTOR-2 stays open. Next optimization task: F-8.

- [x] **DOC-2 — restore replay widget-development documentation.** Completed
      2026-11-15. [Developer guide](../REPLAY_DEVELOPMENT.md) covers Inspector,
      CLI profile/widget selection, looping native tapes, reports, Git LFS and
      recording coverage. README and tool usage links now point to this guide;
      historical experiment links remain historical. Cleared `perf-results` at
      the user's request; new smoke artifacts are outside the repository.
      Verification: CLI help, 49 CLI/Inspector tests and 163 native/SDK bridge
      tests passed; one Windows-only test skipped. A real Linux Electron run
      on the user's IBT with Input at 4x returned 735 SDK frames in a deliberately
      limited three-second run, zero source supersession, with report and owned
      process cleanup. Evidence: `/tmp/irdashies-replay-ibt-dev-check-20261115/`.
      Inspector service/UI checks are automated, not a new manual UI acceptance
      run. TypeScript/ESLint and documentation checks passed. No runtime code
      changed; Windows runtime acceptance remains INSPECTOR-2, and the next
      application optimization task remains F-8.
- [x] **DOC-1 — consolidate continuation instructions.** Result: one entry point,
      continuation/commit protocol, task IDs and separated historical observations.
      Existing log/handoff deletions and reference updates are included in this
      documentation checkpoint. Checks: local links, obsolete-name search,
      formatting and diff whitespace. No runtime behavior changed.
- [x] **F-1 — attribute remaining memory growth with collection disabled.**
      Bounded result: the [collection-off V8 ownership diagnostic](2026-11-12-memory-ownership.md)
      rules out net retained main V8 used-heap growth in its short measured window;
      sampled overlay private growth does not reproduce the control. Two 420-second
      phases completed with stable process lifetimes and source restoration.
      Allocation stacks are recorded, but no long-session/native retention owner
      is established. Follow-up 2026-11-15: the [repeat-replay memory diagnostics](replay-cli.md)
      completed ten max-throughput cycles and three Settings-preview cycles; main
      post-GC heap fell about 0.33 MiB in the ten-cycle stress run, while the
      shorter preview run had stable DOM/listener counts and sub-MiB heap changes.
      Private-memory deltas were mixed, so these runs establish no owner. The
      planned 20-minute 1× preview run was interrupted before a comparable
      endpoint; it is not evidence. The [Inspector telemetry follow-up](2026-11-15-memory-diagnostics.md)
      adds bounded process/private-memory and live main/renderer V8 charts,
      least-squares slopes, interval channel delivery rates, interactive
      tooltips/series toggles and a dashed previous-capture comparison (not a
      matched A/B). An explicit checkpoint forces GC in attached renderer
      windows and samples process-private/main heap live; the main process is
      not collected and no retaining paths are provided. Completed reports persist their chart data
      and restore the latest two valid runs. Checks: 30 focused tests,
      TypeScript/ESLint, Storybook build, formatting and diff whitespace.
      Broader Stage F ownership remains open.
      Next discriminating measurement: complete collection-off
      Settings-preview-active 20-minute heap/private checkpoints; if private
      growth reproduces with flat V8, verify native sampler availability and
      target that process with an unsampled control. Do not repeat completed
      unchanged stress runs.
- [x] **B-1 — identify and close metadata gaps.** The
      [field audit and runtime verification](2026-11-12-runtime-metadata.md)
      enumerate missing fields and unavailable attribution. New interval reports
      join BrowserWindow/WebContents/OS PID, configured instances, observed DOM
      wrappers, current subscriptions/effective rates and renderer/channel deltas.
      Runtime exposed namespace-local preload PID 1; the existing log IPC now adds
      sender-derived OS/window identity. A second 180-second capture verified
      joins and positive controls delivery in 22 steady intervals. Checks: 95
      targeted tests, TypeScript/ESLint, formatting and links. Per-widget ownership,
      closed-window partial intervals, GPU/private metrics and presentation remain
      unavailable; overhead is unquantified. R3 remains inconclusive. Next: F-2.
- [x] **F-4 — reduce a measured visible-renderer hot path.**
      [Radar rings evidence](2026-11-12-radar-rings.md): current 10-second V8
      sample identified static ring drawing as the largest named application
      leaf (173.8 ms). A bounded per-display canvas now caches rings/labels;
      dynamic drawing and telemetry cadence remain unchanged. One normal-workload
      pair observed mean Radar drawing 0.264 → 0.244 ms/frame (7.6% lower).
      This is a scoped observation, not a statistically established application
      CPU/FPS improvement. Cache invalidation/fallback/disposal tests and browser
      image comparisons cover the changed path; see report for checks and costs.
      Next optimization must target a remaining measured hot path; do not reopen
      window-cost matrices without a concrete application hypothesis.
- [x] **F-5 — review the complete pipeline for systemic bottlenecks.**
      [Source review and existing evidence](2026-11-12-pipeline-review.md)
      prioritize renderer update amplification: cloned-array identities, broad
      selections, repeated Relative/Standings derivation and commit/rAF paints.
      Independent channel deliveries may amplify commits; actual multiplicity
      needs measurement. Native materialization and synchronous wait remain
      secondary candidates, not ruled-out costs. No runtime experiment or
      application change in this review. Checks: source/evidence consistency,
      local links, formatting and whitespace.
- [x] **F-6 — preserve stable renderer identity work across dynamic updates.**
      [Relative roster diagnostic](2026-11-12-relative-identities.md) confirms
      the selected narrow hypothesis. Memoizing the unchanged participant
      projection preserves real roster edits and cuts full Relative row rebuilds
      from 333–335 to 132 per twenty seconds in both candidate phases; hook
      render counts stay comparable. Baseline projected 13,653–13,735 roster
      entries per phase versus zero after candidate warmup. The work is cheap;
      total CPU improvement is inconclusive because of short windows and
      source/delivery variation. No broad array normalization or batching claim.
      Checks: 61 targeted tests, TypeScript/ESLint, formatting and whitespace.
      Temporary runtime counters were removed. Next: F-7; do not rerun this
      unchanged experiment merely to force global CPU acceptance.
- [x] **F-7 — investigate downstream commit/paint amplification.**
      [Map same-frame diagnostic](2026-11-12-map-frame-deduplication.md)
      identifies a bounded repeated draw: a target commit has already painted
      after the upcoming rAF timestamp. The shared map hook now skips that
      callback's draw, retaining immediate commit paints and next/final animation
      frames. Candidate phases avoid 66/81 redundant draws per twenty seconds.
      Normal CPU and draw-time effects are inconclusive; Map is a small measured
      cost, and the main systemic bottleneck is not resolved. Checks: 35 targeted
      tests, TypeScript/ESLint, static pixel comparison, formatting/whitespace.
      Physical high-refresh/DPI and motion acceptance remain open. Next: F-8;
      do not repeat this unchanged small candidate for a global CPU verdict.
- [x] **REV-1 — resolve the two branch review findings.**
      Restored `perfUserData` as the first main-entry import, satisfying the
      startup isolation guard. Analyzer CPU aggregation now reuses only process
      lifetime groups observed in the selected window; warmup/cooldown-only
      processes no longer become fabricated zero-valued rows. A regression test
      covers both out-of-window processes and reused PID lifetimes; existing
      CPU interval/legacy-data checks remain intact. Checks: 36 focused tests,
      then all 292 tests in the review's 32-file set; TypeScript/ESLint, formatting
      and whitespace.
      No performance captures were repeated. Next campaign task remains F-8.
- [x] **CLI-1 — reusable IBT replay CLI and bounded reporting.** Completed
      2026-11-14. [Usage and helper entrypoints](../REPLAY_DEVELOPMENT.md#replay-cli).
      `npm run perf -- replay <file.ibt|file.irdt> --speed 1|4|max` launches
      isolated real overlays, preserves source frames at the SDK boundary and
      emits JSON/Markdown reports plus a readiness screenshot. Numeric speeds
      retain frames when behind schedule; maximum speed removes source pacing.
      Normal live playback is unchanged. Source counters, processing wall-time
      sections/execution counts, channel/draw observations and playback CPU
      endpoints have separate scopes. DOM presence does not prove activity.
      Streaming normalization bounds input memory; report parsing rejects logs
      above 64 MiB instead of allocating without a bound.

      Readiness requires the owned main debugger, paused native seed and a
      complete topology marker matching the run ID. Cleanup closes inspectors,
      terminates the owned process tree and removes normalized IBT input after
      success or failure, including profile-loading errors. Playback and cleanup
      errors are retained together. Windows fallback checks process exit after
      taskkill, but remains unvalidated on Windows.

      Verification: fresh native build passed; **82 tests across six files**
      passed (CLI/importer/report, native tape, both SDK bridge suites, replay
      validator); full TypeScript/ESLint and diff whitespace checks passed.
      Logs: `/tmp/cli-native-build.log`, `/tmp/cli-verified-tests.log`,
      `/tmp/cli-verified-lint.log`. An initial test invocation overlapped Forge's
      native rebuild and failed because the addon was temporarily absent; the
      final sequential test run passed after all Electron runs ended.

      Final Linux smoke evidence (ignored local artifacts):
      - `perf-results/cli-final-1x/`: saved ten-widget profile, 1x; completed,
        one seed + 239 SDK-returned frames, zero source supersession.
      - `perf-results/cli-final-4x/`: all 35 profile widget types, 4x; completed,
        one seed + 239 SDK-returned frames, zero source supersession.
      - `perf-results/cli-final-report-max/`: all 35 types, max; completed,
        one seed + 239 SDK-returned frames, zero supersession; 36 processing
        sections in the final report schema. Earlier max smoke also completed.
      - `perf-results/cli-final-tape-limit-verified/`: existing 36,000-frame
        `.irdt`, 4x, 0.5-second wall-time limit; incomplete report as requested,
        one seed + 129 SDK-returned frames, zero supersession. Counters are read
        after pausing so the limited report includes in-flight frames.
      - `perf-results/cli-final-cancel-verified/`: aborted during startup;
        cancellation cause retained and temporary tape removed. Missing-profile
        and five-second startup-timeout probes failed as intended and cleaned
        their normalized input. Importer tests cover pre-launch profile failure;
        CLI tests cover cancellation before preparation and topology readiness.
      - All successful IBT runs removed normalized input; report/log artifacts
        remain. Final `/proc` inspection found no process with these CLI profile
        environments. The normal `~/.config/irdashies/config.json` was absent
        before/after the final checks and was not created; all run configurations
        are under their output directories. Original tape remains intact.

      Limitations: IBT fixture `/tmp/perf-cli-smoke.ibt` contains 240 frames
      converted from the recorded race tape; no original user IBT was available
      during initial validation. The user-recorded follow-up below supersedes
      that input-availability limitation.
      These are developer Linux functional smokes, not matched optimization or
      packaged Windows/game-FPS evidence. IBT session/events and widget activity
      coverage remain input-dependent. Periodic metrics include paused startup
      and drain; accelerated playback and wrapper presence cannot establish
      per-frame drawing or complete widget behavior. Next campaign task: F-8;
      do not repeat these smokes without changed code or a specific missing check.

      User-recorded IBT follow-up, 2026-11-14: Ferrari 296 GT3 at Nordschleife,
      source file under `/mnt/host/Projects/`, 58,156 frames / 60 Hz / 969.25
      source seconds / 292 variables. The 30-second max-speed limit probe in
      `perf-results/cli-user-ibt-max/` returned 42,434 frames plus one initial
      seed, with zero supersession, and correctly marked the report incomplete.
      The full max-speed run in `perf-results/cli-user-ibt-full/` then completed
      all 58,156 frames (one seed + 58,155 SDK returns), zero supersession and
      no source failure, in 36.731 playback wall seconds. Temporary normalized
      input was removed and `/proc` inspection found no remaining CLI process.
      No TypeError/RangeError/unhandled/native playback failures appeared in the
      console log. No implementation change was needed. Report JSON/Markdown
      and raw logs remain local and ignored; source IBT remains untouched.
      All 35 widget wrappers were observed, as were Map/Input/Radar/Lap Trace
      draw counters. The original IBT lacks `CarIdxLapDistPct`, `CarIdxPosition`,
      `CarIdxOnPitRoad` and `RadioTransmitCarIdx`; those observations do not
      establish traffic or radio behavior. Player controls, fuel and SessionTime
      are present. This is functional source-compatibility evidence, not a
      performance comparison.

- [x] **INSPECTOR-1 — in-app IBT Inspector for the current overlays.** User
      priority completed 2026-11-14. [Usage](../REPLAY_DEVELOPMENT.md#ibt-inspector). App Settings →
      General → Dev Tool enables an independent inspector window. It lists
      `.ibt` files from Electron's Documents/iRacing/telemetry directory, loads
      a paused recording, controls playback and records existing main-process
      perf reports in the current profile. Stop/disable restore the previous
      source. No isolated overlay profile is launched. Default is off.

      Source switches share the SDK setup queue; native selection now resolves
      per instance instead of retaining the first imported source forever.
      IBT normalization moved into the app with the public CLI helper delegating
      to it. File names/speeds/commands and resolved directory boundaries are
      validated. Capture buffers are bounded, with ten retained runs, a 64 MiB
      sample budget, a one-hour limit and a bounded stream queue. Summary JSON
      and NDJSON samples retain unknown measurements as unavailable. Follow-up
      2026-11-15 adds charts for app/process CPU and memory, main/renderer live
      V8 heap, telemetry tick rate, event-loop delay and channel delivery rates;
      process slopes, interval counters, section tables, interactive legends and
      previous-capture overlays (descriptive, not automatically matched). Chart
      data is bounded at 240 points and persisted; the two latest valid reports
      are restored on reopen. Explicit
      checkpoints force GC in renderer windows only; main heap/private readings
      remain live and no retaining paths are collected. CDP sampling adds
      diagnostic overhead. See the [memory diagnostics report](2026-11-15-memory-diagnostics.md).

      Verification: 189 tests in 13 files passed; a separate native/defaults
      run passed 74 tests in three files (the native-copy test overlaps).
      Final service/UI rerun passed 16 tests in two files after error handling
      and stale-poll protection changes. Full TypeScript/ESLint, formatting and
      whitespace checks passed. Logs: `/tmp/ibt-inspector-last-tests.log`,
      `/tmp/ibt-inspector-verified-tests.log`,
      `/tmp/ibt-inspector-native-tests.log`, `/tmp/ibt-inspector-last-lint.log`.
      Linux Electron integration on the user's Ferrari/Nordschleife IBT passed
      4x playback, pause, four capture intervals, report creation, source restore
      and a second max replay through the cached module. A short compatible
      fixture then passed replay over Demo Mode, disabling Dev Tool during a
      capture, window close, source restoration and normal app shutdown.
      Evidence: `perf-results/ibt-inspector-e2e/`,
      `/tmp/ibt-inspector-e2e-result.log`,
      `/tmp/ibt-inspector-disable-verified.log`. Source recordings are unchanged;
      temporary Documents copies and the diagnostic crash's orphan input were
      removed. Storybook before/after General and new Inspector screenshots are
      outside the repo in `/tmp/ibt-inspector-review/`.

      During development, source hot rebuild overwrote a mapped native addon
      and the next constructor segfaulted. The core stack identified
      `Napi::ObjectWrap<iRacingSdkNode>::ConstructorCallbackWrapper`; jump target
      0x6306 matched the unrelocated napi_get_new_target PLT entry. The addon had
      been rewritten while loaded. Build-time native copy now skips identical
      bytes and atomically replaces changed files; its test preserves an open
      old file descriptor across replacement. Fresh-process lifecycle checks
      passed. Extracted core was deleted. This fixes dev-build copying, not
      telemetry frame processing.

      Widget-activity follow-up on the same user IBT: a bounded 4x run with all
      35 types returned 3,602 SDK frames plus the seed without supersession.
      Evidence: `perf-results/ibt-widget-activity-check/` and
      `/tmp/ibt-widget-dom.json`. DOM observations confirmed Wind/Weather speed
      text and arrow rotation changes; processor-only playback of the first
      3,600 source frames produced 301 weather snapshot changes. The user's
      reported stationary Wind was not reproduced in this Linux check.
      Source inspection confirms absent CarIdxLapDistPct/Position/EstTime/
      TrackSurface and CamCarIdx; traffic-dependent Radar/Standings/Relative
      behavior cannot be validated from this recording. WindDir/WindVel/YawNorth,
      FuelLevel and player lap fields are present and changing. Temperature and
      humidity can remain visibly constant after display rounding. Do not treat
      all-wrapper/all-draw observations as complete widget activity coverage.

      Limits: native Windows execution remains untested here. The UI was checked
      in Storybook and Linux Electron; the Windows Documents path is resolved
      through Electron rather than a hard-coded account name. The existing IBT
      traffic/event limitations still apply. This feature is a capture tool,
      not evidence of a performance improvement. Next campaign task: F-8.

- [ ] **INSPECTOR-2 — validate Windows IBT initialization after runtime source
      selection.** User reports Replay source failed immediately after Load,
      with ASCII-only paths. A concrete compatibility defect was found: tape
      startup used the addon CRT's getenv cache, whereas Inspector updates the
      running process environment. The Windows build now reads input/options
      from GetEnvironmentVariableW on every startup, preserving wide paths.
      Native status also carries the failure reason; Inspector rejects failed
      initialization, restores the old source and reports that reason instead
      of accepting a failed transport.

      Completed implementation step: Linux native rebuild, Windows x64 cross
      compilation and 72 tests across six files passed, including parameters
      changed after DLL load, Unicode input paths, native failure text and
      failed-load restoration/temporary cleanup. TypeScript/ESLint and whitespace
      passed. Logs: `/tmp/ibt-windows-fix-native.log`,
      `/tmp/ibt-windows-fix-cross.log`, `/tmp/ibt-windows-fix-final-tests.log`,
      `/tmp/ibt-windows-fix-final-lint.log`. The Windows OS branch compiled but
      has not executed here. Next: user checks the rebuilt Windows folder on
      the same IBT. Do not mark the reported Windows failure resolved until
      that check succeeds; any remaining failure should now show its cause.

## Short IBT A/B diagnostic — 2026-11-15

At the user's request, compared `author/main` (`9b9edbcc`) with `perf`
(`2b6367c6`) using the supplied 58,156-frame IBT, reconstructed ten-widget
profile, Linux Electron, and a replay speed capped at 2x. One sequential A-then-B
pair: total process CPU was 917.05 vs 792.18 ms/s (-13.6%); average private
memory was 364.18 vs 305.35 MiB (-58.83 MiB). Overlay rAF p99 was 40.7 vs
40.3 ms; intervals over 50 ms were 16 vs 19. Replay ticks differed by about
5%, and native overlay bounds differed by one pixel. The source lacks the
CarIdx arrays needed to exercise traffic-dependent widgets. This is directional
Linux diagnostic evidence only; it does not establish smoother pacing, Windows
performance, or an acceptance gate, and does not close F-8. Detailed report:
`/home/omarchy/OmarchyShared/Projects/irdashies-ibt-ab-20261115.md`.

- [ ] **F-8 — identify current DOM/compositor invalidation ownership.**
      The last two scoped fixes remove inexpensive work. Existing attribution
      points to larger downstream DOM/compositor costs, but predates these
      changes and cannot identify their current owner. Use one short current
      trace/commit diagnostic to find the responsible nodes/update source and
      choose a concrete behavior-preserving change. Do not repeat rejected
      wind-wrapper, masks or Input-promotion probes without new evidence, and
      do not infer packaged React cost directly from development JSX timings.
      Completion: current causal attribution plus a candidate with reproducible
      normal-function scoped gain; overall CPU requires matched cadence.
- [ ] **F-2 — verify reconnect/session and event delivery.** New
      [positive radio/lifecycle composition evidence](2026-11-12-radio-lifecycle.md)
      uses the recorded carIdx 2 snapshot through production lifecycle/host/bus;
      reset/resume, hidden lifecycle events, replay suppression and live return
      pass. Checks: 50 tests, TypeScript/ESLint and formatting. Transition order is
      synthetic; this is not native runtime acceptance. The existing tape has no
      active radio and replay enter intentionally disables radio processing.
      Positive one-frame JSON inputs exist, but there is no temporal native
      reconnect/session/radio recording or live iRacing source on this host.
      Blocker: actual source/temporal fixture unavailable. Next: run a native
      reconnect/session sequence with positive live input when available; do not
      repeat the completed seek/pause test or relabel tape as live. Proceed to E-1.
- [ ] **E-1 — close remaining drawing/visibility checks.** The
      [native Radar and static-transition diagnostic](2026-11-12-radar-native-visibility.md)
      found Radar drawing while minimized; a typed native-visibility bridge now
      cancels its rAF and restores the latest frame. Two baseline intervals have
      898/899 draws versus 0/0 candidate in matched 15-second native-minimized
      intervals. The final baseline was recovered after a preflight cancellation;
      the 296.684-second minimize-event gap is disclosed, not a normal CPU pass.
      Resize/125% scale/colors/labels/player icon/emulated DPR 2 have bounded
      nonempty-canvas evidence; this is not every compositor-presented frame.
      Checks: 93 targeted tests, ten capture test files, TypeScript/ESLint,
      formatting, artifact hashes and candidate restoration. Next/limitations:
      actual 144/240 Hz, physical high-DPI quality and additional occlusion/hotkey
      modes remain unavailable/unverified; no new Map scheduler or app CPU/FPS
      gain is claimed. Continue with F-3 rather than repeating these checks.
- [ ] **F-3 — compare window-mode cost with matched input cadence.**
      The [timer readiness diagnostic](2026-11-12-poll-delay.md) was followed by
      a [normal 420-second display/widget pair](2026-11-12-window-cost.md).
      Both captures exit 0; source/seed/tape/environment and initial screen
      geometry match. Cadence 59.508/59.727 Hz differs by 0.369%, within the
      predeclared 0.5% gate. Comparison is rejected: native move notifications
      occur for Lap Trace at 182.371 s and Blind Spot at 187.889 s; actual bounds
      at those moments are missing, so continuous geometry equality is unproven.
      The reverse pair was not launched and no CPU/memory mode gain is claimed.
      Checks: 11 capture test files, TypeScript/ESLint, formatting, component
      coverage and artifact hashes. Blocker: stable placement evidence missing.
      Deferred by the user in favor of application bottleneck fixes (F-4). The
      geometry probe `native-geometry-r1` was cancelled before its observation
      endpoint; its uncompleted instrumentation was discarded. No new geometry
      conclusion follows. Resume bounds/setter-origin work only when needed for
      a concrete implementation comparison, not as a standalone capture project.
      Do not repeat the completed capture merely to obtain a favorable verdict.
- [ ] **A-1 — packaged Windows and simulator presentation acceptance.**
      Blocked: Windows/iRacing access is unavailable. Completion: same-target
      packaged A/B and actual simulator presentation evidence under the declared
      workload. Remote CI is also blocked by HTTP 422 (Actions disabled); dispatch
      only after that external condition changes. Linux CI and historical Windows
      checks do not close this item.

## Current completion and next priorities

Checked items below mean the stated work is complete; they do not imply that
the whole stage passed its exit criterion or that game FPS improved.

| Stage                             | Verified evidence                                                                                                              | Open requirement                                                                                                                             |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------- |
| A — reproducible baseline         | Isolated source/seed/environment/topology; completed Linux R3 A–B–B–A                                                          | Full analyzer acceptance remains inconclusive; packaged Windows and real simulator presentation absent                                       |
| B — instrumentation               | SDK/process/React/draw boundaries; bounded diagnostics and clock guards; completed collection on/off experiment                | Quantitative overhead is inconclusive, not zero; activity coverage remains incomplete; new metadata is scoped to the verified Linux capture  |
| C — Relative / TitleBar           | Implementation and behavioral checks; combined normal-operation matrix                                                         | Combined six-file gain does not isolate this change's CPU contribution                                                                       |
| D — stable Map data               | Behavioral tests, render-phase result and repeated direct identity construction measurement                                    | App-wide allocation bytes and isolated CPU contribution are not established                                                                  |
| E — canvas / hidden windows       | Map/Input/Radar hide and Radar minimize draw checks; bounded static transitions; exercised Lap Trace stop/resume               | Actual high-refresh/physical DPI and additional native modes remain open; static-case evidence is bounded; no Map scheduler change justified |
| F — windows / compositor / memory | Compositor/visual diagnostics; repeated 20-minute memory checks; Gantry hidden history; window-mode geometry; Settings cleanup | Memory allocation ownership unresolved; repeated cost comparison and broader lifecycle coverage remain open                                  |
| G — native / IPC                  | Deferred conditional work                                                                                                      | Reopen only with measured native/transport bottleneck; no redesign justified by current evidence                                             |

Evidence and constraints for the execution queue (not additional tasks):

1. Preserve the unresolved memory distinction. The
   [repeated long-session check](2026-11-12-settings-memory.md),
   [MemoryInfra diagnostic](2026-11-12-native-memory.md) and
   [clean/dirty/anonymous controls](2026-11-12-memory-composition.md) are complete
   in their stated scopes. Linux private growth exceeds the smaller reported
   live allocation changes; a retained native leak and allocation owner remain
   unproven. The short natural-GC composition controls cannot retroactively
   explain every byte of the long forced-GC run. The new
   [collection-off allocation diagnostic](2026-11-12-memory-ownership.md) bounds
   main V8 retention in a short Settings-closed window only; it does not close
   long-session/native ownership.
2. Cover actual reconnect/session transitions and active radio input where
   available. [Conditional demand](2026-11-12-input-demand.md) explains absent
   lap-time publication in the ordinary seed; the separate
   [feature-enabled runtime](2026-11-12-lap-times-features.md) verifies positive
   history delivery. The tape contains no radio transmission. Keep R3's original
   inconclusive verdict; these later diagnostics do not turn it into a full pass.
3. Continue only unresolved drawing/window work. Native hide/show is verified
   for [Map/Input/Radar](2026-11-12-hidden-draw-audit.md),
   [exercised Lap Trace](2026-11-12-laptrace-hidden.md), and
   [Gantry hidden history](2026-11-12-gantry-hidden.md).
   [Window topology](2026-11-12-window-topology.md) has matching initial instance
   geometry. The new [normal cost pair](2026-11-12-window-cost.md) matches
   incoming cadence but is rejected for unproven steady geometry; it does not
   establish a repeated CPU comparison. High-refresh hardware remains absent.
   Do not introduce scheduling changes without a measured need.
4. Keep instrumentation qualification explicit. The
   [collection on/off experiment](2026-11-12-collection-overhead.md) has mixed-sign
   deltas and a disclosed recovery gap. Do not repeat the full normal matrix
   merely to obtain a favorable result or subtract an assumed zero overhead.
   [Map identities](2026-11-12-map-identities.md) now have a completed direct
   four-run diagnostic; total allocation bytes remain a different claim.
5. Verify packaged Windows/iRacing presentation before game FPS/frame-time
   claims. Windows access is unavailable. The user's later explicit CI request
   authorized dispatch, but GitHub rejected it with HTTP 422 (Actions disabled),
   despite the permissions API reporting enabled. No current-head remote run
   exists. [Full local CI](2026-11-12-local-ci.md) passed on Linux; the earlier
   Windows run covers its historical checkpoint only.

Settings/memory investigations remain open and should move forward when the
reported trigger or a capture implicates them. A renderer rewrite or native/IPC
redesign is not the next implementation step on the current evidence.

## Earlier findings and closed decisions

These summarize the lasting outcomes from the older Phase 0.5–2a records. Their
measurements are historical, not current baselines; current acceptance is
defined by the stages and reference workloads below.

| Finding                                                                                      | Disposition                                                                                                                                                                            | Current interpretation                                                                                                         |
| -------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| Early steady-state and driver-join memory growth                                             | Legacy tests observed roughly 13–20 MB/min steady growth and 5–6 MB per joining driver. Phase 2a fixes reduced growth in specific workloads.                                           | Not globally resolved: newer development runs still show private-memory growth with an unresolved owner. Stage F remains open. |
| `L1`/`L2`/`S5`: synchronous storage writes, repeated session parsing, analytics-log pressure | The identified hot-path write, YAML parse, and warning-forwarding issues were addressed in earlier remediation runs.                                                                   | Closed for that remediation; no current regression is established here.                                                        |
| `P1`/`P2`/`P4`: telemetry fanout and raw high-frequency subscriptions                        | Payload projection, typed-channel delivery, and targeted selector changes landed in earlier phases.                                                                                    | Implementation work is complete; the combined R3 result remains inconclusive and does not isolate every change's cost.         |
| `H3`/`H4` and Standings allocation churn                                                     | Boot-reset and uneventful PitLap clone issues were fixed and validated in Phase 2a workloads.                                                                                          | Closed for the measured cases; retain the current acceptance limits above.                                                     |
| `A2`/`A3`/`L5`/`A7`: disconnect cleanup and per-driver state                                 | Disconnect cleanup and leave emission were implemented and tested. Mid-session absence detection was declined because transient `SessionInfo` omissions can create false leave events. | Disconnect path closed; mid-session leave detection is an explicit design decision, not an open fix.                           |
| Per-renderer reference-lap fetches                                                           | Reference-lap work moved to the main-process `ReferenceLapProcessor` and `reference-laps.snapshot` channel (`bf119e05`).                                                               | Closed; no per-renderer fetch-dedup task remains.                                                                              |
| Tier 2b filesystem-level write-count proof                                                   | The old run log did not establish whether debounce behavior reduced actual disk writes.                                                                                                | Not an active performance gate; revisit only for a concrete storage regression or new evidence.                                |

## Reference workloads

Use references only for the same build target and workload. The latest located
packaged result is not a measurement of current `main`; packaged current-main
drift remains unmeasured.

| Reference                                     | Scope and result                                                                                                                                                                                  | Qualification                                                                                                                             |
| --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| August packaged pair, `28cbf61e` → `f189c2ee` | Full 40-car tape, 17 widget types; app CPU 3.709% → 3.679%, private-memory slope 16.574 → 9.273 MiB/min. [Evidence](2026-08-09-packaged-reference.json).                                          | Latest located packaged reference; memory target still missed and event-driven input coverage incomplete.                                 |
| 1 November `a5200766` saved-profile replay    | Two 420-second development runs, 59-car actual replay and 20 saved widget instances; app CPU 4.483–4.604%, private-memory slope 20.320–43.683 MiB/min. [Report](2026-11-01-main-full-profile.md). | Descriptive, incomplete input coverage; not a packaged release baseline.                                                                  |
| 1 November shared/widget window comparison    | Six-instance development replay; app CPU 2.010% shared vs 4.699% individual, private-memory slopes 9.853 vs 20.221 MiB/min. [Report](2026-11-01-window-mode.md).                                  | Scoped comparison with missing input coverage; not a full-workload or release result.                                                     |
| 12 November R3 normal matrix                  | Four 420-second Linux tape runs; CPU was lower in both pairs (18.02% and 7.61%). [Report](2026-11-12-normal-matrix.md).                                                                           | Current campaign comparison; formal acceptance remains inconclusive because input coverage and private-memory integration are incomplete. |

## 1. Goal and scope

Reduce CPU time, unnecessary React updates, canvas/compositor work, and memory
pressure while preserving Input smoothness, calculation accuracy, and replay
behavior. Check whether reduced load is accompanied by improved game frame time.

Data path: SDK → native/JS → processors → ChannelBus/IPC → renderer
selectors/stores → React → canvas/DOM → Chromium compositor → screen.

Make changes in small, independent steps. For each step, keep the original and
modified build, profile, input data, and A/B results. Changes to the native API,
threads, and IPC format require separate justification after measurement; they
are not part of the initial React optimization.

## 2. Initial observations and limitations

Previous demo captures were taken on branch `fix/input-trace-canvas`, revision
`20ef8608`, and are not a baseline for this branch. Raw local artifacts are in
the ignored `perf-results/` directory:

- `demo-full-20261111.log`, `demo-empty-20261111.log`, and their summaries;
- `react-profiler-demo-20261111.console.log`.

Observations to recheck:

| Observation                                         | Limitation on the conclusion                                                                                          |
| --------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| Full/empty: average App CPU 5.37% / 0.21%           | Full included Settings and two renderer processes; empty had one. This is not the isolated cost of widgets            |
| Full: working-set slope about 19 MB/min             | Of that, Settings: 14.76; overlay renderer: 0.76 MB/min. Private memory was unavailable; no leak has been established |
| Renderer p99 about 5.7 ms                           | This is an rAF interval, not CPU render time or actual present time                                                   |
| React actualDuration usually below 1 ms             | The render phase of five widget subtrees was measured; layout/effects/paint/compositor were not covered               |
| One actualDuration of 22.6 ms in the first interval | The aggregate does not link the maximum to mount/update; a recurring hitch has not been established                   |
| `processTelemetry` p99 about 0.16 ms in demo        | The mock mode does not measure the native SDK or its synchronous wait                                                 |

Historical observations at the starting base, before the changes below.
Relative/TitleBar and Map identity findings were addressed in C/D; SDK wait
instrumentation was addressed in B. This list is not a current backlog:

- Relative subscribes to the full track state for `sessionFlags`.
- TitleBar subscribes to the full track state for `lapDistPct`, including
  before returning `null` when the title is disabled.
- Map calculates identities in `useMemo` with a dependency on the
  `carIdxClassPosition` array reference, which may change after every IPC
  delivery.
- The regular Track Map does not set `maxFps`; the embedded variant is limited
  to 30 FPS.
- Live `waitForData(16)` runs before the existing `processTelemetry` span.
- Native reads materialize metadata and buffers for all variables on every
  call; JS already partially reuses value arrays.

## 3. Stage A — reproducible baseline and metric definitions

Dependencies: none. Priority: P0.

- [x] Record source/build state and matched Linux environment inventories for
      R3; see the [normal matrix](2026-11-12-normal-matrix.md). This closes
      campaign capture bookkeeping, not packaged Windows acceptance. Record
      fresh source/environment metadata for each future comparison.
- [x] Keep one declared seed within each comparison: widget instances, config,
      layout, window mode, Gantry, Settings, windows, channels and visibility.
      Reconstructed and diagnostic seeds are recorded separately; the original
      user seed remains unavailable.
- [x] Create identical isolated copies of the seed for each run. Verify the
      actual storage path: the previous `--user-data-dir` did not provide the
      expected startup-storage isolation. Do not change user settings.
- [x] Separate workloads: Linux mock, deterministic SDK tape, and actual
      replay/game session. Record the actual source in metadata; do not leave
      `simulatorMode: live` on a mock capture or assess FPS using fixture fields.
- [x] Capture baseline and candidate on the same Linux development target;
      R3 and the render-phase diagnostic are complete in their stated scopes.
- [ ] Verify final cost with a packaged build on Windows (A-1; blocked).
- [x] For steady state, capture 420 seconds: exclude 60 seconds of warmup and
      analyze the following 360 seconds. This leaves more than the 300 seconds
      required by the analyzer. Capture startup as a separate scenario.
- [x] Complete two matched repetitions in A–B / B–A order: R3 completed a
      matched A–B–B–A capture. The capture requirement is complete, but the full
      analyzer gate remains inconclusive because of input-coverage and
      private-memory gaps. See its report; do not restart capture merely because
      acceptance remains open.

Workload matrix:

| Scenario                                                       | What to hold constant/check                                              |
| -------------------------------------------------------------- | ------------------------------------------------------------------------ |
| Full and empty                                                 | Same overlay geometry and process topology; Settings closed in both      |
| Settings alone                                                 | Same open page and preview; memory and CPU separate from overlay         |
| Relative, Standings, Map, Input, Radar, Lap Trace individually | Same seed and input data; change one factor at a time                    |
| Full grid                                                      | Number of cars/classes, changing channel inputs, visible rows            |
| Visibility                                                     | visible → hidden → visible, hotkey hide, Gantry separately               |
| Lifecycle                                                      | join/leave burst, disconnect/reconnect, camera change, replay pause/seek |

Metrics and units:

- App/process CPU% and CPU time: obtain CPU time from the delta of accumulated
  user+system time for each PID, in ms and ms/s. State how percentages are
  normalized and account for new/closed PIDs. Do not double-count Node main CPU
  and Electron Browser CPU.
- rAF interval: p50/p95/p99/max, number of intervals >25/>50 ms. This is the
  renderer scheduler cadence, separate from render duration and present.
- React: render-phase actualDuration, baseDuration, phase, commits/s, total
  render ms/s. A callback for a subtree does not prove that its root rerendered.
- Chromium trace: scripting, effects/commit work, layout, paint, raster,
  compositor, and GC; separate GPU process CPU from GPU engine utilization.
- Game: PresentMon/ETW present intervals, p95/p99/max, and hitch count using a
  threshold selected in advance. Record camera, FPS cap, sync, and the same replay.
- Memory: renderer JS heap, process working set, private memory when available,
  and GPU memory when available. The sum of working sets may include shared
  pages; growth alone does not prove a leak.

Stage A exit criterion: the baseline is reproducible, profile and topology
match, the data source is correctly identified, and coverage/duration/missing
metrics are stated explicitly. `--allow-inconclusive` does not turn a result
into a passed gate.

## 4. Stage B — correct instrumentation

Dependencies: A. Priority: P0.

- [x] Add opt-in spans for SDK wait, telemetry/session reads, full synchronous
      processing, and the entire poll-loop iteration. Clearly distinguish
      wall-clock wait, CPU time, and the planned delay until the next poll.
- [x] Preserve the previous spans for comparison. Correctly finish new spans
      on timeout, exception, disconnect, and stop.
- [x] Extend existing metric types/allowlists and the analyzer consistently;
      do not add a standalone IPC firehose.
- [x] Record source kind, startup topology, runtime process roles and channel
      rates in existing captures; see the
      [instrumentation report](2026-11-11-perf-instrumentation.md) and R3 report.
- [x] Audit runtime window IDs, configured/observed instances and per-window
      subscriptions/rate attribution under B-1; see the
      [field audit](2026-11-12-runtime-metadata.md). Unavailable metrics and scope
      limits are explicit; this does not retroactively pass the normal matrix.
- [x] For React, capture interval aggregates and a bounded list of slow render
      events: widget instance ID/type, phase, actualDuration, startTime, and
      commitTime. Align timelines with the capture origin.
- [x] Keep diagnostic buffers bounded and emit aggregates infrequently; run the
      collection on/off comparison. Its recovered result is inconclusive due to
      mixed-sign deltas and an 8,388-second recovery gap; it establishes no
      overhead bound. Do not call the overhead zero or subtract an assumed cost.
- [x] Store traces separately from lightweight perf captures: sampling/profiling
      adds load and is not a direct estimate of a normal packaged run.

Stage B exit criterion: the report shows complete work boundaries, timestamps
are comparable, slow events include phase/instance, and memory use is bounded.

## 5. Stage C — narrow Relative and TitleBar subscriptions

Dependencies: A/B. Priority: P1. Potential files:
`Standings/Relative.tsx`, `Standings/components/TitleBar/TitleBar.tsx`,
`context/ChannelStore/useTrackStateSnapshot.ts`, and existing specs.

- [x] Relative: replace the full snapshot with the existing `sessionFlags`
      selector; preserve flag contour and color behavior.
- [x] TitleBar: enable the progress subscription only when the title,
      progress bar, and applicable session mode actually need that value. Keep
      hook order stable; use `enabled` or split progress into a child component.
- [x] Choose frequency/precision based on visible progress: first remove
      irrelevant notifications, then evaluate frequency reduction separately.
- [x] Check session/lap-count hook dependencies: a disabled title must not
      retain unnecessary high-frequency work in its subtree.
- [x] Check position changes with constant flags, flag changes, Practice/Race
      modes, disabled title and progress, finish, and replay seek.

Stage C exit criterion: changes to unrelated track-state fields do not notify
the flag selector; disabled progress does not keep its own movement subscription.
Other consumers may retain the shared renderer subscription. UI updates for
other reasons are acceptable. Record before/after commits and render ms/s.

## 6. Stage D — stable Map data

Dependencies: C or an independent A/B from baseline. Priority: P1.
Main file: `TrackMap/hooks/useDriverProgress.tsx`.

- [x] Select class positions using a selector with semantic array equality, so
      equal values after IPC preserve the selected reference.
- [x] Use suitable existing equality or a local pure comparator; account for
      undefined, length, and actual changes to individual positions.
- [x] Separate infrequent changes to identities/classes/qualifying/roster/focus
      from position progress, which continues updating at its own frequency.
- [x] Stabilize fallback qualifying data if the conversion creates a new array
      on every render. Preserve reset/disconnect semantics.
- [x] Count identity recomputations and specific identity-object construction
      rate without mutating snapshots or selected arrays. The
      [direct four-run diagnostic](2026-11-12-map-identities.md) observes about
      879–888 identity objects/s baseline versus 0.363/s candidate, with matched
      progress/input cadence. This is not total allocation bytes or retained heap.
- [x] Check equal values in new payload objects, position changes, join/leave,
      pace car, spectator, multiclass, qualifying fallback, and focus.

Stage D exit criterion: equal class positions do not trigger repeated identity
grouping/sorting; real changes update the map correctly. Equality costs less
than the eliminated work on a representative full grid.

## 7. Stage E — canvas frequency and work in hidden windows

Dependencies: D, separate A/B for each change. Priority: P2.

- [x] Split Map counters into draw on React commit and intermediate rAF draw.
      The existing combined metric includes both paths and is not screen FPS.
      The trace report verifies count/duration equality for all 23 intervals.
- [ ] Compare the existing Map mode with a 60 FPS cap on 60/144/240 Hz displays.
      Account for the fact that current `maxFps` limits intermediate frames, while
      paint in the layout effect runs independently of the cap.
- [ ] If needed, improve carried-deadline scheduling without systematically
      lowering 60 FPS to a value tied to a multiple of refresh rate.
- [ ] Check that rAF stops after interpolation completes and when the
      widget/window is hidden. Do not add background timers to bypass pausing.
- [ ] Preserve immediate repaint after static-cache and size changes, DPR/widget
      scale, colors, icons, and data changes. Do not introduce one blank frame.
- [x] Check Radar draw rate and active/native visibility lifecycle. The
      [native minimize diagnostic](2026-11-12-radar-native-visibility.md) observes
      about 60 draws/s without the native gate and zero with it while minimized;
      restore and cleanup pass. The 60 Hz scheduler is unchanged.
- [ ] If a new user setting is needed, describe it in the type, manifest
      defaults/properties, and settings; use the existing merge.

Only items phrased “if needed” or “if a new setting is needed” are conditional;
other unchecked Stage E checks remain open as described in the status table.

Stage E exit criterion: CPU/draw work decreases beyond repeat noise; movement,
fade/hide, scaling, and replay do not regress. For visual changes, prepare
before/after screenshots and a short motion recording.

## 8. Stage F — windows, Settings, memory, and compositor

Dependencies: A/B; independent of C–E. Priority: P1 for diagnosis.

- [ ] Capture Settings closed/open on the same page, with preview
      enabled/disabled; attribute CPU/heap/working set by PID.
- [ ] Capture allocation/heap profiles during sustained growth; check cleanup
      of preview, listeners, timers, canvas, and objects across repeated open/close.
- [x] For memory trends, use at least 20 minutes of steady state and repeat;
      compare heap after GC at identical checkpoints; do not infer a leak from RSS.
      Completed for visible Standings preview with looping tape; see the memory
      report. Allocation ownership and other workload modes remain open.
- [x] Compare display/shared and individual/widget modes with the same instances,
      layout, and DPI; record all window geometry. Geometry matched, but input
      rates differed (56.22 vs 53.23 Hz), so this is not a CPU comparison.
- [x] Capture an initial Chromium Performance trace with Settings closed and
      attribute layout/paint/raster/compositor spans; see the
      [trace report](2026-11-11-renderer-trace.md). This is diagnostic evidence,
      not a normal-run CPU estimate or complete causal attribution.
- [x] Localize steady-state load across shared snapshot pipeline boundaries on
      the saved ten-widget profile; see the
      [system pipeline report](2026-11-11-system-pipeline-attribution.md).
- [ ] Separate the downstream React/effects, DOM/canvas and compositor costs
      enough to select a shared implementation change; validate it without
      diagnostic work suppression.
- [x] Verify hidden draw stop/resume for Map/Input/Radar, exercised Lap Trace,
      and Gantry history retention/disable cleanup in the tested scenarios.
- [ ] Complete remaining visibility/lifecycle coverage: other native hide modes,
      rAF versus snapshot/event delivery, and full Gantry incident/event coverage.
- Preserve Gantry's always-fed contract. Do not change Chromium flags or
  hardware acceleration without a separate A/B; this is a constraint, not an
  outstanding implementation task.

Stage F exit criterion: the owner of load/memory growth is identified by
process and objects; window changes are confirmed by trace and game presentation
capture.

## 9. Stage G — conditional native/IPC optimization

Current decision: defer interface/transport changes. In the completed R3 normal
matrix, the Browser/main process accounts for 13.05–14.58% of summed process CPU
(84.48–92.26 CPU ms/s). This includes SDK, processors and other main work; it
does not isolate native materialization. It also does **not** bound end-to-end
IPC cost, since deserialization/store work is in renderers. Together with the
downstream traces and measured compositor candidate, this supports continuing
renderer/drawing investigation first, not declaring transport free or redesigning
the native API without new attribution.

No Stage G item is active. The unchecked items below are conditional triggers,
not current tasks; reopen them only after attribution shows a native/IPC bottleneck.

Dependencies: live profile B/F. Priority: P3, only when there is measured benefit.

- [ ] If SDK materialization dominates: measure copied bytes, number of
      objects/buffers, and conversion cost; propose metadata caching or a minimal
      typed read path while preserving existing consumers.
- [ ] If main-thread blocking dominates: design an async native wait or separate
      host; check SDK thread ownership, stop/cancellation, reconnect, and replay
      seek. Preserve N-API guards and buffer safety.
- [ ] If IPC dominates: measure bytes/rate/delivery by channel and window, then
      reduce a specific payload. Preserve coalescing, rate ceilings, event ordering,
      latest snapshot, and seeded delivery after show.
      Invariant: do not reduce Input accuracy, FuelLevel/SessionTime threshold
      calculations, or frame-delta speed calculations; follow the no-round rules.

Stage G exit criterion: the gain exceeds measured overhead of the new interface
and copying; public consumers and lifecycle behavior are preserved.

## 10. Future delivery checks

The initial C/D implementation and instrumentation are already on `perf`; those
proposed commits are superseded. Remaining code changes are evidence-gated:

1. Stage E drawing/scheduling change only after matched A/B identifies a gain
   beyond run variation without visual or lifecycle regressions.
2. Stage F Settings/memory/window change only after attribution identifies an
   owner and a reproducible consumer-visible cost.
3. Stage G native/IPC change only after a measured transport or SDK bottleneck.

The checklist below applies to each future change/PR; unchecked boxes are a
reusable gate, not branch backlog.

- [ ] Write branch documentation, commit messages, and PR titles/descriptions
      in English.
- [ ] Run targeted behavioral tests: no notification for irrelevant data,
      correct updates for real changes, cleanup, replay/disconnect. New domain
      selectors require specs.
- [ ] Run TypeScript/ESLint before commit; broaden tests for affected
      dependencies when store/channel/native lifecycle changes.
- [ ] Capture before/after React profiles on a full grid, including root and
      descendants; do not substitute commit/paint duration for render duration.
- [ ] Repeat matching A/B from A; show CPU ms/s, distributions, topology,
      channel activity, frame intervals, and missing data.
- [ ] Claim game FPS regression/improvement only from actual game present
      capture; exclude mock/tape fixture FPS from this assessment.
- [ ] Complete applicable architecture checklist items; keep raw captures and
      review media outside tracked files, and store concise results in docs.
- [ ] Follow the PR template; visual changes require actual GitHub screenshot
      attachments, before/after images, and verification that they render in the PR.

Use short, in-process group isolation to find expensive paths before expanding
the workload matrix. Keep window geometry and source cadence checked, split a
suspect group, and profile individual widgets only after evidence narrows the
search. Reserve long matched A/B repetitions for validating a proposed fix;
do not run the whole matrix for each widget by default.

The final report must list completed changes and unresolved limitations. Do not
call a change an optimization without a reproducible gain.
