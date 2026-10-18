import { useEffect, useRef } from 'react';
import type { TrackStateSnapshot } from '@irdashies/types';
import { shallow } from 'zustand/shallow';
import { usePitLaneStore, detectPitTransitions } from './PitLaneStore';
import { useTrackStateSelector } from '../ChannelStore';
import { useSessionStore } from '../SessionStore/SessionStore';
import type {
  PitLaneBridge,
  PitLaneCalibration,
  PitLaneTrackData,
} from '@irdashies/types';
import logger from '@irdashies/utils/logger';

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

  const { currentTrackId, calibrationRevision, calibrationSourceId } =
    usePitLaneStore();
  const prevTelemetryRef = useRef<ReturnType<
    typeof selectPitLaneTelemetry
  > | null>(null);

  useEffect(() => {
    let cancelled = false;
    let unsubscribeStore: (() => void) | undefined;
    let unsubscribeReset: (() => void) | undefined;
    let knownRevision = -1;
    let knownSourceId: string | null = null;
    let applying = false;
    prevTelemetryRef.current = null;

    if (!trackId) {
      usePitLaneStore.getState().reset();
      return;
    }
    usePitLaneStore.getState().setCurrentTrack(trackId, null, -1);

    const connect = async () => {
      const resolved = await bridge;
      if (cancelled) return;
      const apply = (calibration: PitLaneCalibration) => {
        if (
          cancelled ||
          calibration.trackId !== trackId ||
          (calibration.sourceId === knownSourceId &&
            calibration.revision <= knownRevision)
        )
          return;
        knownRevision = calibration.revision;
        knownSourceId = calibration.sourceId;
        applying = true;
        prevTelemetryRef.current = null;
        usePitLaneStore
          .getState()
          .setCurrentTrack(
            trackId,
            calibration.data,
            knownRevision,
            knownSourceId
          );
        applying = false;
      };
      // Subscribe before loading: a reset that overtakes the load wins by revision.
      unsubscribeReset = window.channelBridge?.subscribe(
        'pit-lane.reset',
        apply
      );
      unsubscribeStore = usePitLaneStore.subscribe((state, previous) => {
        if (
          applying ||
          knownRevision < 0 ||
          state.currentTrackId !== trackId ||
          state.calibrationRevision !== knownRevision ||
          state.calibrationSourceId !== knownSourceId
        )
          return;
        const updates: Partial<PitLaneTrackData> = {};
        if (
          state.pitEntryPct !== null &&
          state.pitEntryPct !== previous.pitEntryPct
        )
          updates.pitEntryPct = state.pitEntryPct;
        if (
          state.pitExitPct !== null &&
          state.pitExitPct !== previous.pitExitPct
        )
          updates.pitExitPct = state.pitExitPct;
        if (Object.keys(updates).length === 0 || knownSourceId === null) return;
        void resolved
          .updatePitLaneData(trackId, updates, knownRevision, knownSourceId)
          .then(async (accepted) => {
            if (!accepted && !cancelled) {
              const sourceBeforeRead = knownSourceId;
              const calibration = await resolved.getPitLaneData(trackId);
              if (
                sourceBeforeRead === knownSourceId ||
                calibration.sourceId === knownSourceId
              )
                apply(calibration);
            }
          })
          .catch((error) =>
            logger.error('Failed to save pit lane calibration', error)
          );
      });
      const sourceBeforeRead = knownSourceId;
      const calibration = await resolved.getPitLaneData(trackId);
      if (
        sourceBeforeRead === knownSourceId ||
        calibration.sourceId === knownSourceId
      )
        apply(calibration);
    };
    void connect().catch((error) =>
      logger.error('Failed to load pit lane calibration', error)
    );
    return () => {
      cancelled = true;
      unsubscribeStore?.();
      unsubscribeReset?.();
    };
  }, [trackId, bridge]);

  useEffect(() => {
    if (
      !trackId ||
      currentTrackId !== trackId ||
      calibrationRevision < 0 ||
      carIdxOnPitRoad.length === 0 ||
      carIdxTrackSurface.length === 0 ||
      carIdxLapDistPct.length === 0
    )
      return;
    const previous = prevTelemetryRef.current;
    if (
      !previous ||
      previous[0] !== carIdxOnPitRoad ||
      previous[1] !== carIdxTrackSurface ||
      previous[2] !== carIdxLapDistPct
    ) {
      detectPitTransitions(
        carIdxOnPitRoad,
        carIdxTrackSurface,
        carIdxLapDistPct
      );
      prevTelemetryRef.current = [
        carIdxOnPitRoad,
        carIdxTrackSurface,
        carIdxLapDistPct,
      ];
    }
  }, [
    carIdxOnPitRoad,
    carIdxTrackSurface,
    carIdxLapDistPct,
    trackId,
    currentTrackId,
    calibrationRevision,
    calibrationSourceId,
  ]);
};
