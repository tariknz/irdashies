import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import {
  DEFAULT_SIM_WIDGET_SUPPORT,
  type ReleaseNotesBridge,
  type ReleaseNotesStatus,
  type ReleaseNotesResult,
} from '@irdashies/types';
import { releaseNotesFixture } from '@irdashies/types';
import { SettingsMenu } from '../SettingsMenu';
import { ReleaseNotesSettings } from './ReleaseNotesSettings';
import { ReleaseNotesStatusProvider } from './ReleaseNotesStatusContext';

vi.mock('@irdashies/context', () => ({
  useDashboard: () => ({ currentDashboard: { widgets: [] } }),
  useActiveSimulator: () => 'iracing',
  useSimWidgetSupport: () => DEFAULT_SIM_WIDGET_SUPPORT,
}));

let status: ReleaseNotesStatus;
let bridge: ReleaseNotesBridge;
beforeEach(() => {
  status = {
    currentVersion: '2.1.0',
    unreadVersion: '2.1.0',
    pendingVersion: null,
    availableVersion: null,
    autoShow: false,
    development: true,
    simulation: false,
  };
  bridge = {
    getStatus: vi.fn(async () => ({ ...status })),
    getRelease: vi.fn(async () => ({
      status: 'ready' as const,
      release: releaseNotesFixture(),
      cached: false,
    })),
    dismiss: vi.fn(async () => {
      status = { ...status, unreadVersion: null, pendingVersion: null };
    }),
    setAutoShow: vi.fn(async (autoShow) => {
      status = { ...status, autoShow };
    }),
  };
  window.releaseNotesBridge = bridge;
});
afterEach(() => {
  cleanup();
  delete window.releaseNotesBridge;
});
function renderNavigation() {
  return render(
    <MemoryRouter initialEntries={['/settings/general']}>
      <ReleaseNotesStatusProvider>
        <SettingsMenu />
        <Routes>
          <Route
            path="/settings/general"
            element={<div>General settings</div>}
          />
          <Route
            path="/settings/release-notes"
            element={<ReleaseNotesSettings />}
          />
        </Routes>
      </ReleaseNotesStatusProvider>
    </MemoryRouter>
  );
}

