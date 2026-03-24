# Gantry CPU Performance Investigation

## Status

Root cause identified and fixed. Awaiting verification run to confirm the app is no longer slow.

---

## Root Cause

`appendIncident` in `src/app/storage/incidentStorage.ts` used **synchronous file I/O** (`readFileSync` + `writeFileSync`) inside the `onIncident` listener, which fires on the main process thread. Every incident detection blocked the Node.js event loop for ~200ms (read + JSON.parse + JSON.stringify + write). Because the mock data triggers many incidents at startup (pit entries on every session reset, off-track events), this caused:

- Normal ticks: **~200ms block** (1 incident per tick)
- Periodic spikes: **~4000ms block** (20 incidents in one tick)
- Effective telemetry rate: **~5 Hz** instead of 60 Hz
- Everything halts because main process IPC to renderer windows is stalled during these blocks

The loop in `processTelemetry` itself is trivially fast (~0.1ms). All blocking was in the emit → listener → `appendIncident` call chain.

---

## Changes Made

### 1. `src/app/storage/incidentStorage.ts` — THE ACTUAL FIX

**What changed:** `appendIncident` converted from synchronous to async.

**Before:**

```typescript
export function appendIncident(
  sessionId,
  incident,
  storageDir = getStorageDir()
) {
  ensureDir(storageDir); // sync existsSync + mkdirSync
  const existing = loadIncidents(sessionId, storageDir); // readFileSync + JSON.parse
  existing.push(incident);
  fs.writeFileSync(filePath, JSON.stringify(existing)); // BLOCKS ~200ms
}
```

**After:**

```typescript
export async function appendIncident(
  sessionId,
  incident,
  storageDir = getStorageDir()
): Promise<void> {
  await fsp.mkdir(storageDir, { recursive: true }); // non-blocking
  const existing = loadIncidents(sessionId, storageDir); // still sync read (fast, small file)
  existing.push(incident);
  await fsp.writeFile(filePath, JSON.stringify(existing)); // non-blocking
}
```

**Why:** `writeFileSync` on a growing JSON file blocks the entire Node.js main thread. As the file grows, the block gets longer (up to 4 seconds). Making it async lets the event loop continue processing telemetry ticks while the disk write happens in the background.

---

### 2. `src/app/bridge/raceControlBridge.ts` — Fix + Debug

**What changed (fix):** `broadcast` moved before `appendIncident`, and `appendIncident` awaited with `.catch()`.

**Before:**

```typescript
detector.onIncident((incident) => {
  appendIncident(currentSessionId, incident); // blocked 200ms before broadcast
  broadcast(incident);
});
```

**After:**

```typescript
detector.onIncident((incident) => {
  broadcast(incident); // IPC to renderers — fast, runs immediately
  appendIncident(currentSessionId, incident).catch((err) =>
    console.error('Failed to persist incident:', err)
  ); // async, non-blocking
});
```

**Why:** Windows receive incident notifications without waiting for disk I/O. The `.catch()` prevents unhandled promise rejections if the write fails.

**What changed (debug — can be removed):** Added per-tick timing around `processTelemetry`:

```typescript
let rcTickCount = 0;
let rcTotalMs = 0;
// ... in callback:
const t0 = performance.now();
detector.processTelemetry(snap, cachedTrackLengthM);
rcTotalMs += performance.now() - t0;
if (rcTickCount % 30 === 0)
  console.log(`[RaceControl] processTelemetry avg: ...`);
```

---

### 3. `src/app/services/incidentDetector.ts` — Debug + Earlier Array Fix

**What changed (debug — can be removed):** Added per-section timing inside `processTelemetry` to distinguish loop time from emit/listener time:

```typescript
const ptStart = performance.now();
let emitCount = 0;
let emitMs = 0;
// ... wraps each this.emit() call with performance.now() timing
// At end of function:
console.log(
  `[processTelemetry] ${ptMs}ms total | ${emitCount} emits (${emitMs}ms in listeners) | loop=${ptMs - emitMs}ms`
);
```

This confirmed: loop = 0.1ms, all time was in emit listeners.

**What changed (earlier fix, session start):** Replaced array spread pattern with in-place push/shift for rolling windows:

```typescript
// Before (allocates 2 new arrays per car per frame):
state.recentRawSpeeds = [...state.recentRawSpeeds.slice(-(N - 1)), rawSpeed];
state.speedHistory = [...state.speedHistory.slice(-4), rawSpeed];

// After (zero allocations):
state.recentRawSpeeds.push(rawSpeed);
if (state.recentRawSpeeds.length > this.thresholds.suddenStopFrames)
  state.recentRawSpeeds.shift();
state.speedHistory.push(rawSpeed);
if (state.speedHistory.length > 5) state.speedHistory.shift();
```

This was the original hypothesis from the plan — it was correct and worth keeping, but was NOT the primary cause of the slowness.

---

### 4. `src/frontend/App.tsx` — Unnecessary Providers Removed

