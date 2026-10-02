import { act, fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { DashboardLayout } from '@irdashies/types';
import { RadarSettings } from './RadarSettings';

const mocks = vi.hoisted(() => {
  let dashboard: DashboardLayout | undefined;
  const listeners = new Set<() => void>();
  return {
    listeners,
    onDashboardUpdated: vi.fn(),
    getDashboard: () => dashboard,
    setDashboard: (next: DashboardLayout | undefined) => {
      dashboard = next;
      listeners.forEach((listener) => listener());
    },
  };
});

vi.mock('@irdashies/context', async () => {
  const { useSyncExternalStore } = await import('react');
  const { DEFAULT_SIM_WIDGET_SUPPORT } = await import('@irdashies/types');
  return {
    useDashboard: () => ({
      currentDashboard: useSyncExternalStore((onChange) => {
        mocks.listeners.add(onChange);
        return () => mocks.listeners.delete(onChange);
      }, mocks.getDashboard),
      onDashboardUpdated: mocks.onDashboardUpdated,
      bridge: {},
    }),
    useActiveSimulator: () => null,
    useSimWidgetSupport: () => DEFAULT_SIM_WIDGET_SUPPORT,
    useSessionStore: () => undefined,
    useSessionDrivers: () => [],
  };
});

// The canvas preview needs a real browser.
vi.mock('./RadarSettings/RadarPreview', () => ({ RadarPreview: () => null }));

const dashboard = {
  widgets: [
    {
      id: 'radar',
      enabled: true,
      layout: { x: 0, y: 0, width: 300, height: 300 },
      config: {},
    },
  ],
} as unknown as DashboardLayout;

const lastSavedConfig = () => {
  const saved = mocks.onDashboardUpdated.mock.lastCall?.[0] as DashboardLayout;
  return saved.widgets.find((widget) => widget.id === 'radar')
    ?.config as Record<string, unknown>;
};

describe('RadarSettings', () => {
  beforeEach(() => {
    localStorage.clear();
    mocks.onDashboardUpdated.mockClear();
    mocks.setDashboard(dashboard);
  });

  it('shows the basics first and more at each level', () => {
    render(<RadarSettings />);
    expect(screen.getByText('Moving Centre Line')).toBeInTheDocument();
    expect(screen.queryByText(/^Edge Fade/)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Advanced' }));
    expect(screen.getByText(/^Edge Fade/)).toBeInTheDocument();
    expect(screen.queryByText('speedSmoothing')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Dev' }));
    expect(screen.getByText('speedSmoothing')).toBeInTheDocument();
  });

  it('finds settings of every level by name', () => {
    render(<RadarSettings />);
    act(() => {
      fireEvent.change(screen.getByRole('searchbox'), {
        target: { value: 'fade' },
      });
    });
    expect(screen.getByText(/^Edge Fade/)).toBeInTheDocument();
    expect(screen.getByText(/^Fade Time/)).toBeInTheDocument();
    expect(screen.queryByText('Car Numbers')).not.toBeInTheDocument();
  });

  it('keeps changes made on the oval profile to the oval', () => {
    render(<RadarSettings />);
    fireEvent.click(screen.getByRole('button', { name: 'Oval' }));
    fireEvent.click(screen.getByRole('button', { name: /^Minimal/ }));

    const config = lastSavedConfig();
    expect(config.showTrackMap).toBe(true);
    expect(config.ovalProfile).toMatchObject({ showTrackMap: false });
  });
});
