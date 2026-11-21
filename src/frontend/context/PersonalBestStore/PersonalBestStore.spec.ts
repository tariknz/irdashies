import { beforeEach, describe, expect, it } from 'vitest';
import { usePersonalBestStore } from './PersonalBestStore';

describe('rememberPersonalBest', () => {
  beforeEach(() => {
    usePersonalBestStore.setState({ personalBests: {} });
  });

  it('keeps a faster lap in memory without touching the bridge', () => {
    window.personalBestBridge = undefined;
    const { rememberPersonalBest } = usePersonalBestStore.getState();

    rememberPersonalBest('1', 'car', 90.5);
    expect(usePersonalBestStore.getState().personalBests['1:car']).toBe(90.5);

    rememberPersonalBest('1', 'car', 89.9);
    expect(usePersonalBestStore.getState().personalBests['1:car']).toBe(89.9);
  });

  it('ignores slower and invalid laps', () => {
    const { rememberPersonalBest } = usePersonalBestStore.getState();
    rememberPersonalBest('1', 'car', 90);

    rememberPersonalBest('1', 'car', 91);
    rememberPersonalBest('1', 'car', 0);
    rememberPersonalBest('1', 'car', Number.NaN);

    expect(usePersonalBestStore.getState().personalBests['1:car']).toBe(90);
  });
});
