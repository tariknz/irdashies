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
  it('reopens the broadcast module visited last, and goes back to the overlay before it', () => {
    render(
      <MemoryRouter initialEntries={['/settings/standings']}>
        <PreviewSettingsMenu />
      </MemoryRouter>
    );
    fireEvent.click(screen.getByRole('link', { name: 'Broadcast' }));
    fireEvent.click(
      within(
        screen.getByRole('region', { name: 'Broadcast modules' })
      ).getByRole('link', { name: 'Ticker' })
    );
    expect(
      screen.getByRole('link', { name: 'Back to overlays' })
    ).toHaveAttribute('href', '/settings/standings');

    fireEvent.click(screen.getByRole('link', { name: 'Back to overlays' }));
    expect(screen.getByRole('link', { name: 'Broadcast' })).toHaveAttribute(
      'href',
      '/settings/broadcastticker'
    );
  });
});
