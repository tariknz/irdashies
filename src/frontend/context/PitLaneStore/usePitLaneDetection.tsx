import { useEffect, useRef } from 'react';
import { usePitLaneStore, detectPitTransitions } from './PitLaneStore';
import { useTelemetryValues } from '../TelemetryStore/TelemetryStore';
import { useSessionStore } from '../SessionStore/SessionStore';
import type { PitLaneBridge } from '@irdashies/types';

/**
 * Hook that monitors telemetry and detects pit entry/exit positions.
 * This should be mounted once at the app level to continuously track all cars.
 */
export const usePitLaneDetection = (bridge: PitLaneBridge | Promise<PitLaneBridge>) => {
  const trackId = useSessionStore((state) => state.session?.WeekendInfo?.TrackID?.toString() ?? null);
  const carIdxOnPitRoad = useTelemetryValues('CarIdxOnPitRoad') as boolean[] | undefined;
  const carIdxTrackSurface = useTelemetryValues('CarIdxTrackSurface') as number[] | undefined;
  const carIdxLapDistPct = useTelemetryValues('CarIdxLapDistPct') as number[] | undefined;

  const {
    currentTrackId,
    pitEntryPct,
    pitExitPct,
    setCurrentTrack,
    reset,
  } = usePitLaneStore();

  // Use refs to track previous values and only call detectPitTransitions when data actually changes
  // This prevents running expensive operations at 60 FPS when nothing has changed
  const prevTelemetryRef = useRef<{
    carIdxOnPitRoad?: boolean[];
    carIdxTrackSurface?: number[];
    carIdxLapDistPct?: number[];
  }>({});

  const persistenceRef = useRef<{ trackId: string; entry: number | null; exit: number | null }>({
    trackId: '',
    entry: null,
    exit: null,
  });

  // Load pit lane data when track changes
  useEffect(() => {
    if (!trackId) {
      reset();
      prevTelemetryRef.current = {};
      return;
    }

    // Track changed
    if (trackId !== currentTrackId) {
      const loadData = async () => {
        const resolvedBridge = bridge instanceof Promise ? await bridge : bridge;
        const data = await resolvedBridge.getPitLaneData(trackId);
        setCurrentTrack(trackId, data);
        prevTelemetryRef.current = {};
        persistenceRef.current = {
          trackId,
          entry: data?.pitEntryPct ?? null,
          exit: data?.pitExitPct ?? null,
        };
      };
      loadData();
    }
  }, [trackId, currentTrackId, setCurrentTrack, reset, bridge]);

  // Detect pit entry/exit transitions
  useEffect(() => {
    if (!carIdxOnPitRoad || !carIdxTrackSurface || !carIdxLapDistPct || !trackId) {
      return;
    }

    // Only run detection if the telemetry arrays have actually changed (by reference)
    // This prevents running expensive operations at 60 FPS when nothing has changed
    const prev = prevTelemetryRef.current;
    if (
      prev.carIdxOnPitRoad !== carIdxOnPitRoad ||
      prev.carIdxTrackSurface !== carIdxTrackSurface ||
      prev.carIdxLapDistPct !== carIdxLapDistPct
    ) {
      detectPitTransitions(carIdxOnPitRoad, carIdxTrackSurface, carIdxLapDistPct);
      prevTelemetryRef.current = {
        carIdxOnPitRoad,
        carIdxTrackSurface,
        carIdxLapDistPct,
      };
    }
  }, [carIdxOnPitRoad, carIdxTrackSurface, carIdxLapDistPct, trackId]);

  // Persist to disk when values change
  useEffect(() => {
    if (!trackId) return;

    const prev = persistenceRef.current;

    // Check if entry or exit changed
    const entryChanged = pitEntryPct !== null && pitEntryPct !== prev.entry;
    const exitChanged = pitExitPct !== null && pitExitPct !== prev.exit;

    if (entryChanged || exitChanged) {
      const updates: { pitEntryPct?: number; pitExitPct?: number } = {};
      if (entryChanged && pitEntryPct !== null) updates.pitEntryPct = pitEntryPct;
      if (exitChanged && pitExitPct !== null) updates.pitExitPct = pitExitPct;

      const updateData = async () => {
        const resolvedBridge = bridge instanceof Promise ? await bridge : bridge;
        await resolvedBridge.updatePitLaneData(trackId, updates);
      };
      updateData();

      // Update ref
      persistenceRef.current = {
        trackId,
        entry: pitEntryPct,
        exit: pitExitPct,
      };
    }
  }, [trackId, pitEntryPct, pitExitPct, bridge]);
};