**What changed:** Removed `PitLaneProvider` and `ReferenceStoreProvider` from the Gantry window's provider tree.

**Before:**

```tsx
if (isGantryWindow()) {
  return (
    <DashboardProvider bridge={window.dashboardBridge}>
      <RunningStateProvider bridge={window.irsdkBridge}>
        <SessionProvider bridge={window.irsdkBridge} />
        <TelemetryProvider bridge={window.irsdkBridge} />
        <PitLaneProvider bridge={window.pitLaneBridge} /> // ← removed
        <ReferenceStoreProvider bridge={window.referenceLapsBridge} /> // ←
        removed
        <GantryApp />
      </RunningStateProvider>
    </DashboardProvider>
  );
}
```

**After:**

```tsx
if (isGantryWindow()) {
  return (
    <DashboardProvider bridge={window.dashboardBridge}>
      <RunningStateProvider bridge={window.irsdkBridge}>
        <SessionProvider bridge={window.irsdkBridge} />
        <TelemetryProvider bridge={window.irsdkBridge} />
        <GantryApp />
      </RunningStateProvider>
    </DashboardProvider>
  );
}
```

**Why:** The Gantry component doesn't use reference lap data or pit lane detection. These providers were subscribing to 3 telemetry arrays each at 60 Hz and running expensive per-car calculations (`collectLapData`, `detectPitTransitions`) every frame, for zero benefit in the Gantry window.

---

### 5. `src/app/storage/incidentStorage.spec.ts` — Test Fix

**What changed:** Updated 4 tests to `await appendIncident(...)` since it's now async.

---

### 6. Debug Instrumentation Added (to be cleaned up)

These files have temporary debug logging that should be removed once the fix is confirmed working:

| File                                                      | What was added                                                                       |
| --------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| `src/app/overlayManager.ts`                               | `trackIpcTime()` — logs avg IPC serialization time per message key every 5s          |
| `src/app/overlayManager.ts`                               | `browserWindow.webContents.openDevTools({ mode: 'detach' })` in `createGantryWindow` |
| `src/app/bridge/iracingSdk/mock-data/generateMockData.ts` | Logs if spread or callbacks exceed threshold ms                                      |
| `src/app/bridge/iracingSdk/mock-data/mockSdkBridge.ts`    | Logs tick avg and rate every 60 ticks                                                |
| `src/app/bridge/raceControlBridge.ts`                     | Logs `processTelemetry` avg every 30 ticks                                           |
| `src/app/services/incidentDetector.ts`                    | Logs per-section timing inside `processTelemetry` when total > 10ms                  |
| `src/frontend/components/Gantry/Gantry.tsx`               | Logs `GantryInner` renders/sec                                                       |

---

## What Was Investigated and Ruled Out

| Suspect                                                     | Verdict                                                        |
| ----------------------------------------------------------- | -------------------------------------------------------------- |
| `ReferenceLapStore.getSnapshot()` new references every tick | No — uses in-place Map mutations, never calls `set()` at 60 Hz |
| `IncidentDetector` array spread (original plan hypothesis)  | Partially correct — fixed, but NOT primary cause               |
| `LapGapStore` spread operator                               | Not 60 Hz — fires on lap completion only                       |
| `LapGapStoreUpdater` running at 60 Hz                       | Never mounted anywhere, not running                            |
| `PitLaneProvider` / `ReferenceStoreProvider` in Gantry      | Confirmed unnecessary, removed — reduces Gantry renderer work  |
| IPC serialization of 97 KB telemetry to 2 windows           | Fast (0.14–0.21ms per call) — not the bottleneck               |
| `generateMockData` `{...prevTelemetry}` spread              | Fast — no timing logs exceeded threshold                       |
| GC pressure from object allocations                         | Ruled out — loop is 0.1ms, all time was in sync I/O            |
| `GantryInner` re-rendering at 60 Hz                         | Only 1 render/sec — not the problem                            |
| `processTelemetry` loop logic                               | 0.1ms per call — completely fine                               |
| **`appendIncident` sync file I/O**                          | **ROOT CAUSE — 200ms per call, blocks event loop**             |

---

## Remaining Work / Next Steps

1. **Verify the fix** — run the app with the gantry enabled and confirm:
   - No more `[processTelemetry] Xms total | N emits (Xms in listeners)` long blocks
   - The app feels responsive
   - Incidents still persist correctly to disk

2. **Clean up debug instrumentation** — remove all the `console.log` timing code from the files listed above once the fix is confirmed.

3. **False incident investigation** — the mock data triggers many incidents (pit entries on every session reset, off-track) due to `detector.updateSession()` resetting all car states. This is benign with async I/O, but if you want to reduce incident noise in dev mode, consider checking whether `currentSessionId` is valid before persisting, or debouncing rapid session resets.

4. **LapGapStoreUpdater not mounted** — `LapGapStoreUpdater` is exported but never rendered inside the Gantry component tree, so the Lap Graph tab always shows an empty chart. This is a separate bug to fix after the performance issue is resolved.
