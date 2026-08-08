# Phase 3 — Channel-Based Bridge Implementation Plan

> **Status:** Delivered on `main`; memory-slope gate remains open (PRs #646, #649–#652, #656; performance record #658)
> **Architecture phase:** Phase 3 — Channel-based bridge
> **Primary objective:** Replace the renderer-wide telemetry firehose incrementally with typed, per-window channel subscriptions while preserving observable widget behavior.

## Delivery record

The Phase 3 Fuel pilot and reusable channel rails are complete:

- PR #646 added the deterministic curated replay harness.
- PR #649 extracted the deterministic Fuel projection engine.
- PR #650 added the typed, rate-aware, visibility-aware channel bus.
- PR #651 added the Fuel projection processor.
- PR #652 migrated the Fuel renderer to `fuel.projection`, including browser-source delivery.
- PR #656 conditioned legacy telemetry by mounted widget and added runtime rate metadata and wake-up instrumentation.
- PR #658 recorded the Windows Fuel-only A/B: legacy telemetry deliveries fell 100% and app-wide renderer wake-ups fell 42.4%, with no observed correctness regression.

The existing memory-slope gate failed for both baseline and candidate in that
single A/B pair. The candidate moved directionally lower, but repeated pairs
are still required before attributing the memory change to Phase 3.

The legacy telemetry stream intentionally remains for widgets not yet migrated.
Those migrations are tracked as Phase 4 in
[`IMPLEMENTATION_PLAN.md`](./IMPLEMENTATION_PLAN.md).

## 1. Outcomes

Phase 3 is complete when:

- Fuel consumes a typed `fuel.projection` snapshot and no longer reads raw telemetry.
- A Fuel-only renderer does not receive the legacy `telemetry` IPC message.
- Each renderer receives only the channels required by its mounted widgets.
- Each renderer/channel pair runs at the highest rate requested for that channel in that renderer.
- Hidden, closed, and destroyed renderer windows do not receive channel publications.
- Unmigrated widgets continue to work through the legacy telemetry path.
- The curated iRacing tape validates Fuel state deterministically before and after migration.
- Replay performance meets the existing Phase 3 performance gates.

## 2. Decisions

### Subscription model

Use push-based subscriptions. The main process retains the latest value for snapshot channels and sends it immediately to a new subscriber. Event channels, such as lifecycle events, are not replayed to new subscribers.

### Subscription identity

The main process derives renderer identity from `event.sender`. Renderer-provided window IDs are not accepted.

Multiple widget consumers of the same channel are reference-counted in preload. The main process holds one subscription per `webContents.id` and channel. If consumers request different rates, the renderer subscribes at the highest requested rate.

### Rate semantics

- A processor declares its native/default publication rate.
- A widget may request a lower rate.
- The channel bus coalesces updates and delivers the latest pending snapshot at the requested rate.
- On-change channels publish only when their owner reports a state change; they are not represented as a synthetic `0 Hz` polling interval.
- Full-rate paths remain available for inputs and calculations whose precision rules prohibit throttling.

### Backwards compatibility

The legacy `telemetry` channel remains available until all in-tree widgets have migrated. Phase 3 removes it only from renderers that have no mounted legacy consumers.

### Fuel processor ownership

`FuelProjectionProcessor` moves forward from Phase 4 into Phase 3. Publishing a raw telemetry subset under the name `fuel.projection` would not satisfy the channel or processor architecture rules.

### Correctness validation

The curated tape validator is headless and non-real-time. The existing full Electron replay remains a manual smoke and performance test.

## 3. Pull Request Sequence

### PR 1 — Headless curated state validator

**Branch:** `test/curated-state-harness`

Build the correctness harness before changing Fuel behavior.

#### Scope

- Add a streaming `.irdt` reader for validation runs.
- Decode only telemetry fields requested by the active validation probe.
- Apply session revisions according to tape timestamps and the production session polling cadence.
- Validate the tape SHA-256, schema, record count, frame count, session revisions, gaps, disconnects, and end marker.
- Add processor-probe and channel-probe interfaces.
- Calculate per-frame canonical state hashes without retaining every full snapshot.
- Persist readable snapshots only at semantic checkpoints.
- Add a small synthetic tape to the regular unit suite.
- Add commands:
  - `npm run test:replay:curated`
  - `npm run test:replay:curated:update`
- Detect a missing Git LFS object and report the required `git lfs pull` command.

#### Performance target

The curated validator should complete in under 10 seconds on a normal development machine. It must not start Electron, React, IPC, storage, or wall-clock replay.

#### Merge gates

- The synthetic fixture runs in the normal test suite.
- The curated tape processes all 36,000 frames and 70 session revisions.
- Golden updates are explicit and never occur during a normal validation run.
- A mismatch reports the differing golden field, probe, expected and actual hashes, and the latest readable checkpoint state.

### PR 2 — Deterministic Fuel engine extraction

**Branch:** `refactor/fuel-projection-engine`

Extract Fuel calculation behavior without changing the widget's data source or presentation.

#### Scope

- Extract the Fuel state machine and calculation engine from React hooks.
- Inject clock, persistence, logging, initial history, and settings inputs.
- Remove direct `Date.now()` dependencies from calculation state.
- Represent storage operations as deterministic commands handled outside the engine.
- Keep React responsible for telemetry/session subscriptions and rendering.
- Add a Fuel validation probe.
- Generate and review the legacy Fuel golden from the curated tape.
- Retain existing synthetic Fuel scenarios for targeted edge cases.

#### Merge gates

- No visible or persisted behavior changes.
- Existing Fuel tests and stories pass.
- The curated golden contains per-frame hashes and readable checkpoints for session entry, on-track entry, lap crossings, pit/refuel transitions, flag changes, disconnect, and final state.
- Replay output is deterministic across repeated runs.

### PR 3 — Typed, rate-aware channel bus

**Branch:** `feat/channel-bus-core`

Implement reusable channel transport independently of Fuel behavior.

#### Scope

- Add channel snapshot and event contracts under `src/types/channels/`.
- Add a typed channel registry containing channel kind, default rate, and maximum rate.
- Add the `defineBridge` support required for new bridge APIs.
- Add a main-process channel bus keyed by `webContents.id`.
- Validate channel names and finite requested rates at the IPC boundary.
- Add per-channel latest-snapshot caching.
- Add trailing coalescing using an injected monotonic clock.
- Suppress delivery to hidden or destroyed windows.
- Remove subscriptions on renderer destruction or explicit unsubscribe.
- Add preload listener reference counting.
- Add typed renderer snapshot-store primitives and hooks.
- Add per-window/channel publication and delivery counters to performance metrics.

#### Merge gates

- Unknown channels and invalid rates are rejected.
- Duplicate local consumers produce one main-process subscription.
- Unmounting the last consumer unsubscribes the renderer.
- Snapshot channels seed new subscribers; event channels do not replay old events.
- Hidden, destroyed, and reloaded renderers are handled without retained subscriptions.
- Fake-clock tests prove rate limiting and trailing delivery deterministically.

### PR 4 — Fuel processor in shadow mode

**Branch:** `feat/fuel-projection-processor`

Run Fuel projection in the main process while the renderer continues displaying legacy results.

#### Scope

- Add `FuelProjectionSnapshot` to the channel contracts.
- Add `FuelProjectionProcessor` under `src/app/processors/`.
- Feed the processor raw frames, session snapshots, and lifecycle events.
- Run the processor only while `fuel.projection` has subscribers.
- Publish snapshots through the channel bus.
- Keep persistence outside the processor behind an injected coordinator.
- Add `perfMetrics` coverage around the processing and publication paths.
- Compare processor output against the PR 2 Fuel golden for every curated frame.

#### Merge gates

- All curated per-frame hashes match the reviewed legacy golden.
- Processor tests cover session changes, disconnect, lap crossing, refuelling, towing, pit transitions, flag changes, and replay behavior.
- The processor performs no direct disk, network, or renderer I/O.
- Any intentional correctness change is isolated, documented, and accompanied by an explicitly reviewed golden update.

### PR 5 — Fuel renderer migration

**Branch:** `feat/fuel-channel-renderer`

Switch the user-facing Fuel widget from raw telemetry to `fuel.projection`.

#### Scope

- Add `useFuelProjectionSnapshot()` in frontend context.
- Remove raw telemetry and session-store calculation dependencies from Fuel.
- Keep display-only settings transformations in the renderer where appropriate.
- Preserve Fuel history, settings, logging, and persistence behavior.
- Add channel snapshot support to mock/demo data.
- Add a channel snapshot Storybook decorator.
- Extend the WebSocket bridge protocol so browser dashboards receive `fuel.projection`.
- Retain the legacy telemetry path for all unmigrated widgets.

#### Merge gates

- Curated Fuel validation remains green.
- Fuel stories, component tests, and settings tests pass.
- Electron live/demo mode and the browser dashboard render Fuel correctly.
- Unmigrated widgets continue working without changes.
- Fuel contains no raw telemetry subscription hooks.

### PR 6 — Conditional legacy telemetry and rate configuration

**Branch:** `perf/channel-subscriptions`

Turn the completed Fuel migration into measurable renderer and IPC savings.

#### Scope

- Add channel requirements and default update rates to `WidgetDefinition`.
- Complete the relevant self-registering widget metadata prerequisite instead of adding another temporary central map.
- Determine required channels from the widgets assigned to each display renderer.
- Mount the legacy telemetry provider only when a renderer contains an unmigrated consumer.
- Mount specialized providers/updaters only when required by widgets in that renderer.
- Add developer-configurable named rate presets and per-widget overrides.
- Aggregate the highest requested rate per renderer/channel.
- Expose channel delivery and renderer wake-up metrics.
- Update architecture documentation and rate guidance.

#### Merge gates

- A Fuel-only display receives no legacy `telemetry` IPC messages.
- Each renderer receives only channels required by its mounted widgets.
- Hidden and closed windows receive no channel publications.
- Full-rate input and precision-sensitive calculation paths remain unchanged.
- The curated correctness validator passes.
- Deterministic replay benchmarks show a measurable reduction in renderer wake-ups and app CPU.
- Existing performance gates remain satisfied:
  - `processTelemetry` p99 mean below 3 ms.
  - Minimum telemetry cadence at least 20 Hz.
  - Renderer frames over 50 ms below 0.1%.
  - Steady-state app memory slope below 5 MB/min.

#### Widget runtime metadata and rate guidance

Runtime transport metadata is discovered from
`src/frontend/components/*/widgetRuntimeDefinition.ts`. A migrated widget must
explicitly set `legacyTelemetry: false` and list every typed channel it needs.
Widgets without runtime metadata remain legacy consumers so incremental
migrations fail safe.

Choose the lowest named preset that preserves the widget's observable behavior:

- `driverFocused` — 25 Hz for positional or rapidly changing driver data.
- `gapTiming` — 5 Hz for projections, gaps, and sortable timing data.
- `informational` — 1 Hz for weather and slowly changing labels.
- `static` — event/snapshot delivery with no polling-rate request.

Use `channelRates` on the widget runtime definition when one channel needs a
different rate from the preset. Multiple consumers in one renderer are still
coalesced at the highest requested rate. Full-rate input and precision-sensitive
calculation paths must not be moved to a lower preset.

## 4. Validation Strategy

### Every PR

- `npm run lint`
- `npm run test -- --no-coverage`
- Relevant focused Vitest files during development.
- Architecture rules and Pre-PR checklist review.

### Processor, channel, lifecycle, or replay changes

- `npm run test:replay:curated`
- Synthetic replay tests in the normal unit suite.

### Visual changes

- Storybook verification.
- Before/after screenshots in the PR description.

### Final performance PR

- Deterministic observer, empty, Fuel-only, and full-dashboard replay runs.
- Full Electron curated replay smoke test.
- Live iRacing verification remains a separate manual checklist item and is checked only when actually performed.

## 5. Curated Golden Policy

- Goldens identify the tape SHA-256 and probe schema version.
- Numeric canonicalization is defined per snapshot field; there is no generic arbitrary rounding pass.
- Non-deterministic timestamps, object identities, and log ordering are excluded.
- A normal validation run never modifies a golden.
- Golden updates require the explicit update command and a PR explanation.
- Reviewers should inspect readable semantic checkpoints rather than relying only on opaque hash changes.

## 6. Compatibility Boundaries

Phase 3 must preserve:

- Legacy telemetry for unmigrated widgets.
- Demo and mock SDK modes.
- Storybook component previews.
- Browser/WebSocket dashboards.
- Telemetry tape replay on supported platforms.
- Dashboard settings and Fuel history persistence.
- Session lifecycle replay identification.

## 7. Deferred Work

The following remain outside this Phase 3 sequence:

- Migrating non-Fuel processors and widgets.
- Removing the legacy telemetry channel globally.
- Completing unrelated Phase 2b cleanup.
- Moving the SDK loop to a worker thread.
- Binary IPC or SharedArrayBuffer optimization.
- Native optimization without new profiling evidence.
