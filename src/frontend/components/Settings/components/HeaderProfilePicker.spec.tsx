import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { HeaderProfilePicker } from './HeaderProfilePicker';

const state = vi.hoisted(() => ({
  currentProfile: { id: 'default', name: 'Default' },
  profiles: [
    { id: 'default', name: 'Default' },
    { id: 'endurance', name: 'Endurance' },
  ],
  switchProfile: vi.fn<(_id: string) => Promise<void>>(),
}));
vi.mock('@irdashies/context', () => ({ useDashboard: () => state }));

function Path() {
  return <output>{useLocation().pathname}</output>;
}
function renderPicker() {
  return render(
    <MemoryRouter initialEntries={['/settings/relative']}>
      <HeaderProfilePicker />
      <Path />
    </MemoryRouter>
  );
}

describe('HeaderProfilePicker', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    state.currentProfile = { id: 'default', name: 'Default' };
    state.switchProfile.mockResolvedValue(undefined);
  });

  it('switches through the existing action and returns focus to the trigger', async () => {
    renderPicker();
    const trigger = screen.getByRole('button', {
      name: 'Choose profile, current: Default',
    });
    fireEvent.click(trigger);
    expect(screen.getByRole('button', { name: 'Default' })).toHaveAttribute(
      'aria-pressed',
      'true'
    );
    fireEvent.click(screen.getByRole('button', { name: 'Endurance' }));
    await waitFor(() =>
      expect(trigger).toHaveAttribute('aria-expanded', 'false')
    );
    expect(state.switchProfile).toHaveBeenCalledExactlyOnceWith('endurance');
    expect(trigger).toHaveFocus();
    expect(screen.getByRole('status')).toHaveTextContent('/settings/relative');
  });

  it('does not reload the current profile', async () => {
    renderPicker();
    fireEvent.click(screen.getByRole('button', { name: /Choose profile/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Default' }));
    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: /Choose profile/ })
      ).toHaveAttribute('aria-expanded', 'false')
    );
    expect(state.switchProfile).not.toHaveBeenCalled();
  });

  it('supports native keyboard traversal, Escape recovery and manage navigation', async () => {
    const user = userEvent.setup();
    renderPicker();
    await user.tab();
    await user.keyboard('{Enter}');
    await user.tab();
    expect(screen.getByRole('button', { name: 'Default' })).toHaveFocus();
    await user.keyboard('{Escape}');
    expect(
      screen.getByRole('button', { name: /Choose profile/ })
    ).toHaveFocus();
    expect(
      screen.queryByRole('link', { name: 'Manage profiles…' })
    ).not.toBeInTheDocument();
    await user.keyboard(' ');
    await user.click(screen.getByRole('link', { name: 'Manage profiles…' }));
    expect(screen.getByRole('status')).toHaveTextContent('/settings/profiles');
    expect(state.switchProfile).not.toHaveBeenCalled();
  });

  it('dismisses on outside click or keyboard departure', async () => {
    const user = userEvent.setup();
    renderPicker();
    fireEvent.click(screen.getByRole('button', { name: /Choose profile/ }));
    fireEvent.pointerDown(document.body);
    expect(
      screen.getByRole('button', { name: /Choose profile/ })
    ).toHaveAttribute('aria-expanded', 'false');
    await user.click(screen.getByRole('button', { name: /Choose profile/ }));
    await user.tab();
    await user.tab();
    await user.tab();
    await user.tab();
    expect(
      screen.getByRole('button', { name: /Choose profile/ })
    ).toHaveAttribute('aria-expanded', 'false');
  });

  it('prevents duplicate switches while pending and presents failures for retry', async () => {
    let reject: (error: Error) => void = () => undefined;
    state.switchProfile.mockImplementation(
      () =>
        new Promise((_resolve, rejectPromise) => {
          reject = rejectPromise;
        })
    );
    renderPicker();
    fireEvent.click(screen.getByRole('button', { name: /Choose profile/ }));
    const choice = screen.getByRole('button', {
      name: 'Endurance',
    });
    fireEvent.click(choice);
    fireEvent.click(choice);
    expect(state.switchProfile).toHaveBeenCalledTimes(1);
    expect(choice).toHaveAttribute('aria-disabled', 'true');
    fireEvent.click(screen.getByRole('link', { name: 'Manage profiles…' }));
    expect(screen.getByRole('status')).toHaveTextContent('/settings/relative');
    reject(new Error('Unavailable'));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Unable to switch profile'
    );
    expect(
      screen.getByRole('button', { name: /Choose profile/ })
    ).toHaveFocus();
    state.switchProfile.mockResolvedValue(undefined);
    fireEvent.click(screen.getByRole('button', { name: 'Endurance' }));
    await waitFor(() =>
      expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    );
  });
});
