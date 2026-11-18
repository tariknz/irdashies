import { describe, expect, it } from 'vitest';
import {
  broadcastTransition,
  broadcastTransitionChanged,
} from './broadcastModules';

describe('broadcastTransition', () => {
  it('reads a supported transition from the tower config', () => {
    expect(broadcastTransition({ pageTransition: 'wipe' })).toBe('wipe');
    expect(broadcastTransition({ pageTransition: 'random' })).toBe('random');
    expect(broadcastTransitionChanged({ pageTransition: 'wipe' })).toBe(true);
  });

  it('falls back to Random when the transition is missing or unsupported', () => {
    for (const config of [
      undefined,
      null,
      {},
      { pageTransition: 42 },
      { pageTransition: 'spin' },
    ]) {
      expect(broadcastTransition(config), JSON.stringify(config)).toBe(
        'random'
      );
      expect(broadcastTransitionChanged(config)).toBe(false);
    }
  });
});
