# The Gantry — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build The Gantry, a full 16:9 overlay widget for iRDashies with real-time standings, a live incident activity feed, and a per-lap gap chart.

**Architecture:** Hook-reuse approach — `useDriverStandings()` provides standings data with no logic duplication; a new main-process `IncidentDetector` runs at 25Hz and emits typed `Incident` events via IPC to a `RaceControlStore` Zustand store; a new `LapGapStore` snapshots per-lap class-leader gaps; the Gantry shell routes between a 50/50 Standings+Incidents default view and a Lap Graph tab. Mouse interaction requires a two-layer fix (Electron window flag + WidgetContainer CSS).

**Tech Stack:** TypeScript 5.9, React 19, Zustand 5, Tailwind 4, Electron 35, Vitest 3, Storybook 10, Phosphor icons (`@phosphor-icons/react`)

**Spec:** `docs/superpowers/specs/2026-03-20-the-gantry-design.md`

---

## File Map

### New Files

| File                                                                                    | Responsibility                                                                                                                       |
| --------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| `src/types/raceControl.ts`                                                              | All shared types: `IncidentType`, `Incident`, `IncidentDebugSnapshot`, `CarIncidentState`, `IncidentThresholds`, `RaceControlBridge` |
| `src/app/services/incidentDetector.ts`                                                  | `IncidentDetector` class — 25Hz per-car state tracking, 5 detectors, dev-mode debug snapshots                                        |
| `src/app/services/incidentDetector.spec.ts`                                             | Unit tests for all detection logic                                                                                                   |
| `src/app/storage/incidentStorage.ts`                                                    | `loadIncidents`, `appendIncident`, `clearIncidents`, `pruneOldSessions`                                                              |
| `src/app/storage/incidentStorage.spec.ts`                                               | Unit tests for persistence operations                                                                                                |
| `src/app/bridge/raceControlBridge.ts`                                                   | `setupRaceControlBridge()` — wires detector + storage + IPC handlers                                                                 |
| `src/frontend/context/RaceControlStore/RaceControlStore.ts`                             | Zustand store: `incidents[]`, `typeFilters`, `driverFilter`, actions                                                                 |
| `src/frontend/context/RaceControlStore/useRaceControlBridge.ts`                         | Loads incidents on mount, subscribes to push events                                                                                  |
| `src/frontend/context/RaceControlStore/index.ts`                                        | Re-exports                                                                                                                           |
| `src/frontend/context/LapGapStore/LapGapStore.ts`                                       | Zustand store: per-lap gap-to-leader snapshots keyed by carIdx                                                                       |
| `src/frontend/context/LapGapStore/index.ts`                                             | Re-exports                                                                                                                           |
| `.storybook/raceControlDecorator.tsx`                                                   | Storybook decorator with mock incident data                                                                                          |
| `src/frontend/components/Gantry/Gantry.tsx`                                             | Top-level widget: tab state, 50/50 layout shell                                                                                      |
| `src/frontend/components/Gantry/Gantry.stories.tsx`                                     | Storybook story                                                                                                                      |
| `src/frontend/components/Gantry/components/GantryTabBar/GantryTabBar.tsx`               | Tab bar + Follow Driver dropdown                                                                                                     |
| `src/frontend/components/Gantry/components/GantryStandings/GantryStandings.tsx`         | Standings table using `useDriverStandings()`, all 13 columns, follow-driver scroll                                                   |
| `src/frontend/components/Gantry/components/GantryStandings/GantryStandings.stories.tsx` | Storybook story                                                                                                                      |
| `src/frontend/components/Gantry/components/GantryIncidents/IncidentRow.tsx`             | Single incident row: badge, driver info, lap, timestamp, replay buttons, dev Log button                                              |
| `src/frontend/components/Gantry/components/GantryIncidents/GantryIncidents.tsx`         | Incident panel: filter chips, driver dropdown, scrollable list                                                                       |
| `src/frontend/components/Gantry/components/GantryIncidents/GantryIncidents.stories.tsx` | Storybook story                                                                                                                      |
| `src/frontend/components/Gantry/components/LapGraph/LapGapChart.tsx`                    | Custom SVG line chart — polylines, grid, tooltips, hover dimming                                                                     |
| `src/frontend/components/Gantry/components/LapGraph/LapGraphView.tsx`                   | Lap graph tab: class filter, reads from LapGapStore, renders LapGapChart                                                             |
| `src/frontend/components/Gantry/components/LapGraph/LapGraphView.stories.tsx`           | Storybook story                                                                                                                      |
| `src/frontend/components/Settings/sections/GantrySettings.tsx`                          | Settings panel: 7 threshold inputs + session retention dropdown                                                                      |

### Modified Files

| File                                                          | Change                                                                   |
| ------------------------------------------------------------- | ------------------------------------------------------------------------ |
| `src/interface.d.ts`                                          | Add `raceControlBridge: RaceControlBridge` to `Window`                   |
| `src/main.ts`                                                 | Call `setupRaceControlBridge()`                                          |
| `src/app/bridge/rendererExposeBridge.ts`                      | Expose `raceControlBridge` via `contextBridge.exposeInMainWorld`         |
| `src/types/widgetConfigs.ts`                                  | Add `GantryConfig`, `GantryWidgetSettings`                               |
| `src/types/defaultDashboard.ts`                               | Add gantry default widget entry                                          |
| `src/frontend/WidgetIndex.tsx`                                | Register `gantry: Gantry`                                                |
| `src/frontend/context/index.ts`                               | Export new stores                                                        |
| `src/frontend/components/WidgetContainer/WidgetContainer.tsx` | Add `interactive?: boolean` prop, remove `pointer-events-none` when true |

---

## Task 1: Types & Interfaces

**Files:**

- Create: `src/types/raceControl.ts`
- Modify: `src/interface.d.ts`

- [ ] **Step 1: Create `src/types/raceControl.ts`**

```typescript
export enum IncidentType {
  PitEntry = 'PitEntry',
  OffTrack = 'OffTrack',
  Slowdown = 'Slowdown',
  Crash = 'Crash',
  BlackFlag = 'BlackFlag',
}

export interface IncidentThresholds {
  slowSpeedThreshold: number; // km/h, default 15
  slowFrameThreshold: number; // frames, default 10
  suddenStopFromSpeed: number; // km/h, default 80
  suddenStopToSpeed: number; // km/h, default 20
  suddenStopFrames: number; // frames, default 3
  offTrackDebounce: number; // frames, default 3
  cooldownSeconds: number; // seconds, default 5
}

export interface IncidentDebugSnapshot {
  trigger:
    | 'sustained-slow'
    | 'sudden-stop'
    | 'off-track'
    | 'pit-entry'
    | 'black-flag'
    | 'slowdown-flag';
  evidence: string;
  thresholds: IncidentThresholds;
  carStateAtDetection: {
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
    speed: number;
    lapDistPct: number;
    trackSurface: number;
    sessionTime: number;
  }>;
}

export interface Incident {
  id: string;
  carIdx: number;
  driverName: string;
  carNumber: string;
  teamName: string;
  sessionNum: number;
  sessionTime: number;
  lapNum: number;
  replayFrameNum: number;
  type: IncidentType;
  lapDistPct: number;
  timestamp: number;
  debug?: IncidentDebugSnapshot;
}

export interface CarIncidentState {
  prevTrackSurface: number;
  prevSessionFlags: number;
  prevOnPitRoad: boolean;
  prevLapDistPct: number;
  prevSessionTime: number;
  speedHistory: number[];
  currentAvgSpeed: number;
  recentRawSpeeds: number[]; // separate rolling window for sudden-stop
  slowFrameCount: number;
  offTrackFrameCount: number;
  lastIncidentTime: Record<string, number>; // IncidentType → timestamp ms
}

export interface RaceControlBridge {
  getIncidents: () => Promise<Incident[]>;
  onIncident: (cb: (incident: Incident) => void) => () => void;
  replayIncident: (incident: Incident, seconds: number) => Promise<void>;
  clearIncidents: () => Promise<void>;
  updateThresholds: (thresholds: IncidentThresholds) => Promise<void>;
  updateRetention: (retention: 'all' | 5 | 10 | 20) => Promise<void>;
}
```

- [ ] **Step 2: Add `raceControlBridge` to `src/interface.d.ts`**

Open `src/interface.d.ts`. It currently has entries for `irsdkBridge`, `dashboardBridge`, etc. Add:

```typescript
import type { RaceControlBridge } from './types/raceControl';

declare global {
  interface Window {
    // ... existing entries ...
    raceControlBridge: RaceControlBridge;
  }
}
```

- [ ] **Step 3: Verify TypeScript compiles with no errors**

```bash
npm run lint
```

Expected: no errors related to the new types.

- [ ] **Step 4: Commit**

```bash
git add src/types/raceControl.ts src/interface.d.ts
git commit -m "feat: add raceControl types and interfaces"
```

---

## Task 2: Incident Detection Engine — Speed & State

**Files:**

- Create: `src/app/services/incidentDetector.ts`
- Create: `src/app/services/incidentDetector.spec.ts`

Read `src/app/bridge/iracingSdk/setup.ts` and `src/app/irsdk/types/enums.ts` before starting — you need `TrackLocation` enum values and the telemetry/session data shapes.

- [ ] **Step 1: Write failing tests for speed calculation**

Create `src/app/services/incidentDetector.spec.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { IncidentDetector } from './incidentDetector';
import type { IncidentThresholds } from '../../types/raceControl';

const defaultThresholds: IncidentThresholds = {
  slowSpeedThreshold: 15,
  slowFrameThreshold: 10,
  suddenStopFromSpeed: 80,
  suddenStopToSpeed: 20,
  suddenStopFrames: 3,
  offTrackDebounce: 3,
  cooldownSeconds: 5,
};

describe('IncidentDetector - speed calculation', () => {
  it('calculates speed from lapDistPct delta and track length', () => {
    const detector = new IncidentDetector(defaultThresholds, false);
    // 0.001 pct * 5000m = 5m in 0.04s (25Hz) → 125 m/s → 450 km/h
    const speed = detector.calculateSpeed(0.5, 0.501, 0.04, 5000);
    expect(speed).toBeCloseTo(450, 0);
  });

  it('handles lap wrap-around (lapDistPct 0.99 → 0.01)', () => {
    const detector = new IncidentDetector(defaultThresholds, false);
    const speed = detector.calculateSpeed(0.99, 0.01, 0.04, 5000);
    // distPct = 0.01 - 0.99 = -0.98, wrap-around: -0.98 + 1.0 = 0.02
    // 0.02 * 5000 = 100m / 0.04s = 2500 m/s * 3.6 = 9000 km/h (fast car at finish)
    expect(speed).toBeGreaterThan(0);
  });

  it('returns 0 for backwards movement (collision nudge)', () => {
    const detector = new IncidentDetector(defaultThresholds, false);
    const speed = detector.calculateSpeed(0.5, 0.499, 0.04, 5000);
    expect(speed).toBe(0);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm run test -- --no-coverage src/app/services/incidentDetector.spec.ts
```

Expected: FAIL — `incidentDetector.ts` does not exist yet.

- [ ] **Step 3: Create `src/app/services/incidentDetector.ts` with speed calculation**

```typescript
import type {
  Incident,
  IncidentThresholds,
  IncidentDebugSnapshot,
  CarIncidentState,
} from '../../types/raceControl';
import { IncidentType } from '../../types/raceControl';
import { TrackLocation, GlobalFlags } from '../irsdk/types/enums';

type IncidentListener = (incident: Incident) => void;

export class IncidentDetector {
  private carStates = new Map<number, CarIncidentState>();
  private listeners = new Set<IncidentListener>();
  private sessionDrivers: Map<
    number,
    { name: string; carNumber: string; teamName: string; isPaceCar: boolean }
  > = new Map();
  private isDev: boolean;

  constructor(
    private thresholds: IncidentThresholds,
    isDev: boolean
  ) {
    this.isDev = isDev;
  }

  updateThresholds(thresholds: IncidentThresholds) {
    this.thresholds = thresholds;
  }

  updateSession(session: unknown) {
    // Parse session data to populate sessionDrivers
    // Clear car states on new session
    this.carStates.clear();
    // TODO: parse session.DriverInfo.Drivers array
  }

  /** Exposed for testing. Returns speed in km/h. Returns 0 for backwards movement. */
  calculateSpeed(
    prevLapDistPct: number,
    currLapDistPct: number,
    deltaTime: number,
    trackLengthM: number
  ): number {
    if (deltaTime <= 0) return 0;
    let distPct = currLapDistPct - prevLapDistPct;
    if (distPct < -0.5) distPct += 1.0; // wrap-around
    if (distPct <= 0) return 0;
    const distanceM = trackLengthM * distPct;
    return (distanceM / deltaTime) * 3.6;
  }

  onIncident(cb: IncidentListener) {
    this.listeners.add(cb);
    return () => this.listeners.delete(cb);
  }

  processTelemetry(_telemetry: unknown, _trackLengthM: number) {
    // Implemented in subsequent tasks
  }

  private emit(incident: Incident) {
    this.listeners.forEach((cb) => cb(incident));
  }
}
```

- [ ] **Step 4: Run tests to verify speed calculations pass**

```bash
npm run test -- --no-coverage src/app/services/incidentDetector.spec.ts
```

