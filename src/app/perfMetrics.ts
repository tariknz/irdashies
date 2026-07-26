/**
 * Lightweight telemetry performance metrics collector.
 *
 * Measures timing of hot-path sections (processTelemetry, broadcast)
 * using ring buffers to avoid per-tick allocations. Reports summary stats
 * (avg, max, p99) and per-process resource usage at a configurable interval.
 *
 * Enabled via PERF_METRICS=1 environment variable.
 */

import { monitorEventLoopDelay, performance } from 'node:perf_hooks';
import { app, BrowserWindow } from 'electron';
import type { NumericSampleStats, Telemetry } from '@irdashies/types';
import { FixedSampleBuffer } from '../shared/performanceSamples';
import logger from './logger';

export interface SectionStats {
  count: number;
  avgMs: number;
  minMs: number;
  maxMs: number;
  p95Ms: number;
  p99Ms: number;
}

export interface ProcessMetrics {
  pid: number;
  type: string;
  name?: string;
  cpuPercent: number;
  memoryMB: number;
  privateMemoryMB?: number;
}

export interface PerfReport {
  schemaVersion: 1;
  timestamp: string;
  runId: string;
  scenario: string;
  overlayMode: string;
  intervalMs: number;
  tickCount: number;
  tickRateHz: number;
  tickIntervalMs: NumericSampleStats;
  sections: Record<string, SectionStats>;
  eventLoopDelayMs: {
    mean: number;
    max: number;
    p99: number;
  };
  iracing: {
    frameRate: NumericSampleStats;
    cpuUsageForeground: NumericSampleStats;
    cpuUsageBackground: NumericSampleStats;
    gpuUsage: NumericSampleStats;
  };
  cpuPercent: number;
  processes?: ProcessMetrics[];
  totalAppCpuPercent?: number;
  totalAppMemoryMB?: number;
  totalAppPrivateMemoryMB?: number;
}

const DEFAULT_REPORT_INTERVAL_MS = 10_000;
export const PERF_MAIN_LOG_PREFIX = '[PerfMetrics:JSON] ';

class SectionBuffer {
  private samples = new FixedSampleBuffer();
  private startTime = 0;

  markStart(): void {
    this.startTime = performance.now();
  }

  markEnd(): void {
    this.samples.add(performance.now() - this.startTime);
  }

  getStats(): SectionStats {
    const stats = this.samples.summarize();
    return {
      count: stats.count,
      avgMs: stats.avg,
      minMs: stats.min,
      maxMs: stats.max,
      p95Ms: stats.p95,
      p99Ms: stats.p99,
    };
  }

  reset(): void {
    this.samples.reset();
  }
}

