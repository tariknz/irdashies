/** Quit a development instance if its launcher exits without forwarding a signal. */
export function monitorDevParent(parentPid: number, quit: () => void): void {
  const timer = setInterval(() => {
    try {
      process.kill(parentPid, 0);
    } catch (error) {
      if (
        typeof error !== 'object' ||
        error === null ||
        !('code' in error) ||
        error.code !== 'ESRCH'
      ) {
        return;
      }
      clearInterval(timer);
      quit();
    }
  }, 1_000);
  timer.unref();
}
