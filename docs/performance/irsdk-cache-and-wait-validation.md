# iRacing SDK cache correctness and wait instrumentation

Branch: `fix/irsdk-cache-correctness`. Base: local `test-fix-perf` at
`2e2e7059`. Native metadata validation from `1d93c4bb` and the regression spec
from `2e2e7059` are preserved.

## 1. Confirmed bugs and fixes

### Telemetry arrays were not truncated or retyped (confirmed)

`copyTelemData()` reused cached `{ value: [...] }` objects and wrote up to the
new source length without shortening a previously longer array. A variable
whose `count` shrank kept stale trailing elements. A variable whose `varType`
changed reused an array created for the old element type. The layout branch in
`getTelemetry()` rebuilt the key list and cleared typed views but retained
`_telemetryCache`.

Fix:

- cached arrays are resized to the current source length before being filled;
- a per-key `varType` map invalidates incompatible cached objects;
- `stopSDK()` clears telemetry caches, keys, views and type state;
- the mutable-frame contract is unchanged, so retained arrays still observe
  later reads.

This was reproduced in the pre-existing audit with a two-element frame followed
by a one-element frame, and is now covered by permanent tests.

### Native frame metadata cache (already fixed on the base)

`GetTelemetryDataView()` now validates variable size, offset, count, type,
`countAsTime`, name, description and unit before reusing a cached frame. That
work remains from `1d93c4bb` and was not altered here.

### Frame ownership

`getTelemetry()` returns a fresh outer object whose inner arrays are reused and
overwritten. This is documented at the SDK API. In-tree consumers were traced:
processors, lifecycle, bridges and IPC publish synchronously; the webserver and
widget-preview stores keep only the latest value and read it as a current
snapshot, not as an immutable historical frame. No unsafe async retention was
found. The native `getTelemetryDataView()` method exposes byte views into a
reused frame that are valid only until the next read.

## 2. Files changed

- `src/app/irsdk/node/irsdk-node.ts` — array truncation, type invalidation,
  stop-time cache reset, ownership documentation.
- `src/app/irsdk/node/irsdk-node.spec.ts` — seven permanent regression tests.
- `src/app/perfMetrics.ts` — opt-in `sdkWait` samples and report fields.
- `src/app/perfMetrics.spec.ts` — instrumentation tests.
- `src/app/bridge/iracingSdk/iracingSdkBridge.ts` — opt-in wrapper around
  `sdk.waitForData()`.
- This report.

## 3. Tests and results

- `npm run lint` — passed (TypeScript + ESLint).
- `npx prettier --check` on changed TypeScript files — passed.
- `npm run test -- --no-coverage` — 593 files passed, 11 skipped; 7133 tests
  passed, 48 skipped.
- `npx vitest run src/app/irsdk/node/irsdk-node.spec.ts` — 99 passed.
- `npx vitest run src/app/perfMetrics.spec.ts` — 3 passed.
- `npm run irsdk:build` — passed.
- `npx vitest run src/app/irsdk/native/irsdk-replay.spec.ts src/app/irsdk/native/irsdk-tape-node.spec.ts src/app/irsdk/node/irsdk-node.spec.ts` — 133 passed, 1 skipped (native capture suite skipped).
- Windows native and real iRacing tests — unavailable on this Linux host.

## 4. Cache allocation and performance impact

The unchanged-layout path still reuses the same inner arrays and typed views;
no immutable snapshots were introduced. The added per-key type lookup and array
resize add two `Map` operations and one length assignment per decoded variable.

Short A/B with the same 390 MB replay, visible widgets and no instrumentation:

| Metric                                        | `2e2e7059` | `aecb63ba` |     Effect |
| --------------------------------------------- | ---------: | ---------: | ---------: |
| `sdkTelemetryRead` avg, last five 5 s reports |  0.0647 ms |  0.0741 ms | +0.0094 ms |
| `processTelemetry` avg                        |  0.0946 ms |  0.0981 ms | +0.0035 ms |
| `processTelemetry` p99                        |   0.874 ms |   0.973 ms |  +0.099 ms |
| App CPU                                       |   0.274 pp |   0.248 pp |  −0.026 pp |

