import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getWidgetDefaultConfig, type DashboardLayout } from '@irdashies/types';
import { DamageSettings } from './DamageSettings';

const mocks = vi.hoisted(() => ({
  dashboard: undefined as DashboardLayout | undefined,
}));

vi.mock('@irdashies/context', async () => {
  const { DEFAULT_SIM_WIDGET_SUPPORT } = await import('@irdashies/types');
  return {
    useDashboard: () => ({
      currentDashboard: mocks.dashboard,
      onDashboardUpdated: vi.fn(),
    }),
    useActiveSimulator: () => null,
    useSimWidgetSupport: () => DEFAULT_SIM_WIDGET_SUPPORT,
  };
});

const dashboardWith = (showCornerBadges: boolean) =>
  ({
    widgets: [
      {
        id: 'damage',
        enabled: true,
        layout: { x: 0, y: 0, width: 170, height: 240 },
        config: { ...getWidgetDefaultConfig('damage'), showCornerBadges },
      },
    ],
  }) as unknown as DashboardLayout;

describe('DamageSettings', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('offers the tyre % only under the corner badges it goes in', () => {
    mocks.dashboard = dashboardWith(true);
    render(<DamageSettings />);

    expect(screen.getByText('Show Corner Badges')).toBeInTheDocument();
    expect(
      screen.getByText('Show Tyre % In Corner Badges')
    ).toBeInTheDocument();
  });

  it('hides the tyre % while the corner badges are off', () => {
    mocks.dashboard = dashboardWith(false);
    render(<DamageSettings />);

    expect(screen.getByText('Show Corner Badges')).toBeInTheDocument();
    expect(screen.queryByText('Show Tyre % In Corner Badges')).toBeNull();
  });
});
