# The Gantry — Design Spec

**Date:** 2026-03-20
**Status:** Approved for planning
**Branch:** `pitlane-test` → new feature branch

---

## Overview

The Gantry is a full 16:9 monitor overlay widget for iRDashies designed for race directors, broadcasters, and observers. It combines a full multi-class standings table, a real-time incident activity feed, and a per-lap gap chart into a single purpose-built overlay. It is not intended for use while driving — it is a spectator/director tool.

---

## Layout & Navigation

### Default View: Standings + Incidents

The default view splits the screen 50/50 horizontally:

- **Left panel (50%):** Full driver standings table grouped by car class
- **Right panel (50%):** Scrollable real-time incident activity feed

The split ratio is a starting point and can be adjusted after initial implementation.

### Tab Bar

A tab bar runs across the top of the overlay with two views:

1. **Standings & Incidents** (default)
2. **Lap Graph**

More views can be added in the future. The tab bar also contains the **Follow Driver** dropdown (top-right), which is visible in all views.

### Follow Driver

A dropdown in the tab bar selects a driver to follow. The standings table scrolls to keep the followed driver visible and highlights their row with an indigo outline. This is in addition to the existing amber player row highlight.

---

## Standings Panel

### Data Source

Uses the existing `useDriverStandings()` hook and `createStandings()` logic — no duplication of gap/interval/delta calculations.

### Columns

In display order:
| Column | Description |
|--------|-------------|
| P | Class position |
| # | Car number |
| Driver | Driver name (with status badges: DNF, repair, penalty, slowdown) |
| Tire | Tire compound (S/M/H/W) |
| iR | iRating |
| Pit | Pit status indicator |
| Gap | Gap to class leader |
| Int | Interval to car ahead |
| Best | Best lap time |
| Last | Last lap time |
| L-1 | Last lap delta |
| L-2 | 2 laps ago delta |
| L-3 | 3 laps ago delta |

Reuses existing cell components (`CarNumberCell`, `DriverNameCell`, `CompoundCell`, `PitStatusCell`, `DeltaCell`, `LapTimeDeltasCell`, etc.) where possible.

### Class Grouping

Drivers are grouped by car class with a colored class header row (matching class color) separating each group — identical to the existing standings widget.

### Row Styling

Inherits all styling from the existing standings widget:

- Alternating row backgrounds (`odd:bg-slate-800/70 even:bg-slate-900/70`)
- Player row: amber highlight (`bg-yellow-500/20 text-amber-300`)
- Followed driver row: indigo outline
- Lapped drivers: dimmed (`text-white/60`)
- Off-track drivers: dimmed
- Same theme color variable (`--bg-opacity`), compact mode padding, Lato font

---

## Incident Panel

### Purpose

A full activity feed showing all notable events during the session in reverse chronological order (newest first). Scrollable. Persisted across session restarts.

### Incident Types

| Type               | Detection Method                                               | Default Color |
| ------------------ | -------------------------------------------------------------- | ------------- |
| Pit Entry          | `CarIdxOnPitRoad` false → true                                 | Blue          |
| Off Track          | `CarIdxTrackSurface` → OffTrack(0), debounced 3 frames         | Yellow        |
| Slowdown / Penalty | `CarIdxSessionFlags` gains `Furled` bit                        | Orange        |
| Crash              | Speed < threshold km/h for N consecutive frames while on track | Red           |
| Black Flag / DQ    | `CarIdxSessionFlags` gains `Black` or `Disqualify` bit         | White/grey    |

### Incident Row

Each row shows:

- Type badge (color-coded)
- Car number + driver name
- Lap number
- Timestamp (session clock)
- Replay buttons: **-5s / -10s / -30s**

Replay buttons are **active only when iRacing is in replay mode** (`IsReplayPlaying` telemetry value). In live mode they are visually disabled with a "Live mode — replay unavailable" label.

### Replay Behavior

Clicking a replay button calculates `targetFrame = incident.replayFrameNum - (60 * seconds)` and calls:

1. `sdk.changeCameraNumber()` — focus camera on the incident car
2. `sdk.changeReplayPosition()` — seek to the calculated frame

### Filters

- **Incident type chips:** Toggle each type on/off. All on by default.
- **Driver dropdown:** Filter to a specific driver. "All" by default.

Both filters are combined (AND logic): a row must match both the active type filter and the driver filter to appear.

