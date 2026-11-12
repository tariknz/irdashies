import {
  act,
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
import { TrailingSlashRedirect } from './TrailingSlashRedirect';

const dashboard = vi.hoisted(() => ({
  widgets: [] as { id: string; type?: string }[],
}));
const support = vi.hoisted(() => ({
  config: undefined as unknown,
  loaded: true,
}));
const simulator = vi.hoisted(() => ({
  active: 'iracing' as 'iracing' | 'lmu' | null,
  // Whether the main process has answered; a null `active` is then none running.
  loaded: true,
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
  useActiveSimulator: () => simulator.active,
  useActiveSimulatorStatus: () => ({
    simulator: simulator.active,
    loaded: simulator.loaded,
  }),
  useRunningState: () => ({ running: true }),
  useSimWidgetSupport: () => support.config ?? DEFAULT_SIM_WIDGET_SUPPORT,
  useSimWidgetSupportStatus: () => ({
    config: support.config ?? DEFAULT_SIM_WIDGET_SUPPORT,
    loaded: support.loaded,
  }),
}));
vi.mock('./SettingsLoader', () => ({
  SettingsLoader: () => <h2>{useParams().widgetId}</h2>,
  // The widget types with settings pages of their own that these tests
  // visit. The Telemetry Inspector has none, as in the real list.
  WIDGET_SETTINGS: { relative: {}, standings: {}, weather: {} },
}));

// Routed as the settings window routes it.
const layoutAt = (path: string) => (
  <MemoryRouter initialEntries={[path]}>
    <Routes>
      <Route
        path="/settings/*"
        element={
          <TrailingSlashRedirect>
            <SettingsLayout />
          </TrailingSlashRedirect>
        }
      />
    </Routes>
  </MemoryRouter>
);

function renderLayout(path = '/settings/relative') {
  return render(layoutAt(path));
}

describe('SettingsLayout navigation', () => {
  beforeEach(() => {
    localStorage.clear();
    dashboard.widgets = [];
    support.config = undefined;
    support.loaded = true;
    simulator.active = 'iracing';
    simulator.loaded = true;
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
      rerender(layoutAt('/settings/standings-g1'));
      expect(shownPage()).toHaveTextContent('profiles');
      expect(
        screen.getByRole('link', { name: 'Back to overlays' })
      ).toHaveAttribute('href', '/settings/relative');
    });

    it('goes back to the last widget page, past the Telemetry Inspector', () => {
      dashboard.widgets = [{ id: 'telemetryinspector' }];
      // Settings opened from an overlay's gear button.
      let openFromOverlay: (widgetType: string) => void = () => undefined;
      const previousBridge = window.dashboardBridge;
      window.dashboardBridge = {
        onNavigateToSettings: (callback: (widgetType: string) => void) => {
          openFromOverlay = callback;
          return () => undefined;
        },
      } as unknown as typeof window.dashboardBridge;
      try {
        renderLayout('/settings/relative');
        fireEvent.click(screen.getByRole('link', { name: 'Standings' }));
        act(() => openFromOverlay('telemetryinspector'));
        expect(shownPage()).toHaveTextContent('telemetryinspector');
        fireEvent.click(screen.getByRole('link', { name: 'Tools' }));
        expect(
          screen.getByRole('link', { name: 'Back to overlays' })
        ).toHaveAttribute('href', '/settings/standings');
      } finally {
        window.dashboardBridge = previousBridge;
      }
    });

    it('opens on Relative when the sim connected now cannot run the page left last', () => {
      localStorage.setItem('settingsLastWidgetPage', '/settings/standings');
      support.config = {
        message: 'Unavailable in this simulator',
        disabledWidgets: { iracing: ['standings'], lmu: [] },
      };
      renderLayout('/settings');
      expect(shownPage()).toHaveTextContent('relative');
    });

    it('leaves the reopened page for Relative when the sim, known late, cannot run it', () => {
      localStorage.setItem('settingsLastWidgetPage', '/settings/standings');
      support.config = {
        message: 'Unavailable in this simulator',
        disabledWidgets: { iracing: [], lmu: ['standings'] },
      };
      // The simulator is not known yet on the first render.
      simulator.active = null;
      simulator.loaded = false;
      const { rerender } = renderLayout('/settings');
      expect(shownPage()).toHaveTextContent('standings');

      simulator.active = 'lmu';
      simulator.loaded = true;
      rerender(layoutAt('/settings'));
      expect(shownPage()).toHaveTextContent('relative');
    });

    it('keeps the reopened page once the sim is known, when a later sim cannot run it', () => {
      localStorage.setItem('settingsLastWidgetPage', '/settings/standings');
      support.config = {
        message: 'Unavailable in this simulator',
        disabledWidgets: { iracing: [], lmu: ['standings'] },
      };
      const { rerender } = renderLayout('/settings');
      expect(shownPage()).toHaveTextContent('standings');

      // Much later, another sim connects while the page is still open.
      simulator.active = 'lmu';
      rerender(layoutAt('/settings'));
      expect(shownPage()).toHaveTextContent('standings');
    });

    it('waits for the support file before reopening, whatever arrives first', () => {
      localStorage.setItem('settingsLastWidgetPage', '/settings/standings');
      // The bundled defaults disable Standings in LMU; the user's file allows it.
      support.config = {
        message: 'Unavailable in this simulator',
        disabledWidgets: { iracing: [], lmu: ['standings'] },
      };
      support.loaded = false;
      simulator.active = null;
      simulator.loaded = false;
      const { rerender } = renderLayout('/settings');
      const main = screen.getByRole('main');
      expect(within(main).queryByRole('heading')).not.toBeInTheDocument();

      // The simulator answers first.
      simulator.active = 'lmu';
      simulator.loaded = true;
      rerender(layoutAt('/settings'));
      expect(within(main).queryByRole('heading')).not.toBeInTheDocument();

      support.config = {
        message: 'Unavailable in this simulator',
        disabledWidgets: { iracing: [], lmu: [] },
      };
      support.loaded = true;
      rerender(layoutAt('/settings'));
      expect(shownPage()).toHaveTextContent('standings');
      expect(localStorage.getItem('settingsLastWidgetPage')).toBe(
        '/settings/standings'
      );
    });

    it('keeps a page the user opened when the sim, known late, cannot run it', () => {
      support.config = {
        message: 'Unavailable in this simulator',
        disabledWidgets: { iracing: [], lmu: ['standings'] },
      };
      simulator.active = null;
      simulator.loaded = false;
      const { rerender } = renderLayout('/settings/standings');

      simulator.active = 'lmu';
      simulator.loaded = true;
      rerender(layoutAt('/settings/standings'));
      expect(shownPage()).toHaveTextContent('standings');
    });

    it('keeps the page left last until the simulator is known, when it then cannot run the page opened', () => {
      localStorage.setItem('settingsLastWidgetPage', '/settings/weather');
      support.config = {
        message: 'Unavailable in this simulator',
        disabledWidgets: { iracing: [], lmu: ['standings'] },
      };
      simulator.active = null;
      simulator.loaded = false;
      const { rerender } = renderLayout('/settings/standings');
      expect(localStorage.getItem('settingsLastWidgetPage')).toBe(
        '/settings/weather'
      );

      simulator.active = 'lmu';
      simulator.loaded = true;
      rerender(layoutAt('/settings/standings'));
      expect(shownPage()).toHaveTextContent('standings');
      expect(localStorage.getItem('settingsLastWidgetPage')).toBe(
        '/settings/weather'
      );
    });

    it('keeps the page opened once the main process answers that no sim is running', () => {
      localStorage.setItem('settingsLastWidgetPage', '/settings/weather');
      support.config = {
        message: 'Unavailable in this simulator',
        disabledWidgets: { iracing: [], lmu: ['standings'] },
      };
      simulator.active = null;
      simulator.loaded = false;
      const { rerender } = renderLayout('/settings/standings');

      simulator.loaded = true;
      rerender(layoutAt('/settings/standings'));
      expect(localStorage.getItem('settingsLastWidgetPage')).toBe(
        '/settings/standings'
      );
    });

    it('does not keep a page the sim connected now cannot run', () => {
      support.config = {
        message: 'Unavailable in this simulator',
        disabledWidgets: { iracing: ['standings'], lmu: [] },
      };
      const { unmount } = renderLayout('/settings/weather');
      unmount();
      const { unmount: unmountHidden } = renderLayout('/settings/standings');
      unmountHidden();
      expect(localStorage.getItem('settingsLastWidgetPage')).toBe(
        '/settings/weather'
      );
    });

    it('keeps the page left last while the support file loads, when the file then disables the page opened', () => {
      localStorage.setItem('settingsLastWidgetPage', '/settings/weather');
      // The bundled defaults allow Standings; the user's file disables it.
      support.config = {
        message: 'Unavailable in this simulator',
        disabledWidgets: { iracing: [], lmu: [] },
      };
      support.loaded = false;
      const { rerender } = renderLayout('/settings/standings');
      expect(localStorage.getItem('settingsLastWidgetPage')).toBe(
        '/settings/weather'
      );

      support.config = {
        message: 'Unavailable in this simulator',
        disabledWidgets: { iracing: ['standings'], lmu: [] },
      };
      support.loaded = true;
      rerender(layoutAt('/settings/standings'));
      expect(shownPage()).toHaveTextContent('standings');
      expect(localStorage.getItem('settingsLastWidgetPage')).toBe(
        '/settings/weather'
      );
    });

    it('keeps the page opened once the support file allows it', () => {
      localStorage.setItem('settingsLastWidgetPage', '/settings/weather');
      support.config = {
        message: 'Unavailable in this simulator',
        disabledWidgets: { iracing: [], lmu: [] },
      };
      support.loaded = false;
      const { rerender } = renderLayout('/settings/standings');

      support.loaded = true;
      rerender(layoutAt('/settings/standings'));
      expect(localStorage.getItem('settingsLastWidgetPage')).toBe(
        '/settings/standings'
      );
    });

    it('goes back to the latest overlay page that still exists', () => {
      dashboard.widgets = [{ id: 'standings-g1', type: 'standings' }];
      let openFromOverlay: (widgetType: string) => void = () => undefined;
      const previousBridge = window.dashboardBridge;
      window.dashboardBridge = {
        onNavigateToSettings: (callback: (widgetType: string) => void) => {
          openFromOverlay = callback;
          return () => undefined;
        },
      } as unknown as typeof window.dashboardBridge;
      try {
        const { rerender } = renderLayout('/settings/standings');
        act(() => openFromOverlay('standings-g1'));
        fireEvent.click(screen.getByRole('link', { name: 'Tools' }));
        // The copy goes with a profile switch.
        dashboard.widgets = [];
        rerender(layoutAt('/settings/standings'));
        expect(
          screen.getByRole('link', { name: 'Back to overlays' })
        ).toHaveAttribute('href', '/settings/standings');
      } finally {
        window.dashboardBridge = previousBridge;
      }
    });

    it('reads the page left last once, not on every render', () => {
      const getItem = vi.spyOn(Storage.prototype, 'getItem');
      const { rerender } = renderLayout('/settings/relative');
      rerender(layoutAt('/settings/relative'));
      rerender(layoutAt('/settings/relative'));
      expect(
        getItem.mock.calls.filter(([key]) => key === 'settingsLastWidgetPage')
      ).toHaveLength(1);
      getItem.mockRestore();
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
