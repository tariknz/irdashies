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
