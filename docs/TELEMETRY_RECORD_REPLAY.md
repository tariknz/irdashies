# Raw iRacing Telemetry Record/Replay

The `irsdk_replay` Windows tool records the complete live IRSDK shared-memory
surface. Its shared-memory playback uses isolated irDashies test objects by
default:

- `Local\IRDashiesReplayMemMapFileName`
- `Local\IRDashiesReplayDataValidEvent`

The test-only `irsdk_node_replay.node` addon compiles the unchanged reader
against those isolated names. The production `irsdk_node.node` continues using
the standard iRacing names. This exercises the real `irsdk_utils.cpp` and N-API
code without replacing it with a JavaScript mock or risking a collision with a
subsequently launched simulator.

This work supports the automated headless harness described after Phase 0 in
`ARCHITECTURE_REVIEW.md`. The shared-memory bytes deliberately remain
indistinguishable from live iRacing data. Any future in-app replay controls must
identify replay mode through an out-of-band test launch flag so session
lifecycle events can still comply with rule R3.6.

For macOS and other non-Windows development, the application can instead load
the same tape through `irsdk_tape_node`. This native addon implements the
existing `INativeSDK` boundary directly, so telemetry and embedded session YAML
continue through the normal `IRacingSDK` and bridge pipeline without emulating
Windows shared memory.

## Build

The tool is built alongside the existing native addon:

```bash
npm run irsdk:build
```

On Windows, the executable is written to
`build\Release\irsdk_replay.exe`. On every platform, the in-process tape addon
is written to `build/Release/irsdk_tape_node.node`.

## Record a live session

The recorder can be started before the simulator. It waits until iRacing
creates and connects its shared-memory mapping:

```powershell
npm run irsdk:record -- --output telemetry-captures\race.irdt
```

Stop recording with Ctrl+C. To record a bounded interval:

```powershell
npm run irsdk:record -- --output telemetry-captures\race.irdt --duration 120
```

The recorder:

1. Copies the SDK layout and complete variable-header array.
2. Watches the IRSDK data-valid event.
3. Scans every triple buffer for unseen ticks and copies stable buffers in tick
   order.
4. Records every raw `bufLen` frame without parsing or rounding it.
5. Records each raw session-YAML revision.
6. Emits gap records when source ticks were overwritten before capture.

If the SDK layout changes, the recorder finalizes the current tape and asks for
a new capture. A tape currently represents one stable IRSDK connection/schema.

Inspect a completed tape before replaying it:

```powershell
npm run irsdk:inspect -- --input telemetry-captures\race.irdt
```

## Replay

### In-process application replay (macOS, Windows, and Linux)

Run any tape directly through irDashies:

```bash
npm run irsdk:replay:app -- --input test-data/telemetry/ai-race-10min.irdt
```

Playback supports speed factors from `0.25` through `100`, plus looping:

```bash
npm run irsdk:replay:app -- --input telemetry-captures/race.irdt --speed 2
npm run irsdk:replay:app -- --input telemetry-captures/race.irdt --loop
```

The curated fixture has a convenience command:

```bash
npm run irsdk:replay:app:curated
```

The launcher sets these out-of-band development variables:

- `IRDASHIES_TELEMETRY_REPLAY` — resolved tape path
- `IRDASHIES_TELEMETRY_REPLAY_SPEED` — playback speed
- `IRDASHIES_TELEMETRY_REPLAY_LOOP` — `1` to restart after disconnect

Replay validates the same format, layout, schema, and payload checksums as the
Windows tool. Recorded disconnects and loop boundaries pass through the normal
session lifecycle, and `enter` identifies the source with `replay: true`.
SDK broadcast commands are intentionally ignored because they cannot alter a
recorded stream.

### Windows shared-memory replay

```powershell
npm run irsdk:replay -- --input telemetry-captures\race.irdt
```

Isolated playback can safely coexist with the iRacing UI, simulator, Dashies,
or SimHub because it uses different object names. Ordinary Dashies and SimHub
continue reading the production mapping; only the test addon consumes the
isolated mapping. Playback supports speed and looping:

```powershell
npm run irsdk:replay -- --input telemetry-captures\race.irdt --speed 2
npm run irsdk:replay -- --input telemetry-captures\race.irdt --loop
```

To run the complete irDashies application against isolated playback, start the
publisher in one terminal, then launch the app with its explicit replay-mode
environment flag in another:

```powershell
npm run irsdk:replay -- --input telemetry-captures\race.irdt --loop
$env:IRDASHIES_IRSDK_REPLAY = '1'
npm start
```

The flag only selects the isolated native addon for that irDashies process. It
does not redirect other SDK clients or modify the production mapping.

For deterministic tests, step mode accepts `next` and `quit` on stdin:

```powershell
npm run irsdk:replay -- --input telemetry-captures\race.irdt --step
```

An explicit exact-name mode exists only for controlled smoke tests:

```powershell
npm run irsdk:replay -- --input telemetry-captures\race.irdt --iracing-names
```

Do not start iRacing during exact-name playback. The publisher refuses to start
if the production mapping already exists, but iRacing cannot be made to honor a
lock owned by this test tool.

## Synthetic native validation

Generate a small tape containing scalar, bitfield, boolean, float-array, and
session-YAML updates:

```powershell
npm run irsdk:fixture -- --output telemetry-captures\synthetic.irdt
npm run irsdk:inspect -- --input telemetry-captures\synthetic.irdt
```

The Windows-only `irsdk-replay.spec.ts` starts that tape in step mode and reads
it through the isolated build of the unchanged N-API addon. Production IRSDK
clients do not affect the test.

## Curated real-session fixture

`test-data\telemetry\ai-race-10min.irdt` is a ten-minute AI race captured from
the live shared-memory interface. It contains 36,000 frames at 60 Hz, all 333
published variables, 70 session-info revisions, and no capture gaps. The file
is stored with Git LFS; its checksum and structural metadata are recorded in
`ai-race-10min.json`.

The regular unit suite does not read or download this 332 MiB fixture. Use it
for explicit native or full-application integration runs:

```powershell
git lfs pull --include="test-data/telemetry/ai-race-10min.irdt"
npm run irsdk:inspect -- --input test-data\telemetry\ai-race-10min.irdt
npm run irsdk:replay:curated -- --loop
```

On any supported development platform, the simpler full-application path is:

```bash
npm run irsdk:replay:app:curated
```

## Capture format

`.irdt` is a little-endian, checksummed binary container:

- Versioned file header
- Original `irsdk_header`
- Exact `irsdk_varHeader[]` schema
- Frame records containing the original raw buffer bytes
- Session-info revision records containing the original encoded YAML bytes
- Gap, disconnect, and end records

The publisher reconstructs the original offsets, cycles through the recorded
number of mapped buffers, writes payload bytes first, updates `tickCount` last,
and signals the data-valid event.

## Privacy and repository hygiene

Session YAML can contain driver names, customer IDs, team names, and setup
metadata. `.irdt` files are ignored by Git and should remain local by default.
The curated LFS fixture is an AI-only session reviewed for repository use; do
not add other recordings without the same privacy and storage review.
