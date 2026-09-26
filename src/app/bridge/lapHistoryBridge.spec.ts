import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { LapHistorySnapshot } from '@irdashies/types';

const handlers = new Map<string, (...args: unknown[]) => unknown>();

vi.mock('electron', () => ({
  ipcMain: {
    handle: vi.fn((channel: string, handler: (...args: unknown[]) => unknown) =>
      handlers.set(channel, handler)
    ),
  },
}));

vi.mock('../logger', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

const { setupLapHistoryBridge, isValidSessionNum } =
  await import('./lapHistoryBridge');

const stored = { sessionNum: 1 } as LapHistorySnapshot;

const setup = ({
  sessionId = '81269102',
  readable = true,
  load = vi.fn(() => Promise.resolve<LapHistorySnapshot | null>(stored)),
} = {}) => {
  setupLapHistoryBridge({
    getCurrentSessionId: () => sessionId,
    canReadArchive: () => readable,
    load,
  });
  const getArchived = (sessionNum: unknown) =>
    handlers.get('lapHistory:getArchived')?.({}, sessionNum);
  return { load, getArchived };
};

describe('isValidSessionNum', () => {
  it.each([0, 1, 12, 999])('accepts %s', (value) => {
    expect(isValidSessionNum(value)).toBe(true);
  });

  it.each([-1, 1.5, 1000, '1', null, undefined, Number.NaN])(
    'rejects %s',
    (value) => {
      expect(isValidSessionNum(value)).toBe(false);
    }
  );
});

describe('lapHistory:getArchived', () => {
  beforeEach(() => {
    handlers.clear();
    vi.clearAllMocks();
  });

  it('loads the requested session of the current event', async () => {
    const { load, getArchived } = setup();

    await expect(getArchived(1)).resolves.toBe(stored);
    expect(load).toHaveBeenCalledWith('81269102', 1);
  });

  it('rejects an invalid session number without reading storage', async () => {
    const { load, getArchived } = setup();

    await expect(getArchived('../1')).resolves.toBeNull();
    await expect(getArchived(-1)).resolves.toBeNull();
    expect(load).not.toHaveBeenCalled();
  });

  it('returns nothing while disconnected', async () => {
    const { load, getArchived } = setup({ sessionId: '' });

    await expect(getArchived(0)).resolves.toBeNull();
    expect(load).not.toHaveBeenCalled();
  });

  it('returns nothing for a replay irDashies did not record', async () => {
    const { load, getArchived } = setup({ readable: false });

    await expect(getArchived(0)).resolves.toBeNull();
    expect(load).not.toHaveBeenCalled();
  });

  it('returns null when storage fails', async () => {
    const { getArchived } = setup({
      load: vi.fn(() => Promise.reject(new Error('io'))),
    });

    await expect(getArchived(0)).resolves.toBeNull();
  });
});