Expected: speed calculation tests PASS.

- [ ] **Step 5: Add test for session change clearing state**

```typescript
describe('session transitions', () => {
  it('clears car states when session updates', () => {
    const detector = new IncidentDetector(defaultThresholds, false);
    // Manually inject state
    (detector as any).carStates.set(0, { slowFrameCount: 5 });
    detector.updateSession({ DriverInfo: { Drivers: [] } });
    expect((detector as any).carStates.size).toBe(0);
  });
});
```

- [ ] **Step 6: Implement `updateSession` properly**

```typescript
updateSession(session: { DriverInfo?: { Drivers?: Array<{ CarIdx: number; UserName: string; CarNumber: string; TeamName: string; CarIsPaceCar: number }> } }) {
  this.carStates.clear();
  this.sessionDrivers.clear();
  session.DriverInfo?.Drivers?.forEach(d => {
    this.sessionDrivers.set(d.CarIdx, {
      name: d.UserName,
      carNumber: d.CarNumber,
      teamName: d.TeamName,
      isPaceCar: d.CarIsPaceCar === 1,
    });
  });
}
```

- [ ] **Step 7: Run all tests**

```bash
npm run test -- --no-coverage src/app/services/incidentDetector.spec.ts
```

Expected: all PASS.

- [ ] **Step 8: Commit**

```bash
git add src/app/services/incidentDetector.ts src/app/services/incidentDetector.spec.ts
git commit -m "feat: add IncidentDetector with speed calculation and session management"
```

---

## Task 3: Incident Detection Engine — Detectors

**Files:**

- Modify: `src/app/services/incidentDetector.ts`
- Modify: `src/app/services/incidentDetector.spec.ts`

Before starting, read `src/app/irsdk/types/enums.ts` to get exact `TrackLocation` and `GlobalFlags` values.

- [ ] **Step 1: Add helper to get or create car state**

Add to `incidentDetector.ts`:

```typescript
private getOrCreateState(carIdx: number): CarIncidentState {
  if (!this.carStates.has(carIdx)) {
    this.carStates.set(carIdx, {
      prevTrackSurface: TrackLocation.OnTrack,
      prevSessionFlags: 0,
      prevOnPitRoad: false,
      prevLapDistPct: 0,
      prevSessionTime: 0,
      speedHistory: [],
      currentAvgSpeed: 0,
      recentRawSpeeds: [],
      slowFrameCount: 0,
      offTrackFrameCount: 0,
      lastIncidentTime: {} as Record<IncidentType, number>,
    });
  }
  return this.carStates.get(carIdx)!;
}

private isCoolingDown(state: CarIncidentState, type: IncidentType, nowMs: number): boolean {
  const last = state.lastIncidentTime[type] ?? 0;
  return (nowMs - last) < this.thresholds.cooldownSeconds * 1000;
}

private createIncidentBase(carIdx: number, telemetry: TelemetrySnapshot, type: IncidentType): Omit<Incident, 'debug'> {
  const driver = this.sessionDrivers.get(carIdx);
  return {
    id: `${carIdx}-${telemetry.sessionTime}`,
    carIdx,
    driverName: driver?.name ?? 'Unknown',
    carNumber: driver?.carNumber ?? '?',
    teamName: driver?.teamName ?? '',
    sessionNum: telemetry.sessionNum,
    sessionTime: telemetry.sessionTime,
    lapNum: telemetry.carIdxLap[carIdx] ?? 0,
    replayFrameNum: telemetry.replayFrameNum,
    type,
    lapDistPct: telemetry.carIdxLapDistPct[carIdx] ?? 0,
    timestamp: Date.now(),
  };
}
```

Define a `TelemetrySnapshot` interface (internal to this file) capturing the array fields you'll read:

```typescript
interface TelemetrySnapshot {
  sessionTime: number;
  sessionNum: number;
  replayFrameNum: number;
  carIdxLapDistPct: number[];
  carIdxLap: number[];
  carIdxTrackSurface: number[];
  carIdxSessionFlags: number[];
  carIdxOnPitRoad: boolean[];
}
```

- [ ] **Step 2: Write failing tests for pit entry detection**

```typescript
describe('pit entry detection', () => {
  it('fires PitEntry when CarIdxOnPitRoad transitions false → true', () => {
    const detector = new IncidentDetector(defaultThresholds, false);
    const incidents: Incident[] = [];
    detector.onIncident((i) => incidents.push(i));
    detector.updateSession({
      DriverInfo: {
        Drivers: [
          {
            CarIdx: 0,
            UserName: 'Test',
            CarNumber: '99',
            TeamName: '',
            CarIsPaceCar: 0,
          },
        ],
      },
    });

    const baseTelemetry = makeTelemetry({
      carIdxOnPitRoad: [false],
      carIdxTrackSurface: [3],
    });
    detector.processTelemetry(baseTelemetry, 5000);
    expect(incidents).toHaveLength(0);

    const pitTelemetry = makeTelemetry({
      carIdxOnPitRoad: [true],
      carIdxTrackSurface: [3],
    });
    detector.processTelemetry(pitTelemetry, 5000);
    expect(incidents).toHaveLength(1);
    expect(incidents[0].type).toBe(IncidentType.PitEntry);
  });

  it('does not fire again within cooldown period', () => {
    // Two pit entries within 2s should only produce one incident
    // (use thresholds with 5s cooldown)
  });
});
```

Add a `makeTelemetry` helper at the top of the spec file:

```typescript
const makeTelemetry = (
  overrides: Partial<{
    sessionTime: number;
    sessionNum: number;
    replayFrameNum: number;
    carIdxLapDistPct: number[];
    carIdxLap: number[];
    carIdxTrackSurface: number[];
    carIdxSessionFlags: number[];
    carIdxOnPitRoad: boolean[];
  }> = {}
) => ({
  sessionTime: 100,
  sessionNum: 0,
  replayFrameNum: 6000,
  carIdxLapDistPct: [0.5],
  carIdxLap: [3],
  carIdxTrackSurface: [3], // OnTrack
  carIdxSessionFlags: [0],
  carIdxOnPitRoad: [false],
  ...overrides,
});
```

- [ ] **Step 3: Implement `processTelemetry` with pit entry detection**

```typescript
processTelemetry(snap: TelemetrySnapshot, trackLengthM: number) {
  const nowMs = Date.now();
  const numCars = snap.carIdxLapDistPct.length;

  for (let carIdx = 0; carIdx < numCars; carIdx++) {
    const driver = this.sessionDrivers.get(carIdx);
    if (!driver || driver.isPaceCar) continue;
    if (snap.carIdxTrackSurface[carIdx] === TrackLocation.NotInWorld) continue;

    const state = this.getOrCreateState(carIdx);

    // --- Pit entry ---
    const onPitRoad = snap.carIdxOnPitRoad[carIdx] ?? false;
    if (onPitRoad && !state.prevOnPitRoad && !this.isCoolingDown(state, IncidentType.PitEntry, nowMs)) {
      state.lastIncidentTime[IncidentType.PitEntry] = nowMs;
      this.emit({ ...this.createIncidentBase(carIdx, snap, IncidentType.PitEntry) });
    }

    // Update state
    state.prevOnPitRoad = onPitRoad;
    state.prevLapDistPct = snap.carIdxLapDistPct[carIdx] ?? 0;
    state.prevSessionTime = snap.sessionTime;
    state.prevTrackSurface = snap.carIdxTrackSurface[carIdx] ?? TrackLocation.OnTrack;
    state.prevSessionFlags = snap.carIdxSessionFlags[carIdx] ?? 0;
  }
}
```

- [ ] **Step 4: Run pit entry tests**

```bash
npm run test -- --no-coverage src/app/services/incidentDetector.spec.ts
```

Expected: pit entry tests PASS.

- [ ] **Step 5: Write failing tests for off-track detection (with debounce)**

```typescript
describe('off-track detection', () => {
  it('does not fire on first off-track frame', () => {
    // After 1 frame of OffTrack, no incident
  });

  it('fires OffTrack after 3 consecutive off-track frames', () => {
    // After 3 frames of TrackLocation.OffTrack (=0), incident fires
  });

  it('resets debounce counter if car returns to track', () => {
    // 2 off-track frames, 1 on-track frame, 2 off-track frames = no incident
  });
});
```

- [ ] **Step 6: Implement off-track detection in `processTelemetry`**

Inside the per-car loop, after pit detection:

```typescript
// --- Off-track ---
const surface = snap.carIdxTrackSurface[carIdx] ?? TrackLocation.OnTrack;
if (surface === TrackLocation.OffTrack) {
  state.offTrackFrameCount++;
  if (
    state.offTrackFrameCount >= this.thresholds.offTrackDebounce &&
    state.prevTrackSurface !== TrackLocation.OffTrack &&
    !this.isCoolingDown(state, IncidentType.OffTrack, nowMs)
  ) {
    state.lastIncidentTime[IncidentType.OffTrack] = nowMs;
    this.emit({
      ...this.createIncidentBase(carIdx, snap, IncidentType.OffTrack),
    });
  }
} else {
  state.offTrackFrameCount = 0;
}
```

Wait — the debounce check `state.prevTrackSurface !== TrackLocation.OffTrack` would prevent it firing on the 3rd frame since prevTrackSurface would be OffTrack by then. Correct approach: fire when count **reaches** the threshold:

```typescript
if (state.offTrackFrameCount === this.thresholds.offTrackDebounce) { // exactly when threshold hit
```

- [ ] **Step 7: Write failing tests for flag detection**

```typescript
describe('flag detection', () => {
  it('fires BlackFlag when Black bit appears in session flags', () => {
    // GlobalFlags.Black bit appears in CarIdxSessionFlags
  });

  it('fires Slowdown when Furled bit appears in session flags', () => {
    // GlobalFlags.Furled bit appears
  });
});
```

Check `src/app/irsdk/types/enums.ts` for exact `GlobalFlags` bit values before writing the implementation.

- [ ] **Step 8: Implement flag detection**

```typescript
// --- Flag detection ---
const flags = snap.carIdxSessionFlags[carIdx] ?? 0;
const prevFlags = state.prevSessionFlags;
const newFlags = flags & ~prevFlags; // bits that just appeared

if (
  newFlags & GlobalFlags.Black &&
  !this.isCoolingDown(state, IncidentType.BlackFlag, nowMs)
) {
  state.lastIncidentTime[IncidentType.BlackFlag] = nowMs;
  this.emit({
    ...this.createIncidentBase(carIdx, snap, IncidentType.BlackFlag),
  });
}
if (
  newFlags & GlobalFlags.Furled &&
  !this.isCoolingDown(state, IncidentType.Slowdown, nowMs)
) {
  state.lastIncidentTime[IncidentType.Slowdown] = nowMs;
  this.emit({
    ...this.createIncidentBase(carIdx, snap, IncidentType.Slowdown),
  });
}
```

- [ ] **Step 9: Write failing tests for sustained-slow crash detection**

```typescript
describe('crash detection - sustained slow', () => {
  it('fires Crash after avgSpeed < threshold for slowFrameThreshold consecutive frames', () => {
    const detector = new IncidentDetector(
      { ...defaultThresholds, slowFrameThreshold: 3 },
      false
    );
    const incidents: Incident[] = [];
    detector.onIncident((i) => incidents.push(i));
    detector.updateSession({
      DriverInfo: {
        Drivers: [
          {
            CarIdx: 0,
            UserName: 'Test',
            CarNumber: '99',
            TeamName: '',
            CarIsPaceCar: 0,
          },
        ],
      },
    });

    // Simulate 3 frames at ~5 km/h (slow, on-track, not in pits)
    for (let i = 0; i < 3; i++) {
      detector.processTelemetry(
        makeTelemetry({
          carIdxTrackSurface: [TrackLocation.OnTrack],
          carIdxOnPitRoad: [false],
          carIdxLapDistPct: [0.5 + i * 0.00001], // barely moving
          sessionTime: 100 + i * 0.04,
        }),
        5000
      );
    }
    // After 3 slow frames, Crash should fire
    expect(incidents.some((i) => i.type === IncidentType.Crash)).toBe(true);
  });

  it('does not fire while car is on pit road', () => {
    // Same scenario but carIdxOnPitRoad = [true] — no crash
  });

  it('does not fire for NotInWorld cars', () => {
    // carIdxTrackSurface = [TrackLocation.NotInWorld]
  });
});
```

- [ ] **Step 10: Implement speed history and sustained-slow crash detection**

Add to the per-car loop (before updating state):

```typescript
// --- Speed calculation ---
const deltaTime = snap.sessionTime - state.prevSessionTime;
const rawSpeed =
  deltaTime > 0
    ? this.calculateSpeed(
        state.prevLapDistPct,
        snap.carIdxLapDistPct[carIdx] ?? 0,
        deltaTime,
        trackLengthM
      )
    : 0;

// Update rolling averages
state.recentRawSpeeds = [...state.recentRawSpeeds.slice(-4), rawSpeed];
state.speedHistory = [...state.speedHistory.slice(-4), rawSpeed];
state.currentAvgSpeed =
  state.speedHistory.reduce((a, b) => a + b, 0) / state.speedHistory.length;

// --- Sustained slow crash ---
const isOnTrack = surface === TrackLocation.OnTrack;
const isOnPitRoad = snap.carIdxOnPitRoad[carIdx] ?? false;
if (isOnTrack && !isOnPitRoad) {
  if (state.currentAvgSpeed < this.thresholds.slowSpeedThreshold) {
    state.slowFrameCount++;
    if (
      state.slowFrameCount === this.thresholds.slowFrameThreshold &&
      !this.isCoolingDown(state, IncidentType.Crash, nowMs)
    ) {
      state.lastIncidentTime[IncidentType.Crash] = nowMs;
      this.emit({
        ...this.createIncidentBase(carIdx, snap, IncidentType.Crash),
      });
    }
  } else {
    state.slowFrameCount = 0;
  }
}
```

