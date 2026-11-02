import { renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import type { StandingsWidgetSettings } from '@irdashies/types';
import {
  StandingsSettingsProvider,
  useStandingsSettings,
} from './useStandingsSettings';

const overlayConfig = { background: { opacity: 10 } };

vi.mock('@irdashies/context', () => ({
  useDashboard: () => ({
    currentDashboard: {
      widgets: [
        { id: 'standings-g1', config: { background: { opacity: 99 } } },
        { id: 'standings', config: overlayConfig },
      ],
    },
  }),
}));

describe('useStandingsSettings', () => {
  it('reads the overlay Standings widget without a provider', () => {
    const { result } = renderHook(() => useStandingsSettings());
    expect(result.current).toBe(overlayConfig);
  });

  it('reads the provided config below a provider', () => {
    const config = {
      background: { opacity: 55 },
    } as StandingsWidgetSettings['config'];
    const wrapper = ({ children }: { children: ReactNode }) => (
      <StandingsSettingsProvider config={config}>
        {children}
      </StandingsSettingsProvider>
    );
    const { result } = renderHook(() => useStandingsSettings(), { wrapper });
    expect(result.current).toBe(config);
  });
});
