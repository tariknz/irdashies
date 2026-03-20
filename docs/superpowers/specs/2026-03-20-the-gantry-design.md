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

**Important:** `useDriverStandings()` accepts a settings config that controls whether gap, interval, and lap deltas are computed. The Gantry must pass a fixed config with gap, interval, and all lap delta columns explicitly enabled — do not rely on user settings for these always-on columns.

### Columns

In display order:

| Column | Description                    | Cell Component                                                                                                 |
| ------ | ------------------------------ | -------------------------------------------------------------------------------------------------------------- |
| P      | Class position                 | `PositionCell` (existing)                                                                                      |
| #      | Car number                     | `CarNumberCell` (existing)                                                                                     |
| Driver | Driver name with status badges | `DriverNameCell` (existing)                                                                                    |
| Tire   | Tire compound (S/M/H/W)        | `CompoundCell` (existing)                                                                                      |
| iR     | Raw iRating value              | **New `IratingCell`** — reads `driver.rating`; `IratingChangeCell` shows change only and cannot be reused here |
| Pit    | Pit status indicator           | `PitStatusCell` (existing)                                                                                     |
| Gap    | Gap to class leader            | `DeltaCell` (existing)                                                                                         |
| Int    | Interval to car ahead          | `DeltaCell` (existing)                                                                                         |
| Best   | Best lap time                  | `FastestTimeCell` (existing)                                                                                   |
| Last   | Last lap time                  | `LastTimeCell` (existing)                                                                                      |
| L-1    | Last lap delta                 | `LapTimeDeltasCell` (existing)                                                                                 |
| L-2    | 2 laps ago delta               | `LapTimeDeltasCell` (existing)                                                                                 |
| L-3    | 3 laps ago delta               | `LapTimeDeltasCell` (existing)                                                                                 |

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

1. `sdk.changeCameraNumber(incident.carIdx, 0, 0)` — focus camera on the incident car using current camera group and camera (pass `0, 0` to use defaults)
2. `sdk.changeReplayPosition(ReplayPositionCommand.Begin, targetFrame)` — seek to the calculated frame

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

### Integration Point

The `IncidentDetector` is instantiated inside `setupRaceControlBridge()` which is called from `main.ts` after existing bridge setups. It subscribes to both callbacks from `getCurrentBridge()`:

- `onTelemetry(telemetry)` → calls `detector.processTelemetry(telemetry, cachedTrackLength)`
- `onSession(session)` → calls `detector.updateSession(session)` AND updates `cachedTrackLength`

`cachedTrackLength` is a local variable in `setupRaceControlBridge()` updated on each session event. This mirrors how `CarSpeedsStore` handles track length in the frontend.

**Track length parsing:** `session.WeekendInfo.TrackLength` is a string like `"5.12 km"`. The bridge must parse this to meters: `parseFloat(trackLengthStr) * 1000`. This parsing logic is duplicated from the frontend — create a shared utility or inline it in the bridge.

### Per-Car State

```typescript
interface CarIncidentState {
  prevTrackSurface: number;
  prevSessionFlags: number;
  prevOnPitRoad: boolean;
  prevLapDistPct: number;
  prevSessionTime: number;
  speedHistory: number[]; // 5-sample rolling average window (km/h)
  currentAvgSpeed: number; // moving average of speedHistory
  recentRawSpeeds: number[]; // 5-sample raw speed window for sudden-stop detection
  slowFrameCount: number; // consecutive frames below slowSpeedThreshold
  offTrackFrameCount: number; // consecutive frames off track
  lastIncidentTime: Record<IncidentType, number>; // unix ms, for cooldown
}
```

`recentRawSpeeds` is a separate rolling window of raw (not averaged) per-frame speeds used to detect the sudden-stop condition across a `suddenStopFrames` window.

### Speed Calculation

Identical to `CarSpeedsStore`:

```
distancePct = currentLapDistPct - prevLapDistPct  // handle wrap-around: if < -0.5, add 1.0
distance = trackLength * distancePct              // meters
speed = (distance / deltaTime) * 3.6             // km/h
```

### Crash / Slow on Track Detection

Two triggers (both require car to be `OnTrack` surface === 3, NOT on pit road):

1. **Sustained slow:** 5-sample moving average `currentAvgSpeed < slowSpeedThreshold` for `slowFrameCount >= slowFrameThreshold` consecutive frames
2. **Sudden stop:** Check `recentRawSpeeds` — if the oldest sample in the window was `> suddenStopFromSpeed` AND the current raw speed is `< suddenStopToSpeed`, trigger. The window size is `suddenStopFrames`.

### `Incident` Type

