import { beforeEach, describe, expect, it } from 'vitest';
import type { ReferenceLap } from '@irdashies/types';
import { EMPTY_REFERENCE_LAP, useReferenceLapStore } from './ReferenceLapStore';

const lap = (finishTime: number) =>
  ({ startTime: 0, finishTime }) as ReferenceLap;

describe('ReferenceLapStore compatibility selectors', () => {
  beforeEach(() => useReferenceLapStore.getState().completeSession());

  it('prefers a driver best and falls back to the persisted class lap', () => {
    const best = lap(59);
    const persisted = lap(60);
    useReferenceLapStore.setState({
      bestLaps: new Map([[4, best]]),
      persistedLaps: new Map([[12, persisted]]),
    });
    const store = useReferenceLapStore.getState();
    expect(store.getReferenceLap(4, 12, false)).toBe(best);
    expect(store.getReferenceLap(4, 12, true)).toBe(persisted);
    expect(store.getReferenceLap(5, 12, false)).toBe(persisted);
    expect(store.getReferenceLap(5, 99, false)).toBe(EMPTY_REFERENCE_LAP);
  });

  it('clears channel-derived state', () => {
    useReferenceLapStore.setState({ bestLaps: new Map([[4, lap(59)]]) });
    useReferenceLapStore.getState().completeSession();
    expect(useReferenceLapStore.getState().bestLaps.size).toBe(0);
  });
});
