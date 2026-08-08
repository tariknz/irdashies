import type { RadioSnapshot, Telemetry } from '@irdashies/types';
import { RadioProcessor } from '../../src/app/processors/RadioProcessor';
import type { ReplayProbe, TelemetryFrame } from './validator';

const telemetryFrom = (frame: TelemetryFrame): Telemetry =>
  Object.fromEntries(
    Object.entries(frame).map(([name, entry]) => [
      name,
      { value: Array.isArray(entry) ? entry : [entry] },
    ])
  ) as unknown as Telemetry;

export const createRadioProbe = (): ReplayProbe<RadioSnapshot> => {
  const processor = new RadioProcessor();
  return {
    name: 'radio-state',
    schemaVersion: 1,
    variables: ['RadioTransmitCarIdx'],
    onFrame(frame) {
      processor.onFrame(telemetryFrom(frame));
      const snapshot = processor.snapshot();
      return {
        transmittingCarIdxs: [...snapshot.transmittingCarIdxs],
        version: snapshot.version,
      };
    },
    onDisconnect() {
      processor.onLifecycle({ type: 'disconnect' });
    },
  };
};
