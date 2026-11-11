import { fireEvent, render, screen, within } from '@testing-library/react';
import {
  assert,
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';
import { MemoryRouter, useLocation } from 'react-router-dom';
import type {
  ActiveSimulator,
  DashboardLayout,
  SimWidgetSupportConfig,
} from '@irdashies/types';
import { SettingsMenu } from './SettingsMenu';

const state = vi.hoisted(() => ({
  dashboard: undefined as DashboardLayout | undefined,
  simulator: 'lmu' as ActiveSimulator | null,
  onDashboardUpdated: vi.fn(),
  support: {
    message: 'Unavailable in this simulator',
    disabledWidgets: { iracing: [], lmu: ['wind'] },
  } as SimWidgetSupportConfig,
}));

vi.mock('@irdashies/context', () => ({
  useDashboard: () => ({
    currentDashboard: state.dashboard,
    onDashboardUpdated: state.onDashboardUpdated,
  }),
  useActiveSimulator: () => state.simulator,
  useSimWidgetSupport: () => state.support,
}));

vi.mock('./ReleaseNotes/ReleaseNotesStatusContext', () => ({
  useReleaseNotesStatus: () => ({ status: undefined }),
}));

// Keep component behavior independent of the full catalog. The registry spec
// checks real manifests, labels and menu entries together.
vi.mock('./menuItems', () => ({
  generalItems: [
    { to: '/settings/general', path: '/general', label: 'General' },
  ],
  toolItems: [
    {
      to: '/settings/profiles',
      path: '/profiles',
      label: 'Profiles',
      category: 'Tools',
    },
    {
      to: '/settings/driver-tags',
      path: '/driver-tags',
      label: 'Driver Tags',
      category: 'Tools',
    },
    {
      to: '/settings/car-setup',
      path: '/car-setup',
      label: 'Setup Comparison',
      category: 'Tools',
    },
  ],
  bottomItems: [{ to: '/settings/about', path: '/about', label: 'About' }],
  menuHasToggle: (widgetType: string, ids: string[]) =>
    ids.includes(widgetType),
  widgetItems: [
    {
      to: '/settings/standings',
      path: '/standings',
      label: 'Standings',
      widgetType: 'standings',
      category: 'Standings',
    },
    {
      to: '/settings/wind',
      path: '/wind',
      label: 'Wind',
      widgetType: 'wind',
      category: 'Session & Weather',
    },
    {
      to: '/settings/twitchchat',
      path: '/twitchchat',
      label: 'Twitch Chat',
      widgetType: 'twitchchat',
      category: 'Broadcast & Streaming',
    },
  ],
}));

function CurrentPath() {
  return <output data-testid="current-path">{useLocation().pathname}</output>;
}

function renderMenu() {
  return render(
    <MemoryRouter initialEntries={['/settings/standings']}>
      <SettingsMenu returnTo="/settings/standings" />
      <CurrentPath />
    </MemoryRouter>
  );
}

describe('SettingsMenu', () => {
  const originalBridge = window.dashboardBridge;

  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    state.simulator = 'lmu';
    state.dashboard = {
      widgets: [
        {
          id: 'standings',
          enabled: true,
          layout: { x: 0, y: 0, width: 100, height: 100 },
        },
        {
          id: 'standings-copy',
          type: 'standings',
          enabled: true,
          layout: { x: 100, y: 0, width: 100, height: 100 },
        },
        {
          id: 'wind',
          enabled: true,
          layout: { x: 0, y: 100, width: 100, height: 100 },
        },
      ],
      generalSettings: {},
    };
    Object.defineProperty(window, 'dashboardBridge', {
      configurable: true,
      writable: true,
      value: undefined,
    });
  });

  afterEach(() => {
    window.dashboardBridge = originalBridge;
  });

  it('opens a dedicated app view and returns without changing settings', () => {
    renderMenu();
    expect(
      screen.queryByRole('link', { name: 'General' })
    ).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('link', { name: 'App settings' }));
    expect(screen.getByTestId('current-path')).toHaveTextContent(
      '/settings/general'
    );
    expect(
      screen.getByRole('navigation', { name: 'App settings pages' })
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'General' })).toHaveAttribute(
      'aria-current',
      'page'
    );
    expect(screen.queryByRole('searchbox')).not.toBeInTheDocument();
    expect(screen.queryByRole('switch')).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Driver Tags' })).toBeNull();
    expect(screen.queryByRole('link', { name: 'Setup Comparison' })).toBeNull();
    expect(screen.queryByRole('link', { name: 'Profiles' })).toBeNull();
    fireEvent.click(screen.getByRole('link', { name: 'Back to overlays' }));
    expect(screen.getByTestId('current-path')).toHaveTextContent(
      '/settings/standings'
    );
    expect(screen.getByRole('searchbox')).toBeInTheDocument();
    expect(state.onDashboardUpdated).not.toHaveBeenCalled();
  });

  it('retains overlay query and support reveal across app navigation', () => {
    renderMenu();
    fireEvent.click(screen.getByText('(1 hidden)'));
    fireEvent.change(screen.getByRole('searchbox'), {
      target: { value: 'Wind' },
    });
    fireEvent.click(screen.getByRole('link', { name: 'App settings' }));
    fireEvent.click(screen.getByRole('link', { name: 'About' }));
    expect(screen.getByRole('link', { name: 'About' })).toHaveAttribute(
      'aria-current',
      'page'
    );
    expect(screen.queryByRole('searchbox')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('link', { name: 'Back to overlays' }));
    expect(screen.getByRole('searchbox')).toHaveValue('Wind');
    expect(screen.getByRole('link', { name: /Wind/ })).toBeInTheDocument();
    expect(screen.getByText('(showing 1 hidden)')).toBeInTheDocument();
    expect(
      screen.queryByRole('switch', { name: 'Enable Wind' })
    ).not.toBeInTheDocument();
    expect(state.onDashboardUpdated).not.toHaveBeenCalled();
  });

  describe('sorting', () => {
    const sortButton = () =>
      screen.getByRole('button', { name: /^Sort overlays:/ });
    const listedLinks = (name: RegExp) =>
      within(screen.getByRole('list', { name }))
        .getAllByRole('link')
        .map((link) => link.textContent);
    const categoryHeadings = () =>
      screen.queryAllByRole('heading', { level: 3 });

    it('is by category by default', () => {
      renderMenu();
      expect(sortButton()).toHaveAttribute(
        'title',
        'By category. Click for alphabetical'
      );
      expect(categoryHeadings().length).toBeGreaterThan(0);
    });

    it('lists the overlays alphabetically without categories, and remembers it', () => {
      const { unmount } = renderMenu();
      fireEvent.click(sortButton());

      expect(categoryHeadings()).toHaveLength(0);
      expect(listedLinks(/alphabetical/)).toEqual([
        'Driver Tags',
        'Profiles',
        'Setup Comparison',
        'Standings',
        'Twitch Chat',
      ]);
      expect(localStorage.getItem('settingsMenuSort')).toBe('alpha');

      // Next time the menu opens, it is as it was left.
      unmount();
      renderMenu();
      expect(categoryHeadings()).toHaveLength(0);
      expect(sortButton()).toHaveAttribute(
        'title',
        'Alphabetical. Click for activated first'
      );
    });

    it('puts the activated overlays first, then the rest, each alphabetically', () => {
      localStorage.setItem('settingsMenuSort', 'activated');
      renderMenu();

      expect(categoryHeadings()).toHaveLength(0);
      // Standings is on; Twitch Chat is not in the dashboard, and tools have
      // no switch.
      expect(listedLinks(/activated first/)).toEqual([
        'Standings',
        'Driver Tags',
        'Profiles',
        'Setup Comparison',
        'Twitch Chat',
      ]);

      // A click steps back round to categories.
      fireEvent.click(sortButton());
      expect(categoryHeadings().length).toBeGreaterThan(0);
      expect(localStorage.getItem('settingsMenuSort')).toBe('category');
    });

    it('offers every order as an icon in the dropdown, each named by its tooltip', () => {
      renderMenu();
      fireEvent.click(
        screen.getByRole('button', { name: 'Choose how overlays are sorted' })
      );
      const options = within(
        screen.getByRole('listbox', { name: 'Sort overlays' })
      ).getAllByRole('option');
      expect(options.map((o) => o.getAttribute('title'))).toEqual([
        'By category',
        'Alphabetical',
        'Activated first',
      ]);
      expect(options[0]).toHaveAttribute('aria-selected', 'true');

      fireEvent.click(options[2]);
      expect(
        screen.queryByRole('listbox', { name: 'Sort overlays' })
      ).not.toBeInTheDocument();
      expect(listedLinks(/activated first/)[0]).toBe('Standings');
      expect(localStorage.getItem('settingsMenuSort')).toBe('activated');
    });

    it('still filters by the search in a list without categories', () => {
      localStorage.setItem('settingsMenuSort', 'alpha');
      renderMenu();
      fireEvent.change(
        screen.getByRole('searchbox', { name: 'Find an overlay' }),
        {
          target: { value: 'tw' },
        }
      );
      expect(listedLinks(/alphabetical/)).toEqual(['Twitch Chat']);
    });
  });

  it('lists supported widgets in categories without redundant live labels', () => {
    assert(state.dashboard);
    state.dashboard.generalSettings = {};
    renderMenu();
    expect(screen.getByRole('link', { name: 'Standings' })).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: 'Twitch Chat' })
    ).toBeInTheDocument();
    expect(screen.queryByText('Mine')).not.toBeInTheDocument();
    expect(screen.queryByText('LIVE')).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: '+ New group' })
    ).not.toBeInTheDocument();
    expect(screen.getByText('(1 hidden)')).toBeInTheDocument();
    expect(
      within(screen.getByRole('region', { name: 'Standings' })).getByRole(
        'link',
        { name: 'Standings' }
      )
    ).toBeInTheDocument();
    expect(
      within(
        screen.getByRole('region', { name: 'Broadcast & Streaming' })
      ).getByRole('link', { name: 'Twitch Chat' })
    ).toBeInTheDocument();
    expect(
      screen.getAllByRole('heading', { level: 3 }).map((el) => el.textContent)
    ).toEqual(['Standings', 'Broadcast & Streaming', 'Tools']);
    const tools = within(screen.getByRole('region', { name: 'Tools' }));
    expect(tools.getAllByRole('link').map((link) => link.textContent)).toEqual([
      'Profiles',
      'Driver Tags',
      'Setup Comparison',
    ]);
    expect(tools.queryByRole('switch')).not.toBeInTheDocument();
    expect(
      screen.queryByRole('heading', { name: 'Session & Weather' })
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('link', { name: /Wind/ })
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('link', { name: 'General' })
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('link', { name: 'About' })
    ).not.toBeInTheDocument();
  });

  it('switches every copy of the widget off and preserves other widgets and settings', () => {
    renderMenu();
    const original = structuredClone(state.dashboard);
    assert(original);
    fireEvent.click(screen.getByRole('switch', { name: 'Enable Standings' }));
    expect(state.onDashboardUpdated).toHaveBeenCalledExactlyOnceWith({
      ...original,
      widgets: original.widgets.map((widget) =>
        widget.id.startsWith('standings')
          ? { ...widget, enabled: false }
          : widget
      ),
    });
    expect(state.dashboard).toEqual(original);
    expect(screen.getByTestId('current-path')).toHaveTextContent(
      '/settings/standings'
    );
  });

  it('offers settings but no toggle for a widget absent from the dashboard', () => {
    renderMenu();
    expect(
      screen.getByRole('link', { name: 'Twitch Chat' })
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('switch', { name: 'Enable Twitch Chat' })
    ).not.toBeInTheDocument();
  });

  it('updates compatibility after the active simulator changes', () => {
    const { rerender } = renderMenu();
    expect(
      screen.queryByRole('link', { name: /Wind/ })
    ).not.toBeInTheDocument();
    state.simulator = 'iracing';
    rerender(
      <MemoryRouter>
        <SettingsMenu />
        <CurrentPath />
      </MemoryRouter>
    );
    expect(screen.getByRole('switch', { name: 'Enable Wind' })).toBeEnabled();
    expect(screen.queryByText('(1 hidden)')).not.toBeInTheDocument();
    expect(state.onDashboardUpdated).not.toHaveBeenCalled();
  });

  it('handles a missing dashboard and unknown simulator without inventing widget toggles', () => {
    state.dashboard = undefined;
    state.simulator = null;
    renderMenu();
    expect(screen.getByRole('link', { name: /Wind/ })).toBeInTheDocument();
    expect(screen.queryByRole('switch')).not.toBeInTheDocument();
  });

  it('toggles the primary widget when a disabled extra instance comes first', () => {
    assert(state.dashboard);
    const [primary, extra, wind] = state.dashboard.widgets;
    state.dashboard = {
      ...state.dashboard,
      widgets: [{ ...extra, enabled: false }, primary, wind],
    };
    renderMenu();

    fireEvent.click(screen.getByRole('switch', { name: 'Enable Standings' }));

    expect(state.onDashboardUpdated).toHaveBeenCalledExactlyOnceWith({
      ...state.dashboard,
      widgets: [
        { ...extra, enabled: false },
        { ...primary, enabled: false },
        wind,
      ],
    });
  });

  it('shows the menu entry on while only a custom layout is on, and the switch turns it off', () => {
    assert(state.dashboard);
    const [primary, extra, wind] = state.dashboard.widgets;
    state.dashboard = {
      ...state.dashboard,
      widgets: [{ ...primary, enabled: false }, extra, wind],
    };
    renderMenu();
    const toggle = screen.getByRole('switch', { name: 'Enable Standings' });
    expect(toggle).toBeChecked();
    fireEvent.click(toggle);
    expect(state.onDashboardUpdated).toHaveBeenCalledExactlyOnceWith({
      ...state.dashboard,
      widgets: [
        { ...primary, enabled: false },
        { ...extra, enabled: false },
        wind,
      ],
    });
  });

  it('lists widgets the sim cannot run on request, without a switch', () => {
    renderMenu();
    fireEvent.click(screen.getByText('(1 hidden)'));
    expect(screen.getByRole('link', { name: /Wind/ })).toBeInTheDocument();
    expect(
      within(
        screen.getByRole('region', { name: 'Session & Weather' })
      ).getByRole('link', { name: /Wind/ })
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('switch', { name: 'Enable Wind' })
    ).not.toBeInTheDocument();
  });

  it('searches category names and omits categories with no visible matches', () => {
    renderMenu();
    const search = screen.getByRole('searchbox');
    fireEvent.change(search, { target: { value: '  BROADCAST  ' } });
    expect(
      screen.getByRole('link', { name: 'Twitch Chat' })
    ).toBeInTheDocument();
    expect(
      screen.getAllByRole('heading', { level: 3 }).map((el) => el.textContent)
    ).toEqual(['Broadcast & Streaming']);

    fireEvent.change(search, { target: { value: 'session & weather' } });
    expect(screen.getByText(/No overlays match/)).toHaveAttribute(
      'role',
      'status'
    );
    expect(screen.queryByRole('heading', { level: 3 })).not.toBeInTheDocument();
    fireEvent.click(screen.getByText('(1 hidden)'));
    expect(screen.getByRole('link', { name: /Wind/ })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 3 })).toHaveTextContent(
      'Session & Weather'
    );
    expect(state.onDashboardUpdated).not.toHaveBeenCalled();
  });

  it('filters overlays while keeping app access available without changing saved settings', () => {
    renderMenu();
    const search = screen.getByRole('searchbox', { name: 'Find an overlay' });
    fireEvent.change(search, { target: { value: '  STAND  ' } });
    expect(screen.getByRole('link', { name: 'Standings' })).toBeInTheDocument();
    expect(
      screen.queryByRole('link', { name: 'Twitch Chat' })
    ).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Standings' })).toHaveAttribute(
      'aria-current',
      'page'
    );
    expect(
      screen.queryByRole('link', { name: 'About' })
    ).not.toBeInTheDocument();
    fireEvent.change(search, { target: { value: 'no matching widget' } });
    expect(
      screen.getByRole('link', { name: 'App settings' })
    ).toBeInTheDocument();
    expect(screen.getByText(/No overlays match/)).toHaveAttribute(
      'role',
      'status'
    );
    fireEvent.change(search, { target: { value: '' } });
    expect(
      screen.getByRole('link', { name: 'Twitch Chat' })
    ).toBeInTheDocument();
    expect(state.onDashboardUpdated).not.toHaveBeenCalled();
  });

  it('keeps preview exclusions hidden even when revealing unsupported widgets', () => {
    render(
      <MemoryRouter initialEntries={['/settings/standings']}>
        <SettingsMenu
          previewMode
          excludedWidgetTypes={new Set(['twitchchat'])}
        />
      </MemoryRouter>
    );
    fireEvent.click(screen.getByText('(1 hidden)'));
    expect(screen.getByRole('link', { name: /Wind/ })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Twitch Chat' })).toBeNull();
    expect(screen.queryByRole('region', { name: 'Tools' })).toBeNull();
    expect(
      screen.getByRole('switch', { name: 'Enable Standings' })
    ).toBeChecked();
  });

  it('limits preview app pages to General while retaining the return route', () => {
    render(
      <MemoryRouter initialEntries={['/settings/general']}>
        <SettingsMenu previewMode returnTo="/settings/standings" />
        <CurrentPath />
      </MemoryRouter>
    );
    expect(screen.getByRole('link', { name: 'General' })).toHaveAttribute(
      'aria-current',
      'page'
    );
    expect(screen.queryByRole('link', { name: 'Profiles' })).toBeNull();
    expect(screen.queryByRole('link', { name: 'About' })).toBeNull();
    fireEvent.click(screen.getByRole('link', { name: 'Back to overlays' }));
    expect(screen.getByTestId('current-path')).toHaveTextContent(
      '/settings/standings'
    );
  });
});
