import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import {
  BroadcastGroupSettings,
  BroadcastSettingsPage,
} from './BroadcastGroupSettings';

const onDashboardUpdated = vi.fn();
const currentDashboard = {
  widgets: [
    { id: 'broadcast', enabled: true },
    { id: 'broadcastticker', enabled: false, config: { secondsPerEntry: 9 } },
    { id: 'standings', enabled: true },
  ],
};
const getComponentServerPort = vi.fn(() => Promise.resolve(3002));
const bridge = { getComponentServerPort };
vi.mock('@irdashies/context', () => ({
  useDashboard: () => ({ currentDashboard, onDashboardUpdated, bridge }),
}));
vi.mock('./BroadcastSettings', () => ({
  BroadcastSettings: ({ obsUrl }: { obsUrl?: string }) => (
    <div>tower settings {obsUrl}</div>
  ),
}));
vi.mock('./BroadcastTickerSettings', () => ({
  BroadcastTickerSettings: ({ obsUrl }: { obsUrl?: string }) => (
    <div>ticker settings {obsUrl}</div>
  ),
}));
vi.mock('./BroadcastEventsSettings', () => ({
  BroadcastEventsSettings: ({ obsUrl }: { obsUrl?: string }) => (
    <div>events settings {obsUrl}</div>
  ),
}));
vi.mock('./BroadcastPreview', () => ({
  BroadcastPreview: () => null,
}));
vi.mock('./BroadcastPodiumSettings', () => ({
  BroadcastPodiumSettings: ({ obsUrl }: { obsUrl?: string }) => (
    <div>podium settings {obsUrl}</div>
  ),
}));
vi.mock('./BroadcastWeatherSettings', () => ({
  BroadcastWeatherSettings: ({ obsUrl }: { obsUrl?: string }) => (
    <div>weather settings {obsUrl}</div>
  ),
}));

const renderAt = (
  active: Parameters<typeof BroadcastGroupSettings>[0]['active']
) =>
  render(
    <MemoryRouter>
      <BroadcastGroupSettings active={active} />
    </MemoryRouter>
  );

describe('BroadcastGroupSettings', () => {
  it("shows only the active module's settings, the Broadcast menu listing the rest", () => {
    renderAt('broadcastticker');

    expect(screen.getByText(/^ticker settings/)).toBeInTheDocument();
    expect(screen.queryByText(/^tower settings/)).not.toBeInTheDocument();
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });

  it('has no Broadcast heading, no switch for all modules and no transition', () => {
    renderAt('broadcast');

    expect(
      screen.queryByRole('heading', { name: 'Broadcast' })
    ).not.toBeInTheDocument();
    expect(screen.queryByRole('switch')).not.toBeInTheDocument();
    expect(
      screen.queryByRole('combobox', { name: 'Transition' })
    ).not.toBeInTheDocument();
  });

  it('gives the module its own OBS URL', async () => {
    renderAt('broadcastevents');

    expect(
      await screen.findByText(
        'events settings http://localhost:3002/widget/broadcastevents'
      )
    ).toBeInTheDocument();
  });

  it('offers no reset for a module at its defaults', () => {
    renderAt('broadcast');

    expect(
      screen.queryByRole('button', { name: 'Reset module' })
    ).not.toBeInTheDocument();
  });

  it('resets a changed module to the defaults', () => {
    onDashboardUpdated.mockClear();
    renderAt('broadcastticker');

    fireEvent.click(screen.getByRole('button', { name: 'Reset module' }));

    const saved = onDashboardUpdated.mock.calls[0][0].widgets.find(
      (w: { id: string }) => w.id === 'broadcastticker'
    );
    expect(saved.config.secondsPerEntry).toBe(3);
  });

  it('keeps one page mounted while switching tabs', async () => {
    getComponentServerPort.mockClear();
    const { rerender } = render(
      <MemoryRouter>
        <BroadcastSettingsPage widgetType="broadcast" />
      </MemoryRouter>
    );
    rerender(
      <MemoryRouter>
        <BroadcastSettingsPage widgetType="broadcastticker" />
      </MemoryRouter>
    );

    expect(
      await screen.findByText(/localhost:3002\/widget\/broadcastticker/)
    ).toBeInTheDocument();
    // A remount would ask for the port again (and show 3000 meanwhile).
    expect(getComponentServerPort).toHaveBeenCalledTimes(1);
  });
});
