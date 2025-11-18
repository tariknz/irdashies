import type { Session, Telemetry, IrSdkBridge } from '@irdashies/types';
import mockTelemetry from '../../../irsdk/node/utils/mock-data/telemetry.json';
import mockSessionInfo from '../../../irsdk/node/utils/mock-data/session.json';

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

  // Use Sets to support multiple subscribers
  const telemetryCallbacks = new Set<(value: Telemetry) => void>();
  const sessionCallbacks = new Set<(value: Session) => void>();
  const runningStateCallbacks = new Set<(value: boolean) => void>();

  return {
    onTelemetry: (callback: (value: Telemetry) => void) => {
      console.log('📝 Mock bridge: Registering telemetry callback, total subscribers:', telemetryCallbacks.size + 1);
      telemetryCallbacks.add(callback);
      
      // Start interval only once
      if (!telemetryInterval) {
        console.log('🚀 Mock bridge: Starting telemetry interval (60fps)');
        telemetryInterval = setInterval(() => {
          let t = Array.isArray(telemetry)
            ? telemetry[telemetryIdx % telemetry.length]
            : telemetry;
          if (!t) {
            const throttleValue = prevTelemetry.Throttle.value[0];
            const brakeValue = prevTelemetry.Brake.value[0];
            t = {
              ...prevTelemetry,
              Brake: {
                ...prevTelemetry.Brake,
                value: [jitterValue(brakeValue)],
              },
              Throttle: {
                ...prevTelemetry.Throttle,
                value: [jitterValue(throttleValue)],
              },
              Gear: {
                ...prevTelemetry.Gear,
                value: [3],
              },
              Speed: {
                ...prevTelemetry.Speed,
                value: [44],
              },
            };
            prevTelemetry = t;
          }

          telemetryIdx = telemetryIdx + 1;
          const data = { ...t };
          
          // Call all registered callbacks
          telemetryCallbacks.forEach(cb => cb(data));
        }, 1000 / 60);
      }
    },
    onSessionData: (callback: (value: Session) => void) => {
      console.log('📝 Mock bridge: Registering session callback, total subscribers:', sessionCallbacks.size + 1);
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
        console.log('🚀 Mock bridge: Starting session interval (2s)');
        sessionInfoInterval = setInterval(updateSessionData, 2000);
      }
    },
    onRunningState: (callback: (value: boolean) => void) => {
      console.log('📝 Mock bridge: Registering running state callback, total subscribers:', runningStateCallbacks.size + 1);
      runningStateCallbacks.add(callback);
      
      // Send initial state immediately
      callback(true);
      
      // Start interval only once
      if (!runningStateInterval) {
        console.log('🚀 Mock bridge: Starting running state interval (1s)');
        runningStateInterval = setInterval(() => {
          runningStateCallbacks.forEach(cb => cb(true));
        }, 1000);
      }
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
