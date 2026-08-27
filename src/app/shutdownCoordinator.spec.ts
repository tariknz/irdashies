import { describe, expect, it, vi } from 'vitest';
import { createBeforeQuitHandler } from './shutdownCoordinator';

const flushPromises = () => new Promise((resolve) => setTimeout(resolve, 0));

function createHarness(shutdown: () => Promise<void>, timeoutMs = 5_000) {
  const prepareToQuit = vi.fn();
  const quit = vi.fn();
  const reportFailure = vi.fn();
  const preventDefault = vi.fn();
  const handler = createBeforeQuitHandler({
    prepareToQuit,
    shutdown,
    quit,
    reportFailure,
    timeoutMs,
  });

  return {
    handler,
    event: { preventDefault },
    prepareToQuit,
    quit,
    reportFailure,
    preventDefault,
  };
}

describe('createBeforeQuitHandler', () => {
  it('waits for shutdown and lets the follow-up quit proceed', async () => {
    let finishShutdown: (() => void) | undefined;
    const shutdown = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          finishShutdown = resolve;
        })
    );
    const harness = createHarness(shutdown);

    harness.handler(harness.event);

    expect(harness.preventDefault).toHaveBeenCalledOnce();
    expect(shutdown).toHaveBeenCalledOnce();
    expect(harness.quit).not.toHaveBeenCalled();

    finishShutdown?.();
    await flushPromises();

    expect(harness.quit).toHaveBeenCalledOnce();
    harness.preventDefault.mockClear();
    harness.handler(harness.event);
    expect(harness.preventDefault).not.toHaveBeenCalled();
  });

  it('runs shutdown only once when quit is requested repeatedly', () => {
    const shutdown = vi.fn(() => new Promise<void>(() => undefined));
    const harness = createHarness(shutdown);

    harness.handler(harness.event);
    harness.handler(harness.event);

    expect(shutdown).toHaveBeenCalledOnce();
    expect(harness.preventDefault).toHaveBeenCalledTimes(2);
  });

  it('reports a shutdown failure and continues quitting', async () => {
    const error = new Error('flush failed');
    const harness = createHarness(() => Promise.reject(error));

    harness.handler(harness.event);
    await flushPromises();

    expect(harness.reportFailure).toHaveBeenCalledWith(error);
    expect(harness.quit).toHaveBeenCalledOnce();
  });

  it('continues quitting when shutdown exceeds its deadline', async () => {
    vi.useFakeTimers();
    const harness = createHarness(
      () => new Promise<void>(() => undefined),
      100
    );

    harness.handler(harness.event);
    await vi.advanceTimersByTimeAsync(100);

    expect(harness.reportFailure).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'Shutdown timed out' })
    );
    expect(harness.quit).toHaveBeenCalledOnce();
    vi.useRealTimers();
  });
});
