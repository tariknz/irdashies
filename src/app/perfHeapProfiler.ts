import { promises as fs } from 'node:fs';
import inspector from 'node:inspector';

const post = <T>(
  session: inspector.Session,
  method: string,
  params?: Record<string, unknown>
): Promise<T> =>
  new Promise((resolve, reject) => {
    session.post(method, params, (error, result) => {
      if (error) reject(error);
      else resolve(result as T);
    });
  });

export class PerfHeapProfiler {
  private readonly session = new inspector.Session();
  private started = false;

  constructor(private readonly outputPath: string) {}

  async start(): Promise<void> {
    let connected = false;
    try {
      this.session.connect();
      connected = true;
      await post(this.session, 'HeapProfiler.enable');
      await post(this.session, 'HeapProfiler.startSampling', {
        samplingInterval: 32 * 1024,
        includeObjectsCollectedByMajorGC: false,
        includeObjectsCollectedByMinorGC: false,
      });
      this.started = true;
    } catch (error) {
      if (connected) this.session.disconnect();
      throw error;
    }
  }

  async stop(): Promise<void> {
    if (!this.started) return;
    try {
      const result = await post<{ profile: unknown }>(
        this.session,
        'HeapProfiler.stopSampling'
      );
      await fs.writeFile(
        this.outputPath,
        JSON.stringify(result.profile),
        'utf8'
      );
    } finally {
      this.started = false;
      this.session.disconnect();
    }
  }
}
