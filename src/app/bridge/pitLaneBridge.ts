import { ipcMain, shell } from 'electron';
import { randomUUID } from 'node:crypto';
import {
  clearPitLaneDataForTrack,
  getPitLaneDataForTrack,
  updatePitLaneDataForTrack,
  preparePitLaneDataFile,
  reloadPitLaneDataFile,
  isPitLaneDataEditing,
  resumePitLaneDataLearning,
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
  const registerTrack = (trackId: string): void => {
    if (!revisions.has(trackId)) {
      if (revisions.size >= 10000)
        throw new Error('Too many tracked calibration records.');
      revisions.set(trackId, 0);
    }
  };
  // A file reload changes several tracks at once. Keep reads, saves and resets
  // behind the same barrier so none can restore the pre-edit calibration.
  let pending: Promise<unknown> = Promise.resolve();
  const serialize = <Result>(
    operation: () => Promise<Result>
  ): Promise<Result> => {
    const next = pending.catch(() => undefined).then(operation);
    pending = next;
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
      return serialize(async () => {
        registerTrack(trackId);
        return {
          trackId,
          sourceId,
          revision: revisions.get(trackId) ?? 0,
          data: await getPitLaneDataForTrack(trackId),
        };
      });
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
      return serialize(async () => {
        registerTrack(trackId);
        if (
          savedSourceId !== sourceId ||
          revision !== (revisions.get(trackId) ?? 0)
        )
          return false;
        return updatePitLaneDataForTrack(trackId, data);
      });
    },
    async getCurrentTrackPitLaneInfo() {
      const track = currentTrack();
      if (!track) return null;
      const data = await serialize(() => getPitLaneDataForTrack(track.trackId));
      return {
        ...track,
        hasCalibration: data?.pitEntryPct != null || data?.pitExitPct != null,
        learningPaused: isPitLaneDataEditing(),
      };
    },
    async resetPitLaneData(trackId) {
      if (!isTrackId(trackId)) throw new TypeError('Invalid pit lane track ID');
      await serialize(async () => {
        if (isPitLaneDataEditing())
          throw new Error(
            'Reload the calibration file before resetting while editing.'
          );
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
    async openPitLaneDataFile() {
      await serialize(async () => {
        const wasEditing = isPitLaneDataEditing();
        try {
          const filePath = await preparePitLaneDataFile();
          const error = await shell.openPath(filePath);
          if (error)
            throw new Error(
              'Could not open calibration file. Check your default JSON application.'
            );
        } catch (error) {
          if (!wasEditing) resumePitLaneDataLearning();
          throw error;
        }
      });
    },
    async reloadPitLaneDataFile() {
      await serialize(async () => {
        const wasEditing = isPitLaneDataEditing();
        const changes = new Map(
          (await reloadPitLaneDataFile()).map(({ trackId, data }) => [
            trackId,
            data,
          ])
        );
        // Even an unchanged file must replace values learned only in renderer
        // memory while saves were paused, and reject late pre-editor saves.
        if (wasEditing)
          for (const trackId of revisions.keys()) {
            if (!changes.has(trackId))
              changes.set(trackId, await getPitLaneDataForTrack(trackId));
          }
        for (const [trackId, data] of changes) {
          registerTrack(trackId);
          const revision = (revisions.get(trackId) ?? 0) + 1;
          revisions.set(trackId, revision);
          channelBus.publish('pit-lane.reset', {
            trackId,
            sourceId,
            revision,
            data,
          });
        }
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
  ipcMain.handle('pitLane:openFile', () => bridge.openPitLaneDataFile?.());
  ipcMain.handle('pitLane:reloadFile', () => bridge.reloadPitLaneDataFile?.());
  return bridge;
};
