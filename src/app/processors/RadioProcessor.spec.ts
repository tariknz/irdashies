import { describe, expect, it } from 'vitest';
import type { Telemetry } from '@irdashies/types';
import { RadioProcessor } from './RadioProcessor';

const frame = (carIdxs: unknown) =>
  ({ RadioTransmitCarIdx: { value: carIdxs } }) as Telemetry;

describe('RadioProcessor', () => {
  it('publishes only valid transmitting car indices when the signal changes', () => {
    const processor = new RadioProcessor();
    processor.onFrame(frame([-1]));
    expect(processor.snapshot()).toEqual({
      transmittingCarIdxs: [],
      version: 0,
    });

    processor.onFrame(frame([-1, 5, 8]));
    expect(processor.snapshot()).toEqual({
      transmittingCarIdxs: [5, 8],
      version: 1,
    });
    processor.onFrame(frame([-1, 5, 8]));
    expect(processor.snapshot().version).toBe(1);
    processor.onFrame(frame([-1]));
    expect(processor.snapshot()).toEqual({
      transmittingCarIdxs: [],
      version: 2,
    });
  });

  it('does not republish reordered or duplicate transmitter indexes', () => {
    const processor = new RadioProcessor();
    processor.onFrame(frame([8, 5]));
    expect(processor.snapshot()).toEqual({
      transmittingCarIdxs: [5, 8],
      version: 1,
    });
    processor.onFrame(frame([5, 5, 8]));
    expect(processor.snapshot()).toEqual({
      transmittingCarIdxs: [5, 8],
      version: 1,
    });
  });

  it('clears on lifecycle transitions and ignores replay scrubbing', () => {
    const processor = new RadioProcessor();
    processor.onFrame(frame([5]));
    processor.onLifecycle({ type: 'sessionNumChange' });
    expect(processor.snapshot().transmittingCarIdxs).toEqual([]);

    processor.onLifecycle({ type: 'enter', replay: true });
    processor.onFrame(frame([8]));
    expect(processor.snapshot().transmittingCarIdxs).toEqual([]);

    processor.onLifecycle({ type: 'enter', replay: false });
    processor.onFrame(frame([8]));
    expect(processor.snapshot().transmittingCarIdxs).toEqual([8]);
  });
});
