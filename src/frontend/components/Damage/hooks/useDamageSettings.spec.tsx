import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { getWidgetDefaultConfig, type DamageConfig } from '@irdashies/types';
import { useDamageSettings } from './useDamageSettings';

let saved: unknown;

vi.mock('@irdashies/context', () => ({
  useDashboard: () => ({
    currentDashboard: { widgets: [{ id: 'damage', config: saved }] },
  }),
}));

const defaults = getWidgetDefaultConfig('damage') as unknown as DamageConfig;

describe('useDamageSettings', () => {
  it('layers a saved value over the defaults', () => {
    saved = { background: { opacity: 40 } };

    const { result } = renderHook(() => useDamageSettings());

    expect(result.current.background.opacity).toBe(40);
    expect(result.current.showStats).toBe(defaults.showStats);
  });

  it('falls back to the defaults for a stored config that fails validation', () => {
    saved = { background: null };

    const { result } = renderHook(() => useDamageSettings());

    expect(result.current).toEqual(defaults);
    expect(result.current.background.opacity).toBe(defaults.background.opacity);
  });
});
