import type { IrSdkSourceBridge, Session, Telemetry } from '@irdashies/types';
import { GlobalFlags, SessionState } from '@irdashies/types';
import mockSessionInfo from '../../../irsdk/node/utils/mock-data/session.json';
import mockTelemetry from '../../../irsdk/node/utils/mock-data/telemetry.json';

const MOCK_TEAM_NAMES = [
  'Apex Racing',
  'Northstar Motorsport',
  'Pacific Coast Endurance Racing',
  'Cornerstone Esports',
  'Velocity Works',
  'Blue Flag Racing',
  'Redline Motorsport',
  'Silver Arrow Racing',
  'Gridline Engineering',
  'Summit Racing',
];

export async function generateMockDataFromPath(
  path?: string
): Promise<IrSdkSourceBridge> {
  if (!path) {
    return generateMockData();
  }

  const telemetry = (await import(/* @vite-ignore */ `${path}/telemetry.json`))
    .default;
  const sessionInfo = (await import(/* @vite-ignore */ `${path}/session.json`))
    .default;

  return generateMockData({
    telemetry,
    sessionInfo,
  });
}

function createMockFeed<T>(intervalMs: number, sample: () => T) {
  const subscribers = new Set<(value: T) => void>();
  let timer: ReturnType<typeof setInterval> | undefined;
  const publish = () => {
    const value = sample();
    subscribers.forEach((callback) => callback(value));
  };
  const stop = () => {
    clearInterval(timer);
    timer = undefined;
    subscribers.clear();
  };
  return {
    publish,
    stop,
    subscribe(callback: (value: T) => void) {
      subscribers.add(callback);
      timer ??= setInterval(publish, intervalMs);
      return () => {
        subscribers.delete(callback);
        if (!subscribers.size) stop();
      };
    },
  };
}

