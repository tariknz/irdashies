import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useParams } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { DEFAULT_SIM_WIDGET_SUPPORT } from '@irdashies/types';
import { SettingsLayout } from './SettingsLayout';

vi.mock('@irdashies/context', () => ({
  useDashboard: () => ({
    currentDashboard: { widgets: [] },
    currentProfile: { id: 'default', name: 'Default' },
    profiles: [{ id: 'default', name: 'Default' }],
    switchProfile: vi.fn(),
    bridge: { toggleLockOverlays: vi.fn() },
    toggleDemoMode: vi.fn(),
  }),
  useActiveSimulator: () => 'iracing',
  useRunningState: () => ({ running: true }),
  useSimWidgetSupport: () => DEFAULT_SIM_WIDGET_SUPPORT,
}));
vi.mock('./SettingsLoader', () => ({
  SettingsLoader: () => <h2>{useParams().widgetId}</h2>,
}));

function renderLayout(path = '/settings/relative') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/settings/*" element={<SettingsLayout />} />
      </Routes>
    </MemoryRouter>
  );
}

describe('SettingsLayout navigation', () => {
  it('keeps the first keyboard skip and focuses main only when changing routes', async () => {
    const user = userEvent.setup();
    renderLayout();
    const main = screen.getByRole('main');
    expect(main).not.toHaveFocus();
    await user.tab();
    expect(
      screen.getByRole('link', { name: 'Skip to settings' })
    ).toHaveFocus();
    await user.keyboard('{Enter}');
    expect(main).toHaveFocus();
    fireEvent.click(screen.getByRole('link', { name: 'App settings' }));
    await waitFor(() => expect(main).toHaveFocus());
    expect(
      screen.getByRole('navigation', { name: 'App settings pages' })
    ).toBeInTheDocument();
    expect(screen.queryByRole('searchbox')).not.toBeInTheDocument();
  });

  it('restores the last overlay, overlay query and last app destination', async () => {
    renderLayout();
    fireEvent.change(screen.getByRole('searchbox'), {
      target: { value: 'Weather' },
    });
    fireEvent.click(screen.getByRole('link', { name: 'Weather' }));
    fireEvent.click(screen.getByRole('link', { name: 'App settings' }));
    fireEvent.click(screen.getByRole('link', { name: 'Profiles' }));
    expect(screen.getByRole('main')).toHaveFocus();
    fireEvent.click(screen.getByRole('link', { name: 'Back to overlays' }));
    expect(
      screen.getByRole('heading', { name: 'weather' })
    ).toBeInTheDocument();
    expect(screen.getByRole('searchbox')).toHaveValue('Weather');
    fireEvent.click(screen.getByRole('link', { name: 'App settings' }));
    expect(
      screen.getByRole('heading', { name: 'profiles' })
    ).toBeInTheDocument();
  });

  it.each(['/settings', '/settings/'])(
    'opens %s on overlay settings and keeps app settings accessible',
    async (path) => {
      renderLayout(path);
      await screen.findByRole('heading', { name: 'relative' });
      expect(screen.getByRole('searchbox')).toBeInTheDocument();
      expect(
        screen.getByRole('main', { name: 'Overlay settings page' })
      ).toBeInTheDocument();
      fireEvent.click(screen.getByRole('link', { name: 'App settings' }));
      expect(
        screen.getByRole('heading', { name: 'general' })
      ).toBeInTheDocument();
      fireEvent.click(screen.getByRole('link', { name: 'Back to overlays' }));
      expect(
        screen.getByRole('heading', { name: 'relative' })
      ).toBeInTheDocument();
    }
  );

  it('opens direct service routes with app navigation and manages profiles from the header', async () => {
    renderLayout('/settings/advanced');
    expect(
      screen.getByRole('navigation', { name: 'App settings pages' })
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Advanced' })).toHaveAttribute(
      'aria-current',
      'page'
    );
    fireEvent.click(screen.getByRole('button', { name: /Choose profile/ }));
    fireEvent.click(screen.getByRole('link', { name: 'Manage profiles…' }));
    expect(
      screen.getByRole('heading', { name: 'profiles' })
    ).toBeInTheDocument();
    expect(screen.getByRole('main')).toHaveFocus();
    expect(
      screen.getByRole('button', { name: /Choose profile/ })
    ).toHaveAttribute('aria-expanded', 'false');
  });
});
