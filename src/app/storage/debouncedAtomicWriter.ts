import fsp from 'node:fs/promises';

/** One in-flight write and one dirty flag, regardless of how often saves arrive. */
export function createDebouncedAtomicWriter(options: {
  filePath: string;
  serialize(): string;
  onSuccess(): void;
  onError(error: unknown): void;
}) {
  let dirty = false;
  let timer: NodeJS.Timeout | undefined;
  let ready = false;
  let inFlight: Promise<void> | undefined;
  const tempPath = `${options.filePath}.${process.pid}.tmp`;

  const write = (): Promise<void> => {
    if (inFlight) return inFlight;
    if (!dirty) return Promise.resolve();
    dirty = false;
    const operation = (async () => {
      try {
        const payload = options.serialize();
        await fsp.writeFile(tempPath, payload, 'utf8');
        // Node replaces an existing file on Windows too. If a scanner/lock
        // prevents that, fail safely: never unlink the destination to retry.
        await fsp.rename(tempPath, options.filePath);
        options.onSuccess();
      } catch (error) {
        dirty = true;
        await fsp.unlink(tempPath).catch(() => undefined);
        options.onError(error);
      }
    })();
    const tracked = operation.finally(() => {
      if (inFlight === tracked) inFlight = undefined;
      if (ready) {
        ready = false;
        void write();
      }
    });
    inFlight = tracked;
    return tracked;
  };

  return {
    schedule() {
      dirty = true;
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        timer = undefined;
        if (inFlight) ready = true;
        else void write();
      }, 250);
    },
    cancel() {
      if (timer) clearTimeout(timer);
      timer = undefined;
      ready = false;
    },
    async flush() {
      if (timer) clearTimeout(timer);
      timer = undefined;
      ready = false;
      while (inFlight) await inFlight;
      // Retry failed data once on shutdown, never in a repeating timer.
      await write();
    },
  };
}
