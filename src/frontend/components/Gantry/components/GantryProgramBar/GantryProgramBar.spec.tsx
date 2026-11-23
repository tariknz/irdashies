import { act, fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReplayTimecodeSnapshot } from '@irdashies/types';
import {
  INITIAL_REPLAY_TIMECODE,
  useReplayTimecodeStore,
} from '@irdashies/context';
import {
  GantryProgramBar,
  GantryProgramBarContainer,
} from './GantryProgramBar';

const cutAway = (overrides: Partial<ReplayTimecodeSnapshot> = {}) =>
  act(() =>
    useReplayTimecodeStore.getState().setSnapshot({
      ...INITIAL_REPLAY_TIMECODE,
      active: true,
      sessionTime: 200,
      program: {
        state: 'cutAway',
        sessionNum: 0,
        sessionTime: 100,
        offsetSeconds: 100,
        wasLive: false,
      },
      ...overrides,
    })
  );

describe('GantryProgramBar', () => {
  it('shows the program timecode when not live', () => {
    render(
      <GantryProgramBar
        onBackToProgram={vi.fn()}
        onStayHere={vi.fn()}
        onResumeAtCut={vi.fn()}
        programSessionTime={3661}
        offsetSeconds={30}
        wasLive={false}
      />
    );
    expect(screen.getByRole('status').textContent).toContain('01:01:01');
  });

  it('shows "Program is live" when wasLive', () => {
    render(
      <GantryProgramBar
        onBackToProgram={vi.fn()}
        onStayHere={vi.fn()}
        onResumeAtCut={vi.fn()}
        programSessionTime={100}
        offsetSeconds={0}
        wasLive={true}
      />
    );
    expect(screen.getByRole('status').textContent).toContain('Program is live');
  });

  it('calls onBackToProgram when clicked', () => {
    const cb = vi.fn();
    render(
      <GantryProgramBar
        onBackToProgram={cb}
        onStayHere={vi.fn()}
        onResumeAtCut={vi.fn()}
        programSessionTime={100}
        offsetSeconds={30}
        wasLive={false}
      />
    );
    fireEvent.click(screen.getByText('Back to program'));
    expect(cb).toHaveBeenCalledOnce();
  });
});

describe('GantryProgramBarContainer', () => {
  beforeEach(() => {
    useReplayTimecodeStore.getState().reset();
    window.replayDirectorBridge = undefined;
  });

  it('renders nothing when inactive', () => {
    render(<GantryProgramBarContainer />);
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('renders nothing when onProgram', () => {
    act(() =>
      useReplayTimecodeStore.getState().setSnapshot({
        ...INITIAL_REPLAY_TIMECODE,
        active: true,
        program: { ...INITIAL_REPLAY_TIMECODE.program, state: 'onProgram' },
      })
    );
    render(<GantryProgramBarContainer />);
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('renders bar when cutAway', async () => {
    render(<GantryProgramBarContainer />);
    await cutAway();
    expect(screen.getByRole('status')).toBeTruthy();
  });
});
