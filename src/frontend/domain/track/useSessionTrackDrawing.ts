import { useMemo } from 'react';
import { useStoreWithEqualityFn } from 'zustand/traditional';
import { useSessionStore } from '@irdashies/context';
import type { LmuTrackMap } from '@irdashies/types';
import {
  lmuCorners,
  lmuTurnLabels,
  type LmuTurnLabelLayout,
} from './lmuTurnLabels';
import type { TrackDrawing } from './trackDrawing';
import { useTrackDrawing } from './useTrackDrawing';

const sameLmuTrackMap = (
  a: LmuTrackMap | undefined,
  b: LmuTrackMap | undefined
): boolean =>
  a === b ||
  (a !== undefined &&
    b !== undefined &&
    a.active.inside === b.active.inside &&
    a.active.totalLength === b.active.totalLength &&
    a.startFinish.point.length === b.startFinish.point.length &&
    (a.turns?.length ?? 0) === (b.turns?.length ?? 0));

export const closeLmuTrackLoop = (map: LmuTrackMap): TrackDrawing => {
  const points = map.active.trackPathPoints;
  const first = points[0];
  const last = points[points.length - 1];
  if (points.length < 2 || (first.x === last.x && first.y === last.y)) {
    return map;
  }
  return {
    ...map,
    active: {
      ...map.active,
      trackPathPoints: [...points, first],
      totalLength:
        (map.active.totalLength * points.length) / (points.length - 1),
    },
  };
};

export const useSessionTrackDrawing = (
  trackId: number | undefined,
  turnLabelLayout?: LmuTurnLabelLayout
): TrackDrawing | null => {
  const lmuTrackMap = useStoreWithEqualityFn(
    useSessionStore,
    (state) => state.session?.LmuTrackMap,
    sameLmuTrackMap
  );
  const trackName = useSessionStore(
    (state) => state.session?.WeekendInfo?.TrackName
  );
  const closedLmuMap = useMemo(
    () => (lmuTrackMap ? closeLmuTrackLoop(lmuTrackMap) : null),
    [lmuTrackMap]
  );
  const fontScale = turnLabelLayout?.fontScale;
  const trackWidth = turnLabelLayout?.trackWidth;
  const lmuDrawing = useMemo(() => {
    if (
      !closedLmuMap ||
      closedLmuMap.turns?.length ||
      fontScale === undefined ||
      trackWidth === undefined
    ) {
      return closedLmuMap;
    }
    const turns = lmuTurnLabels(closedLmuMap, lmuCorners(trackName), {
      fontScale,
      trackWidth,
    });
    return turns.length ? { ...closedLmuMap, turns } : closedLmuMap;
  }, [closedLmuMap, trackName, fontScale, trackWidth]);
  const loaded = useTrackDrawing(lmuDrawing ? undefined : trackId);
  if (trackId === undefined) return null;
  return lmuDrawing ?? loaded;
};
