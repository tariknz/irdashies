import { describe, expect, it, vi } from 'vitest';
import type { Session, Telemetry } from '@irdashies/types';
import {
  ReplayContextProcessor,
  detectReplayMode,
  isArchivableSubSessionId,
  type ArchiveIndex,
} from './ReplayContextProcessor';

/**
 * Hand-written session info. Replace with sessions cut from the §4.1 spike
 * tapes (live race, spectating, own replay, foreign replay, test replay) once
 * they are recorded.
 */
const session = ({
  simMode = 'full',
  subSessionId = 81269102,
  userId = 1001,
}: {
  simMode?: string;
  subSessionId?: number;
  userId?: number;
} = {}): Session =>
  ({
    WeekendInfo: { SimMode: simMode, SubSessionID: subSessionId },
    DriverInfo: { DriverUserID: userId, Drivers: [] },
  }) as unknown as Session;

const frame = (isReplayPlaying: boolean): Telemetry =>
  ({ IsReplayPlaying: { value: [isReplayPlaying] } }) as unknown as Telemetry;

const archiveOf = (bySubSession: Record<string, number[]> = {}) => ({
  has: vi.fn<ArchiveIndex['has']>((id) =>
    Promise.resolve(bySubSession[id] ?? [])
  ),
});

const knownUsers = (...ids: number[]) => ({
  has: (id: number) => ids.includes(id),
});

const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

describe('detectReplayMode', () => {
  it.each([
    ['replay', false, 'replayFile'],
    ['replay', true, 'replayFile'],
    ['full', true, 'spectating'],
    ['full', false, 'live'],
    [undefined, false, 'live'],
  ] as const)('simMode=%s playing=%s is %s', (simMode, playing, expected) => {
    expect(detectReplayMode({ simMode, isReplayPlaying: playing })).toBe(
      expected
    );
  });
});

describe('isArchivableSubSessionId', () => {
  it('rejects the shared offline id and an empty id', () => {
    expect(isArchivableSubSessionId('0')).toBe(false);
    expect(isArchivableSubSessionId('')).toBe(false);
    expect(isArchivableSubSessionId('81269102')).toBe(true);
  });
});

