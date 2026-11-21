import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, expect, it, vi } from 'vitest';
import type { AppUpdateStatus } from '@irdashies/types';
import { AppUpdateStatusProvider } from '../AppUpdateStatusContext';
import { UpdatesSettings } from './UpdatesSettings';

const previousBridge = window.appUpdatesBridge;

afterEach(() => {
  window.appUpdatesBridge = previousBridge;
});

it('lets the native updater check for a download independently of the latest release lookup', async () => {
  const status: AppUpdateStatus = {
    currentVersion: '3.0.0',
    latestVersion: '3.0.0',
    autoUpdate: false,
    preferenceSaveFailed: false,
    canUpdate: true,
    newerVersionAvailable: false,
    checkingLatest: true,
    latestCheckFailed: false,
    phase: 'idle',
  };
  let publish: ((status: AppUpdateStatus) => void) | undefined;
  const install = vi.fn(async () =>
    publish?.({ ...status, phase: 'no-update' })
  );
  window.appUpdatesBridge = {
    onStatus: (callback) => {
      publish = callback;
      callback(status);
      return () => undefined;
    },
    checkLatest: vi.fn(),
    setAutoUpdate: vi.fn(),
    install,
  };

  render(
    <AppUpdateStatusProvider>
      <UpdatesSettings />
    </AppUpdateStatusProvider>
  );
  expect(
    screen.getByRole('checkbox', { name: 'Automatic updates' })
  ).not.toBeChecked();
  expect(
    screen.getByRole('button', { name: 'Checking for updates…' })
  ).toBeDisabled();
  await userEvent.click(
    screen.getByRole('button', { name: 'Check and download' })
  );

  expect(install).toHaveBeenCalledExactlyOnceWith('download');
  expect(screen.getByRole('status')).toHaveTextContent(
    'No update is available for this installation.'
  );
});
