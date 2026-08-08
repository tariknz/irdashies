import * as yaml from 'js-yaml';
import type {
  DriverControlsSnapshot,
  Session,
  Telemetry,
} from '@irdashies/types';
import { DriverControlsProcessor } from '../../src/app/processors/DriverControlsProcessor';
import type { ReplayProbe, TelemetryFrame } from './validator';

const telemetryFrom = (frame: TelemetryFrame): Telemetry =>
  Object.fromEntries(
    Object.entries(frame).map(([name, entry]) => [
      name,
      { value: Array.isArray(entry) ? entry : [entry] },
    ])
  ) as unknown as Telemetry;

export const createDriverControlsProbe =
  (): ReplayProbe<DriverControlsSnapshot> => {
    const processor = new DriverControlsProcessor();
    return {
      name: 'driver-controls-state',
      schemaVersion: 1,
      variables: [
        'Brake',
        'BrakeRaw',
        'Throttle',
        'ThrottleRaw',
        'Clutch',
        'ClutchRaw',
        'Gear',
        'Speed',
        'DisplayUnits',
        'SteeringWheelAngle',
        'BrakeABSactive',
        'RPM',
        'ShiftGrindRPM',
        'OilTemp',
        'WaterTemp',
        'EngineWarnings',
      ],
      onSessionInfo(text) {
        processor.init(yaml.load(text, { json: true }) as Session);
      },
      onFrame(frame) {
        processor.onFrame(telemetryFrom(frame));
        return { ...processor.snapshot() };
      },
      onDisconnect() {
        processor.onLifecycle({ type: 'disconnect' });
      },
    };
  };
