import { describe, expect, it } from 'vitest';
import {
  broadcastExcludedCars,
  broadcastModuleChanged,
  broadcastModuleDefaults,
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

describe('broadcastExcludedCars', () => {
  it('reads the saved list from the tower config, dropping bad entries', () => {
    expect(
      broadcastExcludedCars({
        excludedCars: [{ carId: 7, name: 'Safety' }, { carId: 'x' }],
      })
    ).toEqual([{ carId: 7, name: 'Safety' }]);
    expect(broadcastExcludedCars(undefined)).toEqual([]);
  });

  it('is left alone by a tower reset and does not mark the tower changed', () => {
    expect(broadcastModuleDefaults('broadcast')).not.toHaveProperty(
      'excludedCars'
    );
    const saved = {
      ...broadcastModuleDefaults('broadcast'),
      excludedCars: [{ carId: 7, name: 'Safety' }],
    };
    expect(broadcastModuleChanged('broadcast', saved)).toBe(false);
    expect({ ...saved, ...broadcastModuleDefaults('broadcast') }).toMatchObject(
      { excludedCars: [{ carId: 7, name: 'Safety' }] }
    );
  });
});
