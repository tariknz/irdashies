import { spawn, type ChildProcess } from 'node:child_process';
import { access, readdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';

/** Native recorder writes full SDK frames/session updates; 10 files, 512 MB and one hour per file. */
export class LiveTelemetryRecorder {
  private child?: ChildProcess;
  private error: string | null = null;
  private stopFile = '';
  constructor(
    private executable: string,
    private directory: string
  ) {}
  async start(output: string) {
    if (process.platform !== 'win32')
      throw new Error('Live telemetry recording requires Windows and iRacing');
    await access(this.executable);
    const entries = (await readdir(this.directory))
      .filter((name) => /^irdashies-live-\d+\.irdt$/.test(name))
      .sort();
    for (const name of entries.slice(0, Math.max(0, entries.length - 9)))
      await rm(path.join(this.directory, name));
    this.stopFile = `${output}.stop`;
    const child = spawn(
      this.executable,
      [
        'record',
        '--output',
        output,
        '--duration',
        '3600',
        '--stop-file',
        this.stopFile,
      ],
      { windowsHide: true, stdio: ['ignore', 'ignore', 'pipe'] }
    );
    this.child = child;
    child.stderr?.on('data', (data: Buffer) => {
      this.error = data.toString().slice(0, 500);
    });
    child.on('error', (error) => {
      this.error = error.message;
    });
    child.on('exit', (code) => {
      if (code !== 0) this.error ??= `Telemetry recorder exited (${code})`;
    });
    await new Promise<void>((resolve, reject) => {
      child.once('spawn', resolve);
      child.once('error', reject);
    });
  }
  getError() {
    return this.error;
  }
  async stop() {
    const child = this.child;
    this.child = undefined;
    if (!child || child.exitCode !== null) return;
    await writeFile(this.stopFile, 'stop');
    await new Promise<void>((resolve) => {
      const timer = setTimeout(() => {
        this.error =
          'Telemetry recorder did not finish; recording may be incomplete';
        child.kill();
        resolve();
      }, 5000);
      child.once('exit', () => {
        clearTimeout(timer);
        resolve();
      });
    });
    await rm(this.stopFile, { force: true });
  }
}
