import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { PitLaneBridge } from '@irdashies/types';
import { PitLaneCalibrationSettings } from './PitLaneCalibrationSettings';

const current = {
  trackId: '47',
  trackName: 'Laguna Seca',
  hasCalibration: true,
};
const makeBridge = (): PitLaneBridge => ({
  getPitLaneData: vi.fn(async (trackId) => ({
    trackId,
    sourceId: 'test-source',
    revision: 0,
    data: null,
  })),
  updatePitLaneData: vi.fn(async () => true),
  getCurrentTrackPitLaneInfo: vi.fn(async () => current),
  resetPitLaneData: vi.fn(async () => undefined),
});

afterEach(() => vi.useRealTimers());

describe('PitLaneCalibrationSettings', () => {
  it('labels the current track obtained from main', async () => {
    const bridge = makeBridge();
    render(<PitLaneCalibrationSettings bridge={bridge} />);
    expect(await screen.findByText('Laguna Seca')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Reset calibration' })
    ).toBeEnabled();
  });

  it('explains why reset is disabled without a session or calibration', async () => {
    const bridge = makeBridge();
    vi.mocked(bridge.getCurrentTrackPitLaneInfo).mockResolvedValue(null);
    render(<PitLaneCalibrationSettings bridge={bridge} />);
    expect(
      await screen.findByText(/Connect to a simulator session/)
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Reset calibration' })
    ).toBeDisabled();
  });

  it('confirms the selected track before resetting and shows relearning status', async () => {
    const bridge = makeBridge();
    render(<PitLaneCalibrationSettings bridge={bridge} />);
    await screen.findByText('Laguna Seca');
    fireEvent.click(screen.getByRole('button', { name: 'Reset calibration' }));
    expect(screen.getByText('Reset pit lane calibration?')).toBeInTheDocument();
    expect(bridge.resetPitLaneData).not.toHaveBeenCalled();
    vi.mocked(bridge.getCurrentTrackPitLaneInfo).mockResolvedValue({
      ...current,
      hasCalibration: false,
    });
    fireEvent.click(
      screen.getAllByRole('button', { name: 'Reset calibration' })[1]
    );
    await waitFor(() =>
      expect(bridge.resetPitLaneData).toHaveBeenCalledWith('47')
    );
    expect(await screen.findByRole('status')).toHaveTextContent(
      /learned again/
    );
    expect(
      screen.getByRole('button', { name: 'Reset calibration' })
    ).toBeDisabled();
  });

  it('keeps reset errors visible through later successful track refreshes', async () => {
    vi.useFakeTimers();
    const bridge = makeBridge();
    vi.mocked(bridge.resetPitLaneData).mockRejectedValue(
      new Error('disk full')
    );
    render(<PitLaneCalibrationSettings bridge={bridge} />);
    await act(async () => undefined);
    fireEvent.click(screen.getByRole('button', { name: 'Reset calibration' }));
    fireEvent.click(
      screen.getAllByRole('button', { name: 'Reset calibration' })[1]
    );
    await act(async () => undefined);
    expect(screen.getByRole('alert')).toHaveTextContent('Could not reset');
    await act(async () => vi.advanceTimersByTime(4000));
    expect(screen.getByRole('alert')).toHaveTextContent('Could not reset');
  });
});

describe('native calibration file actions', () => {
  it('hides desktop file actions when the bridge does not offer them', async () => {
    render(<PitLaneCalibrationSettings bridge={makeBridge()} />);
    await screen.findByText('Laguna Seca');
    expect(
      screen.queryByRole('button', { name: 'Open calibration file' })
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Reload file' })
    ).not.toBeInTheDocument();
  });

  it('opens the file without a session and explains how to apply saved edits', async () => {
    const bridge = makeBridge();
    vi.mocked(bridge.getCurrentTrackPitLaneInfo).mockResolvedValue(null);
    bridge.openPitLaneDataFile = vi.fn(async () => undefined);
    bridge.reloadPitLaneDataFile = vi.fn(async () => undefined);
    render(<PitLaneCalibrationSettings bridge={bridge} />);
    await screen.findByText(/Connect to a simulator session/);
    expect(
      screen.getByRole('button', { name: 'Reset calibration' })
    ).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Reload file' })).toBeEnabled();
    fireEvent.click(
      screen.getByRole('button', { name: 'Open calibration file' })
    );
    expect(await screen.findByRole('status')).toHaveTextContent(
      'Save your changes, then choose Reload file.'
    );
    expect(bridge.openPitLaneDataFile).toHaveBeenCalledOnce();
  });

  it('applies reload through the native bridge and refreshes track status', async () => {
    const bridge = makeBridge();
    bridge.reloadPitLaneDataFile = vi.fn(async () => undefined);
    render(<PitLaneCalibrationSettings bridge={bridge} />);
    await screen.findByText('Laguna Seca');
    vi.mocked(bridge.getCurrentTrackPitLaneInfo).mockResolvedValue({
      ...current,
      hasCalibration: false,
    });
    fireEvent.click(screen.getByRole('button', { name: 'Reload file' }));
    expect(await screen.findByRole('status')).toHaveTextContent(
      'Saved edits are now applied'
    );
    expect(bridge.reloadPitLaneDataFile).toHaveBeenCalledOnce();
    expect(
      screen.getByRole('button', { name: 'Reset calibration' })
    ).toBeDisabled();
  });

  it.each(['open', 'reload'] as const)(
    'reports %s errors and permits retry',
    async (action) => {
      const bridge = makeBridge();
      bridge.openPitLaneDataFile = vi.fn(async () => {
        throw new Error('No default app');
      });
      bridge.reloadPitLaneDataFile = vi.fn(async () => {
        throw new Error('Invalid JSON');
      });
      render(<PitLaneCalibrationSettings bridge={bridge} />);
      await screen.findByText('Laguna Seca');
      const label = action === 'open' ? 'Open calibration file' : 'Reload file';
      fireEvent.click(screen.getByRole('button', { name: label }));
      expect(await screen.findByRole('alert')).toHaveTextContent(
        action === 'open' ? 'Could not open' : 'Could not reload'
      );
      expect(screen.getByRole('button', { name: label })).toBeEnabled();
    }
  );
});

