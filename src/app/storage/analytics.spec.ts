import { beforeEach, describe, expect, it, vi } from 'vitest';
import { readData, writeData } from './storage';

vi.mock('./storage', () => ({ readData: vi.fn(), writeData: vi.fn() }));

describe('analytics consent cache', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.mocked(readData).mockReset();
    vi.mocked(writeData).mockReset();
  });

  it.each([true, false, undefined])(
    'loads consent once at startup: %s',
    async (stored) => {
      vi.mocked(readData).mockReturnValue(stored);
      const { getAnalyticsOptOut } = await import('./analytics');
      expect(getAnalyticsOptOut()).toBe(stored ?? false);
      expect(getAnalyticsOptOut()).toBe(stored ?? false);
      expect(readData).toHaveBeenCalledExactlyOnceWith('analyticsOptOut');
    }
  );

  it('immediately reflects settings changes without another synchronous read', async () => {
    const { getAnalyticsOptOut, setAnalyticsOptOut } =
      await import('./analytics');
    expect(getAnalyticsOptOut()).toBe(false);
    setAnalyticsOptOut(true);
    expect(getAnalyticsOptOut()).toBe(true);
    setAnalyticsOptOut(false);
    expect(getAnalyticsOptOut()).toBe(false);
    expect(readData).toHaveBeenCalledOnce();
    expect(vi.mocked(writeData).mock.calls).toEqual([
      ['analyticsOptOut', true],
      ['analyticsOptOut', false],
    ]);
  });

  it('honours a new opt-out in memory even when persistence fails', async () => {
    const { getAnalyticsOptOut, setAnalyticsOptOut } =
      await import('./analytics');
    vi.mocked(writeData).mockImplementation(() => {
      throw new Error('disk full');
    });
    expect(() => setAnalyticsOptOut(true)).toThrow('disk full');
    expect(getAnalyticsOptOut()).toBe(true);
    expect(readData).not.toHaveBeenCalled();
  });
});