describe('ReplayContextProcessor', () => {
  it('starts live with no provenance', () => {
    const processor = new ReplayContextProcessor(archiveOf(), knownUsers());

    expect(processor.snapshot()).toMatchObject({
      mode: 'live',
      provenance: 'none',
      subSessionId: '',
      archivedSessionNums: [],
    });
  });

  it('reports a live race without looking at the archive', () => {
    const archive = archiveOf({ '81269102': [0, 1] });
    const processor = new ReplayContextProcessor(archive, knownUsers());

    processor.init(session());
    processor.onFrame(frame(false));

    expect(processor.snapshot()).toMatchObject({
      mode: 'live',
      provenance: 'none',
      subSessionId: '81269102',
    });
    expect(archive.has).not.toHaveBeenCalled();
  });

  it('reports live spectating while the sim plays back, and back again', () => {
    const processor = new ReplayContextProcessor(archiveOf(), knownUsers());
    processor.init(session());

    processor.onFrame(frame(true));
    expect(processor.snapshot().mode).toBe('spectating');
    expect(processor.snapshot().provenance).toBe('none');

    processor.onFrame(frame(false));
    expect(processor.snapshot().mode).toBe('live');
  });

  it('marks a replay file of an archived event as archived', async () => {
    const processor = new ReplayContextProcessor(
      archiveOf({ '81269102': [2, 0, 2] }),
      knownUsers(1001)
    );

    processor.init(session({ simMode: 'replay' }));
    expect(processor.snapshot()).toMatchObject({
      mode: 'replayFile',
      provenance: 'none',
    });
    await settle();

    expect(processor.snapshot()).toMatchObject({
      mode: 'replayFile',
      provenance: 'archived',
      subSessionId: '81269102',
      archivedSessionNums: [0, 2],
    });
  });

  it('marks our own replay with no archive as local', async () => {
    const processor = new ReplayContextProcessor(archiveOf(), knownUsers(1001));

    processor.init(session({ simMode: 'replay' }));
    await settle();

    expect(processor.snapshot().provenance).toBe('localNotArchived');
    expect(processor.snapshot().archivedSessionNums).toEqual([]);
  });

  it('marks a replay from an unknown user as foreign', async () => {
    const processor = new ReplayContextProcessor(archiveOf(), knownUsers(1001));

    processor.init(session({ simMode: 'replay', userId: 2002 }));
    await settle();

    expect(processor.snapshot().provenance).toBe('foreign');
  });

  it('never reports a SubSessionID 0 replay as archived', async () => {
    const archive = archiveOf({ '0': [0] });
    const processor = new ReplayContextProcessor(archive, knownUsers(1001));

    processor.init(session({ simMode: 'replay', subSessionId: 0 }));
    await settle();

    expect(archive.has).not.toHaveBeenCalled();
    expect(processor.snapshot()).toMatchObject({
      provenance: 'localNotArchived',
      archivedSessionNums: [],
    });
  });

  it('treats a failed archive lookup as no archive', async () => {
    const archive = {
      has: vi.fn<ArchiveIndex['has']>(() => Promise.reject(new Error('io'))),
    };
    const processor = new ReplayContextProcessor(archive, knownUsers());

    processor.init(session({ simMode: 'replay' }));
    await settle();

    expect(processor.snapshot().provenance).toBe('foreign');
  });

  it('drops a lookup that resolves after the replay changed', async () => {
    let resolveFirst: (value: number[]) => void = () => undefined;
    const archive = {
      has: vi.fn<ArchiveIndex['has']>((id) =>
        id === '111'
          ? new Promise<number[]>((resolve) => {
              resolveFirst = resolve;
            })
          : Promise.resolve([])
      ),
    };
    const processor = new ReplayContextProcessor(archive, knownUsers());

    processor.init(session({ simMode: 'replay', subSessionId: 111 }));
    processor.init(session({ simMode: 'replay', subSessionId: 222 }));
    await settle();
    resolveFirst([0]);
    await settle();

    expect(processor.snapshot()).toMatchObject({
      subSessionId: '222',
      provenance: 'foreign',
    });
  });

  it('bumps the version and notifies only when something changes', () => {
    const processor = new ReplayContextProcessor(archiveOf(), knownUsers());
    const listener = vi.fn();
    processor.onChange(listener);

    processor.init(session());
    const version = processor.snapshot().version;
    processor.init(session());
    processor.onFrame(frame(false));
    processor.onFrame(frame(false));

    expect(processor.snapshot().version).toBe(version);
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('does not look up the archive again for the same replay', async () => {
    const archive = archiveOf({ '81269102': [0] });
    const processor = new ReplayContextProcessor(archive, knownUsers());

    processor.init(session({ simMode: 'replay' }));
    await settle();
    processor.init(session({ simMode: 'replay' }));
    await settle();

    expect(archive.has).toHaveBeenCalledTimes(1);
  });

  it('re-resolves provenance when known users arrive late', async () => {
    const ids: number[] = [];
    const processor = new ReplayContextProcessor(archiveOf(), {
      has: (id) => ids.includes(id),
    });
    processor.init(session({ simMode: 'replay' }));
    await settle();
    expect(processor.snapshot().provenance).toBe('foreign');

    ids.push(1001);
    processor.refresh();

    expect(processor.snapshot().provenance).toBe('localNotArchived');
  });

  it.each(['disconnect', 'enter'] as const)(
    'resets to live on %s and ignores a lookup still in flight',
    async (type) => {
      let resolveLookup: (value: number[]) => void = () => undefined;
      const archive = {
        has: vi.fn<ArchiveIndex['has']>(
          () =>
            new Promise<number[]>((resolve) => {
              resolveLookup = resolve;
            })
        ),
      };
      const processor = new ReplayContextProcessor(archive, knownUsers());
      processor.init(session({ simMode: 'replay' }));

      processor.onLifecycle(
        type === 'enter' ? { type, replay: false } : { type }
      );
      resolveLookup([0]);
      await settle();

      expect(processor.snapshot()).toMatchObject({
        mode: 'live',
        provenance: 'none',
        subSessionId: '',
        archivedSessionNums: [],
      });
    }
  );

  it('ignores session number changes', () => {
    const processor = new ReplayContextProcessor(archiveOf(), knownUsers());
    processor.init(session());
    const before = processor.snapshot();

    processor.onLifecycle({ type: 'sessionNumChange' });

    expect(processor.snapshot()).toBe(before);
  });

  it('keeps a failing listener from breaking the others', () => {
    const processor = new ReplayContextProcessor(archiveOf(), knownUsers());
    const good = vi.fn();
    processor.onChange(() => {
      throw new Error('boom');
    });
    processor.onChange(good);

    processor.init(session());

    expect(good).toHaveBeenCalledTimes(1);
  });
});
