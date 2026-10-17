import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { ProfileSettings } from './ProfileSettings';

const mocks = vi.hoisted(() => ({
  getComponentServerPort: vi.fn(),
  refreshProfiles: vi.fn(),
  switchProfile: vi.fn(),
  writeText: vi.fn(),
  webServerEnabled: true,
}));

const profiles = [
  { id: 'default', name: 'Default' },
  { id: 'race + night', name: 'Night Race' },
];

vi.mock('@irdashies/context', () => ({
  useDashboard: () => ({
    currentDashboard: {
      widgets: [],
      generalSettings: { enableWebServer: mocks.webServerEnabled },
    },
    currentProfile: profiles[0],
    profiles,
    bridge: { getComponentServerPort: mocks.getComponentServerPort },
    refreshProfiles: mocks.refreshProfiles,
    switchProfile: mocks.switchProfile,
  }),
}));

const expectedUrl = (profile: string, port: number, host = '192.168.1.50') =>
  `http://${host}:${port}/dashboard?profile=${encodeURIComponent(profile)}`;

beforeEach(() => {
  mocks.getComponentServerPort.mockReset().mockResolvedValue(4321);
  mocks.switchProfile.mockReset();
  mocks.writeText.mockReset().mockResolvedValue(undefined);
  mocks.webServerEnabled = true;
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({
      json: async () => ({ ip: '192.168.1.50' }),
    })
  );
  vi.stubGlobal('navigator', { clipboard: { writeText: mocks.writeText } });
});

afterEach(() => vi.unstubAllGlobals());

describe('ProfileSettings browser layout URLs', () => {
  it.each([3007, 4321])(
    'uses the detected server port %i for displayed and copied OBS URLs',
    async (port) => {
      mocks.getComponentServerPort.mockResolvedValue(port);
      render(<ProfileSettings />);
      await screen.findByDisplayValue(expectedUrl('default', port));
      expect(
        screen.getByDisplayValue(expectedUrl('default', port, 'localhost'))
      ).toBeInTheDocument();
      expect(fetch).toHaveBeenCalledWith(
        `http://localhost:${port}/api/server-ip`
      );

      fireEvent.click(screen.getByRole('button', { name: 'Copy for OBS' }));
      expect(mocks.writeText).toHaveBeenLastCalledWith(
        expectedUrl('default', port)
      );

      fireEvent.click(screen.getByRole('button', { name: 'Copy' }));
      expect(mocks.writeText).toHaveBeenLastCalledWith(
        expectedUrl('default', port, 'localhost')
      );
    }
  );

  it('opens the selected profile in the system browser without switching desktop profiles', async () => {
    render(<ProfileSettings />);
    const links = screen.getAllByRole('link', { name: 'Edit Browser Layout' });
    await waitFor(() =>
      expect(links[1]).toHaveAttribute(
        'href',
        expectedUrl('race + night', 4321)
      )
    );
    expect(links[1]).toHaveAttribute('target', '_blank');
    expect(links[1]).toHaveAttribute('rel', 'noopener noreferrer');
    // Electron's existing window-open handler sends this target=_blank link to
    // shell.openExternal; its http(s) behavior is covered by hardenWindow.spec.
    links[1].addEventListener('click', (event) => event.preventDefault());
    fireEvent.click(links[1]);
    expect(mocks.switchProfile).not.toHaveBeenCalled();

    fireEvent.click(screen.getAllByRole('button', { name: 'Copy URL' })[1]);
    expect(mocks.writeText).toHaveBeenLastCalledWith(
      links[1].getAttribute('href')
    );
  });

  it('keeps the detected port when the LAN address lookup fails', async () => {
    vi.mocked(fetch).mockRejectedValue(new Error('No LAN address'));
    render(<ProfileSettings />);
    await screen.findAllByDisplayValue(
      expectedUrl('default', 4321, 'localhost')
    );
    fireEvent.click(screen.getByRole('button', { name: 'Copy for OBS' }));
    expect(mocks.writeText).toHaveBeenLastCalledWith(
      expectedUrl('default', 4321, 'localhost')
    );
  });

  it('hides browser actions when the web server is turned off', () => {
    mocks.webServerEnabled = false;
    render(<ProfileSettings />);
    expect(
      screen.queryByRole('link', { name: 'Edit Browser Layout' })
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Copy URL' })
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Copy for OBS' })
    ).not.toBeInTheDocument();
    expect(
      screen.getByText(/The built-in web server is turned off/)
    ).toBeInTheDocument();
  });
});
