// Telemetry subscription system types
import type { Telemetry } from './telemetry';

export interface TelemetryFieldSubscription {
  overlayId: string;
  fields: (keyof Telemetry)[];
  lastUpdate?: number;
}

export interface TelemetrySubscriptionManager {
  subscribe(overlayId: string, fields: (keyof Telemetry)[]): void;
  unsubscribe(overlayId: string): void;
  getSubscribedFields(): Set<keyof Telemetry>;
  getOverlaysForField(field: keyof Telemetry): string[];
  getFieldsForOverlay(overlayId: string): Set<keyof Telemetry>;
}

export type TelemetryDelta = Partial<Telemetry>;

export interface OverlayTelemetryPayload {
  overlayId: string;
  telemetry: TelemetryDelta;
  timestamp: number;
}