```typescript
interface Incident {
  id: string; // uuid or `${carIdx}-${sessionTime}`
  carIdx: number;
  driverName: string;
  carNumber: string;
  teamName: string;
  sessionNum: number;
  sessionTime: number; // seconds into session
  lapNum: number; // CarIdxLap[carIdx] at time of incident
  replayFrameNum: number; // ReplayFrameNum.value[0] sampled at incident detection time
  type: IncidentType;
  lapDistPct: number;
  timestamp: number; // Date.now() — wall clock ms
  debug?: IncidentDebugSnapshot; // only populated when !app.isPackaged (dev mode)
}
```

`replayFrameNum` is read from `ReplayFrameNum` telemetry array at `value[0]` at the moment the incident is detected. This value is the current replay frame counter — it is valid in both live and replay sessions.

---

## Dev Mode Incident Diagnostics

When running in development mode (`!app.isPackaged` in the main process, equivalently `process.env.NODE_ENV === 'development'` in the renderer), each incident carries a `debug` snapshot and the Gantry incidents panel shows a **Log** button per row.

### `IncidentDebugSnapshot` Type

```typescript
interface IncidentDebugSnapshot {
  trigger:
    | 'sustained-slow'
    | 'sudden-stop'
    | 'off-track'
    | 'pit-entry'
    | 'black-flag'
    | 'slowdown-flag';
  evidence: string; // human-readable explanation, e.g. "avgSpeed 8.2 km/h < threshold 15 km/h for 12 frames (threshold: 10)"
  thresholds: {
    // snapshot of the threshold config at detection time
    slowSpeedThreshold: number;
    slowFrameThreshold: number;
    suddenStopFromSpeed: number;
    suddenStopToSpeed: number;
    suddenStopFrames: number;
    offTrackDebounce: number;
    cooldownSeconds: number;
  };
  carStateAtDetection: {
    // full per-car state at the moment of detection
    speedHistory: number[];
    currentAvgSpeed: number;
    recentRawSpeeds: number[];
    slowFrameCount: number;
    offTrackFrameCount: number;
    prevTrackSurface: number;
    prevSessionFlags: number;
    prevOnPitRoad: boolean;
    prevLapDistPct: number;
  };
  frameHistory: Array<{
    // last 10 raw speed samples leading up to detection
    speed: number;
    lapDistPct: number;
    trackSurface: number;
    sessionTime: number;
  }>;
}
```

### Log Button Behaviour

- Visible only when `process.env.NODE_ENV === 'development'`
- Clicking calls `navigator.clipboard.writeText(JSON.stringify(incident.debug, null, 2))`
- The button label is **"Log"** with a copy icon (Phosphor `Copy` icon)
- A brief visual confirmation ("Copied!") replaces the label for 1.5s after click
- If `incident.debug` is absent (production build), the button is not rendered

### `frameHistory` Collection

The `IncidentDetector` maintains a per-car circular buffer of the last 10 raw telemetry frames (speed, lapDistPct, trackSurface, sessionTime). In dev mode only (`isDev` flag passed to the detector on construction), this buffer is attached to the `debug` snapshot at detection time. In production the buffer is not allocated, keeping the main process memory footprint identical to today.

### Output Format

Pretty-printed JSON (`JSON.stringify(debug, null, 2)`). Example output for a sustained-slow crash:

```json
{
  "trigger": "sustained-slow",
  "evidence": "avgSpeed 8.2 km/h < threshold 15 km/h for 12 consecutive frames (threshold: 10)",
  "thresholds": {
    "slowSpeedThreshold": 15,
    "slowFrameThreshold": 10,
    "suddenStopFromSpeed": 80,
    "suddenStopToSpeed": 20,
    "suddenStopFrames": 3,
    "offTrackDebounce": 3,
    "cooldownSeconds": 5
  },
  "carStateAtDetection": {
    "speedHistory": [9.1, 8.8, 8.5, 8.3, 8.2],
    "currentAvgSpeed": 8.58,
    "recentRawSpeeds": [9.1, 8.8, 8.5],
    "slowFrameCount": 12,
    "offTrackFrameCount": 0,
    "prevTrackSurface": 3,
    "prevSessionFlags": 0,
    "prevOnPitRoad": false,
    "prevLapDistPct": 0.4821
  },
  "frameHistory": [
    {
      "speed": 45.2,
      "lapDistPct": 0.478,
      "trackSurface": 3,
      "sessionTime": 1823.4
    },
    {
      "speed": 28.1,
      "lapDistPct": 0.4795,
      "trackSurface": 3,
      "sessionTime": 1823.44
    },
    {
      "speed": 15.3,
      "lapDistPct": 0.4803,
      "trackSurface": 3,
      "sessionTime": 1823.48
    },
    {
      "speed": 9.1,
      "lapDistPct": 0.481,
      "trackSurface": 3,
      "sessionTime": 1823.52
    },
    {
      "speed": 8.8,
      "lapDistPct": 0.4815,
      "trackSurface": 3,
      "sessionTime": 1823.56
    }
  ]
}
```