- [ ] **Step 11: Write failing tests for sudden-stop detection**

```typescript
describe('crash detection - sudden stop', () => {
  it('fires Crash when speed drops from >80 to <20 within suddenStopFrames', () => {
    const detector = new IncidentDetector(
      { ...defaultThresholds, suddenStopFrames: 3 },
      false
    );
    // ...simulate frames: high speed, then 2 slow frames
  });
});
```

- [ ] **Step 12: Implement sudden-stop detection**

After the sustained-slow block:

```typescript
// --- Sudden stop ---
if (
  isOnTrack &&
  !isOnPitRoad &&
  state.recentRawSpeeds.length >= this.thresholds.suddenStopFrames
) {
  const oldestSpeed = state.recentRawSpeeds[0];
  const currentSpeed = rawSpeed;
  if (
    oldestSpeed > this.thresholds.suddenStopFromSpeed &&
    currentSpeed < this.thresholds.suddenStopToSpeed &&
    !this.isCoolingDown(state, IncidentType.Crash, nowMs)
  ) {
    state.lastIncidentTime[IncidentType.Crash] = nowMs;
    this.emit({ ...this.createIncidentBase(carIdx, snap, IncidentType.Crash) });
  }
}
```

- [ ] **Step 13: Run all detection tests**

```bash
npm run test -- --no-coverage src/app/services/incidentDetector.spec.ts
```

Expected: all PASS.

- [ ] **Step 14: Commit**

```bash
git add src/app/services/incidentDetector.ts src/app/services/incidentDetector.spec.ts
git commit -m "feat: add all five incident detectors to IncidentDetector"
```

---

## Task 4: Incident Detection Engine — Dev Mode Debug Snapshots

**Files:**

- Modify: `src/app/services/incidentDetector.ts`
- Modify: `src/app/services/incidentDetector.spec.ts`

- [ ] **Step 1: Write failing tests for dev-mode debug snapshot**

```typescript
describe('dev mode debug snapshots', () => {
  it('attaches debug snapshot when isDev=true', () => {
    const detector = new IncidentDetector(defaultThresholds, true); // isDev=true
    // Trigger a pit entry incident
    // ...
    expect(incidents[0].debug).toBeDefined();
    expect(incidents[0].debug!.trigger).toBe('pit-entry');
    expect(incidents[0].debug!.evidence).toContain('Pit entry');
    expect(incidents[0].debug!.thresholds.slowSpeedThreshold).toBe(15);
    expect(incidents[0].debug!.frameHistory).toBeInstanceOf(Array);
  });

  it('does not attach debug snapshot when isDev=false', () => {
    const detector = new IncidentDetector(defaultThresholds, false);
    // Trigger a pit entry incident
    // ...
    expect(incidents[0].debug).toBeUndefined();
  });

  it('frameHistory contains up to 10 most recent frames', () => {
    const detector = new IncidentDetector(defaultThresholds, true);
    // Run 15 frames, then trigger incident
    // frameHistory.length should be <= 10
  });
});
```

- [ ] **Step 2: Add circular frame buffer to `IncidentDetector`**

Add a per-car `frameHistory` buffer that is only allocated in dev mode:

```typescript
private frameBuffers = new Map<number, IncidentDebugSnapshot['frameHistory']>();

private pushFrameHistory(carIdx: number, entry: IncidentDebugSnapshot['frameHistory'][number]) {
  if (!this.isDev) return;
  const buf = this.frameBuffers.get(carIdx) ?? [];
  buf.push(entry);
  if (buf.length > 10) buf.shift();
  this.frameBuffers.set(carIdx, buf);
}
```

Call `this.pushFrameHistory(carIdx, { speed: rawSpeed, lapDistPct: ..., trackSurface: surface, sessionTime: snap.sessionTime })` at the start of each car's processing loop (after speed calculation).

- [ ] **Step 3: Implement `buildDebugSnapshot` method**

```typescript
private buildDebugSnapshot(
  carIdx: number,
  state: CarIncidentState,
  trigger: IncidentDebugSnapshot['trigger'],
  evidence: string
): IncidentDebugSnapshot | undefined {
  if (!this.isDev) return undefined;
  return {
    trigger,
    evidence,
    thresholds: { ...this.thresholds },
    carStateAtDetection: {
      speedHistory: [...state.speedHistory],
      currentAvgSpeed: state.currentAvgSpeed,
      recentRawSpeeds: [...state.recentRawSpeeds],
      slowFrameCount: state.slowFrameCount,
      offTrackFrameCount: state.offTrackFrameCount,
      prevTrackSurface: state.prevTrackSurface,
      prevSessionFlags: state.prevSessionFlags,
      prevOnPitRoad: state.prevOnPitRoad,
      prevLapDistPct: state.prevLapDistPct,
    },
    frameHistory: [...(this.frameBuffers.get(carIdx) ?? [])],
  };
}
```

- [ ] **Step 4: Attach debug snapshot when emitting each incident type**

Update each `this.emit(...)` call to include `debug`:

```typescript
// Example for pit entry:
const debug = this.buildDebugSnapshot(
  carIdx,
  state,
  'pit-entry',
  `Pit entry detected for car ${carIdx}`
);
this.emit({
  ...this.createIncidentBase(carIdx, snap, IncidentType.PitEntry),
  debug,
});

// Example for sustained-slow:
const evidence = `avgSpeed ${state.currentAvgSpeed.toFixed(1)} km/h < threshold ${this.thresholds.slowSpeedThreshold} km/h for ${state.slowFrameCount} consecutive frames (threshold: ${this.thresholds.slowFrameThreshold})`;
const debug = this.buildDebugSnapshot(
  carIdx,
  state,
  'sustained-slow',
  evidence
);
this.emit({
  ...this.createIncidentBase(carIdx, snap, IncidentType.Crash),
  debug,
});
```

- [ ] **Step 5: Run all tests**

```bash
npm run test -- --no-coverage src/app/services/incidentDetector.spec.ts
```

Expected: all PASS.

- [ ] **Step 6: Commit**

```bash
git add src/app/services/incidentDetector.ts src/app/services/incidentDetector.spec.ts
git commit -m "feat: add dev-mode debug snapshots to IncidentDetector"
```

---

## Task 5: Incident Persistence

**Files:**

- Create: `src/app/storage/incidentStorage.ts`
- Create: `src/app/storage/incidentStorage.spec.ts`

Read `src/app/storage/fuelDatabase.ts` before starting — follow its pattern for `app.getPath('userData')`.

**Note:** Tests for file I/O must mock `app.getPath` and `fs` operations. Use `vi.mock` from Vitest.

- [ ] **Step 1: Write failing tests**

Create `src/app/storage/incidentStorage.spec.ts`:

```typescript
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';

// Use a real temp directory for tests
let tmpDir: string;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'irdashies-test-'));
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true });
});

// We need to pass the storage dir to the functions rather than use app.getPath
// So the storage module should accept an optional storageDir param for testability

describe('incidentStorage', () => {
  it('loadIncidents returns [] when no file exists', async () => {
    const { loadIncidents } = await import('./incidentStorage');
    const result = loadIncidents('session123', tmpDir);
    expect(result).toEqual([]);
  });

  it('appendIncident creates file and persists incident', async () => {
    const { appendIncident, loadIncidents } = await import('./incidentStorage');
    const incident = { id: '1', type: 'PitEntry' } as any;
    appendIncident('session123', incident, tmpDir);
    const loaded = loadIncidents('session123', tmpDir);
    expect(loaded).toHaveLength(1);
    expect(loaded[0].id).toBe('1');
  });

  it('clearIncidents removes the session file', async () => {
    const { appendIncident, clearIncidents, loadIncidents } =
      await import('./incidentStorage');
    appendIncident('session123', { id: '1' } as any, tmpDir);
    clearIncidents('session123', tmpDir);
    expect(loadIncidents('session123', tmpDir)).toEqual([]);
  });

  it('pruneOldSessions keeps all when retention is "all"', async () => {
    const { appendIncident, pruneOldSessions, listSessionFiles } =
      await import('./incidentStorage');
    appendIncident('s1', { id: '1' } as any, tmpDir);
    appendIncident('s2', { id: '2' } as any, tmpDir);
    appendIncident('s3', { id: '3' } as any, tmpDir);
    pruneOldSessions('all', tmpDir);
    expect(listSessionFiles(tmpDir)).toHaveLength(3);
  });

  it('pruneOldSessions deletes oldest files when limit exceeded', async () => {
    const { appendIncident, pruneOldSessions, listSessionFiles } =
      await import('./incidentStorage');
    appendIncident('s1', { id: '1' } as any, tmpDir);
    appendIncident('s2', { id: '2' } as any, tmpDir);
    appendIncident('s3', { id: '3' } as any, tmpDir);
    pruneOldSessions(2, tmpDir);
    expect(listSessionFiles(tmpDir)).toHaveLength(2);
    // s1 (oldest) should be gone
  });
});
```

- [ ] **Step 2: Run to verify they fail**

```bash
npm run test -- --no-coverage src/app/storage/incidentStorage.spec.ts
```

Expected: FAIL — module does not exist.

- [ ] **Step 3: Implement `src/app/storage/incidentStorage.ts`**

```typescript
import * as fs from 'node:fs';
import * as path from 'node:path';
import { app } from 'electron';
import type { Incident } from '../../types/raceControl';

function getStorageDir(): string {
  return path.join(app.getPath('userData'), 'incidents');
}

function getFilePath(sessionId: string, storageDir: string): string {
  return path.join(storageDir, `incidents-${sessionId}.json`);
}

function ensureDir(dir: string) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

export function loadIncidents(
  sessionId: string,
  storageDir = getStorageDir()
): Incident[] {
  const filePath = getFilePath(sessionId, storageDir);
  if (!fs.existsSync(filePath)) return [];
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf-8')) as Incident[];
  } catch {
    return [];
  }
}

// NOTE: This does a full-array rewrite rather than true append-only NDJSON for simplicity.
// For race sessions (hundreds of incidents), this is acceptable. If performance becomes
// an issue on very long endurance sessions, switch to NDJSON (one JSON object per line).
export function appendIncident(
  sessionId: string,
  incident: Incident,
  storageDir = getStorageDir()
) {
  ensureDir(storageDir);
  const filePath = getFilePath(sessionId, storageDir);
  const existing = loadIncidents(sessionId, storageDir);
  existing.push(incident);
  fs.writeFileSync(filePath, JSON.stringify(existing));
}

export function clearIncidents(
  sessionId: string,
  storageDir = getStorageDir()
) {
  const filePath = getFilePath(sessionId, storageDir);
  if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
}

export function listSessionFiles(storageDir = getStorageDir()): string[] {
  if (!fs.existsSync(storageDir)) return [];
  return fs
    .readdirSync(storageDir)
    .filter((f) => f.startsWith('incidents-') && f.endsWith('.json'))
    .map((f) => path.join(storageDir, f))
    .sort((a, b) => fs.statSync(a).mtimeMs - fs.statSync(b).mtimeMs); // oldest first
}

export function pruneOldSessions(
  retention: 'all' | 5 | 10 | 20,
  storageDir = getStorageDir()
) {
  if (retention === 'all') return;
  const files = listSessionFiles(storageDir);
  const toDelete = files.slice(0, Math.max(0, files.length - retention));
  toDelete.forEach((f) => fs.unlinkSync(f));
}
```

- [ ] **Step 4: Run tests**

