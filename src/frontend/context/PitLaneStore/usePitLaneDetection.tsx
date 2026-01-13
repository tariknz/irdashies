import { useEffect, useRef } from 'react';
import { usePitLaneStore } from './PitLaneStore';
import { useTelemetryValues } from '../TelemetryStore/TelemetryStore';
import { useSessionStore } from '../SessionStore/SessionStore';

/**
 * Hook that monitors telemetry and detects pit entry/exit positions.
 * This should be mounted once at the app level to continuously track all cars.
 */
export const usePitLaneDetection = () => {
  const session = useSessionStore((state) => state.session);
  const carIdxOnPitRoad = useTelemetryValues('CarIdxOnPitRoad') as boolean[] | undefined;
  const carIdxTrackSurface = useTelemetryValues('CarIdxTrackSurface') as number[] | undefined;
  const carIdxLapDistPct = useTelemetryValues('CarIdxLapDistPct') as number[] | undefined;

  const {
    currentTrackId,
    pitEntryPct,
    pitExitPct,
    setCurrentTrack,
    detectTransitions,
    reset,
  } = usePitLaneStore();

  const persistenceRef = useRef<{ trackId: string; entry: number | null; exit: number | null }>({
    trackId: '',
    entry: null,
    exit: null,
  });

  // Track ID from session
  const trackId = session?.WeekendInfo?.TrackID?.toString() ?? null;

  // Load pit lane data when track changes
  useEffect(() => {
    if (!trackId) {
      reset();
      return;
    }

    // Track changed
    if (trackId !== currentTrackId) {
      console.log(`[PitLaneDetection] Track changed to ${trackId}, loading pit lane data...`);

      // Load from disk via IPC
      window.electron?.pitLane?.getPitLaneData(trackId).then((data) => {
        console.log(`[PitLaneDetection] Loaded data:`, data);
        setCurrentTrack(trackId, data);
        persistenceRef.current = {
          trackId,
          entry: data?.pitEntryPct ?? null,
          exit: data?.pitExitPct ?? null,
        };
      });
    }
  }, [trackId, currentTrackId, setCurrentTrack, reset]);

  // Detect pit entry/exit transitions
  useEffect(() => {
    if (!carIdxOnPitRoad || !carIdxTrackSurface || !carIdxLapDistPct || !trackId) {
      return;
    }

    detectTransitions(carIdxOnPitRoad, carIdxTrackSurface, carIdxLapDistPct);
  }, [carIdxOnPitRoad, carIdxTrackSurface, carIdxLapDistPct, trackId, detectTransitions]);

  // Persist to disk when values change
  useEffect(() => {
    if (!trackId) return;

    const prev = persistenceRef.current;

    // Check if entry or exit changed
    const entryChanged = pitEntryPct !== null && pitEntryPct !== prev.entry;
    const exitChanged = pitExitPct !== null && pitExitPct !== prev.exit;

    if (entryChanged || exitChanged) {
      console.log(`[PitLaneDetection] Persisting to disk: entry=${pitEntryPct}, exit=${pitExitPct}`);

      const updates: { pitEntryPct?: number; pitExitPct?: number } = {};
      if (entryChanged) updates.pitEntryPct = pitEntryPct!;
      if (exitChanged) updates.pitExitPct = pitExitPct!;

      window.electron?.pitLane?.updatePitLaneData(trackId, updates);

      // Update ref
      persistenceRef.current = {
        trackId,
        entry: pitEntryPct,
        exit: pitExitPct,
      };
    }
  }, [trackId, pitEntryPct, pitExitPct]);
};