export class TelemetryPerfMetrics {
  private sections = new Map<string, SectionBuffer>();
  private tickIntervals = new FixedSampleBuffer();
  private iracingFrameRate = new FixedSampleBuffer();
  private iracingCpuForeground = new FixedSampleBuffer();
  private iracingCpuBackground = new FixedSampleBuffer();
  private iracingGpuUsage = new FixedSampleBuffer();
  private eventLoopDelay = monitorEventLoopDelay({ resolution: 20 });
  private reportTimer: NodeJS.Timeout | null = null;
  private lastReportTime = 0;
  private lastTickTime = 0;
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
    const configuredInterval = Number(process.env.PERF_REPORT_INTERVAL_MS);
    const effectiveInterval =
      Number.isFinite(configuredInterval) && configuredInterval >= 1000
        ? configuredInterval
        : intervalMs;
    this.lastReportTime = performance.now();
    this.lastTickTime = 0;
    this.lastCpuUsage = process.cpuUsage();
    this.eventLoopDelay.enable();
    this.reportTimer = setInterval(() => {
      const report = this.report();
      this.logReport(report);
    }, effectiveInterval);
  }

  stopReporting(): void {
    if (this.reportTimer) {
      clearInterval(this.reportTimer);
      this.reportTimer = null;
    }
    this.eventLoopDelay.disable();
  }

  markStart(label: string): void {
    if (!this._enabled) return;
    this.getOrCreateSection(label).markStart();
  }

  markEnd(label: string): void {
    if (!this._enabled) return;
    this.getOrCreateSection(label).markEnd();
  }

  tick(telemetry?: Telemetry | null): void {
    if (!this._enabled) return;
    const now = performance.now();
    if (this.lastTickTime > 0) {
      this.tickIntervals.add(now - this.lastTickTime);
    }
    this.lastTickTime = now;
    this.tickCount++;
    if (telemetry) {
      this.observeIRacing(telemetry);
    }
  }

  report(): PerfReport {
    const now = performance.now();

    const cpuUsage = process.cpuUsage(this.lastCpuUsage);
    const intervalSeconds = (now - this.lastReportTime) / 1000;
    const cpuUserPercent = (cpuUsage.user / 1_000_000 / intervalSeconds) * 100;
    const cpuSystemPercent =
      (cpuUsage.system / 1_000_000 / intervalSeconds) * 100;
    const cpuPercent = cpuUserPercent + cpuSystemPercent;

    const sections: Record<string, SectionStats> = {};
    for (const [label, buf] of this.sections) {
      sections[label] = buf.getStats();
    }

    const { processes, totalCpu, totalMemory, totalPrivateMemory } =
      this.getProcessMetrics();
    const elapsedMs = now - this.lastReportTime;
    const nanosecondsToMilliseconds = (value: number): number =>
      Number.isFinite(value) ? value / 1_000_000 : 0;

    const report: PerfReport = {
      schemaVersion: 1,
      timestamp: new Date().toISOString(),
      runId: process.env.PERF_RUN_ID ?? 'manual',
      scenario: process.env.PERF_SCENARIO ?? 'unspecified',
      overlayMode: process.env.PERF_OVERLAY_MODE ?? 'full',
      intervalMs: elapsedMs,
      tickCount: this.tickCount,
      tickRateHz: this.tickCount / (elapsedMs / 1000),
      tickIntervalMs: this.tickIntervals.summarize(),
      sections,
      eventLoopDelayMs: {
        mean: nanosecondsToMilliseconds(this.eventLoopDelay.mean),
        max: nanosecondsToMilliseconds(this.eventLoopDelay.max),
        p99: nanosecondsToMilliseconds(this.eventLoopDelay.percentile(99)),
      },
      iracing: {
        frameRate: this.iracingFrameRate.summarize(),
        cpuUsageForeground: this.iracingCpuForeground.summarize(),
        cpuUsageBackground: this.iracingCpuBackground.summarize(),
        gpuUsage: this.iracingGpuUsage.summarize(),
      },
      cpuPercent,
      processes,
      totalAppCpuPercent: totalCpu,
      totalAppMemoryMB: totalMemory,
      totalAppPrivateMemoryMB: totalPrivateMemory,
    };

    this.lastReportTime = now;
    this.lastCpuUsage = process.cpuUsage();
    this.tickCount = 0;
    this.tickIntervals.reset();
    this.iracingFrameRate.reset();
    this.iracingCpuForeground.reset();
    this.iracingCpuBackground.reset();
    this.iracingGpuUsage.reset();
    this.eventLoopDelay.reset();
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

  private observeIRacing(telemetry: Telemetry): void {
    this.iracingFrameRate.add(telemetry.FrameRate?.value?.[0]);
    const percentage = (value: number | undefined): number | undefined =>
      value === undefined ? undefined : value * 100;
    this.iracingCpuForeground.add(percentage(telemetry.CpuUsageFG?.value?.[0]));
    this.iracingCpuBackground.add(percentage(telemetry.CpuUsageBG?.value?.[0]));
    this.iracingGpuUsage.add(percentage(telemetry.GpuUsage?.value?.[0]));
  }

  private getProcessMetrics(): {
    processes: ProcessMetrics[];
    totalCpu: number;
    totalMemory: number;
    totalPrivateMemory?: number;
  } {
    try {
      const metrics = app.getAppMetrics();
      const processes: ProcessMetrics[] = [];
      let totalCpu = 0;
      let totalMemory = 0;
      let totalPrivateMemory = 0;
      let hasPrivateMemory = false;

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
        const privateMemoryMB =
          metric.memory.privateBytes === undefined
            ? undefined
            : metric.memory.privateBytes / 1024;

        totalCpu += cpuPercent;
        totalMemory += memoryMB;
        if (privateMemoryMB !== undefined) {
          totalPrivateMemory += privateMemoryMB;
          hasPrivateMemory = true;
        }

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
          privateMemoryMB,
        });
      }

      processes.sort((a, b) => b.cpuPercent - a.cpuPercent);

      return {
        processes,
        totalCpu,
        totalMemory,
        totalPrivateMemory: hasPrivateMemory ? totalPrivateMemory : undefined,
      };
    } catch {
      return {
        processes: [],
        totalCpu: 0,
        totalMemory: 0,
        totalPrivateMemory: undefined,
      };
    }
  }

  private logReport(report: PerfReport): void {
    const totalCpu = report.totalAppCpuPercent ?? report.cpuPercent;
    const totalMem = report.totalAppMemoryMB ?? 0;
    const lines = [
      `[PerfMetrics] ${report.tickCount} ticks in ${(report.intervalMs / 1000).toFixed(1)}s (${report.tickRateHz.toFixed(1)} Hz) | App CPU: ${totalCpu.toFixed(1)}% | App Memory: ${totalMem.toFixed(0)}MB`,
    ];

    if (report.iracing.frameRate.count > 0) {
      lines.push(
        `  iRacing: FPS avg=${report.iracing.frameRate.avg.toFixed(1)} p1=${report.iracing.frameRate.p1.toFixed(1)} min=${report.iracing.frameRate.min.toFixed(1)} | CPU FG=${report.iracing.cpuUsageForeground.avg.toFixed(1)}% | GPU=${report.iracing.gpuUsage.avg.toFixed(1)}%`
      );
    }

    lines.push(
      `  eventLoop: mean=${report.eventLoopDelayMs.mean.toFixed(3)}ms max=${report.eventLoopDelayMs.max.toFixed(3)}ms p99=${report.eventLoopDelayMs.p99.toFixed(3)}ms`
    );

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

    logger.info(lines.join('\n'));
    logger.info(`${PERF_MAIN_LOG_PREFIX}${JSON.stringify(report)}`);
  }
}
