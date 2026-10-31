import { cleanup, render, screen, act } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { StorageStatusNotice } from './StorageStatusNotice';
import type { StorageStatus } from '@irdashies/types';

afterEach(() => {
  cleanup();
  delete window.storageStatusBridge;
});

it('shows actionable disk-full feedback once and removes it on recovery', () => {
  let notify!: (status: StorageStatus) => void;
  const unsubscribe = vi.fn();
  window.storageStatusBridge = {
    onStatus: (callback) => {
      notify = callback;
      return unsubscribe;
    },
  };
  const { unmount } = render(<StorageStatusNotice />);
  expect(screen.queryByRole('alert')).toBeNull();
  act(() => {
    notify({ diskFull: true });
    notify({ diskFull: true });
  });
  expect(screen.getAllByRole('alert')).toHaveLength(1);
  expect(screen.getByText(/Free disk space/)).toBeInTheDocument();
  act(() => notify({ diskFull: false }));
  expect(screen.queryByRole('alert')).toBeNull();
  unmount();
  expect(unsubscribe).toHaveBeenCalledOnce();
});
