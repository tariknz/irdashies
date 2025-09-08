import type { DashboardBridge, IrSdkBridge, Telemetry } from '@irdashies/types';

declare global {
  interface Window {
    irsdkBridge: IrSdkBridge;
    dashboardBridge: DashboardBridge;
    telemetryBridge: {
      subscribeToTelemetryFields: (fields: (keyof Telemetry)[]) => Promise<void>;
      unsubscribeFromTelemetryFields: (fields: (keyof Telemetry)[]) => Promise<void>;
    };
  }
}