```bash
npm run test -- --no-coverage src/app/storage/incidentStorage.spec.ts
```

Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
git add src/app/storage/incidentStorage.ts src/app/storage/incidentStorage.spec.ts
git commit -m "feat: add incident persistence with session retention control"
```

---

## Task 6: Race Control Bridge

**Files:**

- Modify: `src/types/irSdkBridge.ts` (add `changeCameraNumber` + `changeReplayPosition`)
- Modify: `src/app/bridge/iracingSdk/iracingSdkBridge.ts` (implement camera/replay methods)
- Modify: `src/app/bridge/iracingSdk/mock-data/mockSdkBridge.ts` (no-op implementations)
- Create: `src/app/bridge/raceControlBridge.ts`
- Modify: `src/app/bridge/rendererExposeBridge.ts`
- Modify: `src/main.ts`

Read `src/app/bridge/fuelCalculatorBridge.ts` fully before starting — copy the setup function pattern exactly. Read `src/app/bridge/iracingSdk/setup.ts` to understand `getCurrentBridge()` and `onBridgeChanged()`. Read `src/types/irSdkBridge.ts` to understand the `IrSdkBridge` interface.

**Before Step 1:** The `IrSdkBridge` interface (`src/types/irSdkBridge.ts`) does NOT have camera/replay methods. The actual `IRacingSDK` class in `src/app/irsdk/node/irsdk-node.ts` has `changeCameraNumber(driver, group, camera)` and `changeReplayPosition(position, frame)`. You must extend `IrSdkBridge` with these methods and implement them in both bridge files before writing `raceControlBridge.ts`.

**Pre-Task: Extend `IrSdkBridge` for camera/replay**

1. Add to `src/types/irSdkBridge.ts`:

```typescript
import type { ReplayPositionCommand } from '../app/irsdk/types/enums';
export interface IrSdkBridge {
  onTelemetry: (
    callback: (value: Telemetry) => void
  ) => (() => void) | undefined;
  onSessionData: (
    callback: (value: Session) => void
  ) => (() => void) | undefined;
  onRunningState: (
    callback: (value: boolean) => void
  ) => (() => void) | undefined;
  changeCameraNumber: (driver: number, group: number, camera: number) => void;
  changeReplayPosition: (
    position: ReplayPositionCommand,
    frame: number
  ) => void;
  stop: () => void;
}
```

2. In `src/app/bridge/iracingSdk/iracingSdkBridge.ts`, the `sdk` local variable already has these methods. Add them to the returned object:

```typescript
// In the returned IrSdkBridge object:
changeCameraNumber: (driver, group, camera) => sdk.changeCameraNumber(driver, group, camera),
changeReplayPosition: (position, frame) => sdk.changeReplayPosition(position, frame),
```

3. In `src/app/bridge/iracingSdk/mock-data/mockSdkBridge.ts`, add no-op implementations:

```typescript
changeCameraNumber: () => {},
changeReplayPosition: () => {},
```

Run `npm run lint` after these changes before proceeding to Step 1.

- [ ] **Step 1: Create `src/app/bridge/raceControlBridge.ts`**

```typescript
import { ipcMain, BrowserWindow, app } from 'electron';
import { getCurrentBridge, onBridgeChanged } from './iracingSdk/setup';
import { IncidentDetector } from '../services/incidentDetector';
import {
  loadIncidents,
  appendIncident,
  clearIncidents,
  pruneOldSessions,
} from '../storage/incidentStorage';
import type { Incident, IncidentThresholds } from '../../types/raceControl';
import { ReplayPositionCommand } from '../irsdk/types/enums';

/** Parse "5.12 km" → 5120 (metres) */
function parseTrackLengthM(str: string): number {
  return parseFloat(str) * 1000;
}

const defaultThresholds: IncidentThresholds = {
  slowSpeedThreshold: 15,
  slowFrameThreshold: 10,
  suddenStopFromSpeed: 80,
  suddenStopToSpeed: 20,
  suddenStopFrames: 3,
  offTrackDebounce: 3,
  cooldownSeconds: 5,
};

export const setupRaceControlBridge = () => {
  const isDev = !app.isPackaged;
  const detector = new IncidentDetector(defaultThresholds, isDev);
  let cachedTrackLengthM = 0;
  let currentSessionId = '';
  let retention: 'all' | 5 | 10 | 20 = 'all';

  const broadcast = (incident: Incident) => {
    BrowserWindow.getAllWindows().forEach((win) => {
      win.webContents.send('raceControl:incident', incident);
    });
  };

  detector.onIncident((incident) => {
    appendIncident(currentSessionId, incident);
    broadcast(incident);
  });

  const wireToTelemetryBridge = () => {
    const bridge = getCurrentBridge();
    if (!bridge) return;

    bridge.onSessionData((session) => {
      detector.updateSession(session);
      const trackLen = session?.WeekendInfo?.TrackLength;
      if (trackLen) cachedTrackLengthM = parseTrackLengthM(trackLen);
      const sessionId = session?.WeekendInfo?.SubSessionID?.toString() ?? '';
      if (sessionId && sessionId !== currentSessionId) {
        currentSessionId = sessionId;
        pruneOldSessions(retention);
      }
    });

    bridge.onTelemetry((telemetry) => {
      if (!cachedTrackLengthM) return;
      detector.processTelemetry(telemetry, cachedTrackLengthM);
    });
  };

  wireToTelemetryBridge();
  onBridgeChanged(wireToTelemetryBridge);

  // Update thresholds from settings (called when GantryConfig saves)
  ipcMain.handle(
    'raceControl:updateThresholds',
    (_event, thresholds: IncidentThresholds) => {
      detector.updateThresholds(thresholds);
    }
  );

  ipcMain.handle(
    'raceControl:updateRetention',
    (_event, r: 'all' | 5 | 10 | 20) => {
      retention = r;
    }
  );

  ipcMain.handle('raceControl:getIncidents', () => {
    return loadIncidents(currentSessionId);
  });

  ipcMain.handle('raceControl:clearIncidents', () => {
    clearIncidents(currentSessionId);
  });

  ipcMain.handle(
    'raceControl:replayIncident',
    async (_event, incident: Incident, seconds: number) => {
      const bridge = getCurrentBridge();
      if (!bridge) return;
      const targetFrame = incident.replayFrameNum - Math.round(60 * seconds);
      await bridge.changeCameraNumber(incident.carIdx, 0, 0);
      await bridge.changeReplayPosition(
        ReplayPositionCommand.Begin,
        Math.max(0, targetFrame)
      );
    }
  );
};
```

- [ ] **Step 2: Expose `raceControlBridge` in `src/app/bridge/rendererExposeBridge.ts`**

Open `rendererExposeBridge.ts`. Following the exact same pattern as existing bridges (e.g. `fuelCalculatorBridge`), add:

```typescript
import type { RaceControlBridge } from '../../types/raceControl';

contextBridge.exposeInMainWorld('raceControlBridge', {
  getIncidents: () => ipcRenderer.invoke('raceControl:getIncidents'),
  onIncident: (cb: (incident: unknown) => void) => {
    const handler = (_: unknown, incident: unknown) => cb(incident);
    ipcRenderer.on('raceControl:incident', handler);
    return () => ipcRenderer.removeListener('raceControl:incident', handler);
  },
  replayIncident: (incident: unknown, seconds: number) =>
    ipcRenderer.invoke('raceControl:replayIncident', incident, seconds),
  clearIncidents: () => ipcRenderer.invoke('raceControl:clearIncidents'),
  updateThresholds: (thresholds: unknown) =>
    ipcRenderer.invoke('raceControl:updateThresholds', thresholds),
  updateRetention: (retention: unknown) =>
    ipcRenderer.invoke('raceControl:updateRetention', retention),
} as RaceControlBridge);
```

- [ ] **Step 3: Call `setupRaceControlBridge()` in `src/main.ts`**

Open `main.ts`. After the existing bridge setup calls (fuel, pitLane, referenceLaps), add:

```typescript
import { setupRaceControlBridge } from './app/bridge/raceControlBridge';
// ...
setupRaceControlBridge();
```

- [ ] **Step 4: Verify lint and build**

```bash
npm run lint
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add src/types/irSdkBridge.ts src/app/bridge/iracingSdk/iracingSdkBridge.ts src/app/bridge/iracingSdk/mock-data/mockSdkBridge.ts src/app/bridge/raceControlBridge.ts src/app/bridge/rendererExposeBridge.ts src/main.ts
git commit -m "feat: add race control bridge with IPC handlers and telemetry wiring"
```

---

## Task 7: Frontend Incident Store + Storybook Decorator

**Files:**

- Create: `src/frontend/context/RaceControlStore/RaceControlStore.ts`
- Create: `src/frontend/context/RaceControlStore/useRaceControlBridge.ts`
- Create: `src/frontend/context/RaceControlStore/index.ts`
- Modify: `src/frontend/context/index.ts`
- Create: `.storybook/raceControlDecorator.tsx`

Read `src/frontend/context/LapTimesStore/LapTimesStore.ts` and `.storybook/telemetryDecorator.tsx` before starting — they show the exact Zustand store and decorator patterns.

- [ ] **Step 1: Create `RaceControlStore.ts`**

```typescript
import { create } from 'zustand';
import { IncidentType } from '../../../types/raceControl';
import type { Incident } from '../../../types/raceControl';

interface RaceControlState {
  incidents: Incident[];
  activeTypeFilters: Set<IncidentType>;
  driverFilter: number | null; // carIdx, null = all

  addIncident: (incident: Incident) => void;
  clearIncidents: () => void;
  toggleTypeFilter: (type: IncidentType) => void;
  setDriverFilter: (carIdx: number | null) => void;
  setIncidents: (incidents: Incident[]) => void;
}

export const useRaceControlStore = create<RaceControlState>((set) => ({
  incidents: [],
  activeTypeFilters: new Set(Object.values(IncidentType)), // all on by default
  driverFilter: null,

  addIncident: (incident) =>
    set((s) => ({ incidents: [incident, ...s.incidents] })),

  clearIncidents: () => set({ incidents: [] }),

  toggleTypeFilter: (type) =>
    set((s) => {
      const next = new Set(s.activeTypeFilters);
      next.has(type) ? next.delete(type) : next.add(type);
      return { activeTypeFilters: next };
    }),

  setDriverFilter: (carIdx) => set({ driverFilter: carIdx }),

  setIncidents: (incidents) => set({ incidents: [...incidents].reverse() }), // newest first
}));

export const useFilteredIncidents = () =>
  useRaceControlStore((s) => {
    return s.incidents.filter(
      (i) =>
        s.activeTypeFilters.has(i.type) &&
        (s.driverFilter === null || i.carIdx === s.driverFilter)
    );
  });
```

- [ ] **Step 2: Create `useRaceControlBridge.ts`**

```typescript
import { useEffect } from 'react';
import { useRaceControlStore } from './RaceControlStore';

export const useRaceControlBridge = () => {
  const setIncidents = useRaceControlStore((s) => s.setIncidents);
  const addIncident = useRaceControlStore((s) => s.addIncident);

  useEffect(() => {
    if (!window.raceControlBridge) return;

    window.raceControlBridge.getIncidents().then(setIncidents);

    const cleanup = window.raceControlBridge.onIncident(addIncident);
    return cleanup;
  }, []);
};
```

- [ ] **Step 3: Create `index.ts`**

```typescript
export * from './RaceControlStore';
export * from './useRaceControlBridge';
```

- [ ] **Step 4: Add to `src/frontend/context/index.ts`**

```typescript
export * from './RaceControlStore';
```

**Do NOT add `LapGapStore` yet** — that module is created in Task 8. Export it there.

- [ ] **Step 5: Create `.storybook/raceControlDecorator.tsx`**

```typescript
import type { Decorator } from '@storybook/react';
import { useEffect } from 'react';
import { useRaceControlStore } from '../src/frontend/context/RaceControlStore/RaceControlStore';
import { IncidentType } from '../src/types/raceControl';
import type { Incident } from '../src/types/raceControl';

const mockIncidents: Incident[] = [
  {
    id: '0-1823.5',
    carIdx: 0,
    driverName: 'R. Grosjean',
    carNumber: '77',
    teamName: 'Alpine Racing',
    sessionNum: 0,
    sessionTime: 1823.5,
    lapNum: 12,
    replayFrameNum: 109410,
    type: IncidentType.Crash,
    lapDistPct: 0.482,
    timestamp: Date.now() - 60000,
    debug: {
      trigger: 'sustained-slow',
      evidence: 'avgSpeed 8.2 km/h < threshold 15 km/h for 12 consecutive frames (threshold: 10)',
      thresholds: { slowSpeedThreshold: 15, slowFrameThreshold: 10, suddenStopFromSpeed: 80, suddenStopToSpeed: 20, suddenStopFrames: 3, offTrackDebounce: 3, cooldownSeconds: 5 },
      carStateAtDetection: { speedHistory: [9.1, 8.8, 8.5, 8.3, 8.2], currentAvgSpeed: 8.58, recentRawSpeeds: [9.1, 8.8, 8.5], slowFrameCount: 12, offTrackFrameCount: 0, prevTrackSurface: 3, prevSessionFlags: 0, prevOnPitRoad: false, prevLapDistPct: 0.4821 },
      frameHistory: [{ speed: 45.2, lapDistPct: 0.478, trackSurface: 3, sessionTime: 1823.4 }, { speed: 8.2, lapDistPct: 0.482, trackSurface: 3, sessionTime: 1823.5 }],
    },
  },
  {
    id: '1-1801.2',
    carIdx: 1,
    driverName: 'O. Jarvis',
    carNumber: '60',
    teamName: 'JOTA',
    sessionNum: 0,
    sessionTime: 1801.2,
    lapNum: 12,
    replayFrameNum: 108072,
    type: IncidentType.PitEntry,
    lapDistPct: 0.97,
    timestamp: Date.now() - 82000,
  },
  {
    id: '2-1750.0',
    carIdx: 2,
    driverName: 'F. Albuquerque',
    carNumber: '22',
    teamName: 'United Autosports',
    sessionNum: 0,
    sessionTime: 1750.0,
    lapNum: 11,
    replayFrameNum: 105000,
    type: IncidentType.OffTrack,
    lapDistPct: 0.312,
    timestamp: Date.now() - 133000,
  },
];

const RaceControlLoader = () => {
  const setIncidents = useRaceControlStore(s => s.setIncidents);
  useEffect(() => { setIncidents(mockIncidents); }, []);
  return null;
};