export function generateMockData(sessionData?: {
  telemetry: Telemetry | Telemetry[];
  sessionInfo: Session | Session[];
}): IrSdkSourceBridge {
  const telemetry = sessionData?.telemetry;
  const sessionInfo = sessionData?.sessionInfo;

  let telemetryIdx = 0;
  let sessionIdx = 0;

  let prevTelemetry = mockTelemetry as unknown as Telemetry;

  const mockState = {
    fuelLevel: 45.0, // FUEL_START
    lapDistPct: 0.1, // Start a bit into the lap
    currentLap: 3,
    sessionTime: 600.0, // Start 10 mins in
    sessionLaps: 15,
    sessionLapsRemain: 12,
  };

  // Animate all cars around the track — seed initial positions from mock telemetry
  const playerCarIdx = mockSessionInfo.DriverInfo.DriverCarIdx;
  const carLapDistPcts = [
    ...(prevTelemetry.CarIdxLapDistPct.value as number[]),
  ];
  // Per-car speed multipliers: 1-3% variation so gaps are realistic
  const carSpeedMultipliers = carLapDistPcts.map((pct, idx) => {
    if (pct < 0) return 0; // not on track
    return 1 + (((idx * 7) % 7) - 3) / 100; // -3% to +3% variation
  });

  const sectorStarts = mockSessionInfo.SplitTimeInfo.Sectors.map(
    (sector) => sector.SectorStartPct
  );

  function getPlayerSectorIdx(lapDistPct: number): number {
    return Math.max(
      0,
      sectorStarts.findLastIndex((start) => lapDistPct >= start)
    );
  }

  /** Generate a fresh set of per-sector multipliers, each ±1% of baseline. */
  function newSectorMultipliers(): number[] {
    return sectorStarts.map(() => 0.99 + Math.random() * 0.02);
  }

  let playerSectorMultipliers = newSectorMultipliers();
  let playerCurrentSectorIdx = getPlayerSectorIdx(mockState.lapDistPct);

  // P2P demo: carIdx 1-4 are overridden to Dallara IR18 (CarID 99) in demo session
  const P2P_DEMO_CAR_IDXS = [1, 2, 3, 4];
  const P2P_IR18_CAR_ID = 99;

  // P2P demo telemetry state
  const p2pDemo = {
    frame: 0,
    activeCount: 100, // carIdx 2: slowly decreasing while active
  };
  // Cycle lengths for carIdx 4 (cooldown demo car): 5s active → transition → 5s inactive → repeat
  const P2P_CYCLE_FRAMES = 60 * 20; // 20s full cycle
  const P2P_ACTIVE_FRAMES = 60 * 5; // 5s active phase

  // Demo mode: Simulate RPM and gear changes for Mazda MX-5
  let demoRpm = 2000;
  let demoGear = 1;
  let holdAtRedlineCounter = 0; // Counter to hold at redline
  const shiftRpm = 7400; // BMW M4 GT4 shift point
  const minRpm = 2000;
  const rpmStep = 15; // RPM change per update
  const holdAtRedlineTicks = 15; // Hold for 1.5 seconds (15 ticks * 100ms)

  const telemetryFeed = createMockFeed(1000 / 60, () => {
    let t = Array.isArray(telemetry)
      ? telemetry[telemetryIdx % telemetry.length]
      : telemetry;
    if (!t) {
      const throttleValue = prevTelemetry.Throttle.value[0];
      const brakeValue = prevTelemetry.Brake.value[0];
      const jitteredBrakeValue = jitterValue(brakeValue);
      const jitteredThrottleValue = jitterValue(throttleValue);

      if (demoRpm >= shiftRpm) {
        // Hold at redline for a moment
        if (holdAtRedlineCounter < holdAtRedlineTicks) {
          holdAtRedlineCounter++;
          demoRpm = shiftRpm; // Keep at exactly shift RPM
        } else {
          demoGear = Math.min(6, demoGear + 1);
          demoRpm = minRpm + 1000; // Drop RPM after shift
          holdAtRedlineCounter = 0; // Reset counter
          // After reaching 6th gear, loop back to 1st
          if (demoGear > 6) {
            demoGear = 1;
          }
        }
      } else {
        // Normal RPM increase
        demoRpm += rpmStep;
      }

      // --- Fuel Calculator Mock Logic Start ---
      // Constants for simulation
      const FUEL_TANK_MAX = 60.0;
      const FUEL_PER_LAP = 2.2;
      const LAP_DISTANCE_INC = 0.0007; // Increment per tick for ~24s lap at 60Hz (fast mock lap)
      const SESSION_TIME_INC = 1 / 60; // Seconds per tick

      // Update Lap Distance — apply this sector's speed multiplier so
      // sector times vary by ±1% of baseline, changing each lap.
      const newSectorIdx = getPlayerSectorIdx(mockState.lapDistPct);
      if (newSectorIdx !== playerCurrentSectorIdx) {
        playerCurrentSectorIdx = newSectorIdx;
      }
      mockState.lapDistPct +=
        LAP_DISTANCE_INC * playerSectorMultipliers[playerCurrentSectorIdx];

      // Handle Lap Completion
      if (mockState.lapDistPct >= 1.0) {
        mockState.lapDistPct = 0.0;
        mockState.currentLap += 1;
        mockState.sessionLapsRemain = Math.max(
          0,
          mockState.sessionLapsRemain - 1
        );
        // Pick new per-sector multipliers for the next lap
        playerSectorMultipliers = newSectorMultipliers();
        playerCurrentSectorIdx = 0;
      }

      // Update Fuel (consume based on distance)
      // Fuel consumed = (Fuel Per Lap) * (Distance Fraction traveled this tick)
      // Since we increment dist by LAP_DISTANCE_INC, we consume that fraction of a lap's fuel
      const fuelConsumedThisTick = FUEL_PER_LAP * LAP_DISTANCE_INC;
      mockState.fuelLevel = Math.max(
        0,
        mockState.fuelLevel - fuelConsumedThisTick
      );

      // Update Session Time
      mockState.sessionTime += SESSION_TIME_INC;

      // --- Fuel Calculator Mock Logic End ---

      // Animate all on-track cars forward; sync player car with mockState
      for (let i = 0; i < carLapDistPcts.length; i++) {
        if (carLapDistPcts[i] < 0) continue; // not on track
        if (i === playerCarIdx) {
          carLapDistPcts[i] = mockState.lapDistPct;
        } else {
          carLapDistPcts[i] =
            (carLapDistPcts[i] + LAP_DISTANCE_INC * carSpeedMultipliers[i]) % 1;
        }
      }

      const state = mockState;

      // Enable ABS when brake force is above 80% in demo mode
      const absActive = jitteredBrakeValue > 0.8;
      const prevAbs =
        prevTelemetry.BrakeABSactive ?? ({ value: [false] } as const);

      // P2P demo: advance frame counter and update state
      p2pDemo.frame++;
      // carIdx 2 (active): count decreases 1/s, resets to 100 when exhausted
      if (p2pDemo.frame % 60 === 0) {
        p2pDemo.activeCount =
          p2pDemo.activeCount > 0 ? p2pDemo.activeCount - 1 : 100;
      }
      // carIdx 4 (cooldown cycle): active for 5s, then transitions to inactive
      const cycleFrame = p2pDemo.frame % P2P_CYCLE_FRAMES;
      const cooldownCarActive = cycleFrame < P2P_ACTIVE_FRAMES;

      const demoP2PStatus = [
        ...prevTelemetry.CarIdxP2P_Status.value,
      ] as boolean[];
      const demoP2PCount = [...prevTelemetry.CarIdxP2P_Count.value] as number[];
      demoP2PStatus[1] = false; // inactive
      demoP2PCount[1] = 150;
      demoP2PStatus[2] = true; // active
      demoP2PCount[2] = p2pDemo.activeCount;
      demoP2PStatus[3] = false; // exhausted
      demoP2PCount[3] = 0;
      demoP2PStatus[4] = cooldownCarActive; // cycling for cooldown demo
      demoP2PCount[4] = 80;

      t = {
        ...prevTelemetry,
        // All demo hosts simulate an active race. Recorded input above
        // retains its original state, including checkered/replay frames.
        SessionState: {
          ...prevTelemetry.SessionState,
          value: [SessionState.Racing],
        },
        SessionFlags: {
          ...prevTelemetry.SessionFlags,
          value: [GlobalFlags.Green],
        },
        Brake: {
          ...prevTelemetry.Brake,
          value: [jitteredBrakeValue],
        },
        Throttle: {
          ...prevTelemetry.Throttle,
          value: [jitteredThrottleValue],
        },
        // The demo drives with no assists, so the raw pedals are the
        // processed ones. Left as recorded they stayed at 0, and every
        // widget set to Use Raw Inputs (and the lap trace, which reads
        // raw pedals first) showed the pedals untouched.
        BrakeRaw: {
          ...prevTelemetry.BrakeRaw,
          value: [jitteredBrakeValue],
        },
        ThrottleRaw: {
          ...prevTelemetry.ThrottleRaw,
          value: [jitteredThrottleValue],
        },
        ClutchRaw: {
          ...prevTelemetry.ClutchRaw,
          value: [prevTelemetry.Clutch.value[0]],
        },
        Gear: {
          ...prevTelemetry.Gear,
          value: [demoGear],
        },
        Speed: {
          ...prevTelemetry.Speed,
          value: [44 + demoGear * 10],
        },
        RPM: {
          ...prevTelemetry.RPM,
          value: [demoRpm],
        },
        // Inject Fuel Calculator Mock Values
        FuelLevel: {
          ...prevTelemetry.FuelLevel,
          value: [state.fuelLevel],
        },
        FuelLevelPct: {
          ...prevTelemetry.FuelLevelPct,
          value: [state.fuelLevel / FUEL_TANK_MAX],
        },
        Lap: {
          ...prevTelemetry.Lap,
          value: [state.currentLap],
        },
        LapDistPct: {
          ...prevTelemetry.LapDistPct,
          value: [state.lapDistPct],
        },
        CarIdxLapDistPct: {
          ...prevTelemetry.CarIdxLapDistPct,
          value: [...carLapDistPcts],
        },
        SessionTime: {
          ...prevTelemetry.SessionTime,
          value: [state.sessionTime],
        },
        // Advance with SessionTime at iRacing's 60 ticks per second: the
        // processor host rate-limits on SessionTick, so a frozen tick
        // would run every processor on every frame.
        SessionTick: {
          ...prevTelemetry.SessionTick,
          value: [Math.round(state.sessionTime * 60)],
        },
        SessionLapsRemain: {
          ...prevTelemetry.SessionLapsRemain,
          value: [state.sessionLapsRemain],
        },
        SessionLapsRemainEx: {
          ...prevTelemetry.SessionLapsRemainEx,
          value: [state.sessionLapsRemain],
        },
        SessionTimeRemain: {
          ...prevTelemetry.SessionTimeRemain,
          value: [state.sessionLapsRemain * 90], // Roughly 1.5 min laps
        },
        IsOnTrack: {
          ...prevTelemetry.IsOnTrack,
          value: [true],
        },
        OnPitRoad: {
          ...prevTelemetry.OnPitRoad,
          value: [false],
        },
        BrakeABSactive: {
          ...prevAbs,
          value: [absActive],
        },
        CarIdxP2P_Status: {
          ...prevTelemetry.CarIdxP2P_Status,
          value: demoP2PStatus,
        },
        CarIdxP2P_Count: {
          ...prevTelemetry.CarIdxP2P_Count,
          value: demoP2PCount,
        },
        // Drive friction circle / steering meter — frozen JSON values
        // left those widgets looking dead in demo mode.
        LatAccel: {
          ...prevTelemetry.LatAccel,
          value: [
            Math.sin(state.sessionTime * 1.4) * 9.5 +
              Math.sin(state.sessionTime * 0.35) * 3,
          ],
        },
        LongAccel: {
          ...prevTelemetry.LongAccel,
          value: [
            (jitteredThrottleValue - jitteredBrakeValue) * 8 -
              Math.sin(state.sessionTime * 0.9) * 2,
          ],
        },
        SteeringWheelAngle: {
          ...prevTelemetry.SteeringWheelAngle,
          value: [
            Math.sin(state.sessionTime * 0.85) * 1.1 +
              Math.sin(state.sessionTime * 2.3) * 0.25,
          ],
        },
        CarLeftRight: {
          ...prevTelemetry.CarLeftRight,
          value: [
            // Cycle clear / left / right / both every ~3s
            ([1, 2, 3, 4, 1, 5, 6] as const)[
              Math.floor(state.sessionTime / 3) % 7
            ],
          ],
        },
      } as unknown as Telemetry;
      prevTelemetry = t;
    }

    telemetryIdx = telemetryIdx + 1;
    return t;
  });

  const sessionFeed = createMockFeed(2000, () => {
    let s = Array.isArray(sessionInfo)
      ? sessionInfo[sessionIdx % sessionInfo.length]
      : sessionInfo;

    if (!s) {
      const base = mockSessionInfo as unknown as Session;
      // Demo mode: override CarID for P2P demo drivers
      s = {
        ...base,
        WeekendInfo: {
          ...base.WeekendInfo,
          TeamRacing: 1,
          MinDrivers: 1,
          MaxDrivers: 4,
        },
        DriverInfo: {
          ...base.DriverInfo,
          Drivers: base.DriverInfo.Drivers.map((driver) => {
            if (driver.CarIsPaceCar) return driver;

            const teamIndex = (driver.CarIdx - 1) % MOCK_TEAM_NAMES.length;
            return {
              ...driver,
              TeamID: teamIndex + 1,
              TeamName: MOCK_TEAM_NAMES[teamIndex],
              CarID: P2P_DEMO_CAR_IDXS.includes(driver.CarIdx)
                ? P2P_IR18_CAR_ID
                : driver.CarID,
            };
          }),
        },
      };
    }
    sessionIdx = sessionIdx + 1;
    return s;
  });

  const runningFeed = createMockFeed(1000, () => true);
  return {
    onTelemetry: telemetryFeed.subscribe,
    onSessionData(callback) {
      const unsubscribe = sessionFeed.subscribe(callback);
      sessionFeed.publish();
      return unsubscribe;
    },
    onRunningState(callback) {
      const unsubscribe = runningFeed.subscribe(callback);
      callback(true);
      return unsubscribe;
    },
    stop() {
      telemetryFeed.stop();
      sessionFeed.stop();
      runningFeed.stop();
    },
    // eslint-disable-next-line @typescript-eslint/no-empty-function
    changeCameraNumber: () => {},
    // eslint-disable-next-line @typescript-eslint/no-empty-function
    changeReplayPosition: () => {},
    // eslint-disable-next-line @typescript-eslint/no-empty-function
    triggerReplaySessionSearch: () => {},
  };
}

const jitterValue = (value: number): number => {
  return Math.max(0, Math.min(1, value + Math.random() * 0.1 - 0.05));
};