Branch verdict: **NO REPRODUCIBLE EFFECT** from one 60 s AB pair. The small
positive decode delta is consistent with the extra type bookkeeping but is not
separated from run noise. Allocation rate, allocated bytes per frame, GC count
and GC pause duration were not instrumented and remain unavailable.

## 5. Wait-duration instrumentation

Opt-in with `PERF_METRICS=1` and `PERF_SDK_WAIT=1`. Normal launches have no
instrumentation: `TelemetryPerfMetrics.sdkWaitEnabled` is false and
`recordSdkWait()` returns immediately. The bridge records duration only when
enabled, without changing `WAIT_TIMEOUT` or the scheduling loop. The report
includes duration p50/p95/p99/max, calls, successful reads, unsuccessful reads,
total wall-clock wait time, configured timeout and requested polling rate.
An unsuccessful read is only a native read outcome; it is **not** assumed to be
an OS timeout.

## 6. Controlled A/B: `waitForData(16)` vs `waitForData(0)`

Existing replay runner, ABBA, two runs per side, 10 s warmup, 120 s measured
per run, same 390 MB tape, same profile and visible-widget settings. Variant B
was a temporary uncommitted `WAIT_TIMEOUT = 0` patch in a detached worktree and
was never committed to this branch. Each run produced 23 perf reports and about
2890 wait samples.

| Condition              | A p50 / p95 / p99 / max (ms) | B p50 / p95 / p99 / max (ms) |
| ---------------------- | ---------------------------- | ---------------------------- |
| Connected replay run 1 | 1.86 / 3.10 / 7.31 / 31.5    | 1.97 / 3.39 / 8.84 / 49.3    |
| Connected replay run 2 | 1.43 / 2.11 / 5.29 / 27.8    | 1.45 / 2.23 / 5.43 / 31.0    |

Aggregate verdict: **NO REPRODUCIBLE EFFECT**. App CPU medians 0.184 pp (A) vs
0.190 pp (B), run noise 0.059 pp. Event-loop p99 medians 22.61 ms vs 23.21 ms,
run noise 2.60 ms. Effective tick rate remained about 25 Hz on both sides.
Successful reads were 2896/2906 in A and 2883/2906 in B; the five unsuccessful
reads in one B run are not evidence of an OS timeout.

Paused and disconnected conditions were not reproducible with the existing
replay runner, so no wait samples exist for them. Linux tape replay uses a file
mapping, not Win32 `WaitForSingleObject`; these numbers must not be applied to
Windows iRacing behaviour.

## 7. Unverified hypotheses

- Paused replay and iRacing-closed waits may occupy more of each polling cycle
  than the connected replay measured here.
- Windows timer quantization may amplify the 16 ms wait differently from Linux.
- The extra native metadata fingerprint work costs time on every frame; it was
  not isolated from the other decode work in these captures.
- No allocation/GC or simulator frametime measurements were collected, so no
  game FPS or stutter claim is made.

## 8. Recommendation

Keep synchronous polling for now. The available evidence does not demonstrate
material main-process responsiveness loss from `waitForData(16)`, and a zero
timeout did not improve event-loop, CPU or cadence metrics beyond noise.

Next experiment, only if evidence is needed for a platform decision: run the
same opt-in instrumentation on Windows with real iRacing in connected, paused
and disconnected states, including GC/heap counters and IPC responsiveness.
Investigate native async isolation only if that run shows material main-thread
blocking. Do not rewrite the SDK on the basis of Linux replay alone.

Evidence artifacts: `perf-results/cache-fix-regression/` and
`perf-results/wait-timeout-ab2/` (untracked local captures).

