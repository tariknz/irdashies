export interface BeforeQuitEvent {
  preventDefault(): void;
}

interface ShutdownCoordinatorOptions {
  prepareToQuit(): void;
  shutdown(): Promise<void>;
  quit(): void;
  reportFailure(error: unknown): void;
  timeoutMs: number;
}

type ShutdownState = 'idle' | 'running' | 'complete';

/**
 * Creates an Electron before-quit handler that waits for asynchronous cleanup
 * exactly once, then allows the follow-up quit event to proceed.
 */
export function createBeforeQuitHandler({
  prepareToQuit,
  shutdown,
  quit,
  reportFailure,
  timeoutMs,
}: ShutdownCoordinatorOptions): (event: BeforeQuitEvent) => void {
  let state: ShutdownState = 'idle';

  return (event) => {
    prepareToQuit();
    if (state === 'complete') return;

    event.preventDefault();
    if (state === 'running') return;
    state = 'running';

    let timeout: ReturnType<typeof setTimeout>;
    const deadline = new Promise<never>((_resolve, reject) => {
      timeout = setTimeout(
        () => reject(new Error('Shutdown timed out')),
        timeoutMs
      );
    });

    void Promise.race([shutdown(), deadline])
      .catch(reportFailure)
      .finally(() => {
        clearTimeout(timeout);
        state = 'complete';
        quit();
      });
  };
}
