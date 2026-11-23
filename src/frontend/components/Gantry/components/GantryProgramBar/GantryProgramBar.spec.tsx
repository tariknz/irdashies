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
        cutawaySessionTime: 90,
        offsetSeconds: 100,
        wasLive: false,
      },
      ...overrides,
    })
  );

describe('GantryProgramBar', () => {
  it('shows Current, the frozen Cutaway, and the advancing Live position', () => {
    render(
      <GantryProgramBar
        onBackToProgram={vi.fn()}
        onStayHere={vi.fn()}
        onResumeAtCut={vi.fn()}
        sessionTime={3691}
        cutawaySessionTime={3661}
        liveSessionTime={3680}
        isCutAway={true}
      />
    );
    expect(screen.getByRole('status').textContent).toContain(
      'Current: 01:01:31'
    );
    expect(screen.getByRole('status').textContent).toContain(
      'Cutaway: 01:01:01'
    );
    expect(screen.getByRole('status').textContent).toContain('Live: 01:01:20');
  });

  it('clears the Cutaway clock when on program', () => {
    render(
      <GantryProgramBar
        onBackToProgram={vi.fn()}
        onStayHere={vi.fn()}
        onResumeAtCut={vi.fn()}
        sessionTime={100}
        cutawaySessionTime={null}
        liveSessionTime={100}
        isCutAway={false}
      />
    );
    expect(screen.getByRole('status').textContent).toContain('Cutaway: ');
    expect(screen.getByRole('status').textContent).not.toContain(
      'Cutaway: 00:'
    );
    expect(screen.getByRole('status').textContent).toContain('Live: 00:01:40');
  });

  it('calls onBackToProgram when clicked', () => {
    const cb = vi.fn();
    render(
      <GantryProgramBar
        onBackToProgram={cb}
        onStayHere={vi.fn()}
        onResumeAtCut={vi.fn()}
        sessionTime={130}
        cutawaySessionTime={100}
        liveSessionTime={200}
        isCutAway={true}
      />
    );
    fireEvent.click(screen.getByText('Return to live'));
    expect(cb).toHaveBeenCalledOnce();
  });

  it('returns to the static cutaway with the matching button', () => {
    const onResumeAtCut = vi.fn();
    render(
      <GantryProgramBar
        onBackToProgram={vi.fn()}
        onStayHere={vi.fn()}
        onResumeAtCut={onResumeAtCut}
        sessionTime={130}
        cutawaySessionTime={100}
        liveSessionTime={200}
        isCutAway={true}
      />
    );
    fireEvent.click(screen.getByText('Return to cutaway'));
    expect(onResumeAtCut).toHaveBeenCalledOnce();
  });

  it('makes the current replay position live', () => {
    const onStayHere = vi.fn();
    render(
      <GantryProgramBar
        onBackToProgram={vi.fn()}
        onStayHere={onStayHere}
        onResumeAtCut={vi.fn()}
        sessionTime={130}
        cutawaySessionTime={100}
        liveSessionTime={200}
        isCutAway={true}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: 'Make current live' }));
    expect(onStayHere).toHaveBeenCalledOnce();
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

  it('shows the current replay timecode when onProgram', () => {
    act(() =>
      useReplayTimecodeStore.getState().setSnapshot({
        ...INITIAL_REPLAY_TIMECODE,
        active: true,
        sessionTime: 123,
        program: { ...INITIAL_REPLAY_TIMECODE.program, sessionTime: 123 },
      })
    );
    render(<GantryProgramBarContainer />);
    expect(screen.getByRole('status').textContent).toContain(
      'Current: 00:02:03'
    );
    expect(screen.queryByText('Return to cutaway')).toBeNull();
    expect(screen.queryByText('Make current live')).toBeNull();
  });

  it('renders bar when cutAway', async () => {
    render(<GantryProgramBarContainer />);
    await cutAway();
    expect(screen.getByRole('status')).toBeTruthy();
  });
});
