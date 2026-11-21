import { telemetryFrom } from './processorInputs';
import type { RadioSnapshot } from '@irdashies/types';
import { RadioProcessor } from '../../src/app/processors/RadioProcessor';
import type { ReplayProbe } from './validator';

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
