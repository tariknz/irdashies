# Telemetry memory ownership and widget cleanup

This document describes the memory fixes relative to upstream `tariknz/main`
at `668d457e`. The fixes apply to normal application operation, including live
iRacing telemetry. They do not require an Inspector UI or diagnostic backend.

## Changes

- The SDK wrapper uses an optional native frame-view API: one owned frame copy
  backs every variable's byte view. The previous native API allocated a separate
  `ArrayBuffer` for each variable on every frame. Converted telemetry still uses
  the existing JS arrays; raw frame views do not escape into stores or IPC. The
  legacy native API and fallback for older addons remain available. The number
  of variables, and therefore the allocation reduction, depends on the session.
- Canvas owners release their pixel buffers at unmount, including Track Map's
  offscreen cache, instead of waiting for detached DOM/React trees to be garbage
  collected. Cached map canvases are also released when replaced.
- Locked display overlays close when their last enabled widget is removed.
  Previously an empty primary overlay and unused secondary overlays retained
  renderer processes. Re-enabling widgets recreates the required windows. Edit
  mode still creates its controls for an empty profile. Gantry's separate window
  lifetime and the empty-renderer performance override are preserved.
- Color conversion reuses cached results instead of repeatedly creating
  temporary DOM elements to resolve the same CSS colors.

## Current evidence

See [Memory fixes versus upstream main](upstream-main-memory-comparison.md)
for the recording, methodology, individual runs and validation results.

The Linux max-speed replay comparison found 8.7% greater source-frame throughput
and 3.2% lower application CPU. With widgets continuously enabled, private
memory after GC was approximately unchanged: 273.35 MiB upstream versus
273.94 MiB with the fixes. In a separate disable-all check, the fixed application
closed its overlay renderer and ended at 177.0 MiB versus 231.3 MiB upstream.

The max-speed scheduler and forced-GC hooks were temporary, identical test
instrumentation in both builds. They are absent from the final product build.
The measured throughput gain cannot be assumed for normal, rate-limited live
telemetry. Live Windows/iRacing behavior remains unverified, and these results
do not establish that a long-session memory leak has been eliminated.