This gives a clear picture of the speed history leading up to detection, which thresholds were active, and what evidence caused the trigger — enough to tune thresholds without needing to instrument the detector manually.

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
| Sudden stop: frame window | 3 frames  | `recentRawSpeeds` window size for sudden-stop check   |
| Off-track debounce        | 3 frames  | Consecutive off-track frames before event fires       |
| Per-type cooldown         | 5 seconds | Minimum time between same event type for same car     |

---

## Incident Persistence

Incidents are stored to disk via `src/app/storage/incidentStorage.ts`:

- Keyed by `SubSessionId` (unique per iRacing session)
- JSON file per session in the existing storage directory
- Appended incrementally on each new incident (not full rewrite)
- Last 10 sessions retained; older files pruned automatically on startup
- Loaded by `RaceControlBridge` on startup if a file matches the current session ID
- Frontend receives full restored list transparently via `getIncidents()` on mount — no frontend changes needed

**`clearIncidents()` behavior:** Clears the in-memory incident array AND deletes the current session's JSON file from disk. Subsequent `getIncidents()` calls return `[]` until new incidents arrive.

---

## Lap Graph View

### Purpose

A line chart showing each driver's gap to their class leader over race laps. Useful for visualising battles, pit strategies, and session trends.

### Data Source

`LapGapStore` — a new frontend Zustand store. Lap completion is detected per car by watching for `CarIdxLap[carIdx]` incrementing (same pattern as `ReferenceLapStore` which uses `lastTrackedPct > 0.95 && trackPct < 0.05` — either approach is valid; prefer `CarIdxLap` increment as it is more direct). At lap completion, the store reads the current gap-to-class-leader from the live standings data and snapshots it.

Data structure: `Record<carIdx, number[]>` where the array index is lap number and the value is gap in seconds. The class leader's gap is always 0. Resets on session change.

### Chart Design

Custom SVG line chart (no external library):

- **X-axis:** Lap number
- **Y-axis:** Gap to class leader in seconds (leader always at 0)
- **Lines:** One per car, colored by car class
- **Tooltip on hover:** Shows driver name, car number, gap value
- Clean grid lines, axis labels matching overlay typography

### Class Filter

Dropdown to select which class to display. Defaults to the player's class if the player is in the session, otherwise the class with the most cars.

---

## Mouse Interaction

`WidgetContainer` hard-codes `pointer-events-none` on all widget children, and all overlay windows use `setIgnoreMouseEvents(true)` by default. The Gantry requires full mouse interaction for tabs, dropdowns, filter chips, replay buttons, and scrollable lists.

**Two-layer fix required in Phase 7:**

1. **Electron window layer:** Add an `interactive: true` flag to `GantryConfig`. The window manager checks this flag when creating/configuring the overlay window and calls `setIgnoreMouseEvents(false)` for interactive widgets. Investigate `overlayManager` and `WidgetContainer` during Phase 7 to confirm the exact hook point.

2. **CSS layer:** `WidgetContainer` must support an `interactive` prop that removes `pointer-events-none` from the wrapper div when `true`. Gantry passes `interactive={true}`.

This two-layer change must be confirmed against the actual `WidgetContainer` and overlay manager code during Phase 7 before proceeding with interactive elements.

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

### IPC Channels

| Channel                      | Direction                | Handler                     |
| ---------------------------- | ------------------------ | --------------------------- |
| `raceControl:getIncidents`   | renderer → main (invoke) | Returns full incident array |
| `raceControl:incident`       | main → renderer (push)   | New incident payload        |
| `raceControl:replayIncident` | renderer → main (invoke) | Executes camera + seek      |
| `raceControl:clearIncidents` | renderer → main (invoke) | Clears memory + disk        |

**Push broadcast:** New incidents are broadcast to all renderer windows using `BrowserWindow.getAllWindows().forEach(win => win.webContents.send('raceControl:incident', incident))`. This is consistent with how other bridges push updates.

Exposed via `contextBridge.exposeInMainWorld('raceControlBridge', ...)` in `rendererExposeBridge.ts`.

### Storybook

Phase 5 must include mock data fixtures for `RaceControlStore` (a `RaceControlDecorator` analogous to `TelemetryDecorator`) so Phase 10's Storybook story for the incidents panel has a realistic data source.

---

## Widget Registration

