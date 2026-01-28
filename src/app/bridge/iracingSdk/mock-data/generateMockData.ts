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
