/**
 * Lightweight telemetry performance metrics collector.
 *
 * Measures timing of hot-path sections (processTelemetry, broadcast)
 * using ring buffers to avoid per-tick allocations. Reports summary stats
 * (avg, max, p99) and per-process resource usage at a configurable interval.
 *
 * Enabled via PERF_METRICS=1 environment variable.
 */

import { performance } from 'perf_hooks';
import { app, BrowserWindow } from 'electron';

export interface SectionStats {
  count: number;
  avgMs: number;
  maxMs: number;
  p99Ms: number;
}

export interface ProcessMetrics {
  pid: number;
  type: string;
  name?: string;
  cpuPercent: number;
  memoryMB: number;
}

export interface PerfReport {
  intervalMs: number;
  tickCount: number;
  sections: Record<string, SectionStats>;
  cpuPercent: number;
  processes?: ProcessMetrics[];
  totalAppCpuPercent?: number;
  totalAppMemoryMB?: number;
}

const RING_BUFFER_SIZE = 1024;
const DEFAULT_REPORT_INTERVAL_MS = 10_000;

class SectionBuffer {
  private buffer: Float64Array = new Float64Array(RING_BUFFER_SIZE);
  private writeIndex = 0;
  private count = 0;
  private startTime = 0;

  markStart(): void {
    this.startTime = performance.now();
  }

  markEnd(): void {
    const elapsed = performance.now() - this.startTime;
    this.buffer[this.writeIndex] = elapsed;
    this.writeIndex = (this.writeIndex + 1) % RING_BUFFER_SIZE;
    if (this.count < RING_BUFFER_SIZE) this.count++;
  }

  getStats(): SectionStats {
    if (this.count === 0) {
      return { count: 0, avgMs: 0, maxMs: 0, p99Ms: 0 };
    }

    const samples = new Float64Array(this.count);
    if (this.count < RING_BUFFER_SIZE) {
      samples.set(this.buffer.subarray(0, this.count));
    } else {
      const tailLen = RING_BUFFER_SIZE - this.writeIndex;
      samples.set(
        this.buffer.subarray(this.writeIndex, RING_BUFFER_SIZE),
        0
      );
      samples.set(this.buffer.subarray(0, this.writeIndex), tailLen);
    }

    samples.sort();

    let sum = 0;
    for (const sample of samples) {
      sum += sample;
    }

    const p99Index = Math.min(
      Math.floor(samples.length * 0.99),
      samples.length - 1
    );

    return {
      count: this.count,
      avgMs: sum / samples.length,
      maxMs: samples[samples.length - 1],
      p99Ms: samples[p99Index],
    };
  }

  reset(): void {
    this.writeIndex = 0;
    this.count = 0;
  }
}

export class TelemetryPerfMetrics {
  private sections = new Map<string, SectionBuffer>();
  private reportTimer: NodeJS.Timeout | null = null;
  private lastReportTime = 0;
  private lastCpuUsage: NodeJS.CpuUsage = { user: 0, system: 0 };
  private tickCount = 0;
  private _enabled: boolean;

  constructor(enabled?: boolean) {
    this._enabled = enabled ?? process.env.PERF_METRICS === '1';
  }

  get enabled(): boolean {
    return this._enabled;
  }

  startReporting(intervalMs: number = DEFAULT_REPORT_INTERVAL_MS): void {
    if (!this._enabled) return;
    this.stopReporting();
    this.lastReportTime = performance.now();
    this.lastCpuUsage = process.cpuUsage();
    this.reportTimer = setInterval(() => {
      const report = this.report();
      this.logReport(report);
    }, intervalMs);
  }

  stopReporting(): void {
    if (this.reportTimer) {
      clearInterval(this.reportTimer);
      this.reportTimer = null;
    }
  }

  markStart(label: string): void {
    if (!this._enabled) return;
    this.getOrCreateSection(label).markStart();
  }

  markEnd(label: string): void {
    if (!this._enabled) return;
    this.getOrCreateSection(label).markEnd();
  }

  tick(): void {
    if (!this._enabled) return;
    this.tickCount++;
  }

