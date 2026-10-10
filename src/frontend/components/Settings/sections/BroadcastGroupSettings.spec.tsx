import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { BroadcastGroupSettings } from './BroadcastGroupSettings';

const onDashboardUpdated = vi.fn();
const currentDashboard = {
  widgets: [
    { id: 'broadcast', enabled: true },
    { id: 'broadcastticker', enabled: false },
    { id: 'standings', enabled: true },
  ],
};
vi.mock('@irdashies/context', () => ({
  useDashboard: () => ({ currentDashboard, onDashboardUpdated }),
}));
vi.mock('./BroadcastSettings', () => ({
  BroadcastSettings: () => <div>tower settings</div>,
}));
vi.mock('./BroadcastTickerSettings', () => ({
  BroadcastTickerSettings: () => <div>ticker settings</div>,
}));
vi.mock('./BroadcastEventsSettings', () => ({
  BroadcastEventsSettings: () => <div>events settings</div>,
}));
vi.mock('./BroadcastWeatherSettings', () => ({
  BroadcastWeatherSettings: () => <div>weather settings</div>,
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
  it("shows the active module's settings under one tab per module", () => {
    renderAt('broadcastticker');

    expect(screen.getByText('ticker settings')).toBeInTheDocument();
    expect(screen.queryByText('tower settings')).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Events/ })).toHaveAttribute(
      'href',
      '/settings/broadcastevents'
    );
  });

  it('marks which modules are switched on', () => {
    renderAt('broadcast');

    expect(screen.getByRole('link', { name: /Tower/ })).toContainHTML(
      'title="On"'
    );
    expect(screen.getByRole('link', { name: /Ticker/ })).toContainHTML(
      'title="Off"'
    );
  });

  it('the master switch turns every module off, leaving other widgets', () => {
    renderAt('broadcast');

    fireEvent.click(screen.getByRole('switch'));

    expect(onDashboardUpdated).toHaveBeenCalledWith({
      widgets: [
        { id: 'broadcast', enabled: false },
        { id: 'broadcastticker', enabled: false },
        { id: 'standings', enabled: true },
      ],
    });
  });
});
