import { act, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import type {
  ChannelBridge,
  Session,
  SessionBarSnapshot,
  Telemetry,
} from '@irdashies/types';
import { mapLmuTelemetry } from '../../src/app/lmu/mapTelemetry';
import { fixture } from '../../src/app/lmu/rawFixture';
import { SessionBarProcessor } from '../../src/app/processors/SessionBarProcessor';
import { HumidityItem } from '../../src/frontend/components/Standings/components/SessionBar/components/HumidityItem/HumidityItem';

const previousBridge = window.channelBridge;
afterEach(() => {
  window.channelBridge = previousBridge;
});

describe('humidity across telemetry sources', () => {
  it('clears a prior humidity for unsupported LMU and preserves a real iRacing zero', () => {
    const processor = new SessionBarProcessor();
    processor.init({} as Session);
    const listeners = new Set<(snapshot: SessionBarSnapshot) => void>();
    const bridge: ChannelBridge = {
      subscribe(channel, callback) {
        if (channel !== 'session-bar.snapshot') return () => undefined;
        const listener = callback as (snapshot: SessionBarSnapshot) => void;
        listeners.add(listener);
        return () => {
          listeners.delete(listener);
        };
      },
    };
    window.channelBridge = bridge;
    const view = render(<HumidityItem settings={undefined} standalone />);
    const emit = (frame: Telemetry) => {
      act(() => {
        processor.onFrame(frame);
        for (const listener of listeners) listener(processor.snapshot());
      });
    };
    const iracingFrame = (time: number, humidity: number): Telemetry =>
      ({
        SessionTime: { value: [time] },
        SessionNum: { value: [1] },
        RelativeHumidity: { value: [humidity] },
      }) as unknown as Telemetry;

    emit(iracingFrame(1, 0));
    expect(view.container.textContent).toBe('0%');
    emit(iracingFrame(2, 0.45));
    expect(view.container.textContent).toBe('45%');

    const lmuFrame = mapLmuTelemetry(fixture());
    expect(lmuFrame).not.toHaveProperty('RelativeHumidity');
    emit(lmuFrame);
    expect(processor.snapshot().relativeHumidity).toBeUndefined();
    expect(view.container.textContent).toBe('- %');

    emit(iracingFrame(251, 0));
    expect(view.container.textContent).toBe('0%');
  });
});
