import '@testing-library/jest-dom/vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { DEFAULT_SIM_WIDGET_SUPPORT } from '@irdashies/types';
import { PreviewSettingsMenu } from './PreviewSettingsMenu';

vi.mock('@irdashies/context', () => ({
  useDashboard: () => ({
    currentDashboard: {
      widgets: [
        { id: 'standings', enabled: true },
        { id: 'broadcast', enabled: false },
        { id: 'broadcastticker', enabled: false },
      ],
    },
    onDashboardUpdated: vi.fn(),
  }),
  useActiveSimulator: () => 'iracing',
  useSimWidgetSupport: () => DEFAULT_SIM_WIDGET_SUPPORT,
}));

describe('PreviewSettingsMenu', () => {
  it('opens broadcast widgets directly and returns to them from Broadcast Settings', () => {
    render(
      <MemoryRouter initialEntries={['/settings/standings']}>
        <PreviewSettingsMenu />
      </MemoryRouter>
    );
    const widgets = within(screen.getByRole('region', { name: 'Broadcast' }));
    fireEvent.click(widgets.getByRole('link', { name: 'Broadcast Ticker' }));
    expect(
      widgets.getByRole('link', { name: 'Broadcast Ticker' })
    ).toHaveAttribute('aria-current', 'page');
    fireEvent.click(screen.getByRole('link', { name: 'App settings' }));
    fireEvent.click(screen.getByRole('link', { name: 'Broadcast Settings' }));
    expect(
      screen.getByRole('link', { name: 'Back to overlays' })
    ).toHaveAttribute('href', '/settings/broadcastticker');

    fireEvent.click(screen.getByRole('link', { name: 'Back to overlays' }));
    expect(
      widgets.getByRole('link', { name: 'Broadcast Ticker' })
    ).toHaveAttribute('aria-current', 'page');
  });
});
