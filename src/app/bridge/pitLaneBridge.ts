import { ipcMain } from 'electron';
import { randomUUID } from 'node:crypto';
import {
  clearPitLaneDataForTrack,
  getPitLaneDataForTrack,
  updatePitLaneDataForTrack,
} from '../storage/pitLaneData';
import type { PitLaneBridge, Session } from '@irdashies/types';
import type { OverlayManager } from '../overlayManager';
import type { ChannelBus } from './channelBus';

const isTrackId = (value: unknown): value is string =>
  typeof value === 'string' && /^[1-9]\d{0,9}$/.test(value);

const isUpdate = (
  value: unknown
): value is Parameters<PitLaneBridge['updatePitLaneData']>[1] =>
  value !== null &&
  typeof value === 'object' &&
  !Array.isArray(value) &&
  Object.keys(value).length > 0 &&
  Object.entries(value).every(
    ([key, pct]) =>
      (key === 'pitEntryPct' || key === 'pitExitPct') &&
      (pct === null ||
        (typeof pct === 'number' &&
          Number.isFinite(pct) &&
          pct >= 0 &&
          pct <= 1))
  );

/** One instance is shared by IPC and browser clients, including reset revisions. */
export const createPitLaneBridge = (
  overlayManager: Pick<
    OverlayManager,
    'getLatestSessionData' | 'getRunningState'
  >,
  channelBus: ChannelBus
): PitLaneBridge => {
  const sourceId = randomUUID();
  const revisions = new Map<string, number>();
  const pending = new Map<string, Promise<unknown>>();
  const forTrack = <Result>(
    trackId: string,
    operation: () => Promise<Result>
  ): Promise<Result> => {
    const next = (pending.get(trackId) ?? Promise.resolve())
      .catch(() => undefined)
      .then(operation);
    pending.set(trackId, next);
    void next
      .finally(() => {
        if (pending.get(trackId) === next) pending.delete(trackId);
      })
      .catch(() => undefined);
    return next;
  };
  const currentTrack = () => {
    if (!overlayManager.getRunningState()) return null;
    const session = overlayManager.getLatestSessionData() as
      Session | undefined;
    const weekend = session?.WeekendInfo;
    const trackId = weekend?.TrackID?.toString();
    if (!isTrackId(trackId)) return null;
    return {
      trackId,
      trackName:
        weekend?.TrackDisplayName || weekend?.TrackName || `Track ${trackId}`,
    };
  };

  return {
    async getPitLaneData(trackId) {
      if (!isTrackId(trackId)) throw new TypeError('Invalid pit lane track ID');
      return forTrack(trackId, async () => ({
        trackId,
        sourceId,
        revision: revisions.get(trackId) ?? 0,
        data: await getPitLaneDataForTrack(trackId),
      }));
    },
    async updatePitLaneData(trackId, data, revision, savedSourceId) {
      if (
        !isTrackId(trackId) ||
        !isUpdate(data) ||
        !Number.isSafeInteger(revision) ||
        revision < 0 ||
        typeof savedSourceId !== 'string'
      ) {
        throw new TypeError('Invalid pit lane update');
      }
      return forTrack(trackId, async () => {
        if (
          savedSourceId !== sourceId ||
          revision !== (revisions.get(trackId) ?? 0)
        )
          return false;
        await updatePitLaneDataForTrack(trackId, data);
        return true;
      });
    },
    async getCurrentTrackPitLaneInfo() {
      const track = currentTrack();
      if (!track) return null;
      const data = await forTrack(track.trackId, () =>
        getPitLaneDataForTrack(track.trackId)
      );
      return {
        ...track,
        hasCalibration: data?.pitEntryPct != null || data?.pitExitPct != null,
      };
    },
    async resetPitLaneData(trackId) {
      if (!isTrackId(trackId)) throw new TypeError('Invalid pit lane track ID');
      await forTrack(trackId, async () => {
        if (currentTrack()?.trackId !== trackId)
          throw new Error('The current track changed. Refresh and try again.');
        await clearPitLaneDataForTrack(trackId);
        const revision = (revisions.get(trackId) ?? 0) + 1;
        revisions.set(trackId, revision);
        channelBus.publish('pit-lane.reset', {
          trackId,
          sourceId,
          revision,
          data: null,
        });
      });
    },
  };
};

export const setupPitLaneBridge = (
  overlayManager: Parameters<typeof createPitLaneBridge>[0],
  channelBus: ChannelBus
): PitLaneBridge => {
  const bridge = createPitLaneBridge(overlayManager, channelBus);
  ipcMain.handle('pitLane:getData', (_, trackId) =>
    bridge.getPitLaneData(trackId)
  );
  ipcMain.handle('pitLane:updateData', (_, trackId, data, revision, sourceId) =>
    bridge.updatePitLaneData(trackId, data, revision, sourceId)
  );
  ipcMain.handle('pitLane:getCurrentTrack', () =>
    bridge.getCurrentTrackPitLaneInfo()
  );
  ipcMain.handle('pitLane:resetData', (_, trackId) =>
    bridge.resetPitLaneData(trackId)
  );
  return bridge;
};
