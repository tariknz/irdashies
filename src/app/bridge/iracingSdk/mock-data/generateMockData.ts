import type { IrSdkBridge, Session, Telemetry } from '@irdashies/types';
import mockSessionInfo from '../../../irsdk/node/utils/mock-data/session.json';
import mockTelemetry from '../../../irsdk/node/utils/mock-data/telemetry.json';

export async function generateMockDataFromPath(
  path?: string
): Promise<IrSdkBridge> {
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

export function generateMockData(sessionData?: {
  telemetry: Telemetry | Telemetry[];
  sessionInfo: Session | Session[];
}): IrSdkBridge {
  let telemetryInterval: NodeJS.Timeout | null = null;
  let sessionInfoInterval: NodeJS.Timeout | null = null;
  let runningStateInterval: NodeJS.Timeout | null = null;

  const telemetry = sessionData?.telemetry;
  const sessionInfo = sessionData?.sessionInfo;

  let telemetryIdx = 0;
  let sessionIdx = 0;

  let prevTelemetry = mockTelemetry as unknown as Telemetry;

  // Demo mode: Simulate RPM and gear changes for Mazda MX-5
  let demoRpm = 2000;
  let demoGear = 1;
  let holdAtRedlineCounter = 0; // Counter to hold at redline
  const shiftRpm = 7400; // MX-5 shift point
  const minRpm = 2000;
  const rpmStep = 15; // RPM change per update
  const holdAtRedlineTicks = 15; // Hold for 1.5 seconds (15 ticks * 100ms)

  // Use Sets to support multiple subscribers
  const telemetryCallbacks = new Set<(value: Telemetry) => void>();
  const sessionCallbacks = new Set<(value: Session) => void>();
  const runningStateCallbacks = new Set<(value: boolean) => void>();

  return {
    onTelemetry: (callback: (value: Telemetry) => void) => {
      telemetryCallbacks.add(callback);

      // Start interval only once
      if (!telemetryInterval) {
        telemetryInterval = setInterval(() => {
          let t = Array.isArray(telemetry)
            ? telemetry[telemetryIdx % telemetry.length]
            : telemetry;
          if (!t) {
            const throttleValue = prevTelemetry.Throttle.value[0];
            const brakeValue = prevTelemetry.Brake.value[0];
            const jitteredBrakeValue = jitterValue(brakeValue);

            // Simulate RPM and gear changes for demo mode
            // Check if we're at or above shift RPM
            if (demoRpm >= shiftRpm) {
              // Hold at redline for a moment
              if (holdAtRedlineCounter < holdAtRedlineTicks) {
                holdAtRedlineCounter++;
                demoRpm = shiftRpm; // Keep at exactly shift RPM
              } else {
                // Shift up after holding
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
            const FUEL_START = 45.0;
            const FUEL_PER_LAP = 2.2;
            const LAP_DISTANCE_INC = 0.0007; // Increment per tick for ~24s lap at 60Hz (fast mock lap)
            const SESSION_TIME_INC = 1/60; // Seconds per tick

            // Initialize state if not present on prevTelemetry (using existing fields as state holders if needed, or just vars)
            // leveraging global vars defined outside this scope would be cleaner but for now extending the closure vars
            if (typeof (prevTelemetry as any)._mockState === 'undefined') {
               (prevTelemetry as any)._mockState = {
                 fuelLevel: FUEL_START,
                 lapDistPct: 0.1, // Start a bit into the lap
                 currentLap: 3,
                 sessionTime: 600.0, // Start 10 mins in
                 sessionLaps: 15,
                 sessionLapsRemain: 12
               };
            }
            
            const state = (prevTelemetry as any)._mockState;

            // Update Lap Distance
            state.lapDistPct += LAP_DISTANCE_INC;

            // Handle Lap Completion
            if (state.lapDistPct >= 1.0) {
              state.lapDistPct = 0.0;
              state.currentLap += 1;
              state.sessionLapsRemain = Math.max(0, state.sessionLapsRemain - 1);
            }

            // Update Fuel (consume based on distance)
            // Fuel consumed = (Fuel Per Lap) * (Distance Fraction traveled this tick)
            // Since we increment dist by LAP_DISTANCE_INC, we consume that fraction of a lap's fuel
            const fuelConsumedThisTick = FUEL_PER_LAP * LAP_DISTANCE_INC;
            state.fuelLevel = Math.max(0, state.fuelLevel - fuelConsumedThisTick);

            // Update Session Time
            state.sessionTime += SESSION_TIME_INC;

            // --- Fuel Calculator Mock Logic End ---
            
            // Enable ABS when brake force is above 80% in demo mode
            const absActive = jitteredBrakeValue > 0.8;
            const prevAbs =
              prevTelemetry.BrakeABSactive ?? ({ value: [false] } as const);

            t = {
              ...prevTelemetry,
              Brake: {
                ...prevTelemetry.Brake,
                value: [jitteredBrakeValue],
              },
              Throttle: {
                ...prevTelemetry.Throttle,
                value: [jitterValue(throttleValue)],
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
                value: [state.fuelLevel]
              },
              FuelLevelPct: {
                ...prevTelemetry.FuelLevelPct,
                value: [state.fuelLevel / FUEL_TANK_MAX]
              },
              Lap: {
                ...prevTelemetry.Lap,
                value: [state.currentLap]
              },
              LapDistPct: {
                ...prevTelemetry.LapDistPct,
                value: [state.lapDistPct]
              },
              SessionTime: {
                ...prevTelemetry.SessionTime,
                value: [state.sessionTime]
              },
              SessionLapsRemain: {
                ...prevTelemetry.SessionLapsRemain,
                value: [state.sessionLapsRemain]
              },
              SessionTimeRemain: {
                 ...prevTelemetry.SessionTimeRemain,
                 value: [state.sessionLapsRemain * 90] // Roughly 1.5 min laps
              },
               IsOnTrack: {
                ...prevTelemetry.IsOnTrack, // Ensure this field exists or mock it if missing types might be tricky but assuming existing
                value: [true]
              },
              OnPitRoad: {
                 ...prevTelemetry.OnPitRoad,
                 value: [false]
              },
              BrakeABSactive: {
                ...prevAbs,
                value: [absActive],
              },
            };
            prevTelemetry = t;
          }

          telemetryIdx = telemetryIdx + 1;
          const data = { ...t };

          // Call all registered callbacks
          telemetryCallbacks.forEach(cb => cb(data));
        }, 1000 / 60); // Update at 60Hz for smooth telemetry simulation
      }

      // Return unsubscribe function
      return () => {
        telemetryCallbacks.delete(callback);
        // Stop interval if no more callbacks
        if (telemetryCallbacks.size === 0 && telemetryInterval) {
          clearInterval(telemetryInterval);
          telemetryInterval = null;
        }
      };
    },
    onSessionData: (callback: (value: Session) => void) => {
      sessionCallbacks.add(callback);

      const updateSessionData = () => {
        let s = Array.isArray(sessionInfo)
          ? sessionInfo[sessionIdx % sessionInfo.length]
          : sessionInfo;

        if (!s) s = mockSessionInfo as unknown as Session;
        sessionIdx = sessionIdx + 1;

        // Call all registered callbacks
        sessionCallbacks.forEach(cb => cb(s));
      };

      // Send initial data immediately
      updateSessionData();

      // Start interval only once
      if (!sessionInfoInterval) {
        sessionInfoInterval = setInterval(updateSessionData, 2000);
      }

      // Return unsubscribe function
      return () => {
        sessionCallbacks.delete(callback);
        // Stop interval if no more callbacks
        if (sessionCallbacks.size === 0 && sessionInfoInterval) {
          clearInterval(sessionInfoInterval);
          sessionInfoInterval = null;
        }
      };
    },
    onRunningState: (callback: (value: boolean) => void) => {
      runningStateCallbacks.add(callback);

      // Send initial state immediately
      callback(true);

      // Start interval only once
      if (!runningStateInterval) {
        runningStateInterval = setInterval(() => {
          runningStateCallbacks.forEach(cb => cb(true));
        }, 1000);
      }

      // Return unsubscribe function
      return () => {
        runningStateCallbacks.delete(callback);
        // Stop interval if no more callbacks
        if (runningStateCallbacks.size === 0 && runningStateInterval) {
          clearInterval(runningStateInterval);
          runningStateInterval = null;
        }
      };
    },
    stop: () => {
      console.log('🛑 Mock bridge: Stopping all intervals');
      if (telemetryInterval) clearInterval(telemetryInterval);
      if (sessionInfoInterval) clearInterval(sessionInfoInterval);
      if (runningStateInterval) clearInterval(runningStateInterval);
      telemetryCallbacks.clear();
      sessionCallbacks.clear();
      runningStateCallbacks.clear();
    },
  };
}

const jitterValue = (value: number): number => {
  return Math.max(0, Math.min(1, value + Math.random() * 0.1 - 0.05));
};
