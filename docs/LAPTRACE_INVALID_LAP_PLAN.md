# Lap Trace — show why the lap in progress cannot become the reference

> **Status:** Implemented on `feature/laptrace_bestlap_show_invalid_lap`. See §9 for where the build departed from the plan.
> **Branch:** `feature/laptrace_bestlap_show_invalid_lap`
> **Scope:** Lap Trace widget, its store, the lap-trace sample processor, and the LMU telemetry map.

## 1. Problem

With no reference lap stored, Lap Trace shows a prompt and a recording
progress bar ([`LapTrace.tsx:226-245`](../src/frontend/components/LapTrace/LapTrace.tsx#L226-L245)):

```
Drive a clean lap to record a reference
[████████░░░░░░░░]  Recording 52%
```

That bar is driven by `useLapTraceRecordingProgress`
([`LapTraceStore.tsx:1059-1067`](../src/frontend/context/LapTraceStore/LapTraceStore.tsx#L1059-L1067)),
which is pure distance along the lap. It knows nothing about whether the lap
is still promotable.

The recorder, meanwhile, does know. `ActiveLap.isCleanLap`
([`LapTraceStore.tsx:141`](../src/frontend/context/LapTraceStore/LapTraceStore.tsx#L141))
is cleared the moment the lap stops being a candidate, and only
`finishedClean` laps are ever snapshotted at the line
([`LapTraceStore.tsx:685`](../src/frontend/context/LapTraceStore/LapTraceStore.tsx#L685)).

So today the bar fills to 100% on a lap that was written off at turn 2, and
the driver gets no signal at all — they just see the prompt again next lap and
assume the feature is broken. The two cases that hurt most are the ones that
are not the driver's mistake:

- **An incident.** iRacing bumps `PlayerCarMyIncidentCount`; the lap is dead
  from that frame, silently.
- **Leaving the garage or the pit box.** Every out-lap is invalid by
  construction, and on a fresh session it is the _first_ thing the driver
  sees — a progress bar that was never going to produce anything.

## 2. Outcome

This change is done when, with no reference lap loaded:

- The moment the lap in progress becomes unpromotable, the progress bar is
  replaced by a short message naming the cause.
- An out-lap (left the garage, left the pit box, joined mid-session) is
  reported as an out-lap from its first frame, not as a generic failure.
- The message clears and the progress bar returns at 0% when the next lap
  starts.
- The cause is reported for both iRacing and Le Mans Ultimate, using each
  sim's own signals, with no invented reasons where a sim reports none.
- The widget's behaviour with a reference lap loaded is unchanged.

Explicit non-goals: no change to what gets promoted, no change to the trace
itself, no new user-facing setting, no message when a reference lap already
exists (the plot is more useful than the notice).

## 3. Where validity is decided today

Every site that clears `isCleanLap`, in
[`LapTraceStore.tsx`](../src/frontend/context/LapTraceStore/LapTraceStore.tsx).
These are the only places the new reason has to be attached — there is no
other definition of validity in the codebase.

| Line                                                                         | Condition                                                           | What really happened                                |
| ---------------------------------------------------------------------------- | ------------------------------------------------------------------- | --------------------------------------------------- |
| [567-573](../src/frontend/context/LapTraceStore/LapTraceStore.tsx#L567-L573) | first frame: `atLine && isOnTrack && !onPitRoad`                    | Joined mid-lap, in the pits, or not on track        |
| [600](../src/frontend/context/LapTraceStore/LapTraceStore.tsx#L600)          | position jump                                                       | Active Reset, tow, or replay scrub                  |
| [704-710](../src/frontend/context/LapTraceStore/LapTraceStore.tsx#L704-L710) | crossing: `isOnTrack && !onPitRoad`                                 | Lap _started_ on pit road or off track — an out-lap |
| [716-719](../src/frontend/context/LapTraceStore/LapTraceStore.tsx#L716-L719) | `onPitRoad` / `!isOnTrack` / `incidentCount > incidentCountAtStart` | Pitted, left the world, or picked up an incident    |
| [734-737](../src/frontend/context/LapTraceStore/LapTraceStore.tsx#L734-L737) | `pushed === 'backward'`                                             | Spun / went backwards along the track               |
| [734-737](../src/frontend/context/LapTraceStore/LapTraceStore.tsx#L734-L737) | `pushed === 'full'`                                                 | Lap longer than the sample buffer holds             |
| [741](../src/frontend/context/LapTraceStore/LapTraceStore.tsx#L741)          | `pushed === 'gap'`                                                  | Teleport: not every metre was driven                |

Note the line-716 condition collapses three distinct causes into one
assignment. Splitting it is most of the work in §5.1.

## 4. Decisions

### 4.1 The reason is recorded where it happens, not re-derived

Add `invalidReason: LapInvalidReason | null` to `ActiveLap` and set it at each
site in the table above. Re-deriving the cause from live telemetry in the
widget would be wrong: by the time the frontend looks, the car may be back on
track with no incident pending, and the lap would read as clean when the
recorder has already written it off.

### 4.2 First cause wins, and it is sticky for the lap

Once `invalidReason` is non-null, later frames do not overwrite it. A driver
who takes an incident at turn 2 and then pits should be told about the
incident — that is the thing they can do something about. `resetActiveLap`
clears it back to `null` (or to the lap-start reason, §5.1), so the message
lives exactly as long as the lap does.

### 4.3 Out-lap is a lap-start classification, not a mid-lap event

`onPitRoad` at the _start_ of a lap means an out-lap; `onPitRoad` _during_ a
lap means the driver pitted. Same telemetry bit, two different messages, and
the driver reads them very differently. The distinction falls out of which
call site fires: the `resetActiveLap` callers (lines 567, 600, 704) classify
lap start, the line-716 block classifies mid-lap.

`!isOnTrack` at lap start covers the garage exit specifically — iRacing
reports `IsOnTrack` false in the garage, and LMU maps it from `inRealtime`
([`mapTelemetry.ts:644`](../src/app/lmu/mapTelemetry.ts#L644)).

### 4.4 LMU reports invalidation, not a reason — say only what it knows

LMU publishes no incident count. `mapLmuTelemetry` hard-codes
`PlayerCarMyIncidentCount = 0`
([`mapTelemetry.ts:327`](../src/app/lmu/mapTelemetry.ts#L327)), so the incident
branch can never fire under LMU and an LMU driver currently gets a lap marked
clean through a four-wheels-off.

What LMU _does_ publish is `mLapInvalidated`, already surfaced by the native
addon as `lapInvalidated`
([`lmu_node.cc:419`](../src/app/lmu/native/lmu_node.cc#L419),
[`index.d.ts:119`](../src/app/lmu/native/index.d.ts#L119)) and already consumed
by [`trackMap.ts`](../src/app/lmu/trackMap.ts). It is a bare boolean: the sim
says the lap is void, not why. The message must reflect that honestly —
"Lap invalidated by the sim" — rather than guessing at a track-limits cut.

Pit road, garage and position-jump reasons are sim-agnostic and work on LMU
unchanged, so an LMU out-lap is still reported as an out-lap.

### 4.5 Still a plain status, not an alarm

Slate text in the existing empty-state block, matching the prompt it replaces.
No red, no emoji (Phosphor only, per `AGENTS.md`), one optional small icon.
On a fresh session the very first thing shown will be "Out-lap", which is
correct and frequent — it must not look like an error.

## 5. Implementation

### 5.1 Store: carry the reason — `src/frontend/context/LapTraceStore/LapTraceStore.tsx`

Add the type next to the other lap-trace types (`src/types/`, so the widget can
import it without crossing a layer):

```ts
export type LapInvalidReason =
  | 'out-lap' // started from the garage or the pit box
  | 'partial-lap' // joined mid-lap; no start/finish crossing yet
  | 'reset' // Active Reset, tow, or replay scrub
  | 'pitted' // entered the pits mid-lap
  | 'off-world' // left the track surface entirely mid-lap
  | 'incident' // iRacing incident count rose
  | 'sim-invalidated' // LMU said so; no reason available
  | 'spin' // samples went backwards
  | 'discontinuity' // teleport — not every metre driven
  | 'too-long'; // lap exceeded the sample buffer
```

1. Add `invalidReason: LapInvalidReason | null` to `ActiveLap`
   ([line 141](../src/frontend/context/LapTraceStore/LapTraceStore.tsx#L141),
   beside `isCleanLap`) and to `createActiveLap()`
   ([line 336](../src/frontend/context/LapTraceStore/LapTraceStore.tsx#L336)).
2. Give `resetActiveLap` a `reason: LapInvalidReason | null` parameter and
   assign it alongside `lap.isCleanLap = isClean`
   ([line 375](../src/frontend/context/LapTraceStore/LapTraceStore.tsx#L375)).
   Invariant worth asserting in review: `isClean === (reason === null)`.
3. Update the three call sites:
   - **567** — `atLine ? null : 'partial-lap'`, except that `!isOnTrack` or
     `onPitRoad` at the line means `'out-lap'`.
   - **600** — `'reset'`.
   - **704** — `onPitRoad || !isOnTrack ? 'out-lap' : null`.
4. Split the line-716 block so each cause is named, and make it sticky:

```ts
if (lap.isCleanLap) {
  const reason: LapInvalidReason | null =
    incidentCount > lap.incidentCountAtStart
      ? 'incident'
      : simLapInvalidated
        ? 'sim-invalidated'
        : onPitRoad
          ? 'pitted'
          : !isOnTrack
            ? 'off-world'
            : null;
  if (reason) invalidate(lap, reason);
}
```

Incident is tested first: an incident that _causes_ a trip through the pits is
the cause worth reporting.

5. Lines 734-741: `'spin'` for `'backward'`, `'too-long'` for `'full'`,
   `'discontinuity'` for `'gap'`.
6. Add the local helper that names the cause once:

```ts
function invalidate(lap: ActiveLap, reason: LapInvalidReason): void {
  if (lap.invalidReason) return; // first cause wins (§4.2)
  lap.isCleanLap = false;
  lap.invalidReason = reason;
}
```

### 5.2 Store: make the transition visible to React

**This is the part that will silently not work if it is skipped.** `ActiveLap`
is mutated in place and republished only every `NOTIFY_INTERVAL_M = 5` metres
([lines 101](../src/frontend/context/LapTraceStore/LapTraceStore.tsx#L101),
[755-757](../src/frontend/context/LapTraceStore/LapTraceStore.tsx#L755-L757)).
A car sitting in the garage or stopped in the pit box covers no distance, so
the two cases this feature exists for are exactly the two that would never
reach the UI.

In `collectPlayerFrame`, capture `lap.invalidReason` before the invalidation
logic and `set({ activeLap: lap })` unconditionally if it changed — including
the change back to `null` at a lap boundary. That is one extra store write per
lap, against 60 frames a second, so there is no hot-path cost to measure.

Then expose a selector returning a primitive, which works with Zustand's
default equality (the same trick `useLapTraceRecordingProgress` relies on —
the `activeLap` reference never changes, so an object-returning selector would
never re-render):

```ts
export const useLapTraceInvalidReason = (): LapInvalidReason | null =>
  useLapTraceStore((s) => s.activeLap?.invalidReason ?? null);
```

Export from [`src/frontend/context/index.ts`](../src/frontend/context/index.ts).

### 5.3 Processor: carry LMU's flag — `src/app/`

1. [`src/types/telemetry.ts`](../src/types/telemetry.ts): add
   `LmuLapInvalidated?: TelemetryVar<boolean[]>` to the `Lmu*` optional block
   (lines 6-28), with a comment that the sim gives no reason with it.
2. [`mapTelemetry.ts`](../src/app/lmu/mapTelemetry.ts): publish it from
   `raw.lapInvalidated`, near the other player fields (~line 327). Leave
   `PlayerCarMyIncidentCount` at 0 — this is the replacement signal, not a
   synthetic incident count.
3. [`LapTraceSampleProcessor.ts`](../src/app/processors/LapTraceSampleProcessor.ts):
   add `simLapInvalidated: boolean` to `defaults()` (line 27) and read it in
   `onFrame` via the existing `booleanValue(frame, 'LmuLapInvalidated')`
   (line 101 area), following the established `changed = this.set(...) || changed`
   pattern so it participates in version bumping.
4. [`channel.ts:86-119`](../src/types/channels/channel.ts#L86-L119): add
   `simLapInvalidated: boolean` to `LapTraceSampleSnapshot`, documented as
   "LMU's own lap-void flag; always false under iRacing, which reports
   incidents through `incidentCount` instead."

iRacing needs no producer change: `booleanValue` on an absent key already
yields `false`.

### 5.4 Widget — `src/frontend/components/LapTrace/LapTrace.tsx`

Add a message map in a new `invalidLapMessage.ts` beside the component (pure,
unit-testable, no JSX):

| Reason            | Message                                              |
| ----------------- | ---------------------------------------------------- |
| `out-lap`         | `Out-lap — this lap can't be recorded`               |
| `partial-lap`     | `Joined mid-lap — waiting for the start/finish line` |
| `reset`           | `Lap restarted after a reset`                        |
| `pitted`          | `Pit lap — this lap can't be recorded`               |
| `off-world`       | `Off track — this lap can't be recorded`             |
| `incident`        | `Incident — this lap can't be recorded`              |
| `sim-invalidated` | `Lap invalidated by the sim`                         |
| `spin`            | `Spin detected — this lap can't be recorded`         |
| `discontinuity`   | `Lap interrupted — this lap can't be recorded`       |
| `too-long`        | `Lap too long to record`                             |

Then in the `referenceLap ? … : (…)` empty state
([lines 226-245](../src/frontend/components/LapTrace/LapTrace.tsx#L226-L245)),
replace the bar — not the whole block — when a reason is present:

```tsx
{
  !referenceError &&
    trackLengthM > 0 &&
    (invalidReason ? (
      <span className="text-slate-400 text-[10px]">
        {invalidLapMessage(invalidReason)}
      </span>
    ) : (
      <>{/* existing bar + "Recording n%" */}</>
    ));
}
```

`referenceError` keeps precedence: a reference that failed to load is a
different and more serious problem than a scruffy lap.

The prompt above the bar ("Drive a clean lap to record a reference") stays as
the standing instruction; the line below it becomes the live status. Two short
lines read better here than one long one, and it keeps the block's height
stable, which matters in a widget the user has sized by hand.

## 6. Testing

Per `ARCHITECTURE_RULES` R14.1 and the Storybook requirement.

**`LapTraceStore.spec.ts`** — the meat of it. The store takes plain snapshot
objects, so each case is a short synthetic frame sequence:

- `incidentCount` rising mid-lap sets `'incident'` and clears `isCleanLap`.
- `onPitRoad` true at the crossing frame sets `'out-lap'`; `onPitRoad` true
  mid-clean-lap sets `'pitted'`.
- `isOnTrack` false at lap start sets `'out-lap'` (garage exit).
- First frame away from the line sets `'partial-lap'`.
- A position jump sets `'reset'`.
- `simLapInvalidated` sets `'sim-invalidated'`, **with `incidentCount` left at
  0 throughout** — this is the LMU shape and it must pass without an incident
  count.
- First cause wins: incident then pit stop still reports `'incident'`.
- A crossing into a clean lap clears the reason to `null`.
- **A frame that invalidates while the car is stationary republishes the
  store** (guards §5.2 — assert via a `subscribe` spy, not via distance).

**`LapTraceSampleProcessor.spec.ts`** — `LmuLapInvalidated` maps through and
bumps `version`; an absent key yields `false`.

**`mapTelemetry.spec.ts`** — `lapInvalidated` reaches `LmuLapInvalidated`.

**`LapTrace.spec.tsx`** — with no reference: a reason renders its message and
the progress bar is gone; no reason renders the bar; a `referenceError` still
wins; with a reference loaded, no message appears regardless of reason.

**`invalidLapMessage.spec.ts`** — exhaustive over the union (a
`satisfies Record<LapInvalidReason, string>` map makes a missing case a
compile error, but the test pins the strings).

**`LapTrace.stories.tsx`** — `InvalidLapIncident`, `InvalidLapOutLap`,
`InvalidLapSimInvalidated`, driven by seeding the store the way the existing
no-reference story does.

## 7. Risks

- **The notify gap (§5.2) is the one real trap.** Implemented without the
  forced republish, every test above still passes on a moving car and the
  feature is dead in the garage — the exact case this change exists for.
- **Out-lap will be the most-seen message**, since every session starts with
  one. If it reads as an error in practice, the fallback is to keep the
  progress bar visible and greyed with the reason beneath it, rather than
  replacing it. Decide from a real session, not from Storybook.
- **`'partial-lap'` on reconnect.** `useResetOnDisconnect` empties the store
  and the recorder re-bootstraps mid-lap
  ([`useLapTraceRecorder.ts:185-189`](../src/frontend/context/LapTraceStore/useLapTraceRecorder.ts#L185-L189)),
  so a reconnect on the back straight shows "Joined mid-lap". Accurate, and it
  resolves itself at the next line.
- **LMU `lapInvalidated` semantics are unverified against a live session.**
  Whether it latches for the lap or pulses needs checking on a tape before
  release. `invalidate()`'s first-cause-wins rule makes a pulse safe, but a
  flag that clears at the line and sets again immediately would flicker. The
  LMU replay harness ([`docs/LMU_RECORD_REPLAY.md`](./LMU_RECORD_REPLAY.md))
  is the cheap way to confirm.

## 8. Pre-PR checklist

```
[x] N1 — no fs access added
[x] N2 — no frontend → src/app/ imports (LapInvalidReason lives in src/types/)
[x] N3 — no cross-widget imports
[x] N4 — no new ipcMain handler
[x] R2.1/R2.2 — no new telemetry hook; booleans are not rounded
[x] R3.1 — reason lives on the existing activeLap, already covered by reset
[x] R4.1 — no new bridge
[x] R6.1 — no storage change
[x] R7.1 — no new widget
[x] R8.1/R8.2 — no settings change, so no migration
[x] R10.1 — lapInvalidated already read by the addon; no native change
[x] R11.1 — project logger only
[ ] R13.1 — confirm no measurable change in the 60 Hz path (one extra
      scalar compare per frame, one extra set() per lap)
[x] R14.1 — processor and selector specs listed in §6
[x] Storybook stories listed in §6
```

## 9. As built

Four departures from the plan above, all found while implementing:

**`resetActiveLap` takes the reason instead of a boolean.** The plan proposed
adding `reason` alongside the existing `isClean` parameter, and noted the
invariant `isClean === (reason === null)` as something for review to check.
Replacing the boolean outright removes the chance of them disagreeing: both
fields are now derived from one argument.

**A reset into the pit box reports `'out-lap'`, not `'reset'`.** A tow or an
Active Reset that lands the car in the pits leaves the driver on an out-lap,
which says more about what happens next than "a reset happened" does. A reset
elsewhere on track still reports `'reset'`.

**Lap-start classification moved into a `lapStartReason` helper**, shared by
the first-frame and start/finish-crossing call sites, with pit road and the
garage taking precedence over `'partial-lap'`.

**The widget spec and stories drive the real recorder** rather than writing
`invalidReason` into the store directly, so they exercise the classification
rules instead of restating them.

Two things worth knowing that the plan did not anticipate:

- `MAX_SAMPLE_GAP_M` is 50 m, so on a 5 km track a 0.01 lap-fraction step
  between test frames lands exactly on the threshold and floating-point error
  tips it over into `'discontinuity'`. Test frames need a smaller step. The
  pre-existing "marks the lap dirty when the car teleports" case in
  `LapTraceStore.spec.ts` turns out to be invalidated by this gap rule rather
  than by the position-jump detector its comment describes.
- `src/app/lmu/native/lmu-tape-cadence.spec.ts` fails on this machine, on a
  clean tree as well as with these changes. It wants an LMU tape fixture that
  is not present locally. Unrelated to this work.
