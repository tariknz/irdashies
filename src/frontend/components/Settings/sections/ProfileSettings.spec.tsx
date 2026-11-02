import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { ProfileSettings } from './ProfileSettings';

vi.mock('@irdashies/utils/logger', () => ({
  default: { warn: vi.fn() },
}));

const mocks = vi.hoisted(() => ({
  getComponentServerPort: vi.fn(),
  refreshProfiles: vi.fn(),
  switchProfile: vi.fn(),
  writeText: vi.fn(),
  webServerEnabled: true,
  portDiscoveryAvailable: true,
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
    bridge: {
      getComponentServerPort: mocks.portDiscoveryAvailable
        ? mocks.getComponentServerPort
        : undefined,
    },
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
  mocks.portDiscoveryAvailable = true;
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

  it.each(profiles.map((profile, index) => ({ ...profile, index })))(
    'opens $name through Actions without switching desktop profiles',
    async ({ id, index }) => {
      render(<ProfileSettings />);
      expect(
        screen.queryByRole('link', { name: 'Edit Browser Layout' })
      ).not.toBeInTheDocument();
      await screen.findByDisplayValue(expectedUrl('default', 4321));
      fireEvent.click(
        screen.getAllByRole('button', { name: 'Actions' })[index]
      );
      const link = screen.getByRole('link', { name: 'Edit Browser Layout' });
      await waitFor(() =>
        expect(link).toHaveAttribute('href', expectedUrl(id, 4321))
      );
      expect(link).toHaveAttribute('target', '_blank');
      expect(link).toHaveAttribute('rel', 'noopener noreferrer');
      // The existing Electron window-open handler sends this link to the
      // system browser; hardenWindow.spec covers the http(s) handoff.
      link.addEventListener('click', (event) => event.preventDefault());
      const href = link.getAttribute('href');
      fireEvent.click(link);
      expect(
        screen.queryByRole('link', { name: 'Edit Browser Layout' })
      ).not.toBeInTheDocument();
      expect(mocks.switchProfile).not.toHaveBeenCalled();
      fireEvent.click(
        screen.getAllByRole('button', { name: 'Copy URL' })[index]
      );
      expect(mocks.writeText).toHaveBeenLastCalledWith(href);
    }
  );

  it('keeps URLs unavailable until port discovery resolves', async () => {
    const port = Promise.withResolvers<number>();
    mocks.getComponentServerPort.mockReturnValue(port.promise);
    render(<ProfileSettings />);
    fireEvent.click(screen.getAllByRole('button', { name: 'Actions' })[1]);
    expect(screen.getByRole('status')).toHaveTextContent(
      'Loading browser source URLs...'
    );
    expect(
      screen.queryByRole('link', { name: 'Edit Browser Layout' })
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Copy URL' })
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Copy for OBS' })
    ).not.toBeInTheDocument();
    expect(screen.queryByDisplayValue(/http:\/\//)).not.toBeInTheDocument();

    port.resolve(4321);
    await screen.findByDisplayValue(expectedUrl('default', 4321));
    const link = screen.getByRole('link', { name: 'Edit Browser Layout' });
    expect(link).toHaveAttribute('href', expectedUrl('race + night', 4321));
    expect(screen.getAllByRole('button', { name: 'Copy URL' })).toHaveLength(2);
    fireEvent.click(screen.getByRole('button', { name: 'Copy for OBS' }));
    expect(mocks.writeText).toHaveBeenLastCalledWith(
      expectedUrl('default', 4321)
    );
  });

  it('shows an error and keeps URLs unavailable when port discovery fails', async () => {
    mocks.getComponentServerPort.mockRejectedValue(
      new Error('Port lookup failed')
    );
    render(<ProfileSettings />);
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Could not load browser source URLs'
    );
    fireEvent.click(screen.getAllByRole('button', { name: 'Actions' })[1]);
    expect(
      screen.queryByRole('link', { name: 'Edit Browser Layout' })
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Copy URL' })
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Copy for OBS' })
    ).not.toBeInTheDocument();
    expect(fetch).not.toHaveBeenCalled();
  });

  it('uses the original default only for a legacy bridge without port discovery', async () => {
    mocks.portDiscoveryAvailable = false;
    render(<ProfileSettings />);
    await screen.findByDisplayValue(expectedUrl('default', 3000));
    fireEvent.click(screen.getByRole('button', { name: 'Copy for OBS' }));
    expect(mocks.writeText).toHaveBeenLastCalledWith(
      expectedUrl('default', 3000)
    );
    expect(mocks.getComponentServerPort).not.toHaveBeenCalled();
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
    fireEvent.click(screen.getAllByRole('button', { name: 'Actions' })[1]);
    expect(screen.getByRole('button', { name: 'Clone' })).toBeInTheDocument();
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