  report(): PerfReport {
    const now = performance.now();

    const cpuUsage = process.cpuUsage(this.lastCpuUsage);
    const intervalSeconds = (now - this.lastReportTime) / 1000;
    const cpuUserPercent =
      (cpuUsage.user / 1_000_000 / intervalSeconds) * 100;
    const cpuSystemPercent =
      (cpuUsage.system / 1_000_000 / intervalSeconds) * 100;
    const cpuPercent = cpuUserPercent + cpuSystemPercent;

    const sections: Record<string, SectionStats> = {};
    for (const [label, buf] of this.sections) {
      sections[label] = buf.getStats();
    }

    const { processes, totalCpu, totalMemory } =
      this.getProcessMetrics();

    const report: PerfReport = {
      intervalMs: now - this.lastReportTime,
      tickCount: this.tickCount,
      sections,
      cpuPercent,
      processes,
      totalAppCpuPercent: totalCpu,
      totalAppMemoryMB: totalMemory,
    };

    this.lastReportTime = now;
    this.lastCpuUsage = process.cpuUsage();
    this.tickCount = 0;
    for (const buf of this.sections.values()) {
      buf.reset();
    }

    return report;
  }

  private getOrCreateSection(label: string): SectionBuffer {
    let buf = this.sections.get(label);
    if (!buf) {
      buf = new SectionBuffer();
      this.sections.set(label, buf);
    }
    return buf;
  }

  private getProcessMetrics(): {
    processes: ProcessMetrics[];
    totalCpu: number;
    totalMemory: number;
  } {
    try {
      const metrics = app.getAppMetrics();
      const processes: ProcessMetrics[] = [];
      let totalCpu = 0;
      let totalMemory = 0;

      const pidToWindowName = new Map<number, string>();
      try {
        const windows = BrowserWindow.getAllWindows();
        for (const win of windows) {
          if (!win.isDestroyed()) {
            const pid = win.webContents.getOSProcessId();
            const url = win.webContents.getURL();
            let name = win.getTitle() || 'Untitled';
            if (url) {
              const match = url.match(/#\/([^/?]+)/);
              if (match) {
                name = match[1];
              }
            }
            pidToWindowName.set(pid, name);
          }
        }
      } catch {
        // Ignore errors getting window info
      }

      for (const metric of metrics) {
        const cpuPercent = metric.cpu.percentCPUUsage;
        const memoryMB = metric.memory.workingSetSize / 1024;

        totalCpu += cpuPercent;
        totalMemory += memoryMB;

        let name = metric.name || undefined;
        if (metric.type === 'Tab' && pidToWindowName.has(metric.pid)) {
          name = pidToWindowName.get(metric.pid);
        }

        processes.push({
          pid: metric.pid,
          type: metric.type,
          name,
          cpuPercent,
          memoryMB,
        });
      }

      processes.sort((a, b) => b.cpuPercent - a.cpuPercent);

      return { processes, totalCpu, totalMemory };
    } catch {
      return { processes: [], totalCpu: 0, totalMemory: 0 };
    }
  }

  private logReport(report: PerfReport): void {
    const hz = report.tickCount / (report.intervalMs / 1000);

    const totalCpu = report.totalAppCpuPercent ?? report.cpuPercent;
    const totalMem = report.totalAppMemoryMB ?? 0;
    const lines = [
      `[PerfMetrics] ${report.tickCount} ticks in ${(report.intervalMs / 1000).toFixed(1)}s (${hz.toFixed(1)} Hz) | App CPU: ${totalCpu.toFixed(1)}% | App Memory: ${totalMem.toFixed(0)}MB`,
    ];

    for (const [label, stats] of Object.entries(report.sections)) {
      if (stats.count === 0) continue;
      lines.push(
        `  ${label}: avg=${stats.avgMs.toFixed(3)}ms max=${stats.maxMs.toFixed(3)}ms p99=${stats.p99Ms.toFixed(3)}ms (${stats.count} samples)`
      );
    }

    if (report.processes && report.processes.length > 0) {
      lines.push(`  Processes:`);
      for (const proc of report.processes) {
        let typeLabel = proc.type;
        if (proc.type === 'Browser') typeLabel = 'Main';
        else if (proc.type === 'Tab') typeLabel = 'Renderer';
        else if (proc.type === 'GPU') typeLabel = 'GPU';

        const nameStr = proc.name ? ` (${proc.name})` : '';
        lines.push(
          `    ${typeLabel}${nameStr}: CPU ${proc.cpuPercent.toFixed(1)}% | Mem ${proc.memoryMB.toFixed(0)}MB`
        );
      }
    }

    console.log(lines.join('\n'));
  }
}
