# Le Mans Ultimate Telemetry Record/Replay

The `lmu_replay` Windows tool records LMU's shared-memory block to a `.lmudt`
tape, and `lmu_tape_node` plays one back through the application.

It is the LMU counterpart of the iRacing tooling in
[TELEMETRY_RECORD_REPLAY.md](./TELEMETRY_RECORD_REPLAY.md) and borrows its
central idea: **the replay addon is the production addon.** `lmu_node.cc` is
compiled twice, once against the live shared-memory source and once against a
tape-backed one, so a recording travels through the real snapshot-to-JS
conversion rather than a mock of it. The seam between them is
[`lmu_source.h`](../src/app/lmu/native/lmu_source.h), which mirrors how
`irsdk_node.cc` links either `irsdk_utils.cpp` or `irsdk_tape_utils.cpp`.

LMU is simpler than iRacing in one way and harder in another. Simpler: it
publishes one fixed struct, so a tape has no schema to carry and no variable
headers to validate. Harder: that struct is **324,820 bytes**, and the sim
publishes at 100 Hz. Stored verbatim a tape would cost about 31 MB a second —
roughly 19 GB for ten minutes, against the 348 MB of the curated iRacing tape.

## How the tape stays small

Two things, and neither is a general-purpose compressor:

- Every frame is **run-length encoded**. The arrays are sized for 104 vehicles
  whatever the grid, so a keyframe is mostly empty slots.
- All but every hundredth frame is stored as an **XOR delta** against the one
  before, which is almost entirely zeroes.

A keyframe every `kKeyframeInterval` frames is what makes a tape loopable and
survivable: a delta is useless without its predecessor, so each keyframe is a
point the reader can start from.

The synthetic fixture compresses about 3,600×. **Expect far less from a real
session** — it has two cars and few moving fields. The ratio a real capture
achieves is worth measuring before assuming a size.

## Build

```bash
npm run irsdk:build
```

Produces `build\Release\lmu_replay.exe` and
`build\Release\lmu_tape_node.node`, alongside the iRacing artefacts.

## Record a live session

The recorder can start before the sim and waits for the mapping to appear:

```powershell
npm run lmu:record -- --output telemetry-captures\session.lmudt
```

Stop with Ctrl+C, or bound it:

```powershell
npm run lmu:record -- --output telemetry-captures\session.lmudt --duration 120
```

`--poll <ms>` sets the capture cadence; it defaults to 10 ms, matching the
rate the sim publishes at. A larger value records fewer frames and a smaller
tape, at the cost of the resolution the lap-distance reconstruction depends on.

The recorder copies each snapshot with the same lock-free retry the production
addon uses, so a torn read is skipped rather than stored. If LMU goes away it
writes a disconnect record and waits for it to come back.

## Inspect a tape

```powershell
npm run lmu:inspect -- --input telemetry-captures\session.lmudt
```

Reports the record counts, duration, and the compression achieved against raw
snapshots. It also names every REST path the tape captured, which is how you
check a recording actually covers what you wanted to reproduce. It decodes every record, so it also verifies the checksums.

## Replay through the application

```bash
npm run lmu:replay:app -- --input telemetry-captures/session.lmudt
npm run lmu:replay:app -- --input telemetry-captures/session.lmudt --speed 2
npm run lmu:replay:app -- --input telemetry-captures/session.lmudt --loop
```

The launcher sets these out-of-band development variables:

- `IRDASHIES_LMU_REPLAY` — resolved tape path, and what selects the replay addon
- `IRDASHIES_LMU_REPLAY_SPEED` — 0.25 to 100
- `IRDASHIES_LMU_REPLAY_LOOP` — `1` to restart at the end
- `IRDASHIES_SIM` — pinned to `lmu`, because auto-detection probes for a
  running sim and a tape is not one

Frames are held until their recorded moment arrives, so a tape plays at the
cadence it was captured at rather than as fast as it can be read. A loop
boundary is published as a disconnect, because a restarted recording is what
that is.

## A synthetic tape, without the sim

```powershell
npm run lmu:fixture -- --output telemetry-captures\synthetic.lmudt --frames 600
```

Two cars on a made-up circuit with a player car, moving lap distance, fuel
burn and engine RPM. It is what `src/app/lmu/native/lmu-tape.spec.ts` uses to
cover the format and the player without needing a copy of LMU.

## Not provided

**There is no curated committed fixture.** `npm run lmu:replay:curated` points
at `test-data/telemetry/lmu-session.lmudt`, which does not exist yet — it needs
a real session recorded on a machine running LMU. Record one and commit it, or
keep it out of the repository and pass `--input` explicitly. The iRacing
equivalent is 348 MB, so weigh that before committing one.

## REST API values

LMU serves things over a local REST API that its shared-memory block does not
carry — pit-stop and repair estimates, the pit menu's refuel target,
virtual-energy capacity, component wear, the weather forecast. A tape that held
only shared memory could not reproduce anything depending on them, so the format
carries them too, as `Rest` records interleaved with the snapshots.

They are stored verbatim rather than run-length encoded: a few KB of JSON
written only when the body changes, where the run encoding that makes a
324,820-byte snapshot viable would cost more than it saves.

On playback, the replay addon serves them back through `readRest(path)`, and the
bridge points the REST poller at the tape instead of at the network. The poller
itself is unchanged — same hashing, same backoff, same parsers — so a replay
exercises the real path rather than a shortcut around it. A path the recording
never covered reports as pending for the whole run, which is the honest answer:
it was never captured.

`record` captures them from a live session. The recorder polls the API on its
own thread — the capture loop runs every 10 ms and a loopback connect that
fails can take far longer than that, so polling inline would cost frames — and
queues a record only when a body actually changes. Only the main thread ever
writes to the tape, so the queue is the whole of the shared state.

```powershell
npm run lmu:record -- --output telemetry-captures\session.lmudt
npm run lmu:record -- --output telemetry-captures\session.lmudt --no-rest
```

`--rest-interval <ms>` sets the poll cadence (default 200), `--rest-host` and
`--rest-port` point it elsewhere, and `--no-rest` records shared memory alone.
If nothing is serving the port — an older LMU has no REST API — it says so once
and records shared memory only, rather than retrying four paths a second for
the whole session.

The paths polled are listed in `lmu_replay_main.cpp` and must stay in step with
`LMU_REST_TASKS` in [`src/app/lmu/rest/tasks.ts`](../src/app/lmu/rest/tasks.ts),
which is what the app actually reads. A path recorded but unread is harmless; a
path read but never recorded replays as pending forever.

## Compatibility

A tape stores the struct verbatim, so it records `sizeof(LMUObjectOut)` in its
header and the reader refuses a tape whose size disagrees. If `lmu_struct.h`
changes, old tapes stop loading rather than being silently misread — the bytes
would no longer mean what this build reads them as.

The format version is **2**, which added REST records. Version 1 tapes are
refused rather than played without them: none existed outside a scratch
directory, so there was nothing to migrate, and a silent half-replay would be
worse than a refusal.
