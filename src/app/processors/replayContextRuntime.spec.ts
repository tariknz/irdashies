import { describe, expect, it, vi } from 'vitest';
import type {
  ReplayContextSnapshot,
  Session,
  Telemetry,
} from '@irdashies/types';
import { ChannelBus } from '../bridge/channelBridge';
import { createSessionLifecycle } from '../sessionLifecycle';
import {
  ReplayContextRuntime,
  type KnownUserIdRecorder,
} from './replayContextRuntime';
import type { ArchiveIndex } from './ReplayContextProcessor';

/** Hand-written; replace with spike tape sessions once recorded (§4.1). */
const session = (
  simMode: string,
  subSessionId = 81269102,
  userId = 1001
): Session =>
  ({
    WeekendInfo: { SimMode: simMode, SubSessionID: subSessionId },
    DriverInfo: { DriverUserID: userId, Drivers: [] },
  }) as unknown as Session;

const frame = (isReplayPlaying: boolean): Telemetry =>
  ({ IsReplayPlaying: { value: [isReplayPlaying] } }) as unknown as Telemetry;

const newMetrics = () => ({ markStart: vi.fn(), markEnd: vi.fn() });

const newKnownIds = (initial: number[] = []) => {
  const ids = [...initial];
  return {
    ids,
    has: vi.fn((id: number) => ids.includes(id)),
    remember: vi.fn((id: number) => {
      if (ids.includes(id)) return false;
      ids.unshift(id);
      return true;
    }),
    load: vi.fn(() => Promise.resolve(ids)),
  } satisfies KnownUserIdRecorder & { ids: number[] };
};

const archiveOf = (sessionNums: number[] = []): ArchiveIndex => ({
  has: vi.fn(() => Promise.resolve(sessionNums)),
});

const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

const setup = ({
  archive = archiveOf(),
  knownIds = newKnownIds(),
  isLiveSource = true,
}: {
  archive?: ArchiveIndex;
  knownIds?: ReturnType<typeof newKnownIds>;
  isLiveSource?: boolean;
} = {}) => {
  const bus = new ChannelBus();
  const publish = vi.spyOn(bus, 'publish');
  const lifecycle = createSessionLifecycle();
  const metrics = newMetrics();
  const runtime = new ReplayContextRuntime(
    bus,
    lifecycle,
    metrics,
    archive,
    knownIds,
    { isLiveSource: () => isLiveSource }
  );
  return { bus, publish, lifecycle, metrics, runtime, knownIds };
};

describe('ReplayContextRuntime', () => {
  it('publishes each change on replay.context', async () => {
    const { runtime, publish } = setup({ archive: archiveOf([0, 1]) });

    runtime.onSession(session('replay'));
    await settle();

    const published = publish.mock.calls
      .filter(([channel]) => channel === 'replay.context')
      .map(([, payload]) => payload as ReplayContextSnapshot);
    expect(published.at(-1)).toMatchObject({
      mode: 'replayFile',
      provenance: 'archived',
      archivedSessionNums: [0, 1],
    });
  });

  it('notifies listeners so recording can pause for a replay file', async () => {
    const { runtime } = setup();
    const modes: string[] = [];
    runtime.onChange((snapshot) => modes.push(snapshot.mode));

    runtime.onSession(session('replay'));
    await settle();

    expect(modes).toContain('replayFile');
    expect(runtime.isReplayFile()).toBe(true);
  });

  it('measures frame handling', () => {
    const { runtime, metrics } = setup();

    runtime.onFrame(frame(false));

    expect(metrics.markStart).toHaveBeenCalledWith('replayContextProcessing');
    expect(metrics.markEnd).toHaveBeenCalledWith('replayContextProcessing');
  });

  it('remembers the user of a live session', () => {
    const { runtime, knownIds } = setup();

    runtime.onSession(session('full', 81269102, 4242));

    expect(knownIds.remember).toHaveBeenCalledWith(4242);
  });

  it('does not remember the user of a replay file', () => {
    const { runtime, knownIds } = setup();

    runtime.onSession(session('replay', 81269102, 4242));

    expect(knownIds.remember).not.toHaveBeenCalled();
  });

  it('does not remember users from demo data or tape playback', () => {
    const { runtime, knownIds } = setup({ isLiveSource: false });

    runtime.onSession(session('full', 81269102, 4242));

    expect(knownIds.remember).not.toHaveBeenCalled();
  });

  it('re-resolves provenance once known ids have loaded', async () => {
    const knownIds = newKnownIds();
    let finishLoad: () => void = () => undefined;
    knownIds.load.mockImplementation(
      () =>
        new Promise((resolve) => {
          finishLoad = () => resolve(knownIds.ids);
        })
    );
    const { runtime } = setup({ knownIds });

    runtime.onSession(session('replay', 81269102, 1001));
    await settle();
    expect(runtime.snapshot().provenance).toBe('foreign');

    knownIds.ids.push(1001);
    finishLoad();
    await settle();

    expect(runtime.snapshot().provenance).toBe('localNotArchived');
  });

  it('only allows archive reads for live sessions or archived replays', async () => {
    const archived = setup({ archive: archiveOf([0]) }).runtime;
    const foreign = setup().runtime;
    const testSession = setup({ archive: archiveOf([0]) }).runtime;

    expect(archived.canReadArchive()).toBe(true);

    archived.onSession(session('replay'));
    // Still looking the archive up.
    expect(archived.canReadArchive()).toBe(false);
    await settle();
    expect(archived.canReadArchive()).toBe(true);

    foreign.onSession(session('replay'));
    await settle();
    expect(foreign.canReadArchive()).toBe(false);

    testSession.onSession(session('replay', 0));
    await settle();
    expect(testSession.canReadArchive()).toBe(false);
  });

  it('resets to live on disconnect', async () => {
    const { runtime, lifecycle } = setup({ archive: archiveOf([0]) });
    runtime.onSession(session('replay'));
    await settle();

    lifecycle._onDisconnect();

    expect(runtime.snapshot()).toMatchObject({
      mode: 'live',
      provenance: 'none',
      subSessionId: '',
    });
  });

  it('resends the current context when a window subscribes again', async () => {
    const { runtime, bus } = setup({ archive: archiveOf([0]) });
    runtime.onSession(session('replay'));
    await settle();

    const delivered: unknown[] = [];
    const window = {
      id: 7,
      isDestroyed: () => false,
      isVisible: () => true,
      send: (_c: string, _n: string, payload: unknown) =>
        delivered.push(payload),
    };
    bus.subscribe(window, 'replay.context');
    bus.unsubscribe(window.id, 'replay.context');
    delivered.length = 0;

    bus.subscribe(window, 'replay.context');

    expect(delivered.at(-1)).toMatchObject({ provenance: 'archived' });
  });

  it('stops listening after dispose', async () => {
    const { runtime, lifecycle } = setup({ archive: archiveOf([0]) });
    runtime.onSession(session('replay'));
    await settle();

    runtime.dispose();
    lifecycle._onDisconnect();

    expect(runtime.snapshot().mode).toBe('replayFile');
  });
});
