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
  it('places appearance field headings below their section heading', () => {
    render(<GeneralSettings />);
    expect(
      screen.getByRole('heading', { name: 'Overlay appearance', level: 3 })
    ).toBeInTheDocument();
    for (const name of [
      'Font',
      'Font Weight',
      'Font Size',
      'Compact Mode',
      'Color Theme',
      'Highlight Color',
    ]) {
      expect(
        screen.getByRole('heading', { name, level: 4 })
      ).toBeInTheDocument();
    }
  });
  beforeEach(() => {
    mocks.update.mockClear();
    mocks.dashboard = { widgets: [], generalSettings: { fontSize: 'md' } };
  });

  it('keeps older profiles opted out and saves both choices without changing the layout', () => {
    render(<GeneralSettings />);
    const toggle = screen.getByRole('switch', {
      name: 'Individual Overlay Windows',
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
        name: 'Individual Overlay Windows',
      })
    ).toHaveAttribute('aria-checked', 'true');
  });

  it('shows the selected overlay font configuration without saving on mount', () => {
    render(<GeneralSettings />);
    const sample = screen.getByRole('figure', { name: 'Overlay font sample' });
    expect(sample).toHaveTextContent('Lato / Normal / Medium');
    expect(mocks.update).not.toHaveBeenCalled();
    fireEvent.change(screen.getByRole('combobox', { name: 'Overlay font' }), {
      target: { value: 'inter' },
    });
    fireEvent.change(
      screen.getByRole('combobox', { name: 'Overlay font weight' }),
      {
        target: { value: 'bold' },
      }
    );
    fireEvent.change(
      screen.getByRole('slider', { name: 'Overlay font size' }),
      {
        target: { value: '6' },
      }
    );
    expect(sample).toHaveTextContent('Inter / Bold / Large');
    expect(mocks.update).toHaveBeenLastCalledWith(
      expect.objectContaining({
        generalSettings: expect.objectContaining({
          fontType: 'inter',
          fontWeight: 'bold',
          fontSize: 'lg',
        }),
      })
    );
  });
});
