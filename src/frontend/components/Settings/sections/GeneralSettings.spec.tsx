import type { ReactNode } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { DashboardLayout } from '@irdashies/types';
import { GeneralSettings } from './GeneralSettings';
import { mockDashboardUpdater } from '../mockDashboardUpdater';

const mocks = vi.hoisted(() => ({
  dashboard: {
    widgets: [],
    generalSettings: { fontSize: 'md' },
  } as DashboardLayout,
  listeners: new Set<() => void>(),
  update: vi.fn((dashboard: DashboardLayout) => {
    mocks.dashboard = dashboard;
    mocks.listeners.forEach((listener) => listener());
  }),
  bridge: {
    setAutoStart: vi.fn(),
    notifySimulatorPreferenceChanged: vi.fn(),
  },
}));

vi.mock('@irdashies/context', async () => {
  const { useSyncExternalStore } = await import('react');
  return {
    useAvailableSimulators: () => ['iracing', 'lmu'],
    useDashboard: () => ({
      currentDashboard: useSyncExternalStore(
        (onChange) => {
          mocks.listeners.add(onChange);
          return () => mocks.listeners.delete(onChange);
        },
        () => mocks.dashboard
      ),
      onDashboardUpdated: mockDashboardUpdater(
        () => mocks.dashboard,
        mocks.update
      ),
      bridge: mocks.bridge,
    }),
  };
});
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
    vi.clearAllMocks();
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

  it('shows the new profile settings without saving an unsupported font weight on render', () => {
    const view = render(<GeneralSettings />);
    mocks.dashboard = {
      widgets: [],
      generalSettings: {
        fontType: 'lato',
        fontWeight: 'medium',
        fontSize: 'xl',
        overlayWindowMode: 'widget',
      },
    };
    view.rerender(<GeneralSettings />);

    expect(
      screen.getByRole('figure', { name: 'Overlay font sample' })
    ).toHaveTextContent('Lato / Normal / Extra Large');
    expect(mocks.update).not.toHaveBeenCalled();

    fireEvent.click(
      screen.getByRole('switch', { name: 'Individual Overlay Windows' })
    );
    expect(mocks.dashboard.generalSettings).toEqual({
      fontType: 'lato',
      fontWeight: 'medium',
      fontSize: 'xl',
      overlayWindowMode: 'display',
    });
  });

  it('saves the new font and its compatible weight together', () => {
    mocks.dashboard.generalSettings = {
      fontType: 'inter',
      fontWeight: 'medium',
    };
    render(<GeneralSettings />);
    fireEvent.change(screen.getByRole('combobox', { name: 'Overlay font' }), {
      target: { value: 'lato' },
    });
    expect(mocks.update).toHaveBeenCalledExactlyOnceWith({
      widgets: [],
      generalSettings: { fontType: 'lato', fontWeight: 'normal' },
    });
  });

  it('updates system autostart and refreshes the simulator preference when changed', () => {
    render(<GeneralSettings />);
    fireEvent.click(screen.getByRole('switch', { name: /start.*system/i }));
    fireEvent.change(
      screen
        .getByRole('option', { name: 'Auto' })
        .closest('select') as HTMLSelectElement,
      {
        target: { value: 'lmu' },
      }
    );
    expect(mocks.bridge.setAutoStart).toHaveBeenCalledExactlyOnceWith(true);
    expect(
      mocks.bridge.notifySimulatorPreferenceChanged
    ).toHaveBeenCalledOnce();
    expect(mocks.dashboard.generalSettings).toMatchObject({
      enableAutoStart: true,
      simulator: 'lmu',
    });
  });
});
