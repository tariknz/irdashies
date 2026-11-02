import { renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useFocusDriver } from './useFocusDriver';

const logger = vi.hoisted(() => ({ warn: vi.fn() }));
vi.mock('@irdashies/utils/logger', () => ({ default: logger }));

const withBridge = (focusDriver: (carNumber: string) => Promise<void>) => {
  Object.defineProperty(window, 'raceControlBridge', {
    configurable: true,
    value: { focusDriver },
  });
};

describe('useFocusDriver', () => {
  afterEach(() => {
    Reflect.deleteProperty(window, 'raceControlBridge');
    logger.warn.mockClear();
  });

  it('points the camera at the car number', () => {
    const focusDriver = vi.fn().mockResolvedValue(undefined);
    withBridge(focusDriver);
    const { result } = renderHook(() => useFocusDriver());

    result.current('17');

    expect(focusDriver).toHaveBeenCalledWith('17');
  });

  it('logs a failed request instead of throwing', async () => {
    withBridge(vi.fn().mockRejectedValue(new Error('no sim')));
    const { result } = renderHook(() => useFocusDriver());

    result.current('17');

    await vi.waitFor(() => expect(logger.warn).toHaveBeenCalled());
  });

  it('does nothing without a bridge', () => {
    const { result } = renderHook(() => useFocusDriver());

    expect(() => result.current('17')).not.toThrow();
  });
});
