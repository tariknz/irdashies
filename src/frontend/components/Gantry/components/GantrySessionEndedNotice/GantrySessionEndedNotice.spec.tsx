import { act, fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import type { Session } from '@irdashies/types';
import { useSessionStore } from '@irdashies/context';
import { GantrySessionHoldProvider } from '../../hooks/useGantrySessionHold';
import { GantrySessionEndedNotice } from './GantrySessionEndedNotice';

const sessionWithDrivers = { DriverInfo: { Drivers: [{ CarIdx: 0 }] } };

const view = (running: boolean) => (
  <GantrySessionHoldProvider running={running}>
    <GantrySessionEndedNotice />
  </GantrySessionHoldProvider>
);

describe('GantrySessionEndedNotice', () => {
  beforeEach(() => {
    useSessionStore.getState().resetSession();
    act(() =>
      useSessionStore
        .getState()
        .setSession(sessionWithDrivers as unknown as Session)
    );
  });

  it('shows nothing while the sim runs', () => {
    render(view(true));

    expect(screen.queryByRole('status')).toBeNull();
  });

  it('shows once the sim closes, and hides when dismissed', () => {
    const { rerender } = render(view(true));
    rerender(view(false));

    expect(screen.getByRole('status').textContent).toContain(
      'showing the final results'
    );

    fireEvent.click(
      screen.getByRole('button', { name: 'Dismiss session ended message' })
    );
    expect(screen.queryByRole('status')).toBeNull();
  });
});
