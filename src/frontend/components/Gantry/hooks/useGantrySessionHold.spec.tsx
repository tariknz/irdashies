import { act, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import type { Session } from '@irdashies/types';
import { useSessionStore } from '@irdashies/context';
import {
  GantrySessionHoldProvider,
  useGantrySessionHold,
  useHeld,
} from './useGantrySessionHold';

const isEmpty = (value: readonly string[]) => value.length === 0;

const sessionWithDrivers = { DriverInfo: { Drivers: [{ CarIdx: 0 }] } };

const loadSession = () =>
  act(() =>
    useSessionStore
      .getState()
      .setSession(sessionWithDrivers as unknown as Session)
  );
const clearSession = () => act(() => useSessionStore.getState().resetSession());

const Probe = ({
  live,
  sessionKey,
}: {
  live: readonly string[];
  sessionKey?: number | null;
}) => {
  const { holding } = useGantrySessionHold();
  const shown = useHeld(live, isEmpty, sessionKey);
  return (
    <div>
      <span data-testid="holding">{String(holding)}</span>
      <span data-testid="shown">{shown.join(',')}</span>
    </div>
  );
};

const setup = () => {
  const view = (
    running: boolean,
    live: readonly string[],
    sessionKey?: number | null
  ) => (
    <GantrySessionHoldProvider running={running}>
      <Probe live={live} sessionKey={sessionKey} />
    </GantrySessionHoldProvider>
  );
  const utils = render(view(true, ['A', 'B']));
  return {
    rerender: (
      running: boolean,
      live: readonly string[],
      sessionKey?: number | null
    ) => utils.rerender(view(running, live, sessionKey)),
  };
};

const shown = () => screen.getByTestId('shown').textContent;
const holding = () => screen.getByTestId('holding').textContent;

describe('useGantrySessionHold', () => {
  beforeEach(() => {
    useSessionStore.getState().resetSession();
  });

  it('passes live values through while the sim runs', () => {
    loadSession();
    const { rerender } = setup();
    rerender(true, ['B', 'A']);

    expect(holding()).toBe('false');
    expect(shown()).toBe('B,A');
  });

  it('keeps the last values once the sim closes', () => {
    loadSession();
    const { rerender } = setup();

    rerender(false, []);
    clearSession();

    expect(holding()).toBe('true');
    expect(shown()).toBe('A,B');
  });

  it('ignores empty values that arrive just before the sim closes', () => {
    loadSession();
    const { rerender } = setup();

    rerender(true, []);
    rerender(false, []);

    expect(shown()).toBe('A,B');
  });

  it('keeps holding while the sim restarts without a session', () => {
    loadSession();
    const { rerender } = setup();
    rerender(false, []);
    clearSession();

    rerender(true, []);

    expect(holding()).toBe('true');
    expect(shown()).toBe('A,B');
  });

  it('shows live values again once the next session loads', () => {
    loadSession();
    const { rerender } = setup();
    rerender(false, []);
    clearSession();
    rerender(true, []);

    loadSession();
    rerender(true, []);

    expect(holding()).toBe('false');
    expect(shown()).toBe('');
  });

  it('does not bring back an earlier session after a later one ends', () => {
    loadSession();
    const { rerender } = setup();
    rerender(false, []);
    clearSession();
    rerender(true, []);
    loadSession();
    rerender(true, []);

    rerender(false, []);
    clearSession();

    expect(holding()).toBe('true');
    expect(shown()).toBe('');
  });

  it('drops kept values when the session key moves on', () => {
    loadSession();
    const { rerender } = setup();
    rerender(true, ['A', 'B'], 1);

    rerender(true, [], 2);
    rerender(false, [], null);

    expect(shown()).toBe('');
  });

  it('holds nothing when the sim was never running with a session', () => {
    const { rerender } = setup();
    rerender(false, []);

    expect(holding()).toBe('false');
    expect(shown()).toBe('');
  });

  it('holds nothing without a provider', () => {
    const Bare = () => (
      <span data-testid="shown">{useHeld([], isEmpty).join(',')}</span>
    );
    render(<Bare />);

    expect(shown()).toBe('');
  });
});
