import { spawn, type ChildProcess } from 'node:child_process';
import { open } from 'node:fs/promises';
import { createInterface } from 'node:readline';
import { getActivePerfMetrics } from '../perfMetrics';
import type { IbtInspectorFrameMetrics } from '../../types/ibtInspector';

/** One second of frame durations, capped at 16,384 frames across 32 swap chains. */
export class PresentMonFrames {
  private headers: string[] = [];
  private frameCount = 0;
  private timingSource: 'present' | 'cpu-frame' = 'present';
  private streams = new Map<
    string,
    { times: number[]; cpu: number[]; gpu: number[] }
  >();
  accept(line: string) {
    const columns = line
      .split(',')
      .map((value) => value.trim().replace(/^"|"$/g, ''));
    if (columns.includes('Application') && columns.includes('ProcessID')) {
      this.headers = columns;
      return;
    }
    const read = (name: string) => columns[this.headers.indexOf(name)];
    if (!/^iRacingSim64DX11\.exe$/i.test(read('Application') ?? '')) return;
    const presentTime = read('MsBetweenPresents') ?? read('msBetweenPresents');
    this.timingSource = presentTime !== undefined ? 'present' : 'cpu-frame';
    const duration = Number(
      presentTime ?? read('FrameTime') ?? read('CPUFrameTime')
    );
    if (!Number.isFinite(duration) || duration <= 0) return;
    const key = `${read('ProcessID')}:${read('SwapChainAddress')}`;
    if (!this.streams.has(key) && this.streams.size >= 32) return;
    const stream = this.streams.get(key) ?? { times: [], cpu: [], gpu: [] };
    if (this.frameCount >= 16384) return;
    this.frameCount++;
    stream.times.push(duration);
    const cpu = Number(read('MsCPUBusy') ?? read('CPUBusy'));
    const gpu = Number(
      read('MsGPUTime') ?? read('GPUTime') ?? read('msGPUActive')
    );
    if (Number.isFinite(cpu) && cpu >= 0) stream.cpu.push(cpu);
    if (Number.isFinite(gpu) && gpu >= 0) stream.gpu.push(gpu);
    this.streams.set(key, stream);
  }
  sample(): IbtInspectorFrameMetrics | null {
    // The busiest swap chain represents the game; never sum FPS across swap chains.
    const stream = [...this.streams.values()].sort(
      (a, b) => b.times.length - a.times.length
    )[0];
    this.streams.clear();
    this.frameCount = 0;
    if (!stream?.times.length) return null;
    const average = (values: number[]) =>
      values.length ? values.reduce((a, b) => a + b, 0) / values.length : null;
    const sorted = stream.times.sort((a, b) => b - a);
    const frameTimeMs = average(sorted) ?? 0;
    return {
      timingSource: this.timingSource,
      frames: sorted.length,
      fps: 1000 / frameTimeMs,
      frameTimeMs,
      p95FrameTimeMs:
        sorted[Math.max(0, sorted.length - Math.ceil(sorted.length * 0.95))],
      p99FrameTimeMs:
        sorted[Math.max(0, sorted.length - Math.ceil(sorted.length * 0.99))],
      low5Fps:
        sorted.length >= 20
          ? 1000 /
            (average(sorted.slice(0, Math.ceil(sorted.length * 0.05))) ?? 1)
          : null,
      low1Fps:
        sorted.length >= 100
          ? 1000 /
            (average(sorted.slice(0, Math.ceil(sorted.length * 0.01))) ?? 1)
          : null,
      cpuBusyMs: average(stream.cpu),
      gpuTimeMs: average(stream.gpu),
    };
  }
}

export class PresentMonCapture {
  private child?: ChildProcess;
  private frames = new PresentMonFrames();
  private error: string | null = null;
  private session = `irDashies-${process.pid}`;
  constructor(private executable: string) {}
  async start() {
    if (process.platform !== 'win32')
      throw new Error('PresentMon capture requires Windows');
    this.error = null;
    const child = spawn(
      this.executable,
      [
        '--process_name',
        'iRacingSim64DX11.exe',
        '--output_stdout',
        '--no_console_stats',
        '--session_name',
        this.session,
        '--timed',
        '3600',
        '--terminate_after_timed',
      ],
      { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] }
    );
    this.child = child;
    if (!child.stdout) throw new Error('PresentMon output is unavailable');
    const lines = createInterface({ input: child.stdout });
    lines.on('line', (line) => {
      const metrics = getActivePerfMetrics();
      metrics?.markStart('inspectorPresentMon');
      try {
        this.frames.accept(line);
      } finally {
        metrics?.markEnd('inspectorPresentMon');
      }
    });
    child.stderr?.on('data', (data: Buffer) => {
      this.error = data.toString().slice(0, 500);
    });
    child.on('error', (error) => {
      this.error = error.message;
    });
    child.on('exit', (code) => {
      if (this.child && code !== 0)
        this.error ??= `PresentMon exited (${code})`;
    });
    await new Promise<void>((resolve, reject) => {
      child.once('spawn', resolve);
      child.once('error', reject);
    });
  }
  sample() {
    return this.frames.sample();
  }
  getError() {
    return this.error;
  }
  async stop() {
    const child = this.child;
    this.child = undefined;
    if (!child || child.exitCode !== null) return;
    // Stop only our named ETW session, leaving the user's PresentMon GUI alone.
    const stop = spawn(
      this.executable,
      ['--session_name', this.session, '--terminate_existing_session'],
      { windowsHide: true, stdio: 'ignore' }
    );
    await new Promise<void>((resolve) => {
      const timer = setTimeout(() => {
        stop.kill();
        child.kill();
        resolve();
      }, 3000);
      const done = () => {
        clearTimeout(timer);
        child.kill();
        resolve();
      };
      stop.once('error', done);
      stop.once('exit', done);
    });
  }
}

/** Reject the identically named GUI executable before attempting a capture. */
export async function validatePresentMonConsole(
  executable: string
): Promise<void> {
  const file = await open(executable, 'r');
  try {
    const dos = Buffer.alloc(64);
    if (
      (await file.read(dos, 0, dos.length, 0)).bytesRead !== dos.length ||
      dos.readUInt16LE(0) !== 0x5a4d
    )
      throw new Error('Select a Windows PresentMon console executable');
    const offset = dos.readUInt32LE(0x3c);
    if (offset > 1024 * 1024) throw new Error('Invalid PresentMon executable');
    const pe = Buffer.alloc(96);
    if (
      (await file.read(pe, 0, pe.length, offset)).bytesRead !== pe.length ||
      pe.readUInt32LE(0) !== 0x4550 ||
      ![0x10b, 0x20b].includes(pe.readUInt16LE(24)) ||
      pe.readUInt16LE(24 + 68) !== 3
    )
      throw new Error(
        'Select the standalone PresentMon console collector, not the Intel PresentMon GUI'
      );
  } finally {
    await file.close();
  }
}