export const RaceControlDecorator: () => Decorator = () => (Story) => (
  <>
    <RaceControlLoader />
    <Story />
  </>
);
```

- [ ] **Step 6: Run lint**

```bash
npm run lint
```

- [ ] **Step 7: Commit**

```bash
git add src/frontend/context/RaceControlStore/ src/frontend/context/index.ts .storybook/raceControlDecorator.tsx
git commit -m "feat: add RaceControlStore, useRaceControlBridge, and Storybook decorator"
```

---

## Task 8: Lap Gap Store

**Files:**

- Create: `src/frontend/context/LapGapStore/LapGapStore.ts`
- Create: `src/frontend/context/LapGapStore/index.ts`
- Modify: `src/frontend/context/index.ts`

Read `src/frontend/context/LapTimesStore/LapTimesStore.ts` for the pattern of detecting lap completion and resetting on session change.

- [ ] **Step 1: Write failing test**

Create `src/frontend/context/LapGapStore/LapGapStore.spec.ts`:

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useLapGapStore } from './LapGapStore';

describe('LapGapStore', () => {
  beforeEach(() => {
    useLapGapStore.getState().reset();
  });

  it('records gap snapshot when lap increments for a car', () => {
    const { recordLapGap } = useLapGapStore.getState();
    recordLapGap(0, 3, 0); // car 0, lap 3, 0s gap (leader)
    recordLapGap(1, 3, 4.2); // car 1, lap 3, 4.2s gap
    const gaps = useLapGapStore.getState().lapGaps;
    expect(gaps[0][3]).toBe(0);
    expect(gaps[1][3]).toBe(4.2);
  });

  it('resets all gaps on session change', () => {
    useLapGapStore.getState().recordLapGap(0, 3, 0);
    useLapGapStore.getState().reset();
    expect(useLapGapStore.getState().lapGaps).toEqual({});
  });
});
```

- [ ] **Step 2: Run to verify failure**

```bash
npm run test -- --no-coverage src/frontend/context/LapGapStore/LapGapStore.spec.ts
```

- [ ] **Step 3: Implement `LapGapStore.ts`**

```typescript
import { create } from 'zustand';

// lapGaps[carIdx][lapNum] = gapToClassLeaderInSeconds
interface LapGapState {
  lapGaps: Record<number, Record<number, number>>;
  recordLapGap: (carIdx: number, lapNum: number, gapSeconds: number) => void;
  reset: () => void;
}

export const useLapGapStore = create<LapGapState>((set) => ({
  lapGaps: {},
  recordLapGap: (carIdx, lapNum, gapSeconds) =>
    set((s) => ({
      lapGaps: {
        ...s.lapGaps,
        [carIdx]: { ...(s.lapGaps[carIdx] ?? {}), [lapNum]: gapSeconds },
      },
    })),
  reset: () => set({ lapGaps: {} }),
}));
```

The store is populated by a `LapGapStoreUpdater` component (similar to `LapTimesStoreUpdater`). Create `src/frontend/context/LapGapStore/LapGapStoreUpdater.tsx`:

```typescript
import { memo, useEffect, useRef } from 'react';
import { useTelemetryValuesRounded } from '../TelemetryStore/TelemetryStore';
import { useLapGapStore } from './LapGapStore';
import { useDriverStandings } from '../../components/Standings/hooks/useDriverStandings';

// useDriverStandings returns [classId, Standings[]][] — an array of [classId, drivers] tuples.
// Standings.gap is { value?: number, laps: number }. Use .value for the seconds gap.
export const LapGapStoreUpdater = memo(() => {
  const carIdxLap = useTelemetryValuesRounded('CarIdxLap', 0);
  const prevLapsRef = useRef<number[]>([]);
  const recordLapGap = useLapGapStore((s) => s.recordLapGap);
  // Pass gap enabled so the hook populates driver.gap
  const standingsByClass = useDriverStandings({ gap: { enabled: true } });
  // Flatten all drivers from all classes into a single lookup
  const allDrivers = standingsByClass.flatMap(
    ([, classDrivers]) => classDrivers
  );

  useEffect(() => {
    if (!carIdxLap) return;
    carIdxLap.forEach((lap, carIdx) => {
      if (
        prevLapsRef.current[carIdx] !== undefined &&
        lap > prevLapsRef.current[carIdx]
      ) {
        // Lap just completed — record gap to class leader
        const driver = allDrivers.find((d) => d.carIdx === carIdx);
        if (driver) {
          recordLapGap(carIdx, lap, driver.gap?.value ?? 0);
        }
      }
    });
    prevLapsRef.current = [...carIdxLap];
  }, [carIdxLap]);

  return null;
});
LapGapStoreUpdater.displayName = 'LapGapStoreUpdater';
```

- [ ] **Step 4: Run tests**

```bash
npm run test -- --no-coverage src/frontend/context/LapGapStore/LapGapStore.spec.ts
```

Expected: PASS.

- [ ] **Step 5: Create `index.ts` and update `context/index.ts`**

```typescript
// LapGapStore/index.ts
export * from './LapGapStore';
export * from './LapGapStoreUpdater';
```

Add `export * from './LapGapStore'` to `src/frontend/context/index.ts` (the `RaceControlStore` export was added in Task 7).

- [ ] **Step 6: Commit**

```bash
git add src/frontend/context/LapGapStore/ src/frontend/context/index.ts
git commit -m "feat: add LapGapStore and LapGapStoreUpdater for per-lap gap snapshots"
```

---

## Task 9: GantryConfig Types & Widget Registration

**Files:**

- Modify: `src/types/widgetConfigs.ts`
- Modify: `src/types/defaultDashboard.ts`
- Modify: `src/frontend/WidgetIndex.tsx`

- [ ] **Step 1: Add `GantryConfig` to `src/types/widgetConfigs.ts`**

```typescript
export type SessionRetention = 'all' | 5 | 10 | 20;

export interface GantryConfig {
  // Incident detection thresholds
  slowSpeedThreshold: number;
  slowFrameThreshold: number;
  suddenStopFromSpeed: number;
  suddenStopToSpeed: number;
  suddenStopFrames: number;
  offTrackDebounce: number;
  cooldownSeconds: number;
  // Persistence
  sessionRetention: SessionRetention;
  // Required for mouse interaction
  interactive: true;
}

export type GantryWidgetSettings = BaseWidgetSettings<GantryConfig>;
```

- [ ] **Step 2: Add gantry default entry to `src/types/defaultDashboard.ts`**

```typescript
{
  id: 'gantry',
  enabled: true,
  layout: {
    x: 0, y: 0, width: 1920, height: 1080
  },
  config: {
    slowSpeedThreshold: 15,
    slowFrameThreshold: 10,
    suddenStopFromSpeed: 80,
    suddenStopToSpeed: 20,
    suddenStopFrames: 3,
    offTrackDebounce: 3,
    cooldownSeconds: 5,
    sessionRetention: 'all',
    interactive: true,
  }
}
```

- [ ] **Step 3: Create stub `src/frontend/components/Gantry/Gantry.tsx`**

```typescript
import { memo } from 'react';

export const Gantry = memo(() => {
  return (
    <div className="w-full h-full bg-slate-900/80 text-white flex items-center justify-center">
      <span className="text-slate-400 text-sm">The Gantry — coming soon</span>
    </div>
  );
});
Gantry.displayName = 'Gantry';
```

- [ ] **Step 4: Register in `src/frontend/WidgetIndex.tsx`**

```typescript
import { Gantry } from './components/Gantry/Gantry';

export const WIDGET_MAP = {
  // ... existing entries ...
  gantry: Gantry,
};
```

- [ ] **Step 5: Run lint**

```bash
npm run lint
```

- [ ] **Step 6: Commit**

```bash
git add src/types/widgetConfigs.ts src/types/defaultDashboard.ts src/frontend/components/Gantry/Gantry.tsx src/frontend/WidgetIndex.tsx
git commit -m "feat: add GantryConfig types, default config, and widget stub registration"
```

---

## Task 10: Mouse Interaction — WidgetContainer + Overlay Manager

**Files:**

- Modify: `src/frontend/components/WidgetContainer/WidgetContainer.tsx`
- Investigate & modify: overlay window creation code

This task requires investigation before implementation. Do not skip the read steps.

- [ ] **Step 1: Read `src/frontend/components/WidgetContainer/WidgetContainer.tsx` fully**

Locate the `pointer-events-none` class application. It is likely on a wrapper div that wraps `{children}`. Note the exact line.

- [ ] **Step 2: Add `interactive` prop to `WidgetContainer`**

Modify `WidgetContainerProps` to add `interactive?: boolean`. Change the wrapper div:

```tsx
// Before (approx):
<div className="w-full h-full pointer-events-none">{children}</div>

// After:
<div className={`w-full h-full ${interactive ? 'pointer-events-auto' : 'pointer-events-none'}`}>
  {children}
</div>
```

The `interactive` value should come from the widget's config. Read how the widget config is passed through to `WidgetContainer` — it likely comes from the `widget` prop (a `DashboardWidget`). Check the `DashboardWidget` type in `src/types/`. If the config is accessible, read `widget.config.interactive`. If not, pass `interactive` as a separate prop from the parent that renders `WidgetContainer`.

- [ ] **Step 3: Find and read the overlay window creation code**

Run:

```bash
grep -r "setIgnoreMouseEvents\|BrowserWindow\|createWindow" src/app --include="*.ts" -l
```

Read the files that appear. Find where `setIgnoreMouseEvents` is called and where widget windows are created. This is likely in `src/app/overlayManager.ts` or similar.

- [ ] **Step 4: Apply `setIgnoreMouseEvents(false)` for interactive widgets**

In the window creation/setup code, when building a window for a widget:

```typescript
// After window creation:
if (widgetConfig?.config?.interactive) {
  win.setIgnoreMouseEvents(false);
} else {
  win.setIgnoreMouseEvents(true, { forward: true });
}
```

The exact location depends on what you find in Step 3. The key is that `setIgnoreMouseEvents(false)` must be called for The Gantry's window specifically.

- [ ] **Step 5: Run lint**

```bash
npm run lint
```

- [ ] **Step 6: Commit**

Stage all files you modified in Steps 2 and 4. The exact overlay manager file path was determined in Step 3 (likely `src/app/overlayManager.ts`). Add them all:

```bash
git add src/frontend/components/WidgetContainer/WidgetContainer.tsx
# Also stage the overlay manager file(s) found in Step 3, e.g.:
# git add src/app/overlayManager.ts
git commit -m "feat: add interactive prop to WidgetContainer for mouse-enabled overlays"
```

---

## Task 11: Gantry Shell

**Files:**

- Create: `src/frontend/components/Gantry/components/GantryTabBar/GantryTabBar.tsx`
- Modify: `src/frontend/components/Gantry/Gantry.tsx`
- Create: `src/frontend/components/Gantry/Gantry.stories.tsx`

- [ ] **Step 1: Create `GantryTabBar.tsx`**

```tsx
import { memo } from 'react';
type GantryView = 'standings-incidents' | 'lap-graph';

interface GantryTabBarProps {
  activeView: GantryView;
  onViewChange: (view: GantryView) => void;
  drivers: Array<{ carIdx: number; name: string; carNumber: string }>;
  followedCarIdx: number | null;
  onFollowChange: (carIdx: number | null) => void;
}

export const GantryTabBar = memo(
  ({
    activeView,
    onViewChange,
    drivers,
    followedCarIdx,
    onFollowChange,
  }: GantryTabBarProps) => {
    return (
      <div className="flex items-center gap-1 bg-slate-900 border-b border-slate-700/50 px-2 py-1 flex-shrink-0">
        {(['standings-incidents', 'lap-graph'] as GantryView[]).map((view) => (
          <button
            key={view}
            onClick={() => onViewChange(view)}
            className={[
              'px-3 py-1 rounded text-xs font-bold uppercase tracking-wider transition-colors',
              activeView === view
                ? 'bg-amber-500 text-slate-900'
                : 'bg-slate-800 text-slate-400 hover:text-slate-200',
            ].join(' ')}
          >
            {view === 'standings-incidents'
              ? 'Standings & Incidents'
              : 'Lap Graph'}
          </button>
        ))}
        <div className="flex-1" />
        {/* Follow Driver dropdown */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500 uppercase tracking-wider">
            Follow
          </span>
          <select
            value={followedCarIdx ?? ''}
            onChange={(e) =>
              onFollowChange(e.target.value ? Number(e.target.value) : null)
            }
            className="bg-slate-800 border border-slate-600 rounded text-xs text-slate-300 px-2 py-1"
          >
            <option value="">All</option>
            {drivers.map((d) => (
              <option key={d.carIdx} value={d.carIdx}>
                #{d.carNumber} {d.name}
              </option>
            ))}
          </select>
        </div>
      </div>
    );
  }
);
GantryTabBar.displayName = 'GantryTabBar';
```

- [ ] **Step 2: Implement full `Gantry.tsx`**

Replace the stub:

