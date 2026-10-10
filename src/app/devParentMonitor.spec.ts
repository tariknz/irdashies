import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { monitorDevParent } from './devParentMonitor';

describe('monitorDevParent', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('quits once when the launcher disappears', () => {
    const kill = vi.spyOn(process, 'kill').mockReturnValue(true);
    const quit = vi.fn();
    monitorDevParent(123, quit);
    vi.advanceTimersByTime(1_000);
    expect(kill).toHaveBeenCalledWith(123, 0);
    expect(quit).not.toHaveBeenCalled();

    kill.mockImplementation(() => {
      throw Object.assign(new Error('missing process'), { code: 'ESRCH' });
    });
    vi.advanceTimersByTime(3_000);
    expect(quit).toHaveBeenCalledOnce();
  });

  it('keeps running when the parent exists but cannot be signalled', () => {
    vi.spyOn(process, 'kill').mockImplementation(() => {
      throw Object.assign(new Error('permission denied'), { code: 'EPERM' });
    });
    const quit = vi.fn();
    monitorDevParent(123, quit);
    vi.advanceTimersByTime(2_000);
    expect(quit).not.toHaveBeenCalled();
  });
});
