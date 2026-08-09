import { describe, expect, it, vi } from 'vitest';
import type { ChannelBridge, RadioSnapshot } from '@irdashies/types';
import { ChannelSnapshotStore } from './ChannelSnapshotStore';

describe('ChannelSnapshotStore fixed-size microbenchmark', () => {
  it('bounds selector callbacks and selection allocations by consumer cadence', () => {
    const fastConsumerCount = 32;
    const slowConsumerCount = 32;
    const frameCount = 251;
    let now = 0;
    let publish: ((snapshot: RadioSnapshot) => void) | undefined;
    const bridgeSubscribe = vi.fn(
      (_channel: string, callback: (snapshot: RadioSnapshot) => void) => {
        publish = callback;
        return vi.fn();
      }
    );
    const bridge = { subscribe: bridgeSubscribe } as unknown as ChannelBridge;
    const store = new ChannelSnapshotStore('radio.snapshot', bridge, {
      now: () => now,
    });
    let selectorCallbacks = 0;
    let selectionAllocations = 0;
    let notifications = 0;
    const subscribeConsumer = (rateHz: number) => {
      const selection = store.createSelection(
        (snapshot) => {
          selectorCallbacks += 1;
          selectionAllocations += 1;
          return { activeCount: snapshot.transmittingCarIdxs.length };
        },
        (previous, next) => previous.activeCount === next.activeCount,
        rateHz
      );
      selection.subscribe(() => {
        notifications += 1;
      });
    };

    for (let index = 0; index < fastConsumerCount; index += 1) {
      subscribeConsumer(25);
    }
    for (let index = 0; index < slowConsumerCount; index += 1) {
      subscribeConsumer(5);
    }
    for (let frame = 0; frame < frameCount; frame += 1) {
      now = frame * 40;
      publish?.({ transmittingCarIdxs: [4], version: frame });
    }

    const expectedFastEvaluations = fastConsumerCount * frameCount;
    const expectedSlowEvaluations = slowConsumerCount * 51;
    const expectedEvaluations =
      expectedFastEvaluations + expectedSlowEvaluations;
    expect(bridgeSubscribe).toHaveBeenCalledOnce();
    expect(selectorCallbacks).toBe(expectedEvaluations);
    expect(selectionAllocations).toBe(expectedEvaluations);
    expect(notifications).toBe(fastConsumerCount + slowConsumerCount);
  });
});