```tsx
import { memo, useState } from 'react';
import { GantryTabBar } from './components/GantryTabBar/GantryTabBar';
import { GantryStandings } from './components/GantryStandings/GantryStandings';
import { GantryIncidents } from './components/GantryIncidents/GantryIncidents';
import { LapGraphView } from './components/LapGraph/LapGraphView';
import { useRaceControlBridge } from '../../context/RaceControlStore/useRaceControlBridge';
import { useDriverStandings } from '../Standings/hooks/useDriverStandings';

type GantryView = 'standings-incidents' | 'lap-graph';

export const Gantry = memo(() => {
  const [activeView, setActiveView] = useState<GantryView>(
    'standings-incidents'
  );
  const [followedCarIdx, setFollowedCarIdx] = useState<number | null>(null);

  useRaceControlBridge(); // subscribe to incidents on mount

  // useDriverStandings returns [classId, Standings[]][] — flatten to get all drivers for tab bar
  const standingsByClass = useDriverStandings();
  const drivers = standingsByClass
    .flatMap(([, classDrivers]) => classDrivers)
    .map((s) => ({
      carIdx: s.carIdx,
      name: s.driver.name,
      carNumber: s.driver.carNum,
    }));

  return (
    <div className="w-full h-full flex flex-col bg-slate-900/(--bg-opacity) text-white overflow-hidden">
      <GantryTabBar
        activeView={activeView}
        onViewChange={setActiveView}
        drivers={drivers}
        followedCarIdx={followedCarIdx}
        onFollowChange={setFollowedCarIdx}
      />
      {activeView === 'standings-incidents' && (
        <div className="flex flex-1 overflow-hidden">
          <div className="w-1/2 border-r border-slate-700/50 overflow-hidden">
            <GantryStandings followedCarIdx={followedCarIdx} />
          </div>
          <div className="w-1/2 overflow-hidden">
            <GantryIncidents />
          </div>
        </div>
      )}
      {activeView === 'lap-graph' && (
        <div className="flex-1 overflow-hidden">
          <LapGraphView />
        </div>
      )}
    </div>
  );
});
Gantry.displayName = 'Gantry';
```

- [ ] **Step 3: Create stub files for components imported above (required for lint to pass)**

These files will be fully implemented in Tasks 13–15. Create minimal stubs now so TypeScript resolves the imports:

```typescript
// src/frontend/components/Gantry/components/GantryStandings/GantryStandings.tsx
import { memo } from 'react';
export const GantryStandings = memo(
  ({ followedCarIdx: _ }: { followedCarIdx: number | null }) => null
);
GantryStandings.displayName = 'GantryStandings';
```

```typescript
// src/frontend/components/Gantry/components/GantryIncidents/GantryIncidents.tsx
import { memo } from 'react';
export const GantryIncidents = memo(() => null);
GantryIncidents.displayName = 'GantryIncidents';
```

```typescript
// src/frontend/components/Gantry/components/LapGraph/LapGraphView.tsx
import { memo } from 'react';
export const LapGraphView = memo(() => null);
LapGraphView.displayName = 'LapGraphView';
```

- [ ] **Step 4: Create `Gantry.stories.tsx`**

```typescript
import type { Meta, StoryObj } from '@storybook/react';
import { TelemetryDecorator } from '@irdashies/storybook';
import { RaceControlDecorator } from '../../../../.storybook/raceControlDecorator';
import { Gantry } from './Gantry';

const meta: Meta<typeof Gantry> = {
  component: Gantry,
  decorators: [TelemetryDecorator(), RaceControlDecorator()],
  parameters: { layout: 'fullscreen' },
};

export default meta;
type Story = StoryObj<typeof Gantry>;

export const Default: Story = {};
```

- [ ] **Step 5: Verify Storybook renders**

```bash
npm run storybook
```

Navigate to The Gantry story. Expected: tab bar visible, layout renders without errors. Content panels will be empty stubs at this point.

- [ ] **Step 6: Commit**

```bash
git add src/frontend/components/Gantry/
git commit -m "feat: add Gantry shell with tab bar, 50/50 layout, follow-driver dropdown, and component stubs"
```

---

## Task 12: Gantry Settings Panel

**Files:**

- Create: `src/frontend/components/Settings/sections/GantrySettings.tsx`

Read one existing settings section (e.g. `src/frontend/components/Settings/sections/StandingsSettings.tsx` or similar) to understand the `BaseSettingsSection` pattern and how numeric inputs and dropdowns are built. Also read how settings sections are registered in the Settings widget.

- [ ] **Step 1: Read an existing settings section for the exact pattern**

```bash
ls src/frontend/components/Settings/sections/
```

Read one of the files. Note how `useWidgetSettings`, `BaseSettingsSection`, and `updateDashboard` are used.

- [ ] **Step 2: Create `GantrySettings.tsx`**

```tsx
import { memo } from 'react';
import { BaseSettingsSection } from '../components/BaseSettingsSection'; // adjust path
import { useWidgetSettings } from '../../hooks/useWidgetSettings'; // adjust path
import type { GantryConfig } from '../../../../types/widgetConfigs';

export const GantrySettings = memo(() => {
  const { config, updateConfig } = useWidgetSettings<GantryConfig>('gantry');
  if (!config) return null;

  return (
    <>
      <BaseSettingsSection title="Incident Detection">
        <div className="flex flex-col gap-2">
          {[
            {
              key: 'slowSpeedThreshold',
              label: 'Slow speed threshold (km/h)',
              min: 1,
              max: 100,
            },
            {
              key: 'slowFrameThreshold',
              label: 'Slow frame count',
              min: 1,
              max: 60,
            },
            {
              key: 'suddenStopFromSpeed',
              label: 'Sudden stop: from speed (km/h)',
              min: 20,
              max: 300,
            },
            {
              key: 'suddenStopToSpeed',
              label: 'Sudden stop: to speed (km/h)',
              min: 1,
              max: 50,
            },
            {
              key: 'suddenStopFrames',
              label: 'Sudden stop: frame window',
              min: 1,
              max: 10,
            },
            {
              key: 'offTrackDebounce',
              label: 'Off-track debounce (frames)',
              min: 1,
              max: 10,
            },
            {
              key: 'cooldownSeconds',
              label: 'Per-type cooldown (seconds)',
              min: 1,
              max: 30,
            },
          ].map(({ key, label, min, max }) => (
            <label
              key={key}
              className="flex items-center justify-between text-xs text-slate-300"
            >
              <span>{label}</span>
              <input
                type="number"
                min={min}
                max={max}
                value={config[key as keyof GantryConfig] as number}
                onChange={(e) =>
                  updateConfig({ [key]: Number(e.target.value) })
                }
                className="w-16 bg-slate-700 rounded px-1 py-0.5 text-right"
              />
            </label>
          ))}
        </div>
      </BaseSettingsSection>

      <BaseSettingsSection title="Session Retention">
        <label className="flex items-center justify-between text-xs text-slate-300">
          <span>Keep sessions</span>
          <select
            value={config.sessionRetention}
            onChange={(e) =>
              updateConfig({
                sessionRetention: e.target
                  .value as GantryConfig['sessionRetention'],
              })
            }
            className="bg-slate-700 rounded px-2 py-0.5 text-xs"
          >
            <option value="all">All</option>
            <option value={5}>Last 5</option>
            <option value={10}>Last 10</option>
            <option value={20}>Last 20</option>
          </select>
        </label>
      </BaseSettingsSection>
    </>
  );
});
GantrySettings.displayName = 'GantrySettings';
```

**Note:** The exact imports for `BaseSettingsSection` and `useWidgetSettings` depend on what you find when reading existing settings sections. Adjust paths accordingly.

- [ ] **Step 3: Wire GantrySettings into the Settings widget**

Read `src/frontend/components/Settings/Settings.tsx` to find where per-widget settings sections are rendered — look for a map/object that associates widget IDs with settings components (e.g. `{ standings: StandingsSettings, ... }`). Add `gantry: GantrySettings` following the same pattern. If sections are registered in a separate file (e.g. `settingsSections.ts`), add it there instead.

Also: when `sessionRetention` changes in the settings, send it to the main process:

```typescript
// In useWidgetSettings or the settings save handler, after config updates:
window.raceControlBridge?.updateRetention?.(config.sessionRetention);
```

And when thresholds change, broadcast to the bridge. Follow the existing pattern for how other settings changes trigger IPC calls.

- [ ] **Step 4: Run lint**

```bash
npm run lint
```

- [ ] **Step 5: Commit**

```bash
git add src/frontend/components/Settings/sections/GantrySettings.tsx
# Add any modified Settings registration files
git commit -m "feat: add GantrySettings panel with threshold inputs and session retention"
```

---

## Task 13: Standings Panel

**Files:**

- Create: `src/frontend/components/Gantry/components/GantryStandings/GantryStandings.tsx`
- Create: `src/frontend/components/Gantry/components/GantryStandings/GantryStandings.stories.tsx`

Read `src/frontend/components/Standings/hooks/useDriverStandings.ts` and `src/frontend/components/Standings/components/DriverInfoRow/DriverInfoRow.tsx` before starting. You need to know the exact hook signature, what `standings` data looks like, and which cell components accept which props.

- [ ] **Step 1: Read hook and cell component signatures**

```bash
cat src/frontend/components/Standings/hooks/useDriverStandings.ts
cat src/frontend/components/Standings/components/DriverInfoRow/cells/PositionCell.tsx
cat src/frontend/components/Standings/components/DriverInfoRow/cells/DriverNameCell.tsx
cat src/frontend/components/Standings/components/DriverInfoRow/cells/BadgeCell.tsx
```

Note: which props each cell accepts, and what fields are available on each `standings` entry.

- [ ] **Step 2: Create `GantryStandings.tsx` — column headers and class grouping**

