import type { ReactNode } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { DashboardLayout } from '@irdashies/types';
import { GeneralSettings } from './GeneralSettings';

const mocks = vi.hoisted(() => ({
  dashboard: {
    widgets: [],
    generalSettings: { fontSize: 'md' },
  } as DashboardLayout,
  update: vi.fn(),
}));

vi.mock('@irdashies/context', () => ({
  useAvailableSimulators: () => [],
  useDashboard: () => ({
    currentDashboard: mocks.dashboard,
    onDashboardUpdated: mocks.update,
    bridge: {},
  }),
}));
vi.mock('../components/BaseSettingsSection', () => ({
  BaseSettingsSection: ({ children }: { children: ReactNode }) => (
    <>{children}</>
  ),
}));

describe('individual window setting', () => {
  beforeEach(() => {
    mocks.update.mockClear();
    mocks.dashboard = { widgets: [], generalSettings: { fontSize: 'md' } };
  });

  it('keeps older profiles opted out and saves both choices without changing the layout', () => {
    render(<GeneralSettings />);
    const toggle = screen.getByRole('switch', {
      name: 'Individual Overlay Windows (Experimental)',
    });
    expect(toggle).toHaveAttribute('aria-checked', 'false');
    expect(mocks.update).not.toHaveBeenCalled();
    fireEvent.click(toggle);
    expect(mocks.update).toHaveBeenLastCalledWith(
      expect.objectContaining({
        widgets: mocks.dashboard.widgets,
        generalSettings: expect.objectContaining({
          fontSize: 'md',
          overlayWindowMode: 'widget',
        }),
      })
    );
    fireEvent.click(toggle);
    expect(mocks.update).toHaveBeenLastCalledWith(
      expect.objectContaining({
        generalSettings: expect.objectContaining({
          overlayWindowMode: 'display',
        }),
      })
    );
  });

  it('reads the active profile opt-in', () => {
    mocks.dashboard.generalSettings = { overlayWindowMode: 'widget' };
    render(<GeneralSettings />);
    expect(
      screen.getByRole('switch', {
        name: 'Individual Overlay Windows (Experimental)',
      })
    ).toHaveAttribute('aria-checked', 'true');
  });
});
