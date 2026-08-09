import { useEffect, useRef } from 'react';
import type { TrackStateSnapshot } from '@irdashies/types';
import { shallow } from 'zustand/shallow';
import { usePitLaneStore, detectPitTransitions } from './PitLaneStore';
import { useTrackStateSelector } from '../ChannelStore';
import { useSessionStore } from '../SessionStore/SessionStore';
import type { PitLaneBridge } from '@irdashies/types';

const EMPTY_PIT_LANE_TELEMETRY: readonly [
  readonly boolean[],
  readonly number[],
  readonly number[],
] = [[], [], []];

const selectPitLaneTelemetry = (snapshot: TrackStateSnapshot) =>
  [
    snapshot.carIdxOnPitRoad,
    snapshot.carIdxTrackSurface,
    snapshot.carIdxLapDistPct,
  ] as const;

const pitLaneTelemetryEqual = (
  previous: ReturnType<typeof selectPitLaneTelemetry>,
  next: ReturnType<typeof selectPitLaneTelemetry>
) =>
  shallow(previous[0], next[0]) &&
  shallow(previous[1], next[1]) &&
  shallow(previous[2], next[2]);

/**
 * Hook that monitors telemetry and detects pit entry/exit positions.
 * This should be mounted once at the app level to continuously track all cars.
 */
export const usePitLaneDetection = (
  bridge: PitLaneBridge | Promise<PitLaneBridge>
) => {
  const trackId = useSessionStore(
    (state) => state.session?.WeekendInfo?.TrackID?.toString() ?? null
  );
  const [carIdxOnPitRoad, carIdxTrackSurface, carIdxLapDistPct] =
    useTrackStateSelector(selectPitLaneTelemetry, {
      equality: pitLaneTelemetryEqual,
    }) ?? EMPTY_PIT_LANE_TELEMETRY;

  const { currentTrackId, pitEntryPct, pitExitPct, setCurrentTrack, reset } =
    usePitLaneStore();

  // Use refs to track previous values and only call detectPitTransitions when data actually changes
  // This prevents running expensive operations at 60 FPS when nothing has changed
  const prevTelemetryRef = useRef<{
    carIdxOnPitRoad?: readonly boolean[];
    carIdxTrackSurface?: readonly number[];
    carIdxLapDistPct?: readonly number[];
  }>({});

  const persistenceRef = useRef<{
    trackId: string;
    entry: number | null;
    exit: number | null;
  }>({
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
        const resolvedBridge =
          bridge instanceof Promise ? await bridge : bridge;
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
    if (
      carIdxOnPitRoad.length === 0 ||
      carIdxTrackSurface.length === 0 ||
      carIdxLapDistPct.length === 0 ||
      !trackId
    ) {
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
      detectPitTransitions(
        carIdxOnPitRoad,
        carIdxTrackSurface,
        carIdxLapDistPct
      );
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
      if (entryChanged && pitEntryPct !== null)
        updates.pitEntryPct = pitEntryPct;
      if (exitChanged && pitExitPct !== null) updates.pitExitPct = pitExitPct;

      const updateData = async () => {
        const resolvedBridge =
          bridge instanceof Promise ? await bridge : bridge;
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
