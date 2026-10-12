import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { getWidgetDefaultConfig } from '@irdashies/types';
import { useWindSettings } from './useWindSettings';

let savedConfig: unknown;

vi.mock('@irdashies/context', () => ({
  useDashboard: () => ({
    currentDashboard: { widgets: [{ id: 'wind', config: savedConfig }] },
  }),
}));

const defaults = getWidgetDefaultConfig('wind');

describe('useWindSettings', () => {
  it('keeps a saved config and fills values it predates from the defaults', () => {
    savedConfig = { background: { opacity: 35 }, units: 'Metric' };
    const { result } = renderHook(() => useWindSettings());
    expect(result.current).toEqual({
      ...defaults,
      background: { opacity: 35 },
      units: 'Metric',
    });
  });

  it('falls back to the defaults when a saved value is invalid', () => {
    savedConfig = { ...defaults, units: 'Furlongs' };
    const { result } = renderHook(() => useWindSettings());
    expect(result.current).toEqual(defaults);
  });
});
