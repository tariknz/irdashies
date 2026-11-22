import { beforeEach, describe, expect, it, vi } from 'vitest';
import { readData, writeData } from './storage';

vi.mock('./storage', () => ({ readData: vi.fn(), writeData: vi.fn() }));
vi.mock('../logger', () => ({ default: { error: vi.fn() } }));

describe('RaceOS opt-in', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.mocked(readData).mockReset();
    vi.mocked(writeData).mockReset();
  });

  it.each([true, false, undefined])(
    'loads opt-in once at startup: %s',
    async (stored) => {
      vi.mocked(readData).mockReturnValue(stored);
      const { getRaceosOptIn } = await import('./raceos');
      expect(getRaceosOptIn()).toBe(stored ?? false);
      expect(getRaceosOptIn()).toBe(stored ?? false);
      expect(readData).toHaveBeenCalledExactlyOnceWith('raceosOptIn');
    }
  );

  it('defaults to off when nothing is stored', async () => {
    vi.mocked(readData).mockReturnValue(undefined);
    const { getRaceosOptIn } = await import('./raceos');
    expect(getRaceosOptIn()).toBe(false);
  });

  it('immediately reflects settings changes without another synchronous read', async () => {
    const { getRaceosOptIn, setRaceosOptIn } = await import('./raceos');
    expect(getRaceosOptIn()).toBe(false);
    setRaceosOptIn(true);
    expect(getRaceosOptIn()).toBe(true);
    setRaceosOptIn(false);
    expect(getRaceosOptIn()).toBe(false);
    expect(readData).toHaveBeenCalledOnce();
    expect(vi.mocked(writeData).mock.calls).toEqual([
      ['raceosOptIn', true],
      ['raceosOptIn', false],
    ]);
  });

  it('tells listeners about each change, even when persistence fails', async () => {
    vi.mocked(readData).mockReturnValue(false);
    const { getRaceosOptIn, setRaceosOptIn, onRaceosOptInChanged } =
      await import('./raceos');
    getRaceosOptIn();
    const listener = vi.fn();
    const stop = onRaceosOptInChanged(listener);
    setRaceosOptIn(false);
    setRaceosOptIn(true);
    setRaceosOptIn(true);
    vi.mocked(writeData).mockImplementation(() => {
      throw new Error('disk full');
    });
    expect(() => setRaceosOptIn(false)).toThrow('disk full');
    stop();
    vi.mocked(writeData).mockReset();
    setRaceosOptIn(true);
    expect(listener.mock.calls).toEqual([[true], [false]]);
  });

  it('honours a new opt-in in memory even when persistence fails', async () => {
    const { getRaceosOptIn, setRaceosOptIn } = await import('./raceos');
    vi.mocked(writeData).mockImplementation(() => {
      throw new Error('disk full');
    });
    expect(() => setRaceosOptIn(true)).toThrow('disk full');
    expect(getRaceosOptIn()).toBe(true);
    expect(readData).not.toHaveBeenCalled();
  });
});
