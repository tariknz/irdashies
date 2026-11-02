import { useCallback, useEffect, useRef, useState } from 'react';
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
  const [pendingAction, setPendingAction] = useState<
    'reset' | 'open' | 'reload' | null
  >(null);
  const busy = pendingAction !== null;
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [readError, setReadError] = useState('');
  const currentTrackId = useRef<string | null>(null);
  const feedbackTrackId = useRef<string | null>(null);
  const applyTrackInfo = useCallback(
    (current: CurrentTrackPitLaneInfo | null) => {
      const nextId = current?.trackId ?? null;
      currentTrackId.current = nextId;
      if (feedbackTrackId.current && feedbackTrackId.current !== nextId) {
        setMessage('');
        setError('');
        feedbackTrackId.current = null;
      }
      setTrack(current);
      setLoading(false);
      setReadError('');
    },
    []
  );

  useEffect(() => {
    let active = true;
    const refresh = async () => {
      try {
        const current = (await bridge?.getCurrentTrackPitLaneInfo()) ?? null;
        if (active) {
          applyTrackInfo(current);
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
  }, [bridge, applyTrackInfo]);

  const reset = async () => {
    if (!bridge || !confirmTrack || busy) return;
    const selected = confirmTrack;
    setConfirmTrack(null);
    setPendingAction('reset');
    setMessage('');
    setError('');
    feedbackTrackId.current = selected.trackId;
    try {
      await bridge.resetPitLaneData(selected.trackId);
      setTrack((current) =>
        current?.trackId === selected.trackId
          ? { ...current, hasCalibration: false }
          : current
      );
      if (currentTrackId.current === selected.trackId) {
        feedbackTrackId.current = selected.trackId;
        setMessage(
          `Calibration reset for ${selected.trackName}. Pit entry and exit will be learned again as cars use the pit lane.`
        );
      }
      try {
        applyTrackInfo(await bridge.getCurrentTrackPitLaneInfo());
      } catch {
        setReadError(
          'Calibration was reset, but the current track status could not be refreshed.'
        );
      }
    } catch {
      if (currentTrackId.current === selected.trackId) {
        feedbackTrackId.current = selected.trackId;
        setError(
          'Could not reset calibration. Check that the same track is still connected, then try again.'
        );
      }
    } finally {
      setPendingAction(null);
    }
  };

  const editFile = async (action: 'open' | 'reload') => {
    const execute =
      action === 'open'
        ? bridge?.openPitLaneDataFile
        : bridge?.reloadPitLaneDataFile;
    if (!execute || busy) return;
    setPendingAction(action);
    setMessage('');
    setError('');
    feedbackTrackId.current = null;
    try {
      await execute();
      if (action === 'reload') {
        setTrack((current) =>
          current ? { ...current, learningPaused: false } : current
        );
        setMessage(
          'Calibration file reloaded. Saved edits are now applied to the overlays.'
        );
        try {
          applyTrackInfo((await bridge?.getCurrentTrackPitLaneInfo()) ?? null);
        } catch {
          setReadError(
            'Calibration was reloaded, but the current track status could not be refreshed.'
          );
        }
      } else {
        setTrack((current) =>
          current ? { ...current, learningPaused: true } : current
        );
        setMessage(
          'Opened pitLaneData.json. Save your changes, then choose Reload file. Automatic learning stays paused until a valid reload.'
        );
      }
    } catch {
      setError(
        action === 'open'
          ? 'Could not open the calibration file. Check your default application for JSON files, then try again.'
          : 'Could not reload the calibration file. Check the JSON, track IDs, and pitEntryPct/pitExitPct values (0 to 1 or null), then try again.'
      );
    } finally {
      setPendingAction(null);
    }
  };

  const explanation = loading
    ? 'Checking the current track…'
    : !track
      ? 'Connect to a simulator session to reset calibration for the current track.'
      : track.learningPaused
        ? 'Automatic learning is paused while editing. Save changes, then Reload file to resume learning and enable Reset.'
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
          disabled={
            loading || busy || !track?.hasCalibration || track.learningPaused
          }
          onClick={() => setConfirmTrack(track)}
          className="shrink-0 rounded-md bg-slate-600 px-3 py-1 text-sm text-slate-200 transition-colors hover:bg-slate-500 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {pendingAction === 'reset' ? 'Resetting…' : 'Reset calibration'}
        </button>
      </div>
      {(bridge?.openPitLaneDataFile || bridge?.reloadPitLaneDataFile) && (
        <div className="mt-4 border-t border-slate-700/50 pt-4">
          <h4 className="text-md font-medium text-slate-300">
            Calibration file
          </h4>
          <p className="mt-1 text-sm text-slate-500">
            View or edit pitLaneData.json. Positions are lap fractions from 0 to
            1, or null. Opening pauses automatic learning. Save changes, then
            Reload file to apply them and resume learning.
          </p>
          <div className="mt-3 flex gap-2">
            {bridge.openPitLaneDataFile && (
              <button
                type="button"
                disabled={busy}
                onClick={() => void editFile('open')}
                className="rounded-md bg-slate-600 px-3 py-1 text-sm text-slate-200 transition-colors hover:bg-slate-500 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {pendingAction === 'open'
                  ? 'Opening…'
                  : 'Open calibration file'}
              </button>
            )}
            {bridge.reloadPitLaneDataFile && (
              <button
                type="button"
                disabled={busy}
                onClick={() => void editFile('reload')}
                className="rounded-md bg-slate-600 px-3 py-1 text-sm text-slate-200 transition-colors hover:bg-slate-500 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {pendingAction === 'reload' ? 'Reloading…' : 'Reload file'}
              </button>
            )}
          </div>
        </div>
      )}
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
