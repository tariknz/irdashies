import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useDamageCar } from './useDamageCar';

const mocks = vi.hoisted(() => ({
  driver: {} as Record<string, unknown>,
}));

vi.mock('@irdashies/context', () => ({
  useDriverCarIdx: () => 3,
  useSessionStore: (
    select: (state: {
      session: { DriverInfo: { Drivers: Record<string, unknown>[] } };
    }) => unknown
  ) =>
    select({
      session: { DriverInfo: { Drivers: [{ CarIdx: 3, ...mocks.driver }] } },
    }),
}));

vi.mock('@irdashies/domain/tachometer/usePlayerCarData', () => ({
  usePlayerCarData: () => ({ carClass: 'GT3' }),
}));

describe('useDamageCar', () => {
  it('reads the LMU model when the screen name is the team', () => {
    mocks.driver = {
      CarPath: 'WRT_31_2025',
      CarModel: 'BMW M4 GT3',
      CarScreenName: 'Team WRT 2025 #31',
    };

    expect(renderHook(() => useDamageCar()).result.current.bodyStyle).toBe(
      'gtFront'
    );
  });

  it('still reads the screen name when there is no model', () => {
    mocks.driver = {
      CarPath: 'porsche992rgt3',
      CarScreenName: 'Porsche 911 GT3 R (992)',
    };

    expect(renderHook(() => useDamageCar()).result.current.bodyStyle).toBe(
      'gtRear'
    );
  });
});
