import { act, fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReplayContextSnapshot } from '@irdashies/types';
import {
  INITIAL_REPLAY_CONTEXT,
  useReplayContextStore,
} from '@irdashies/context';
import { GantryReplayBanner, GantryReplayNotice } from './GantryReplayBanner';

const replay = (
  provenance: ReplayContextSnapshot['provenance'],
  version: number,
  mode: ReplayContextSnapshot['mode'] = 'replayFile'
) =>
  act(() =>
    useReplayContextStore.getState().setSnapshot({
      ...INITIAL_REPLAY_CONTEXT,
      mode,
      provenance,
      subSessionId: '81269102',
      version,
    })
  );

describe('GantryReplayBanner', () => {
  it.each([
    ['archived', 'showing events recorded on this PC'],
    ['localNotArchived', "irDashies wasn't recording"],
    ['foreign', 'recorded on another computer'],
  ] as const)('shows the %s message', (provenance, text) => {
    render(<GantryReplayBanner provenance={provenance} onDismiss={vi.fn()} />);

    expect(screen.getByRole('status').textContent).toContain(text);
  });

  it('calls onDismiss from the close button', () => {
    const onDismiss = vi.fn();
    render(<GantryReplayBanner provenance="foreign" onDismiss={onDismiss} />);

    fireEvent.click(
      screen.getByRole('button', { name: 'Dismiss replay message' })
    );

    expect(onDismiss).toHaveBeenCalledOnce();
  });
});

describe('GantryReplayNotice', () => {
  beforeEach(() => {
    useReplayContextStore.getState().reset();
  });

  it('shows nothing live, while spectating, or before provenance resolves', () => {
    render(<GantryReplayNotice />);
    expect(screen.queryByRole('status')).toBeNull();

    replay('none', 1, 'spectating');
    expect(screen.queryByRole('status')).toBeNull();

    replay('none', 2);
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('stays dismissed until the next replay loads', () => {
    render(<GantryReplayNotice />);
    replay('foreign', 1);
    expect(screen.getByRole('status')).toBeTruthy();

    fireEvent.click(
      screen.getByRole('button', { name: 'Dismiss replay message' })
    );
    expect(screen.queryByRole('status')).toBeNull();

    // Disconnect, then another replay.
    replay('none', 2, 'live');
    replay('archived', 3);
    expect(screen.getByRole('status').textContent).toContain(
      'recorded on this PC'
    );
  });
});
