import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BroadcastTransitionSettings } from './BroadcastTransitionSettings';

const state = vi.hoisted(() => ({
  onDashboardUpdated: vi.fn(),
  dashboard: {
    widgets: [] as { id: string; enabled: boolean; config?: object }[],
  },
}));

vi.mock('@irdashies/context', () => ({
  useDashboard: () => ({
    currentDashboard: state.dashboard,
    onDashboardUpdated: state.onDashboardUpdated,
  }),
}));

const savedTower = () =>
  state.onDashboardUpdated.mock.calls[0][0].widgets.find(
    (w: { id: string }) => w.id === 'broadcast'
  );

describe('BroadcastTransitionSettings', () => {
  beforeEach(() => {
    state.onDashboardUpdated.mockClear();
    state.dashboard.widgets = [
      { id: 'broadcast', enabled: true, config: { secondsPerPage: 8 } },
      { id: 'standings', enabled: true },
    ];
  });

  it('shows the transition with its description, Random by default', () => {
    render(<BroadcastTransitionSettings />);

    expect(screen.getByRole('combobox', { name: 'Transition' })).toHaveValue(
      'random'
    );
    expect(screen.getByText(/How every module animates/)).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Reset transition' })
    ).not.toBeInTheDocument();
  });

  it('keeps the choice in the tower config, leaving the rest', () => {
    render(<BroadcastTransitionSettings />);

    fireEvent.change(screen.getByRole('combobox', { name: 'Transition' }), {
      target: { value: 'wipe' },
    });

    expect(savedTower().config).toEqual({
      secondsPerPage: 8,
      pageTransition: 'wipe',
    });
    expect(state.onDashboardUpdated.mock.calls[0][0].widgets[1]).toEqual({
      id: 'standings',
      enabled: true,
    });
  });

  it('resets a changed transition to Random', () => {
    state.dashboard.widgets[0].config = { pageTransition: 'flip' };
    render(<BroadcastTransitionSettings />);

    fireEvent.click(screen.getByRole('button', { name: 'Reset transition' }));

    expect(savedTower().config.pageTransition).toBe('random');
  });
});
