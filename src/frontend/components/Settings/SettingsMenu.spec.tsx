import { fireEvent, render, screen } from '@testing-library/react';
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
  bottomItems: [{ to: '/settings/about', path: '/about', label: 'About' }],
  menuHasToggle: (widgetType: string, ids: string[]) =>
    ids.includes(widgetType),
  widgetItems: [
    {
      to: '/settings/standings',
      path: '/standings',
      label: 'Standings',
      widgetType: 'standings',
    },
    {
      to: '/settings/wind',
      path: '/wind',
      label: 'Wind',
      widgetType: 'wind',
    },
    {
      to: '/settings/twitchchat',
      path: '/twitchchat',
      label: 'Twitch Chat',
      widgetType: 'twitchchat',
    },
  ],
}));

function CurrentPath() {
  return <output data-testid="current-path">{useLocation().pathname}</output>;
}

function renderMenu() {
  return render(
    <MemoryRouter initialEntries={['/settings/general']}>
      <SettingsMenu />
      <CurrentPath />
    </MemoryRouter>
  );
}

describe('SettingsMenu', () => {
  const originalBridge = window.dashboardBridge;

  beforeEach(() => {
    vi.clearAllMocks();
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
      generalSettings: { settingsTheme: 'red' },
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

  it('lists supported widgets without groups or redundant live labels', () => {
    assert(state.dashboard);
    state.dashboard.generalSettings = {
      menuLayout: {
        collapsed: ['race'],
        groups: [{ id: 'mine', label: 'Mine' }],
        assign: { standings: 'mine' },
      },
    };
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
    expect(screen.getByText('1 on')).toBeInTheDocument();
    expect(
      screen.queryByRole('link', { name: /Wind/ })
    ).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'General' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'About' })).toBeInTheDocument();
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
      '/settings/general'
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
    expect(screen.getByText('0 on')).toBeInTheDocument();
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
      screen.queryByRole('switch', { name: 'Enable Wind' })
    ).not.toBeInTheDocument();
  });
});