describe('calibration feedback scope and refresh failures', () => {
  it.each(['success', 'error'] as const)(
    'keeps %s reset feedback on same-track polls and clears it when the track changes',
    async (outcome) => {
      vi.useFakeTimers();
      const bridge = makeBridge();
      if (outcome === 'error')
        vi.mocked(bridge.resetPitLaneData).mockRejectedValue(
          new Error('disk full')
        );
      render(<PitLaneCalibrationSettings bridge={bridge} />);
      await act(async () => undefined);
      fireEvent.click(
        screen.getByRole('button', { name: 'Reset calibration' })
      );
      fireEvent.click(
        screen.getAllByRole('button', { name: 'Reset calibration' })[1]
      );
      await act(async () => undefined);
      const role = outcome === 'success' ? 'status' : 'alert';
      expect(screen.getByRole(role)).toHaveTextContent(
        outcome === 'success' ? 'Calibration reset' : 'Could not reset'
      );
      await act(async () => vi.advanceTimersByTime(2000));
      expect(screen.getByRole(role)).toBeInTheDocument();
      vi.mocked(bridge.getCurrentTrackPitLaneInfo).mockResolvedValue({
        trackId: '181',
        trackName: 'Another track',
        hasCalibration: true,
      });
      await act(async () => vi.advanceTimersByTime(2000));
      expect(screen.getByText('Another track')).toBeInTheDocument();
      expect(screen.queryByRole(role)).not.toBeInTheDocument();
    }
  );

  it.each(['reset', 'reload'] as const)(
    'reports successful %s even when only the following status read fails',
    async (action) => {
      const bridge = makeBridge();
      bridge.reloadPitLaneDataFile = vi.fn(async () => undefined);
      vi.mocked(bridge.getCurrentTrackPitLaneInfo)
        .mockResolvedValueOnce(current)
        .mockRejectedValueOnce(new Error('Status unavailable'));
      render(<PitLaneCalibrationSettings bridge={bridge} />);
      await screen.findByText('Laguna Seca');
      if (action === 'reset') {
        fireEvent.click(
          screen.getByRole('button', { name: 'Reset calibration' })
        );
        fireEvent.click(
          screen.getAllByRole('button', { name: 'Reset calibration' })[1]
        );
      } else
        fireEvent.click(screen.getByRole('button', { name: 'Reload file' }));
      expect(await screen.findByRole('status')).toHaveTextContent(
        action === 'reset'
          ? 'Calibration reset for Laguna Seca'
          : 'Saved edits are now applied'
      );
      expect(await screen.findByRole('alert')).toHaveTextContent(
        'status could not be refreshed'
      );
      if (action === 'reset')
        expect(
          screen.getByRole('button', { name: 'Reset calibration' })
        ).toBeDisabled();
      expect(
        screen.queryByText(
          /^Could not reset calibration|^Could not reload the calibration file/
        )
      ).not.toBeInTheDocument();
    }
  );
});

describe('calibration editing pause in settings', () => {
  it('disables Reset and explains paused learning from Open until a valid Reload', async () => {
    const bridge = makeBridge();
    let learningPaused = false;
    vi.mocked(bridge.getCurrentTrackPitLaneInfo).mockImplementation(
      async () => ({ ...current, learningPaused })
    );
    bridge.openPitLaneDataFile = vi.fn(async () => {
      learningPaused = true;
    });
    bridge.reloadPitLaneDataFile = vi.fn(async () => {
      learningPaused = false;
    });
    render(<PitLaneCalibrationSettings bridge={bridge} />);
    await screen.findByText('Laguna Seca');
    fireEvent.click(
      screen.getByRole('button', { name: 'Open calibration file' })
    );
    await screen.findByText(/Automatic learning is paused while editing/);
    expect(
      screen.getByRole('button', { name: 'Reset calibration' })
    ).toBeDisabled();
    expect(screen.getByRole('status')).toHaveTextContent(
      'Automatic learning stays paused'
    );
    fireEvent.click(screen.getByRole('button', { name: 'Reload file' }));
    await screen.findByText(/Saved edits are now applied/);
    expect(
      screen.getByRole('button', { name: 'Reset calibration' })
    ).toBeEnabled();
    expect(
      screen.queryByText(/Automatic learning is paused while editing/)
    ).not.toBeInTheDocument();
  });
});