describe('Release notes menu and unread badge', () => {
  it('shows the permanent menu item directly before About and New only for unread updates', async () => {
    const { container } = renderNavigation();
    const link = await screen.findByRole('link', {
      name: /Release notes.*New/,
    });
    expect(link).toHaveAttribute('href', '/settings/release-notes');
    const about = screen.getByRole('link', { name: 'About' });
    expect(link.closest('li')?.nextElementSibling).toBe(about.closest('li'));
    expect(link.closest('ul')?.lastElementChild).toBe(about.closest('li'));
    expect(
      container.querySelectorAll('a[href="/settings/release-notes"]')
    ).toHaveLength(1);
  });
  it('does not show New on first install or already-read version', async () => {
    status.unreadVersion = null;
    await act(async () => {
      renderNavigation();
    });
    const link = screen.getByRole('link', { name: 'Release notes' });
    expect(within(link).queryByText('New')).toBeNull();
  });
  it('clears New after successfully opening the installed notes even with auto-show disabled', async () => {
    renderNavigation();
    fireEvent.click(
      await screen.findByRole('link', { name: /Release notes.*New/ })
    );
    await screen.findByText('Standings and relative overlays');
    await waitFor(() => expect(bridge.dismiss).toHaveBeenCalledWith('2.1.0'));
    expect(
      screen.getByRole('link', { name: 'Release notes' })
    ).toBeInTheDocument();
    expect(screen.queryByText('New')).toBeNull();
  });
  it('keeps New visible during loading and clears only after notes arrive', async () => {
    let complete: ((value: ReleaseNotesResult) => void) | undefined;
    vi.mocked(bridge.getRelease).mockImplementation(
      () =>
        new Promise((resolve) => {
          complete = resolve;
        })
    );
    renderNavigation();
    fireEvent.click(
      await screen.findByRole('link', { name: /Release notes.*New/ })
    );
    await screen.findByText('Loading release notes…');
    expect(
      screen.getByRole('link', { name: /Release notes.*New/ })
    ).toBeInTheDocument();
    expect(bridge.dismiss).not.toHaveBeenCalled();
    await act(async () => {
      complete?.({
        status: 'ready',
        release: releaseNotesFixture(),
        cached: false,
      });
    });
    await waitFor(() => expect(bridge.dismiss).toHaveBeenCalledWith('2.1.0'));
    expect(screen.queryByText('New')).toBeNull();
  });

  it('does not mark installed notes read while switching back from a downloaded version until installed notes load', async () => {
    status.availableVersion = '2.2.0';
    let complete: ((value: ReleaseNotesResult) => void) | undefined;
    vi.mocked(bridge.getRelease).mockImplementation((version) =>
      version === '2.2.0'
        ? Promise.resolve({
            status: 'ready',
            release: releaseNotesFixture('2.2.0'),
            cached: false,
          })
        : new Promise((resolve) => {
            complete = resolve;
          })
    );
    renderNavigation();
    fireEvent.click(
      await screen.findByRole('link', { name: /Release notes.*New/ })
    );
    fireEvent.change(await screen.findByRole('combobox', { name: 'Version' }), {
      target: { value: '2.2.0' },
    });
    await screen.findByRole('heading', { name: 'irDashies 2.2.0' });
    expect(bridge.dismiss).not.toHaveBeenCalled();
    fireEvent.change(screen.getByRole('combobox', { name: 'Version' }), {
      target: { value: '2.1.0' },
    });
    await screen.findByText('Loading release notes…');
    expect(bridge.dismiss).not.toHaveBeenCalled();
    expect(
      screen.getByRole('link', { name: /Release notes.*New/ })
    ).toBeInTheDocument();
    await act(async () => {
      complete?.({
        status: 'ready',
        release: releaseNotesFixture(),
        cached: false,
      });
    });
    await waitFor(() => expect(bridge.dismiss).toHaveBeenCalledWith('2.1.0'));
  });

  it('retains New when notes fail to load and clears only after a successful retry', async () => {
    vi.mocked(bridge.getRelease).mockResolvedValueOnce({
      status: 'unavailable',
      reason: 'offline',
    });
    renderNavigation();
    fireEvent.click(
      await screen.findByRole('link', { name: /Release notes.*New/ })
    );
    await screen.findByText(
      'Could not load release notes. Check your connection and try again.'
    );
    expect(bridge.dismiss).not.toHaveBeenCalled();
    expect(
      screen.getByRole('link', { name: /Release notes.*New/ })
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    await waitFor(() => expect(bridge.dismiss).toHaveBeenCalledWith('2.1.0'));
    expect(screen.queryByText('New')).toBeNull();
  });
  it('keeps unread badge when disabling automatic popup and shares one status refresh on focus', async () => {
    status.autoShow = true;
    // Failed notes prevent opening the page from acknowledging the update.
    vi.mocked(bridge.getRelease).mockResolvedValue({
      status: 'unavailable',
      reason: 'offline',
    });
    renderNavigation();
    fireEvent.click(
      await screen.findByRole('link', { name: /Release notes.*New/ })
    );
    fireEvent.click(
      await screen.findByRole('checkbox', {
        name: 'Show release notes after updates',
      })
    );
    await waitFor(() => expect(bridge.setAutoShow).toHaveBeenCalledWith(false));
    expect(
      screen.getByRole('link', { name: /Release notes.*New/ })
    ).toBeInTheDocument();
    expect(bridge.getStatus).toHaveBeenCalledTimes(1);
    fireEvent.focus(window);
    await waitFor(() => expect(bridge.getStatus).toHaveBeenCalledTimes(2));
  });
});
