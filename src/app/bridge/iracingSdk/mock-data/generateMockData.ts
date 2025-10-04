import type { Session, Telemetry, IrSdkBridge } from '@irdashies/types';
import mockTelemetry from './telemetry.json';
import mockSessionInfo from './session.json';

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
  let telemetryInterval: NodeJS.Timeout;
  let sessionInfoInterval: NodeJS.Timeout;
  let runningStateInterval: NodeJS.Timeout;

  const telemetry = sessionData?.telemetry;
  const sessionInfo = sessionData?.sessionInfo;

  let telemetryIdx = 0;
  let sessionIdx = 0;

  let prevTelemetry = mockTelemetry as unknown as Telemetry;

  return {
    onTelemetry: (callback: (value: Telemetry) => void) => {
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
        callback({ ...t });
      }, 1000 / 60);
    },
    onSessionData: (callback: (value: Session) => void) => {
      // callback({ ...sessionInfo });
      const updateSessionData = () => {
        let s = Array.isArray(sessionInfo)
          ? sessionInfo[sessionIdx % sessionInfo.length]
          : sessionInfo;

        if (!s) s = mockSessionInfo as unknown as Session;
        sessionIdx = sessionIdx + 1;

        callback(s);
      };
      updateSessionData();
      sessionInfoInterval = setInterval(updateSessionData, 2000);
    },
    onRunningState: (callback: (value: boolean) => void) => {
      callback(true); // Set initial state
      runningStateInterval = setInterval(() => {
        callback(true);
      }, 1000);
    },
    stop: () => {
      clearInterval(telemetryInterval);
      clearInterval(sessionInfoInterval);
      clearInterval(runningStateInterval);
    },
  };
}

const jitterValue = (value: number): number => {
  return Math.max(0, Math.min(1, value + Math.random() * 0.1 - 0.05));
};
