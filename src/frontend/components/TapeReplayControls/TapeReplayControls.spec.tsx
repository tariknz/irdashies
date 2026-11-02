import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { TapeReplayBridge, TapeReplayStatus } from '@irdashies/types';
import { TapeReplayControls, TapeReplayOverlay } from './TapeReplayControls';

const status: TapeReplayStatus = {
  position: 42,
  duration: 600,
  speed: 1,
  paused: false,
  ended: false,
};

describe('tape replay controls', () => {
  afterEach(() => vi.useRealTimers());

  it('dispatches pause, seek, restart, and speed controls', () => {
    const onCommand = vi.fn();
    render(<TapeReplayControls status={status} onCommand={onCommand} />);
    fireEvent.click(screen.getByRole('button', { name: 'Pause replay' }));
    expect(onCommand).toHaveBeenLastCalledWith({ type: 'pause', paused: true });
    fireEvent.click(screen.getByRole('button', { name: 'Rewind 10 seconds' }));
    expect(onCommand).toHaveBeenLastCalledWith({ type: 'seek', seconds: 32 });
    fireEvent.click(
      screen.getByRole('button', { name: 'Fast forward 10 seconds' })
    );
    expect(onCommand).toHaveBeenLastCalledWith({ type: 'seek', seconds: 52 });
    fireEvent.click(screen.getByRole('button', { name: 'Restart replay' }));
    expect(onCommand).toHaveBeenLastCalledWith({ type: 'seek', seconds: 0 });
    const speed = screen.getByRole('combobox', { name: 'Playback speed' });
    for (const value of ['0.5', '2', '5', '10']) {
      fireEvent.change(speed, { target: { value } });
      expect(onCommand).toHaveBeenLastCalledWith({
        type: 'speed',
        speed: Number(value),
      });
    }
  });

  it('previews scrubbing locally and commits the final position on release or keyboard input', () => {
    const onCommand = vi.fn();
    const { rerender } = render(
      <TapeReplayControls status={status} onCommand={onCommand} />
    );
    const slider = screen.getByRole('slider', { name: 'Replay position' });
    fireEvent.change(slider, { target: { value: '125' } });
    expect(screen.getByText('2:05')).toBeInTheDocument();
    expect(onCommand).not.toHaveBeenCalled();
    rerender(
      <TapeReplayControls
        status={{ ...status, position: 43 }}
        onCommand={onCommand}
      />
    );
    expect(slider).toHaveValue('125');
    fireEvent.pointerUp(slider);
    expect(onCommand).toHaveBeenLastCalledWith({ type: 'seek', seconds: 125 });
    fireEvent.change(slider, { target: { value: '126' } });
    fireEvent.keyUp(slider, { key: 'ArrowRight' });
    expect(onCommand).toHaveBeenLastCalledWith({ type: 'seek', seconds: 126 });
  });

  it('clamps jumps to tape bounds and resumes at the end', () => {
    const onCommand = vi.fn();
    const { rerender } = render(
      <TapeReplayControls
        status={{ ...status, position: 2 }}
        onCommand={onCommand}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: 'Rewind 10 seconds' }));
    expect(onCommand).toHaveBeenLastCalledWith({ type: 'seek', seconds: 0 });
    rerender(
      <TapeReplayControls
        status={{ ...status, position: 600, ended: true }}
        onCommand={onCommand}
      />
    );
    fireEvent.click(
      screen.getByRole('button', { name: 'Fast forward 10 seconds' })
    );
    expect(onCommand).toHaveBeenLastCalledWith({ type: 'seek', seconds: 600 });
    fireEvent.click(screen.getByRole('button', { name: 'Play replay' }));
    expect(onCommand).toHaveBeenLastCalledWith({
      type: 'pause',
      paused: false,
    });
  });

  it('keeps command results when an older status request resolves later and stops polling on unmount', async () => {
    let resolvePoll: (value: TapeReplayStatus) => void = () => undefined;
    const getStatus = vi
      .fn()
      .mockResolvedValueOnce(status)
      .mockImplementation(
        () =>
          new Promise<TapeReplayStatus>((resolve) => {
            resolvePoll = resolve;
          })
      );
    const bridge: TapeReplayBridge = {
      getStatus,
      command: vi.fn(async () => ({ ...status, paused: true })),
    };
    const { unmount } = render(<TapeReplayOverlay bridge={bridge} />);
    await screen.findByRole('button', { name: 'Pause replay' });
    await waitFor(() => expect(getStatus).toHaveBeenCalledTimes(2));
    fireEvent.click(screen.getByRole('button', { name: 'Pause replay' }));
    await screen.findByRole('button', { name: 'Play replay' });
    await act(async () => resolvePoll(status));
    expect(
      screen.getByRole('button', { name: 'Play replay' })
    ).toBeInTheDocument();
    unmount();
    const calls = getStatus.mock.calls.length;
    await new Promise((resolve) => setTimeout(resolve, 220));
    expect(getStatus).toHaveBeenCalledTimes(calls);
  });

  it('shows a command failure and allows retrying', async () => {
    const bridge: TapeReplayBridge = {
      getStatus: vi.fn(async () => status),
      command: vi
        .fn()
        .mockRejectedValueOnce(new Error('failed'))
        .mockResolvedValueOnce({ ...status, paused: true }),
    };
    render(<TapeReplayOverlay bridge={bridge} />);
    fireEvent.click(
      await screen.findByRole('button', { name: 'Pause replay' })
    );
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Could not update replay playback'
    );
    fireEvent.click(screen.getByRole('button', { name: 'Pause replay' }));
    await screen.findByRole('button', { name: 'Play replay' });
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});
