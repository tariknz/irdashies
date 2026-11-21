import { parseSession, telemetryFrom } from './processorInputs';
import type { DriverControlsSnapshot } from '@irdashies/types';
import { DriverControlsProcessor } from '../../src/app/processors/DriverControlsProcessor';
import type { ReplayProbe } from './validator';
import { rateLimited } from './rateLimited';

export const createDriverControlsProbe =
  (): ReplayProbe<DriverControlsSnapshot> => {
    const processor = rateLimited(new DriverControlsProcessor());
    return {
      name: 'driver-controls-state',
      schemaVersion: 1,
      variables: [
        'SessionTick',
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
        processor.init(parseSession(text));
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