### Incident Cap

Maximum 500 incidents stored in memory. Oldest trimmed when exceeded.

### Per-Type Cooldown

5-second cooldown per car per incident type to prevent duplicate events from bouncing state.

---

## Incident Detection Engine

Runs in the Electron main process at 25Hz. Processes telemetry alongside the existing pipeline so incidents are captured even when The Gantry overlay is not open.

### Per-Car State

```typescript
{
  prevTrackSurface: number,
  prevSessionFlags: number,
  prevOnPitRoad: boolean,
  prevLapDistPct: number,
  prevSessionTime: number,
  speedHistory: number[],       // 5-sample rolling window (km/h)
  currentSpeed: number,         // moving average
  slowFrameCount: number,       // consecutive frames below slow threshold
  offTrackFrameCount: number,   // consecutive frames off track
  lastIncidentTime: Record<IncidentType, number>  // cooldown tracking
}
```

### Speed Calculation

Identical to `CarSpeedsStore`:

```
distancePct = currentLapDistPct - prevLapDistPct (wrap-around handled)
distance = trackLength * distancePct
speed = (distance / deltaTime) * 3.6  // km/h
```

### Crash / Slow on Track Detection

Two triggers (both require car to be `OnTrack`, NOT on pit road):

1. **Sustained slow:** `avgSpeed < slowSpeedThreshold` for `slowFrameCount >= slowFrameThreshold` consecutive frames
2. **Sudden stop:** Car was `> suddenStopFromSpeed` km/h and drops below `suddenStopToSpeed` km/h within `suddenStopFrames` frames

### Exclusions

- Pace car (`CarIsPaceCar`)
- Spectators
- Cars `NotInWorld (-1)`, `ApproachingPits (2)`, or `InPitStall (1)` — excluded from crash detection only

---

## Configurable Incident Thresholds

All exposed in the dashboard settings panel under The Gantry widget settings:

| Setting                   | Default   | Description                                           |
| ------------------------- | --------- | ----------------------------------------------------- |
| Slow speed threshold      | 15 km/h   | Speed below which a car is considered stopped/crashed |
| Slow frame count          | 10 frames | Consecutive slow frames before crash event fires      |
| Sudden stop: from speed   | 80 km/h   | Speed car must be above before the drop               |
| Sudden stop: to speed     | 20 km/h   | Speed car must drop below to trigger                  |
| Sudden stop: frame window | 3 frames  | Window in which the drop must occur                   |
| Off-track debounce        | 3 frames  | Consecutive off-track frames before event fires       |
| Per-type cooldown         | 5 seconds | Minimum time between same event type for same car     |

---

## Incident Persistence

Incidents are stored to disk via `src/app/storage/incidentStorage.ts`:

- Keyed by `SubSessionId` (unique per iRacing session)
- JSON file per session
- Appended incrementally on each new incident (not full rewrite)
- Last 10 sessions retained; older files pruned automatically
- Loaded by `RaceControlBridge` on startup if a file matches the current session ID
- Frontend receives full restored list transparently via `getIncidents()` on mount — no frontend changes needed

---

## Lap Graph View

### Purpose

A line chart showing each driver's gap to their class leader over race laps. Useful for visualising battles, pit strategies, and session trends.

### Data Source

`LapGapStore` — a new Zustand store that snapshots each car's gap-to-class-leader at lap completion. Stores `Map<carIdx, number[]>` where index = lap number. Resets on session change.

### Chart Design

Custom SVG line chart (no external library):

- **X-axis:** Lap number
- **Y-axis:** Gap to class leader in seconds (leader always at 0)
- **Lines:** One per car, colored by car class
- **Tooltip on hover:** Shows driver name, car number, gap value
- Clean grid lines, axis labels matching overlay typography

### Class Filter

