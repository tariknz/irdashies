import { useEffect, useState } from 'react';
import type { CurrentTrackPitLaneInfo, PitLaneBridge } from '@irdashies/types';
import { SettingsSection } from './SettingSection';
import { ConfirmDialog } from './ConfirmDialog';

interface PitLaneCalibrationSettingsProps {
  bridge?: PitLaneBridge;
}

export const PitLaneCalibrationSettings = ({
  bridge = window.pitLaneBridge,
}: PitLaneCalibrationSettingsProps) => {
  const [track, setTrack] = useState<CurrentTrackPitLaneInfo | null>(null);
  const [confirmTrack, setConfirmTrack] =
    useState<CurrentTrackPitLaneInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [readError, setReadError] = useState('');

  useEffect(() => {
    let active = true;
    const refresh = async () => {
      try {
        const current = (await bridge?.getCurrentTrackPitLaneInfo()) ?? null;
        if (active) {
          setTrack(current);
          setLoading(false);
          setReadError('');
        }
      } catch {
        if (active) {
          setTrack(null);
          setLoading(false);
          setReadError(
            'Could not read the current track. Try again when the simulator is connected.'
          );
        }
      }
    };
    void refresh();
    const timer = setInterval(() => void refresh(), 2000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [bridge]);

  const reset = async () => {
    if (!bridge || !confirmTrack || busy) return;
    const selected = confirmTrack;
    setConfirmTrack(null);
    setBusy(true);
    setMessage('');
    setError('');
    try {
      await bridge.resetPitLaneData(selected.trackId);
      setTrack(await bridge.getCurrentTrackPitLaneInfo());
      setMessage(
        `Calibration reset for ${selected.trackName}. Pit entry and exit will be learned again as cars use the pit lane.`
      );
    } catch {
      setError(
        'Could not reset calibration. Check that the same track is still connected, then try again.'
      );
    } finally {
      setBusy(false);
    }
  };

  const explanation = loading
    ? 'Checking the current track…'
    : !track
      ? 'Connect to a simulator session to reset calibration for the current track.'
      : !track.hasCalibration
        ? 'No learned calibration for this track. Pit entry and exit are learned as cars use the pit lane.'
        : 'Clear learned pit entry and exit positions for this track. Other tracks are kept.';

  return (
    <SettingsSection title="Pit Lane Calibration">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h4 className="text-md font-medium text-slate-300">
            {track?.trackName ?? 'Current track unavailable'}
          </h4>
          <p className="mt-1 text-sm text-slate-500">{explanation}</p>
        </div>
        <button
          type="button"
          disabled={loading || busy || !track?.hasCalibration}
          onClick={() => setConfirmTrack(track)}
          className="shrink-0 rounded-md bg-slate-600 px-3 py-1 text-sm text-slate-200 transition-colors hover:bg-slate-500 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {busy ? 'Resetting…' : 'Reset calibration'}
        </button>
      </div>
      {message && (
        <p role="status" className="mt-3 text-sm text-emerald-400">
          {message}
        </p>
      )}
      {error && (
        <p role="alert" className="mt-3 text-sm text-red-400">
          {error}
        </p>
      )}
      {readError && !error && (
        <p role="alert" className="mt-3 text-sm text-red-400">
          {readError}
        </p>
      )}
      <ConfirmDialog
        isOpen={confirmTrack !== null}
        title="Reset pit lane calibration?"
        message={`Clear learned pit entry and exit positions for ${confirmTrack?.trackName ?? 'this track'}? The overlay will relearn them as cars use the pit lane.`}
        confirmText="Reset calibration"
        onConfirm={() => void reset()}
        onCancel={() => setConfirmTrack(null)}
      />
    </SettingsSection>
  );
};