## 9. Reproducibility

Replay fixture: `irdashies-live-1794743072408.irdt`, 390,995,302 bytes,
SHA-256 `2b234fbee7cd8b5f5b81ff9d30a48ee28b3598bc9a3694fc256365a0d35237ec`.
Both experiments used the Linux dev target, saved profile (display window
mode), visible-widget replay override, channel delivery on, allowlisted raw
telemetry payload, 5 s perf interval and the existing 25 Hz polling path.

Cache-fix check, one AB pair, no instrumentation flag:

```bash
node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON tools/perf/branches.ts \
  --baseline 2e2e7059 --candidate aecb63ba \
  --input /home/omarchy/OmarchyShared/Projects/irdashies-live-1794743072408.irdt \
  --smoke --replay-visible-widgets --rebuild-native \
  --output perf-results/cache-fix-regression
```

Wait comparison, ABBA, two runs per side, 10 s warmup and 120 s measured per
run. Variant B was an uncommitted `WAIT_TIMEOUT = 0` change in a detached
worktree of `aecb63ba`; the production branch still uses `16`:

```bash
PERF_SDK_WAIT=1 node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON \
  tools/perf/branches.ts \
  --baseline aecb63ba --candidate-dir /tmp/irdashies-wait0 \
  --input /home/omarchy/OmarchyShared/Projects/irdashies-live-1794743072408.irdt \
  --warmup-seconds 10 --duration-seconds 120 --pairs 1 --order abba \
  --allow-inconclusive --ignore-gates memory,FPS --replay-visible-widgets \
  --rebuild-native --output perf-results/wait-timeout-ab2
```

Both commands were run from a detached worktree of `5d56065d`, which contains
the separate replay CLI tooling. Raw logs, reports and profiles remain local
and untracked; only the aggregate tables above are committed.

## 10. Final review

- **Confirmed findings:** the array length/type bug is fixed and covered; the
  native metadata validation from `1d93c4bb` remains intact. No new cache or
  lifecycle defect was confirmed in this review.
- **Cache lifecycle:** `stopSDK()` clears JS caches; native `StopSdk()` and
  `WaitForData()` reset native frames on stop, invalid capture and layout
  change. Replay seek/pause/resume keep the last frame while paused and
  replace it when data resumes; source switching creates a new SDK wrapper.
  No unsupported cache reset was added.
- **Per-frame type tracking:** kept. Clearing all JS caches on native frame
  identity change would handle real native layout changes but would also drop
  reuse for mock feeds that return a new object each frame. The per-key type
  map is small, bounded by known telemetry keys, preserves steady-state array
  reuse and handles same-size metadata changes. The 0.0647 → 0.0741 ms
  observation is a single short pair and is not a proven regression, so no
  speculative optimization was made.
- **Instrumentation:** `sdkWaitEnabled` requires both existing perf mode and
  `PERF_SDK_WAIT=1`. Counters and percentile samples reset each report; the
  sample buffer is fixed at 2048; no telemetry reference is retained. Failed
  native reads are reported as `unsuccessful`, not as OS timeouts. Tests cover
  disabled mode, aggregation and reset.
- **Documentation scope:** `docs/performance/overlay-performance-plan.md` was
  temporarily imported from `perf` in an earlier commit. It exists there and
  not in upstream/main or the base branch, and its 929-line overlay campaign
  plan is not part of this SDK-cache fix. It was removed from this PR; the
  focused audit report is the only documentation here.
- **Evidence:** all numbers are Linux replay measurements. Windows/iRacing,
  paused/disconnected wait states, allocation rate, GC counters and simulator
  frametime are unavailable or unmeasured.
- **Verdict:** READY WITH LIMITATIONS. Recommended PR base: `test-fix-perf`.
  Suggested title: `fix: correct telemetry cache layout handling and add opt-in SDK wait metrics`.