Dropdown to select which class to display. Defaults to the class with the most cars (or the player's class if applicable).

---

## Mouse Interaction

All overlays are click-through by default (`setIgnoreMouseEvents(true)`). The Gantry requires full mouse interaction:

- Tab switching
- Follow driver dropdown
- Incident type filter chips
- Driver filter dropdown
- Replay buttons
- Scroll in standings and incident list

**Implementation:** Follow the pattern used by existing interactive overlays (fuel calculator, settings panel) — to be confirmed during Phase 7 implementation by reviewing how `setIgnoreMouseEvents` is toggled in the main process window management code.

---

## IPC Bridge Architecture

New `RaceControlBridge` following the `fuelCalculatorBridge` / `pitLaneBridge` pattern:

```typescript
interface RaceControlBridge {
  getIncidents: () => Promise<Incident[]>;
  onIncident: (cb: (incident: Incident) => void) => () => void; // returns cleanup fn
  replayIncident: (incident: Incident, seconds: number) => Promise<void>;
  clearIncidents: () => Promise<void>;
}
```

Exposed via `contextBridge.exposeInMainWorld('raceControlBridge', ...)` in `rendererExposeBridge.ts`.

---

## Widget Registration

- Widget key: `gantry`
- Config type: `GantryConfig extends BaseWidgetSettings`
- Registered in `WidgetIndex.tsx`
- Default config in `defaultDashboard.ts`
- Settings component: `Settings/sections/GantrySettings.tsx` using `BaseSettingsSection`

---

## Implementation Phases

| Phase | Scope                     | Key Files                                                                                     |
| ----- | ------------------------- | --------------------------------------------------------------------------------------------- |
| 1     | Types & interfaces        | `src/types/raceControl.ts`, `src/interface.d.ts`                                              |
| 2     | Incident detection engine | `src/app/services/incidentDetector.ts` + unit tests                                           |
| 3     | Incident persistence      | `src/app/storage/incidentStorage.ts` + unit tests                                             |
| 4     | Race control bridge       | `raceControlBridge.ts`, `rendererExposeBridge.ts`, `main.ts`                                  |
| 5     | Frontend incident store   | `RaceControlStore.ts`, `useRaceControlBridge.ts`                                              |
| 6     | Lap gap store             | `LapGapStore.ts`                                                                              |
| 7     | Gantry widget shell       | `Gantry.tsx`, `WidgetIndex.tsx`, `widgetConfigs.ts`, `defaultDashboard.ts`, mouse interaction |
| 8     | Gantry settings panel     | `GantrySettings.tsx`                                                                          |
| 9     | Standings panel           | `GantryStandings.tsx` + follow-driver feature + Storybook                                     |
| 10    | Incidents panel           | `GantryIncidents.tsx` + filters + replay controls + Storybook                                 |
| 11    | Lap graph view            | `LapGapChart.tsx` (custom SVG) + `LapGraphView.tsx` + Storybook                               |

---

## Key Existing Code to Reuse

| Resource                                                      | Location                                    | Used For               |
| ------------------------------------------------------------- | ------------------------------------------- | ---------------------- |
| `useDriverStandings()`                                        | `Standings/hooks/`                          | Standings data         |
| `createStandings()`                                           | `Standings/createStandings.ts`              | Gap/delta calculations |
| Cell components                                               | `Standings/components/DriverInfoRow/cells/` | Standings rendering    |
| Speed calc pattern                                            | `CarSpeedStore/CarSpeedsStore.tsx`          | Crash detection        |
| `getCurrentBridge()` / `onBridgeChanged()`                    | `app/bridge/iracingSdk/setup.ts`            | Backend wiring         |
| `IRacingSDK.changeCameraNumber()` / `.changeReplayPosition()` | `app/irsdk/node/irsdk-node.ts`              | Replay commands        |
| `TrackLocation`, `GlobalFlags`, `ReplayPositionCommand` enums | `app/irsdk/types/enums.ts`                  | Detection logic        |
| `BaseSettingsSection`                                         | `Settings/`                                 | Settings panel         |
| Bridge exposure pattern                                       | `app/bridge/rendererExposeBridge.ts`        | IPC exposure           |
| Storage pattern                                               | `app/storage/`                              | Persistence            |

---

## Known Constraints & Notes

1. **ReplayFrameNum precision:** Telemetry at 25Hz, replay at 60fps — frame offsets are approximate but acceptable for a broadcast tool.
2. **Crash false positives in hairpins:** Mitigated by requiring sustained slow speed (frame count threshold) rather than instantaneous detection. Tunable via settings.
3. **Multi-class lap graph:** All classes on one graph risks visual clutter. Class filter mitigates this.
4. **No existing chart library:** Custom SVG chart keeps zero new dependencies.
5. **Mouse interaction pattern:** Must follow existing app convention — verify during Phase 7.
