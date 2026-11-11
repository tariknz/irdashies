import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useParams } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_SIM_WIDGET_SUPPORT } from '@irdashies/types';
import { SettingsLayout } from './SettingsLayout';

const dashboard = vi.hoisted(() => ({
  widgets: [] as { id: string; type?: string }[],
}));

vi.mock('@irdashies/context', () => ({
  useDashboard: () => ({
    currentDashboard: { widgets: dashboard.widgets },
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
  // The widget types with settings pages of their own that these tests
  // visit. The Telemetry Inspector has none, as in the real list.
  WIDGET_SETTINGS: { relative: {}, standings: {}, weather: {} },
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
  beforeEach(() => {
    localStorage.clear();
    dashboard.widgets = [];
  });

  describe('reopening', () => {
    const shownPage = () =>
      within(screen.getByRole('main')).getByRole('heading', { level: 2 });

    it('opens on the widget page left last', () => {
      const { unmount } = renderLayout('/settings/standings');
      unmount();
      renderLayout('/settings');
      expect(shownPage()).toHaveTextContent('standings');
    });

    it('keeps the last widget page, not an app or tool page visited after it', () => {
      const { unmount } = renderLayout('/settings/weather');
      fireEvent.click(screen.getByRole('link', { name: 'App settings' }));
      expect(shownPage()).toHaveTextContent('general');
      unmount();
      renderLayout('/settings');
      expect(shownPage()).toHaveTextContent('weather');
    });

    it('opens on Relative when the widget page left last is gone', () => {
      localStorage.setItem('settingsLastWidgetPage', '/settings/removed');
      renderLayout('/settings');
      expect(shownPage()).toHaveTextContent('relative');
    });

    it("reopens a layout copy's page while the copy is in the layout", () => {
      localStorage.setItem('settingsLastWidgetPage', '/settings/standings-g1');
      dashboard.widgets = [{ id: 'standings-g1', type: 'standings' }];
      const { unmount } = renderLayout('/settings');
      expect(shownPage()).toHaveTextContent('standings-g1');
      unmount();

      // Gone, e.g. another profile active.
      dashboard.widgets = [];
      renderLayout('/settings');
      expect(shownPage()).toHaveTextContent('relative');
    });

    it('reopens a widget page opened with a trailing slash', () => {
      const { unmount } = renderLayout('/settings/standings/');
      unmount();
      expect(localStorage.getItem('settingsLastWidgetPage')).toBe(
        '/settings/standings'
      );
      renderLayout('/settings');
      expect(shownPage()).toHaveTextContent('standings');
    });

    it('treats a tool page with a trailing slash as a tool page, not an overlay', () => {
      renderLayout('/settings/profiles/');
      expect(
        screen.getByRole('navigation', { name: 'Tools pages' })
      ).toBeInTheDocument();
      // Not recorded as the overlay to go back to.
      expect(
        screen.getByRole('link', { name: 'Back to overlays' })
      ).toHaveAttribute('href', '/settings/relative');
      expect(localStorage.getItem('settingsLastWidgetPage')).toBeNull();
    });

    it('never keeps or reopens the Telemetry Inspector, whose settings are on Advanced', () => {
      dashboard.widgets = [{ id: 'telemetryinspector' }];
      const { unmount } = renderLayout('/settings/standings');
      unmount();
      // Opened from its overlay: the page left last stays Standings.
      const { unmount: unmountInspector } = renderLayout(
        '/settings/telemetryinspector'
      );
      unmountInspector();
      expect(localStorage.getItem('settingsLastWidgetPage')).toBe(
        '/settings/standings'
      );
      renderLayout('/settings');
      expect(shownPage()).toHaveTextContent('standings');
    });

    it('opens on Relative when the Telemetry Inspector was saved', () => {
      dashboard.widgets = [{ id: 'telemetryinspector' }];
      localStorage.setItem(
        'settingsLastWidgetPage',
        '/settings/telemetryinspector'
      );
      renderLayout('/settings');
      expect(shownPage()).toHaveTextContent('relative');
    });

    it('does not go back to a layout copy a profile switch took away', () => {
      dashboard.widgets = [{ id: 'standings-g1', type: 'standings' }];
      const { rerender } = renderLayout('/settings/standings-g1');
      fireEvent.click(screen.getByRole('link', { name: 'Tools' }));
      expect(shownPage()).toHaveTextContent('profiles');
      expect(
        screen.getByRole('link', { name: 'Back to overlays' })
      ).toHaveAttribute('href', '/settings/standings-g1');

      // Another profile, without the copy: the layout stays mounted.
      dashboard.widgets = [];
      rerender(
        <MemoryRouter initialEntries={['/settings/standings-g1']}>
          <Routes>
            <Route path="/settings/*" element={<SettingsLayout />} />
          </Routes>
        </MemoryRouter>
      );
      expect(shownPage()).toHaveTextContent('profiles');
      expect(
        screen.getByRole('link', { name: 'Back to overlays' })
      ).toHaveAttribute('href', '/settings/relative');
    });

    it('returns to the reopened page from App settings', () => {
      localStorage.setItem('settingsLastWidgetPage', '/settings/standings');
      renderLayout('/settings/general');
      expect(
        screen.getByRole('link', { name: 'Back to overlays' })
      ).toHaveAttribute('href', '/settings/standings');
    });
  });

  it('keeps app utilities in the menu and returns to the selected overlay from each page', () => {
    renderLayout('/settings/weather');
    fireEvent.click(screen.getByRole('link', { name: 'App settings' }));
    const appPages = within(screen.getByRole('region', { name: 'App pages' }));
    for (const name of ['Advanced', 'Release notes', 'About']) {
      fireEvent.click(appPages.getByRole('link', { name }));
      expect(appPages.getByRole('link', { name })).toHaveAttribute(
        'aria-current',
        'page'
      );
      expect(
        screen.getByRole('link', { name: 'Back to overlays' })
      ).toHaveAttribute('href', '/settings/weather');
    }
    fireEvent.click(screen.getByRole('link', { name: 'Back to overlays' }));
    expect(
      screen.getByRole('heading', { name: 'weather' })
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'App settings' })).toHaveAttribute(
      'href',
      '/settings/about'
    );
  });

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
    fireEvent.click(screen.getByRole('link', { name: 'Key Bindings' }));
    expect(screen.getByRole('main')).toHaveFocus();
    fireEvent.click(screen.getByRole('link', { name: 'Back to overlays' }));
    expect(
      screen.getByRole('heading', { name: 'weather' })
    ).toBeInTheDocument();
    expect(screen.getByRole('searchbox')).toHaveValue('Weather');
    fireEvent.click(screen.getByRole('link', { name: 'App settings' }));
    expect(
      screen.getByRole('heading', { name: 'keybindings' })
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
    // Profiles is a tool: its menu is Tools, not the overlay list.
    expect(
      screen.getByRole('navigation', { name: 'Tools pages' })
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Profiles' })).toHaveAttribute(
      'aria-current',
      'page'
    );
    expect(screen.getByRole('main')).toHaveFocus();
    expect(
      screen.getByRole('button', { name: /Choose profile/ })
    ).toHaveAttribute('aria-expanded', 'false');
  });
});
