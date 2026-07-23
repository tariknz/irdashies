import { beforeEach, describe, expect, it } from 'vitest';
import { usePushToPassStore } from './PushToPassStore';

describe('PushToPassStore', () => {
  beforeEach(() => {
    usePushToPassStore.getState().reset();
  });

  it('keeps IL-15 opponent counts as integers', () => {
    usePushToPassStore
      .getState()
      .update(
        [false, false, false],
        [65, 65, 65],
        { 0: 205, 1: 205, 2: 205 },
        100,
        1,
        1
      );

    expect(usePushToPassStore.getState().displayStates).toEqual([
      { status: 'inactive', count: 65 },
      { status: 'inactive', count: 65 },
      { status: 'inactive', count: 65 },
    ]);
  });

  it('keeps IR18 opponent counts as integers', () => {
    usePushToPassStore
      .getState()
      .update([false, false], [65, 65], { 0: 99, 1: 99 }, 100, 1, 1);

    expect(usePushToPassStore.getState().displayStates).toEqual([
      { status: 'inactive', count: 65 },
      { status: 'inactive', count: 65 },
    ]);
  });

  it('does not add a cooldown after IR18 P2P deactivates', () => {
    const store = usePushToPassStore.getState();

    store.update([true], [65], { 0: 99 }, 100, 1, 0);
    store.update([false], [65], { 0: 99 }, 101, 1, 0);

    expect(usePushToPassStore.getState().displayStates).toEqual([
      { status: 'inactive', count: 65 },
    ]);
  });

  it('decodes Super Formula opponent counts from float32 tenths', () => {
    const encodedCount = new DataView(new ArrayBuffer(4));
    encodedCount.setFloat32(0, 12.5);

    usePushToPassStore
      .getState()
      .update(
        [false, false],
        [encodedCount.getInt32(0), 65],
        { 0: 171, 1: 171 },
        100,
        1,
        1
      );

    expect(usePushToPassStore.getState().displayStates).toEqual([
      { status: 'inactive', count: 125 },
      { status: 'inactive', count: 65 },
    ]);
  });
});