```tsx
import { memo, useEffect, useRef } from 'react';
import { useDriverStandings } from '../../Standings/hooks/useDriverStandings';
import { PositionCell } from '../../Standings/components/DriverInfoRow/cells/PositionCell';
import { CarNumberCell } from '../../Standings/components/DriverInfoRow/cells/CarNumberCell';
import { DriverNameCell } from '../../Standings/components/DriverInfoRow/cells/DriverNameCell';
import { CompoundCell } from '../../Standings/components/DriverInfoRow/cells/CompoundCell';
import { BadgeCell } from '../../Standings/components/DriverInfoRow/cells/BadgeCell';
import { PitStatusCell } from '../../Standings/components/DriverInfoRow/cells/PitStatusCell';
import { DeltaCell } from '../../Standings/components/DriverInfoRow/cells/DeltaCell';
import { FastestTimeCell } from '../../Standings/components/DriverInfoRow/cells/FastestTimeCell';
import { LastTimeCell } from '../../Standings/components/DriverInfoRow/cells/LastTimeCell';
import { LapTimeDeltasCell } from '../../Standings/components/DriverInfoRow/cells/LapTimeDeltasCell';

interface Props {
  followedCarIdx: number | null;
}

export const GantryStandings = memo(({ followedCarIdx }: Props) => {
  // useDriverStandings returns [classId, Standings[]][] — array of [classId, drivers] tuples.
  // Config field is `numLaps` (not `count`) for lap delta count.
  const standingsByClass = useDriverStandings({
    gap: { enabled: true },
    interval: { enabled: true },
    lapTimeDeltas: { enabled: true, numLaps: 3 },
  });

  const followedRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    followedRef.current?.scrollIntoView({
      block: 'nearest',
      behavior: 'smooth',
    });
  }, [followedCarIdx]);

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Column header row */}
      <div className="flex items-center bg-slate-900 border-b border-slate-700/50 px-1 py-0.5 text-xs font-bold uppercase tracking-wider text-slate-500 flex-shrink-0">
        <span className="w-6 text-center">P</span>
        <span className="w-8 text-center">#</span>
        <span className="flex-1">Driver</span>
        <span className="w-5 text-center">Tyre</span>
        <span className="w-16 text-right">iR</span>
        <span className="w-5 text-center">Pit</span>
        <span className="w-12 text-right">Gap</span>
        <span className="w-12 text-right">Int</span>
        <span className="w-14 text-right">Best</span>
        <span className="w-14 text-right">Last</span>
        <span className="w-9 text-right">L-3</span>
        <span className="w-9 text-right">L-2</span>
        <span className="w-9 text-right">L-1</span>
      </div>

      <div className="flex-1 overflow-y-auto min-h-0">
        {standingsByClass.map(([classId, classDrivers]) => {
          const firstDriver = classDrivers[0];
          const carClass = firstDriver?.carClass;
          const classColorHex =
            carClass?.color !== undefined
              ? `#${carClass.color.toString(16).padStart(6, '0')}`
              : '#94a3b8';
          return (
            <div key={classId}>
              {/* Class header */}
              <div
                className="flex items-center gap-2 bg-slate-900 px-2 py-0.5 border-y border-slate-700/30"
                style={{ borderLeftColor: classColorHex, borderLeftWidth: 2 }}
              >
                <span
                  className="text-xs font-extrabold uppercase tracking-widest"
                  style={{ color: classColorHex }}
                >
                  {carClass?.name}
                </span>
              </div>
              {/* Driver rows */}
              {classDrivers.map((driver, idx) => {
                const isPlayer = driver.isPlayer;
                const isFollowed = driver.carIdx === followedCarIdx;
                return (
                  <div
                    key={driver.carIdx}
                    ref={
                      isFollowed
                        ? (followedRef as React.RefObject<HTMLDivElement>)
                        : undefined
                    }
                    className={[
                      'flex items-center px-1 py-px text-xs border-b border-white/5',
                      idx % 2 === 0 ? 'bg-slate-800/70' : 'bg-slate-900/70',
                      isPlayer ? 'bg-yellow-500/20 text-amber-300' : '',
                      isFollowed ? 'ring-1 ring-indigo-500/50' : '',
                      !driver.onTrack ? 'opacity-60' : '',
                    ]
                      .filter(Boolean)
                      .join(' ')}
                  >
                    <span className="w-6">
                      <PositionCell driver={driver} />
                    </span>
                    <span className="w-8">
                      <CarNumberCell driver={driver} />
                    </span>
                    <span className="flex-1 truncate">
                      <DriverNameCell driver={driver} />
                    </span>
                    <span className="w-5">
                      <CompoundCell driver={driver} />
                    </span>
                    <span className="w-16 text-right">
                      <BadgeCell driver={driver} format="rating" />
                    </span>
                    <span className="w-5">
                      <PitStatusCell driver={driver} />
                    </span>
                    <span className="w-12 text-right">
                      <DeltaCell driver={driver} type="gap" />
                    </span>
                    <span className="w-12 text-right">
                      <DeltaCell driver={driver} type="interval" />
                    </span>
                    <span className="w-14 text-right">
                      <FastestTimeCell driver={driver} />
                    </span>
                    <span className="w-14 text-right">
                      <LastTimeCell driver={driver} />
                    </span>
                    <span className="w-9 text-right">
                      <LapTimeDeltasCell driver={driver} lapOffset={3} />
                    </span>
                    <span className="w-9 text-right">
                      <LapTimeDeltasCell driver={driver} lapOffset={2} />
                    </span>
                    <span className="w-9 text-right">
                      <LapTimeDeltasCell driver={driver} lapOffset={1} />
                    </span>
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
});
GantryStandings.displayName = 'GantryStandings';
```

**Note:** The prop names on cell components (`driver`, `format`, `type`, `lapOffset`) are illustrative based on the existing Standings code. Step 1 instructs you to read each cell file to confirm the exact interface — adjust any that differ.

- [ ] **Step 3: Create `GantryStandings.stories.tsx`**

```typescript
import type { Meta, StoryObj } from '@storybook/react';
import { TelemetryDecorator } from '@irdashies/storybook';
import { GantryStandings } from './GantryStandings';

const meta: Meta<typeof GantryStandings> = {
  component: GantryStandings,
  decorators: [TelemetryDecorator()],
};
export default meta;

export const Default: StoryObj<typeof GantryStandings> = {
  args: { followedCarIdx: null },
};

export const WithFollowedDriver: StoryObj<typeof GantryStandings> = {
  args: { followedCarIdx: 2 },
};
```

- [ ] **Step 4: Verify in Storybook**

```bash
npm run storybook
```

Navigate to GantryStandings. Expected: standings table with all 13 columns renders with mock data.

- [ ] **Step 5: Commit**

```bash
git add src/frontend/components/Gantry/components/GantryStandings/
git commit -m "feat: add GantryStandings with all 13 columns and follow-driver scrolling"
```

---

## Task 14: Incidents Panel

**Files:**

- Create: `src/frontend/components/Gantry/components/GantryIncidents/IncidentRow.tsx`
- Create: `src/frontend/components/Gantry/components/GantryIncidents/GantryIncidents.tsx`
- Create: `src/frontend/components/Gantry/components/GantryIncidents/GantryIncidents.stories.tsx`

- [ ] **Step 1: Create `IncidentRow.tsx`**

```tsx
import { memo, useState } from 'react';
import { Copy } from '@phosphor-icons/react';
import type { Incident } from '../../../../../types/raceControl';
import { IncidentType } from '../../../../../types/raceControl';
import { useTelemetryValue } from '../../../../context/TelemetryStore/TelemetryStore';

const TYPE_STYLES: Record<IncidentType, { label: string; classes: string }> = {
  [IncidentType.PitEntry]: {
    label: 'Pit Entry',
    classes: 'bg-blue-500/20 text-blue-400',
  },
  [IncidentType.OffTrack]: {
    label: 'Off Track',
    classes: 'bg-yellow-500/20 text-yellow-400',
  },
  [IncidentType.Slowdown]: {
    label: 'Slowdown',
    classes: 'bg-orange-500/20 text-orange-400',
  },
  [IncidentType.Crash]: {
    label: 'Crash',
    classes: 'bg-red-500/20 text-red-400',
  },
  [IncidentType.BlackFlag]: {
    label: 'Black Flag',
    classes: 'bg-white/10 text-slate-300',
  },
};

const formatSessionTime = (seconds: number): string => {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  return h > 0
    ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
    : `${m}:${String(s).padStart(2, '0')}`;
};

interface Props {
  incident: Incident;
  isOdd: boolean;
}

export const IncidentRow = memo(({ incident, isOdd }: Props) => {
  const isReplayPlaying = useTelemetryValue('IsReplayPlaying');
  const canReplay = Boolean(isReplayPlaying);
  const [copied, setCopied] = useState(false);
  const isDev = process.env.NODE_ENV === 'development';
  const style = TYPE_STYLES[incident.type];

  const handleReplay = (seconds: number) => {
    window.raceControlBridge?.replayIncident(incident, seconds);
  };

  const handleCopyLog = async () => {
    if (!incident.debug) return;
    await navigator.clipboard.writeText(
      JSON.stringify(incident.debug, null, 2)
    );
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div
      className={`px-3 py-2 border-b border-white/5 ${isOdd ? 'bg-slate-900/80' : 'bg-slate-800/50'}`}
    >
      <div className="flex items-center gap-2 mb-1">
        <span
          className={`px-1.5 py-0.5 rounded text-xs font-extrabold uppercase tracking-wider flex-shrink-0 ${style.classes}`}
        >
          {style.label}
        </span>
        <span className="text-white font-bold text-sm">
          #{incident.carNumber}
        </span>
        <span className="text-slate-300 text-sm flex-1 truncate">
          {incident.driverName}
        </span>
        <span className="text-slate-500 text-xs flex-shrink-0">
          L{incident.lapNum}
        </span>
        <span className="text-slate-600 text-xs flex-shrink-0">
          {formatSessionTime(incident.sessionTime)}
        </span>
      </div>
      <div className="flex items-center gap-1 justify-end">
        {!canReplay && (
          <span className="text-slate-600 text-xs flex-1">
            Live — replay unavailable
          </span>
        )}
        {([5, 10, 30] as const).map((seconds) => (
          <button
            key={seconds}
            onClick={() => handleReplay(seconds)}
            disabled={!canReplay}
            className={[
              'px-2 py-0.5 rounded text-xs font-bold',
              canReplay
                ? 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/40 hover:bg-indigo-500/30'
                : 'bg-white/5 text-slate-600 border border-slate-700 cursor-not-allowed',
            ].join(' ')}
          >
            -{seconds}s
          </button>
        ))}
        {isDev && incident.debug && (
          <button
            onClick={handleCopyLog}
            className="ml-1 flex items-center gap-1 px-2 py-0.5 rounded text-xs font-bold bg-slate-700 text-slate-400 hover:text-slate-200 border border-slate-600"
          >
            <Copy size={10} />
            {copied ? 'Copied!' : 'Log'}
          </button>
        )}
      </div>
    </div>
  );
});
IncidentRow.displayName = 'IncidentRow';
```

**Note:** Read the actual `TelemetryStore` to verify the hook name for reading a single telemetry value (`useTelemetryValue` vs `usePlayerTelemetry` vs another pattern). Adjust accordingly.

- [ ] **Step 2: Create `GantryIncidents.tsx`**

```tsx
import { memo, useMemo } from 'react';
import { IncidentType } from '../../../../../types/raceControl';
import {
  useRaceControlStore,
  useFilteredIncidents,
} from '../../../../context/RaceControlStore/RaceControlStore';
import { IncidentRow } from './IncidentRow';

const ALL_TYPES = Object.values(IncidentType);

const TYPE_LABELS: Record<IncidentType, string> = {
  [IncidentType.PitEntry]: 'Pit Entry',
  [IncidentType.OffTrack]: 'Off Track',
  [IncidentType.Slowdown]: 'Slowdown',
  [IncidentType.Crash]: 'Crash',
  [IncidentType.BlackFlag]: 'Black Flag',
};

const CHIP_COLORS: Record<IncidentType, string> = {
  [IncidentType.PitEntry]: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
  [IncidentType.OffTrack]:
    'bg-yellow-500/15 text-yellow-400 border-yellow-500/30',
  [IncidentType.Slowdown]:
    'bg-orange-500/15 text-orange-400 border-orange-500/30',
  [IncidentType.Crash]: 'bg-red-500/15 text-red-400 border-red-500/30',
  [IncidentType.BlackFlag]: 'bg-white/8 text-slate-300 border-slate-600',
};

export const GantryIncidents = memo(() => {
  const allIncidents = useRaceControlStore((s) => s.incidents);
  const activeTypeFilters = useRaceControlStore((s) => s.activeTypeFilters);
  const driverFilter = useRaceControlStore((s) => s.driverFilter);
  const toggleTypeFilter = useRaceControlStore((s) => s.toggleTypeFilter);
  const setDriverFilter = useRaceControlStore((s) => s.setDriverFilter);
  const filteredIncidents = useFilteredIncidents();

  const uniqueDrivers = useMemo(() => {
    const seen = new Map<
      number,
      { carIdx: number; name: string; carNumber: string }
    >();
    allIncidents.forEach((i) => {
      if (!seen.has(i.carIdx))
        seen.set(i.carIdx, {
          carIdx: i.carIdx,
          name: i.driverName,
          carNumber: i.carNumber,
        });
    });
    return Array.from(seen.values());
  }, [allIncidents]);

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Filters */}
      <div className="flex items-center flex-wrap gap-1 bg-slate-900 border-b border-slate-700/50 px-2 py-1.5 flex-shrink-0">
        <span className="text-xs text-slate-500 uppercase tracking-wider mr-1">
          Show:
        </span>
        {ALL_TYPES.map((type) => (
          <button
            key={type}
            onClick={() => toggleTypeFilter(type)}
            className={[
              'px-2 py-0.5 rounded-full text-xs font-bold border transition-opacity',
              CHIP_COLORS[type],
              !activeTypeFilters.has(type) && 'opacity-30',
            ]
              .filter(Boolean)
              .join(' ')}
          >
            {TYPE_LABELS[type]}
          </button>
        ))}
        <span className="text-xs text-slate-500 uppercase tracking-wider ml-2 mr-1">
          Driver:
        </span>
        <select
          value={driverFilter ?? ''}
          onChange={(e) =>
            setDriverFilter(e.target.value ? Number(e.target.value) : null)
          }
          className="bg-slate-800 border border-slate-600 rounded text-xs text-slate-300 px-2 py-0.5"
        >
          <option value="">All</option>
          {uniqueDrivers.map((d) => (
            <option key={d.carIdx} value={d.carIdx}>
              #{d.carNumber} {d.name}
            </option>
          ))}
        </select>
        <span className="ml-auto text-xs text-slate-600">
          {allIncidents.length} events
        </span>
      </div>

      {/* Incident list */}
      <div className="flex-1 overflow-y-auto min-h-0">
        {filteredIncidents.length === 0 && (
          <div className="flex items-center justify-center h-24 text-slate-600 text-sm">
            No incidents
          </div>
        )}
        {filteredIncidents.map((incident, idx) => (
          <IncidentRow
            key={incident.id}
            incident={incident}
            isOdd={idx % 2 === 1}
          />
        ))}
      </div>
    </div>
  );
});
GantryIncidents.displayName = 'GantryIncidents';
```

- [ ] **Step 3: Create `GantryIncidents.stories.tsx`**

```typescript
import type { Meta, StoryObj } from '@storybook/react';
import { TelemetryDecorator } from '@irdashies/storybook';
import { RaceControlDecorator } from '../../../../../../.storybook/raceControlDecorator';
import { GantryIncidents } from './GantryIncidents';

const meta: Meta<typeof GantryIncidents> = {
  component: GantryIncidents,
  decorators: [TelemetryDecorator(), RaceControlDecorator()],
};
export default meta;

export const Default: StoryObj<typeof GantryIncidents> = {};
```

- [ ] **Step 4: Verify in Storybook**

```bash
npm run storybook
```

Navigate to GantryIncidents. Expected: incident list with filter chips renders. Replay buttons are disabled (not in replay mode). Dev-mode Log buttons are visible (running in development).

- [ ] **Step 5: Commit**

```bash
git add src/frontend/components/Gantry/components/GantryIncidents/
git commit -m "feat: add GantryIncidents panel with filters, replay controls, and dev Log button"
```

---

## Task 15: Lap Graph View

**Files:**

- Create: `src/frontend/components/Gantry/components/LapGraph/LapGapChart.tsx`
- Create: `src/frontend/components/Gantry/components/LapGraph/LapGraphView.tsx`
- Create: `src/frontend/components/Gantry/components/LapGraph/LapGraphView.stories.tsx`

- [ ] **Step 1: Create `LapGapChart.tsx` — custom SVG chart**

```tsx
import { memo, useState, useCallback } from 'react';

interface CarLine {
  carIdx: number;
  driverName: string;
  carNumber: string;
  color: string;
  gaps: Array<{ lap: number; gap: number }>;
}

interface TooltipState {
  x: number;
  y: number;
  carIdx: number;
  lap: number;
  gap: number;
}

interface Props {
  lines: CarLine[];
  width?: number;
  height?: number;
}

const PADDING = { top: 20, right: 20, bottom: 40, left: 55 };

export const LapGapChart = memo(
  ({ lines, width = 800, height = 400 }: Props) => {
    const [hoveredCarIdx, setHoveredCarIdx] = useState<number | null>(null);
    const [tooltip, setTooltip] = useState<TooltipState | null>(null);

    const allGaps = lines.flatMap((l) => l.gaps.map((g) => g.gap));
    const allLaps = lines.flatMap((l) => l.gaps.map((g) => g.lap));
    const maxGap = Math.max(...allGaps, 1);
    const minLap = Math.min(...allLaps, 1);
    const maxLap = Math.max(...allLaps, 1);

    const chartW = width - PADDING.left - PADDING.right;
    const chartH = height - PADDING.top - PADDING.bottom;

    const toX = (lap: number) =>
      ((lap - minLap) / Math.max(maxLap - minLap, 1)) * chartW + PADDING.left;
    const toY = (gap: number) => PADDING.top + chartH - (gap / maxGap) * chartH;

    const toPoints = (gaps: CarLine['gaps']) =>
      gaps
        .map(({ lap, gap }) => `${toX(lap).toFixed(1)},${toY(gap).toFixed(1)}`)
        .join(' ');

    // Grid lines
    const lapTicks = Array.from(
      { length: Math.min(maxLap - minLap + 1, 20) },
      (_, i) =>
        minLap +
        Math.round((i * (maxLap - minLap)) / Math.min(maxLap - minLap, 19))
    );
    const gapTicks = [0, maxGap * 0.25, maxGap * 0.5, maxGap * 0.75, maxGap];

    return (
      <svg
        width={width}
        height={height}
        className="font-sans"
        onMouseLeave={() => {
          setHoveredCarIdx(null);
          setTooltip(null);
        }}
      >
        {/* Grid */}
        {gapTicks.map((gap) => (
          <g key={gap}>
            <line
              x1={PADDING.left}
              y1={toY(gap)}
              x2={width - PADDING.right}
              y2={toY(gap)}
              stroke="rgba(255,255,255,0.06)"
              strokeWidth={1}
            />
            <text
              x={PADDING.left - 4}
              y={toY(gap) + 4}
              textAnchor="end"
              fontSize={9}
              fill="rgba(255,255,255,0.3)"
            >
              {gap.toFixed(gap < 10 ? 1 : 0)}s
            </text>
          </g>
        ))}
        {lapTicks.map((lap) => (
          <g key={lap}>
            <line
              x1={toX(lap)}
              y1={PADDING.top}
              x2={toX(lap)}
              y2={height - PADDING.bottom}
              stroke="rgba(255,255,255,0.06)"
              strokeWidth={1}
            />
            <text
              x={toX(lap)}
              y={height - PADDING.bottom + 14}
              textAnchor="middle"
              fontSize={9}
              fill="rgba(255,255,255,0.3)"
            >
              {lap}
            </text>
          </g>
        ))}

        {/* Axis labels */}
        <text
          x={PADDING.left + chartW / 2}
          y={height - 4}
          textAnchor="middle"
          fontSize={10}
          fill="rgba(255,255,255,0.35)"
        >
          Lap
        </text>
        <text
          x={12}
          y={PADDING.top + chartH / 2}
          textAnchor="middle"
          fontSize={10}
          fill="rgba(255,255,255,0.35)"
          transform={`rotate(-90, 12, ${PADDING.top + chartH / 2})`}
        >
          Gap (s)
        </text>

        {/* Lines */}
        {lines.map((line) => {
          const isHovered = hoveredCarIdx === line.carIdx;
          const isDimmed = hoveredCarIdx !== null && !isHovered;
          return (
            <g key={line.carIdx}>
              {/* Visible line */}
              <polyline
                points={toPoints(line.gaps)}
                fill="none"
                stroke={line.color}
                strokeWidth={isHovered ? 2.5 : 1.5}
                opacity={isDimmed ? 0.6 : 1}
                style={{ transition: 'opacity 0.15s' }}
              />
              {/* Wide invisible hit target */}
              <polyline
                points={toPoints(line.gaps)}
                fill="none"
                stroke="transparent"
                strokeWidth={12}
                style={{ cursor: 'pointer' }}
                onMouseEnter={() => setHoveredCarIdx(line.carIdx)}
                onMouseMove={(e) => {
                  const svg = e.currentTarget.closest('svg')!;
                  const rect = svg.getBoundingClientRect();
                  const x = e.clientX - rect.left;
                  // Find nearest lap point
                  const nearest = line.gaps.reduce((best, g) => {
                    const dist = Math.abs(toX(g.lap) - x);
                    return dist < Math.abs(toX(best.lap) - x) ? g : best;
                  }, line.gaps[0]);
                  if (nearest)
                    setTooltip({
                      x: toX(nearest.lap),
                      y: toY(nearest.gap),
                      carIdx: line.carIdx,
                      lap: nearest.lap,
                      gap: nearest.gap,
                    });
                }}
              />
            </g>
          );
        })}

        {/* Tooltip */}
        {tooltip &&
          hoveredCarIdx !== null &&
          (() => {
            const line = lines.find((l) => l.carIdx === hoveredCarIdx);
            if (!line) return null;
            const tx = Math.min(tooltip.x + 8, width - 120);
            const ty = Math.max(tooltip.y - 30, PADDING.top);
            return (
              <g>
                <rect
                  x={tx}
                  y={ty}
                  width={110}
                  height={32}
                  rx={3}
                  fill="rgba(15,23,42,0.95)"
                  stroke="rgba(255,255,255,0.12)"
                />
                <text
                  x={tx + 6}
                  y={ty + 13}
                  fontSize={9}
                  fontWeight="bold"
                  fill={line.color}
                >
                  #{line.carNumber} {line.driverName}
                </text>
                <text
                  x={tx + 6}
                  y={ty + 24}
                  fontSize={9}
                  fill="rgba(255,255,255,0.6)"
                >
                  Lap {tooltip.lap} · Gap {tooltip.gap.toFixed(2)}s
                </text>
              </g>
            );
          })()}
      </svg>
    );
  }
);
LapGapChart.displayName = 'LapGapChart';
```

- [ ] **Step 2: Create `LapGraphView.tsx`**

```tsx
import { memo, useState, useMemo } from 'react';
import { useLapGapStore } from '../../../../context/LapGapStore/LapGapStore';
import { useDriverStandings } from '../../Standings/hooks/useDriverStandings';
import { useDriverCarIdx } from '../../../../context'; // or wherever this hook lives
import { LapGapChart } from './LapGapChart';

export const LapGraphView = memo(() => {
  const lapGaps = useLapGapStore((s) => s.lapGaps);
  // useDriverStandings returns [classId, Standings[]][] — array of [classId, drivers] tuples
  const standingsByClass = useDriverStandings();
  const playerCarIdx = useDriverCarIdx();

  // Flatten all drivers for player-class lookup
  const allDrivers = useMemo(
    () => standingsByClass.flatMap(([, classDrivers]) => classDrivers),
    [standingsByClass]
  );

  // Build class list from each tuple's first driver's carClass data.
  // NOTE: iRacing orders classes quickest-to-slowest by CarClassEstLapTime in session data.
  // The order returned by useDriverStandings preserves that session ordering, so we use it directly.
  const orderedClasses = useMemo(
    () =>
      standingsByClass.map(([classId, classDrivers]) => ({
        id: classId,
        color:
          classDrivers[0]?.carClass?.color !== undefined
            ? `#${classDrivers[0].carClass.color.toString(16).padStart(6, '0')}`
            : '#94a3b8',
        name: classDrivers[0]?.carClass?.name ?? '',
        drivers: classDrivers,
      })),
    [standingsByClass]
  );

  const defaultClassId = useMemo(() => {
    const playerClass = allDrivers.find((d) => d.carIdx === playerCarIdx)
      ?.carClass?.id;
    return playerClass ?? orderedClasses[0]?.id ?? null;
  }, [allDrivers, playerCarIdx, orderedClasses]);

  const [selectedClassId, setSelectedClassId] = useState<number | null>(null);
  const activeClassId = selectedClassId ?? defaultClassId;

  const lines = useMemo(() => {
    if (activeClassId === null) return [];
    const activeClass = orderedClasses.find((c) => c.id === activeClassId);
    return (activeClass?.drivers ?? [])
      .map((d) => {
        const gapsRecord = lapGaps[d.carIdx] ?? {};
        const gaps = Object.entries(gapsRecord).map(([lap, gap]) => ({
          lap: Number(lap),
          gap,
        }));
        return {
          carIdx: d.carIdx,
          driverName: d.driver.name,
          carNumber: d.driver.carNum,
          color: activeClass?.color ?? '#94a3b8',
          gaps,
        };
      })
      .filter((l) => l.gaps.length > 0);
  }, [orderedClasses, lapGaps, activeClassId]);

  return (
    <div className="flex flex-col h-full overflow-hidden p-2 gap-2">
      {/* Class filter */}
      <div className="flex items-center gap-2 flex-shrink-0">
        <span className="text-xs text-slate-500 uppercase tracking-wider">
          Class:
        </span>
        <div className="flex gap-1">
          {orderedClasses.map((c) => (
            <button
              key={c.id}
              onClick={() => setSelectedClassId(c.id)}
              className={[
                'px-2 py-0.5 rounded text-xs font-bold border transition-colors',
                (selectedClassId ?? defaultClassId) === c.id
                  ? 'border-current'
                  : 'border-transparent opacity-50 hover:opacity-80',
              ].join(' ')}
              style={{ color: c.color }}
            >
              {c.name}
            </button>
          ))}
        </div>
      </div>

      {/* Chart */}
      <div className="flex-1 overflow-hidden">
        {lines.length === 0 ? (
          <div className="flex items-center justify-center h-full text-slate-600 text-sm">
            Gap data will appear as laps complete
          </div>
        ) : (
          <LapGapChart lines={lines} />
        )}
      </div>
    </div>
  );
});
LapGraphView.displayName = 'LapGraphView';
```

**Note:** Read `src/frontend/context/index.ts` to find the correct hook name for getting the player's car index (`useDriverCarIdx` or similar — it may be `useFocusCarIdx`). Class order in `standingsByClass` follows iRacing's session ordering (quickest-to-slowest by `CarClassEstLapTime`), so no additional sorting is needed.

- [ ] **Step 3: Create `LapGraphView.stories.tsx` with mock data**

```typescript
import type { Meta, StoryObj } from '@storybook/react';
import { TelemetryDecorator } from '@irdashies/storybook';
import { useLapGapStore } from '../../../../context/LapGapStore/LapGapStore';
import { useEffect } from 'react';
import { LapGraphView } from './LapGraphView';

// Inject mock lap gap data
const LapGapLoader = () => {
  const recordLapGap = useLapGapStore(s => s.recordLapGap);
  useEffect(() => {
    // Simulate 10 laps for 4 cars
    for (let lap = 1; lap <= 10; lap++) {
      recordLapGap(0, lap, 0);                          // leader
      recordLapGap(1, lap, lap * 0.3 + Math.random()); // 2nd, drifting
      recordLapGap(2, lap, lap * 0.8 - 2 + Math.random() * 2); // pitted mid-race
      recordLapGap(3, lap, 5 + Math.sin(lap) * 2);     // consistent gap
    }
  }, []);
  return null;
};

const meta: Meta<typeof LapGraphView> = {
  component: LapGraphView,
  decorators: [
    TelemetryDecorator(),
    (Story) => <><LapGapLoader /><Story /></>,
  ],
  parameters: { layout: 'fullscreen' },
};
export default meta;

export const WithData: StoryObj<typeof LapGraphView> = {};
export const NoData: StoryObj<typeof LapGraphView> = {};
```

- [ ] **Step 4: Verify in Storybook**

```bash
npm run storybook
```

Navigate to LapGraphView. Expected: line chart renders with mock data, class filter buttons visible, hover interaction works (hover one line → others dim to 60%).

- [ ] **Step 5: Run full lint**

```bash
npm run lint
```

- [ ] **Step 6: Commit**

```bash
git add src/frontend/components/Gantry/components/LapGraph/
git commit -m "feat: add LapGapChart (custom SVG) and LapGraphView with class filter and hover dimming"
```

---

## Final Verification

After all tasks are complete:

- [ ] **Run full test suite**

```bash
npm run test -- --no-coverage
```

Expected: all tests pass (no new failures).

- [ ] **Run lint**

```bash
npm run lint
```

Expected: no errors.

- [ ] **Run Storybook and verify all three stories render**

```bash
npm run storybook
```

Check: `Gantry`, `GantryStandings`, `GantryIncidents`, `LapGraphView`.

- [ ] **Start the app and verify The Gantry overlay appears**

```bash
npm start
```

Add the gantry widget to the dashboard from the settings. Verify: tab bar renders, mouse clicks register, standings populate, incidents feed shows activity.
