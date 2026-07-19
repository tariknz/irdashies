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
});