- Widget key: `gantry`
- Config type: `GantryConfig extends BaseWidgetSettings` — includes all incident threshold settings and `interactive: true` flag
- Registered in `WidgetIndex.tsx`
- Default config in `defaultDashboard.ts`
- Settings component: `Settings/sections/GantrySettings.tsx` using `BaseSettingsSection`

---

## Implementation Phases

| Phase | Scope                                   | Key Files                                                                                                                                              |
| ----- | --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1     | Types & interfaces                      | `src/types/raceControl.ts`, `src/interface.d.ts`                                                                                                       |
| 2     | Incident detection engine               | `src/app/services/incidentDetector.ts` + unit tests; includes `frameHistory` circular buffer (dev mode only) and `IncidentDebugSnapshot` population    |
| 3     | Incident persistence                    | `src/app/storage/incidentStorage.ts` + unit tests                                                                                                      |
| 4     | Race control bridge                     | `raceControlBridge.ts`, `rendererExposeBridge.ts`, `main.ts`                                                                                           |
| 5     | Frontend incident store + mock fixtures | `RaceControlStore.ts`, `useRaceControlBridge.ts`, `RaceControlDecorator`                                                                               |
| 6     | Lap gap store                           | `LapGapStore.ts`                                                                                                                                       |
| 7     | Gantry widget shell + mouse interaction | `Gantry.tsx`, `WidgetIndex.tsx`, `widgetConfigs.ts`, `defaultDashboard.ts`, `WidgetContainer` interactive prop, overlay manager `setIgnoreMouseEvents` |
| 8     | Gantry settings panel                   | `GantrySettings.tsx`                                                                                                                                   |
| 9     | Standings panel                         | `GantryStandings.tsx`, new `IratingCell.tsx`, follow-driver feature, Storybook                                                                         |
| 10    | Incidents panel                         | `GantryIncidents.tsx` + filters + replay controls + dev-mode Log button (clipboard copy of `IncidentDebugSnapshot`) + Storybook                        |
| 11    | Lap graph view                          | `LapGapChart.tsx` (custom SVG) + `LapGraphView.tsx` + Storybook                                                                                        |

---

## Key Existing Code to Reuse

| Resource                                                      | Location                                    | Used For                        |
| ------------------------------------------------------------- | ------------------------------------------- | ------------------------------- |
| `useDriverStandings()`                                        | `Standings/hooks/`                          | Standings data                  |
| `createStandings()`                                           | `Standings/createStandings.ts`              | Gap/delta calculations          |
| Cell components                                               | `Standings/components/DriverInfoRow/cells/` | Standings rendering             |
| Speed calc pattern                                            | `CarSpeedStore/CarSpeedsStore.tsx`          | Crash detection in main process |
| `getCurrentBridge()` / `onBridgeChanged()`                    | `app/bridge/iracingSdk/setup.ts`            | Backend wiring                  |
| `IRacingSDK.changeCameraNumber()` / `.changeReplayPosition()` | `app/irsdk/node/irsdk-node.ts`              | Replay commands                 |
| `TrackLocation`, `GlobalFlags`, `ReplayPositionCommand` enums | `app/irsdk/types/enums.ts`                  | Detection logic                 |
| `BaseSettingsSection`                                         | `Settings/`                                 | Settings panel                  |
| Bridge exposure pattern                                       | `app/bridge/rendererExposeBridge.ts`        | IPC exposure                    |
| Storage pattern                                               | `app/storage/`                              | Persistence                     |
| `TelemetryDecorator` pattern                                  | Storybook decorators                        | `RaceControlDecorator` model    |

---

## Known Constraints & Notes

1. **ReplayFrameNum precision:** Telemetry at 25Hz, replay at 60fps — frame offsets are approximate but acceptable for a broadcast tool.
2. **Crash false positives in hairpins:** Mitigated by requiring sustained slow speed (frame count threshold) rather than instantaneous detection. Tunable via settings.
3. **Multi-class lap graph:** All classes on one graph risks visual clutter. Class filter mitigates this.
4. **No existing chart library:** Custom SVG chart keeps zero new dependencies.
5. **Mouse interaction is a two-layer problem:** Both the Electron window `setIgnoreMouseEvents` flag and the CSS `pointer-events-none` on `WidgetContainer` must be addressed. Verify exact hook points during Phase 7 before building interactive elements.
6. **Track length string parsing:** `WeekendInfo.TrackLength` is a string (e.g. `"5.12 km"`). Parse with `parseFloat(s) * 1000` for meters. This logic must exist in the main process for the incident detector — it currently only lives in the frontend.
7. **`IratingChangeCell` cannot be reused for raw iRating:** A new `IratingCell` component is required in Phase 9.
