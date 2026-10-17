import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { PitLaneTrackData } from '@irdashies/types';
import { createPitLaneBridge, setupPitLaneBridge } from './pitLaneBridge';
import { ChannelBus } from './channelBus';

const mocks = vi.hoisted(() => ({
  get: vi.fn(),
  update: vi.fn(),
  clear: vi.fn(),
  handle: vi.fn(),
}));
vi.mock('node:crypto', () => ({ randomUUID: () => 'test-source' }));
vi.mock('electron', () => ({ ipcMain: { handle: mocks.handle } }));
vi.mock('../storage/pitLaneData', () => ({
  getPitLaneDataForTrack: mocks.get,
  updatePitLaneDataForTrack: mocks.update,
  clearPitLaneDataForTrack: mocks.clear,
}));

let data: Map<string, PitLaneTrackData>;
let manager: {
  getLatestSessionData: ReturnType<typeof vi.fn<() => unknown>>;
  getRunningState: ReturnType<typeof vi.fn<() => boolean>>;
};
let bus: ChannelBus;
let bridge: ReturnType<typeof createPitLaneBridge>;

beforeEach(() => {
  vi.clearAllMocks();
  data = new Map([
    ['47', { pitEntryPct: 0.92, pitExitPct: 0.05 }],
    ['181', { pitEntryPct: 0.98, pitExitPct: 0.06 }],
  ]);
  mocks.get.mockImplementation(async (id) => data.get(id) ?? null);
  mocks.update.mockImplementation(async (id, update) =>
    data.set(id, {
      ...(data.get(id) ?? { pitEntryPct: null, pitExitPct: null }),
      ...update,
    })
  );
  mocks.clear.mockImplementation(async (id) => data.delete(id));
  manager = {
    getLatestSessionData: vi.fn(() => ({
      WeekendInfo: { TrackID: 47, TrackDisplayName: 'Laguna Seca' },
    })),
    getRunningState: vi.fn(() => true),
  };
  bus = new ChannelBus();
  bridge = createPitLaneBridge(manager, bus);
});

afterEach(() => vi.restoreAllMocks());

describe('pit lane reset bridge', () => {
  it('resolves the track in main without a settings session subscription', async () => {
    expect(await bridge.getCurrentTrackPitLaneInfo()).toEqual({
      trackId: '47',
      trackName: 'Laguna Seca',
      hasCalibration: true,
    });
    manager.getRunningState.mockReturnValue(false);
    expect(await bridge.getCurrentTrackPitLaneInfo()).toBeNull();
  });

  it('rejects a stale confirmation after the current track changes', async () => {
    await expect(bridge.resetPitLaneData('181')).rejects.toThrow(
      'current track changed'
    );
    expect(mocks.clear).not.toHaveBeenCalled();
  });

  it.each(['', '__proto__', '../47', '47.5', '0'])(
    'rejects invalid track %s at the IPC boundary',
    async (id) => {
      setupPitLaneBridge(manager, bus);
      const get = mocks.handle.mock.calls.find(
        ([name]) => name === 'pitLane:getData'
      )?.[1];
      await expect(get({}, id)).rejects.toThrow('Invalid pit lane track ID');
      expect(mocks.get).not.toHaveBeenCalled();
    }
  );

  it.each([
    { pitEntryPct: NaN },
    { pitExitPct: -1 },
    { pitExitPct: 1.1 },
    { unexpected: 0.5 },
    {},
  ])('rejects invalid learned data %o', async (update) => {
    await expect(
      bridge.updatePitLaneData('47', update, 0, 'test-source')
    ).rejects.toThrow('Invalid pit lane update');
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it('clears persisted data, broadcasts to visible and hidden windows, and rejects old saves', async () => {
    const visible = vi.fn();
    const hidden = vi.fn();
    for (const [id, send] of [
      [1, visible],
      [2, hidden],
    ] as const) {
      bus.subscribe(
        { id, send, isDestroyed: () => false, isVisible: () => id === 1 },
        'pit-lane.reset'
      );
    }
    await bridge.resetPitLaneData('47');
    expect(data.has('47')).toBe(false);
    expect(data.get('181')).toEqual({ pitEntryPct: 0.98, pitExitPct: 0.06 });
    const reset = {
      trackId: '47',
      sourceId: 'test-source',
      revision: 1,
      data: null,
    };
    expect(visible).toHaveBeenCalledWith(
      'channels:delivery',
      'pit-lane.reset',
      reset
    );
    expect(hidden).toHaveBeenCalledWith(
      'channels:delivery',
      'pit-lane.reset',
      reset
    );
    expect(
      await bridge.updatePitLaneData(
        '47',
        { pitEntryPct: 0.92 },
        0,
        'test-source'
      )
    ).toBe(false);
    expect(
      await bridge.updatePitLaneData(
        '47',
        { pitEntryPct: 0.91 },
        1,
        'test-source'
      )
    ).toBe(true);
    expect((await bridge.getPitLaneData('47')).data?.pitEntryPct).toBe(0.91);
  });

  it('blocks concurrent reads and writes until reset succeeds', async () => {
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    mocks.clear.mockImplementationOnce(async (id) => {
      await gate;
      data.delete(id);
    });
    const resetting = bridge.resetPitLaneData('47');
    await vi.waitFor(() => expect(mocks.clear).toHaveBeenCalled());
    const reading = bridge.getPitLaneData('47');
    const staleSave = bridge.updatePitLaneData(
      '47',
      { pitEntryPct: 0.92 },
      0,
      'test-source'
    );
    const readFinished = vi.fn();
    void reading.then(readFinished);
    await Promise.resolve();
    expect(readFinished).not.toHaveBeenCalled();
    release();
    await resetting;
    expect(await reading).toEqual({
      trackId: '47',
      sourceId: 'test-source',
      revision: 1,
      data: null,
    });
    expect(await staleSave).toBe(false);
  });

  it('keeps revision and live data usable when disk reset fails', async () => {
    mocks.clear.mockRejectedValueOnce(new Error('disk full'));
    const publish = vi.spyOn(bus, 'publish');
    await expect(bridge.resetPitLaneData('47')).rejects.toThrow('disk full');
    expect((await bridge.getPitLaneData('47')).revision).toBe(0);
    expect(
      await bridge.updatePitLaneData(
        '47',
        { pitExitPct: 0.07 },
        0,
        'test-source'
      )
    ).toBe(true);
    expect(publish).not.toHaveBeenCalled();
  });
  it('rejects saves from a previous main instance even at the same revision', async () => {
    expect(
      await bridge.updatePitLaneData(
        '47',
        { pitEntryPct: 0.9 },
        0,
        'previous-instance'
      )
    ).toBe(false);
    expect(mocks.update).not.toHaveBeenCalled();
  });
});
