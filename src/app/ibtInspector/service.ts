import type { IbtInspectorScenario } from '../../types/ibtInspectorScenario';
import { replayWidgetCoverage } from '../../types/replayCoverage';
import { createWriteStream, type WriteStream } from 'node:fs';
import {
  lstat,
  mkdir,
  readFile,
  mkdtemp,
  readdir,
  realpath,
  rm,
  stat,
  writeFile,
} from 'node:fs/promises';
import { finished } from 'node:stream/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { summarizeIbtInspectorTrend } from '../../types';
import type {
  IbtInspectorChannelTotal,
  IbtInspectorMemoryCheckpoint,
  IbtInspectorProcessSample,
  IbtInspectorRendererHeapSample,
  IbtInspectorSectionTotal,
  IbtInspectorStatus,
  IbtInspectorTelemetrySample,
  TapeReplayCommand,
  TapeReplayStatus,
} from '../../types';
import { importIbt, type ReplayInputInfo } from './importIbt';
import { onPerfReport, type PerfReport } from '../perfMetrics';

const MAX_CHART_TELEMETRY_POINTS = 240;
const MAX_MEMORY_CHECKPOINTS = 240;
const TELEMETRY_COMPACTION_THRESHOLD = MAX_CHART_TELEMETRY_POINTS * 2;
const MAX_STORED_REPORT_BYTES = 5 * 1024 * 1024;

export function downsampleIbtTelemetry(
  samples: IbtInspectorTelemetrySample[],
  maxPoints = MAX_CHART_TELEMETRY_POINTS
): IbtInspectorTelemetrySample[] {
  if (maxPoints <= 0 || samples.length === 0) return [];
  if (samples.length <= maxPoints) return samples;
  if (maxPoints === 1) return [samples[samples.length - 1]];
  return Array.from({ length: maxPoints }, (_, index) => {
    const sourceIndex = Math.round(
      (index * (samples.length - 1)) / (maxPoints - 1)
    );
    return samples[sourceIndex];
  });
}

const metricOrNull = (value: number | undefined): number | null =>
  typeof value === 'number' && Number.isFinite(value) ? value : null;

export function validateIbtName(name: unknown): asserts name is string {
  if (
    typeof name !== 'string' ||
    !name ||
    name.includes('/') ||
    name.includes('\\') ||
    name.includes(':') ||
    name.includes('\0') ||
    path.basename(name) !== name ||
    !name.toLowerCase().endsWith('.ibt')
  )
    throw new Error('Select an IBT file from the telemetry directory');
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
const isFiniteNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value);
const isNullableNumber = (value: unknown): value is number | null =>
  value === null || isFiniteNumber(value);

const isProcessSample = (value: unknown): value is IbtInspectorProcessSample =>
  isRecord(value) &&
  typeof value.key === 'string' &&
  isFiniteNumber(value.pid) &&
  (value.creationTime === undefined || isFiniteNumber(value.creationTime)) &&
  typeof value.type === 'string' &&
  (value.name === undefined || typeof value.name === 'string') &&
  isNullableNumber(value.cpuPercent) &&
  isNullableNumber(value.cpuTimeMsPerSecond) &&
  isNullableNumber(value.memoryMB) &&
  isNullableNumber(value.privateMemoryMB);

const isRendererHeapSample = (
  value: unknown
): value is IbtInspectorRendererHeapSample =>
  isRecord(value) &&
  typeof value.key === 'string' &&
  isFiniteNumber(value.pid) &&
  typeof value.route === 'string' &&
  isNullableNumber(value.usedHeapMB) &&
  isNullableNumber(value.totalHeapMB);

const isChannelTotal = (value: unknown): value is IbtInspectorChannelTotal =>
  isRecord(value) &&
  typeof value.name === 'string' &&
  isFiniteNumber(value.processorExecutions) &&
  isFiniteNumber(value.publications) &&
  isFiniteNumber(value.deliveries);

const isTelemetrySample = (
  value: unknown
): value is IbtInspectorTelemetrySample =>
  isRecord(value) &&
  isFiniteNumber(value.elapsedSeconds) &&
  isFiniteNumber(value.intervalSeconds) &&
  isNullableNumber(value.appCpuPercent) &&
  isNullableNumber(value.appWorkingSetMB) &&
  isNullableNumber(value.appPrivateMemoryMB) &&
  isNullableNumber(value.mainV8HeapUsedMB) &&
  isNullableNumber(value.mainExternalMemoryMB) &&
  isNullableNumber(value.tickRateHz) &&
  isNullableNumber(value.eventLoopP99Ms) &&
  isNullableNumber(value.eventLoopMaxMs) &&
  Array.isArray(value.processes) &&
  value.processes.every(isProcessSample) &&
  Array.isArray(value.rendererHeaps) &&
  value.rendererHeaps.every(isRendererHeapSample) &&
  Array.isArray(value.channelActivity) &&
  value.channelActivity.every(isChannelTotal);

const isMemoryCheckpoint = (
  value: unknown
): value is IbtInspectorMemoryCheckpoint =>
  isRecord(value) &&
  isFiniteNumber(value.elapsedSeconds) &&
  isNullableNumber(value.appWorkingSetMB) &&
  isNullableNumber(value.appPrivateMemoryMB) &&
  isNullableNumber(value.mainV8HeapUsedMB) &&
  isNullableNumber(value.mainExternalMemoryMB) &&
  Array.isArray(value.processes) &&
  value.processes.every(isProcessSample) &&
  Array.isArray(value.rendererHeaps) &&
  value.rendererHeaps.every(isRendererHeapSample);

const parseStoredSections = (
  value: unknown
): Record<
  string,
  { count: number; totalWallMs: number; maxWallMs: number }
> | null => {
  if (!isRecord(value)) return null;
  const sections: Record<
    string,
    { count: number; totalWallMs: number; maxWallMs: number }
  > = {};
  for (const [name, section] of Object.entries(value)) {
    if (
      !isRecord(section) ||
      !isFiniteNumber(section.count) ||
      !isFiniteNumber(section.totalWallMs) ||
      !isFiniteNumber(section.maxWallMs)
    )
      return null;
    sections[name] = {
      count: section.count,
      totalWallMs: section.totalWallMs,
      maxWallMs: section.maxWallMs,
    };
  }
  return sections;
};

interface ParsedCaptureReport {
  samples: number;
  error: string | null;
  telemetry: IbtInspectorTelemetrySample[];
  memoryCheckpoints: IbtInspectorMemoryCheckpoint[];
  heapSampling: { attachedTargets: number; skippedTargets: number };
  hottestSections: IbtInspectorSectionTotal[];
  channelActivity: IbtInspectorChannelTotal[];
  sections: Record<
    string,
    { count: number; totalWallMs: number; maxWallMs: number }
  >;
}

export const parseCaptureReport = (
  value: unknown
): ParsedCaptureReport | null => {
  if (
    !isRecord(value) ||
    value.schemaVersion !== 2 ||
    !isFiniteNumber(value.samples) ||
    (value.error !== null && typeof value.error !== 'string') ||
    !Array.isArray(value.telemetry) ||
    !value.telemetry.every(isTelemetrySample) ||
    !Array.isArray(value.memoryCheckpoints) ||
    !value.memoryCheckpoints.every(isMemoryCheckpoint) ||
    !isRecord(value.heapSampling) ||
    !isFiniteNumber(value.heapSampling.attachedTargets) ||
    !isFiniteNumber(value.heapSampling.skippedTargets) ||
    !Array.isArray(value.hottestSections) ||
    !value.hottestSections.every(
      (section) =>
        isRecord(section) &&
        typeof section.name === 'string' &&
        isFiniteNumber(section.count) &&
        isFiniteNumber(section.totalWallMs) &&
        isFiniteNumber(section.averageMs) &&
        isFiniteNumber(section.maxWallMs)
    ) ||
    !Array.isArray(value.channelActivity) ||
    !value.channelActivity.every(isChannelTotal)
  )
    return null;
  const sections = parseStoredSections(value.sections);
  if (!sections) return null;
  return {
    samples: value.samples,
    error: value.error,
    telemetry: value.telemetry,
    memoryCheckpoints: value.memoryCheckpoints,
    heapSampling: {
      attachedTargets: value.heapSampling.attachedTargets,
      skippedTargets: value.heapSampling.skippedTargets,
    },
    hottestSections: value.hottestSections as IbtInspectorSectionTotal[],
    channelActivity: value.channelActivity,
    sections,
  };
};

interface InspectorDependencies {
  directory: string;
  getProfileId?: () => string;
  saveScenario?: (scenario: IbtInspectorScenario) => Promise<void>;
  getWidgetTypes?: () => string[];
  workDirectory: string;
  enabled: () => boolean;
  switchSource: (tape: string | null, speed?: number | 'max') => Promise<void>;
  getPlayback: () => TapeReplayStatus | null;
  command: (command: TapeReplayCommand) => void;
  getProcessMemorySnapshot?: () => IbtInspectorProcessSample[];
  rendererHeapSampler?: {
    start: () => { attachedTargets: number; skippedTargets: number };
    sample: () => Promise<IbtInspectorRendererHeapSample[]>;
    collectGarbageAndSample: () => Promise<IbtInspectorRendererHeapSample[]>;
    stop: () => void;
  };
}

/** Owns one normalized tape and one capture; raw reports stream to disk and chart samples are bounded. */
export class IbtInspectorService {
  private file: string | null = null;
  private temporary: string | null = null;
  private warnings: string[] = [];
  private input: ReplayInputInfo | null = null;
  private queue: Promise<unknown> = Promise.resolve();
  private capture: IbtInspectorStatus['capture'] = {
    active: false,
    samples: 0,
    reportPath: null,
    error: null,
    telemetry: [],
    memoryCheckpoints: [],
    baseline: null,
    heapSampling: { attachedTargets: 0, skippedTargets: 0 },
    hottestSections: [],
    channelActivity: [],
  };
  private writer: WriteStream | null = null;
  private unsubscribe?: () => void;
  private captureStart: TapeReplayStatus | null = null;
  private started = 0;
  private bytes = 0;
  private cpuSum = 0;
  private cpuSamples = 0;
  private maxWorkingSetMB: number | null = null;
  private sections: Record<
    string,
    { count: number; totalWallMs: number; maxWallMs: number }
  > = {};
  private telemetrySamples: IbtInspectorTelemetrySample[] = [];
  private memoryCheckpoints: IbtInspectorMemoryCheckpoint[] = [];
  private baseline: IbtInspectorStatus['capture']['baseline'] = null;
  private heapSampling = { attachedTargets: 0, skippedTargets: 0 };
  private channelTotals = new Map<
    string,
    { processorExecutions: number; publications: number; deliveries: number }
  >();
  private reportQueue: Promise<void> = Promise.resolve();
  private timer?: ReturnType<typeof setTimeout>;
  constructor(private readonly deps: InspectorDependencies) {}

  private requireEnabled() {
    if (!this.deps.enabled())
      throw new Error('Enable Dev Tool in General settings');
  }
  private serial<T>(action: () => Promise<T>): Promise<T> {
    const next = this.queue.catch(() => undefined).then(action);
    this.queue = next.catch(() => undefined);
    return next;
  }
  async list() {
    this.requireEnabled();
    let entries;
    try {
      entries = await readdir(this.deps.directory, { withFileTypes: true });
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT')
        return { directory: this.deps.directory, files: [], truncated: false };
      throw error;
    }
    const candidates = entries
      .filter((e) => e.isFile() && e.name.toLowerCase().endsWith('.ibt'))
      .sort((a, b) => a.name.localeCompare(b.name));
    const files = await Promise.all(
      candidates.slice(0, 500).map(async (entry) => {
        const info = await stat(path.join(this.deps.directory, entry.name));
        return {
          name: entry.name,
          sizeBytes: info.size,
          modifiedAt: info.mtime.toISOString(),
        };
      })
    );
    files.sort((a, b) => b.modifiedAt.localeCompare(a.modifiedAt));
    return {
      directory: this.deps.directory,
      files,
      truncated: candidates.length > 500,
    };
  }
  private getHottestSections(): IbtInspectorSectionTotal[] {
    return Object.entries(this.sections)
      .map(([name, section]) => ({
        name,
        ...section,
        averageMs: section.count ? section.totalWallMs / section.count : 0,
      }))
      .sort((a, b) => b.totalWallMs - a.totalWallMs)
      .slice(0, 8);
  }
  private getChannelActivity(): IbtInspectorChannelTotal[] {
    return [...this.channelTotals.entries()]
      .map(([name, totals]) => ({ name, ...totals }))
      .sort(
        (a, b) =>
          b.deliveries - a.deliveries ||
          b.publications - a.publications ||
          b.processorExecutions - a.processorExecutions
      )
      .slice(0, 8);
  }
  status(): IbtInspectorStatus {
    this.requireEnabled();
    const hottestSections = this.getHottestSections();
    const channelActivity = this.getChannelActivity();
    return {
      file: this.file,
      playback: this.file ? this.deps.getPlayback() : null,
      warnings: [...this.warnings],
      coverage: this.input
        ? replayWidgetCoverage(
            this.input.variables ?? [],
            this.deps.getWidgetTypes?.() ?? []
          )
        : [],
      capture: {
        ...this.capture,
        telemetry: downsampleIbtTelemetry(this.telemetrySamples),
        memoryCheckpoints: this.memoryCheckpoints,
        baseline: this.baseline,
        heapSampling: this.heapSampling,
        hottestSections,
        channelActivity,
      },
    };
  }
  restoreLastCapture(): Promise<boolean> {
    return this.serial(async () => {
      this.requireEnabled();
      if (this.capture.active || this.capture.reportPath) return false;
      const runsDirectory = path.join(this.deps.workDirectory, 'runs');
      let entries;
      try {
        entries = await readdir(runsDirectory, { withFileTypes: true });
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') return false;
        throw error;
      }
      const candidates = entries
        .filter(
          (entry) => entry.isDirectory() && /^\d+-[a-f0-9-]+$/.test(entry.name)
        )
        .sort((a, b) => b.name.localeCompare(a.name));
      let latest: { path: string; report: ParsedCaptureReport } | undefined;
      let previous: ParsedCaptureReport | undefined;
      let lastError: unknown;
      for (const entry of candidates) {
        const reportPath = path.join(runsDirectory, entry.name, 'report.json');
        try {
          const info = await lstat(reportPath);
          if (!info.isFile() || info.size > MAX_STORED_REPORT_BYTES) continue;
          const report = parseCaptureReport(
            JSON.parse(await readFile(reportPath, 'utf8')) as unknown
          );
          if (!report) continue;
          if (!latest) latest = { path: reportPath, report };
          else {
            previous = report;
            break;
          }
        } catch (error) {
          lastError = error;
        }
      }
      if (!latest) {
        if (lastError) throw lastError;
        return false;
      }
      this.baseline = previous
        ? {
            label: 'Previous capture',
            telemetry: downsampleIbtTelemetry(previous.telemetry),
            memoryCheckpoints: previous.memoryCheckpoints.slice(
              -MAX_MEMORY_CHECKPOINTS
            ),
          }
        : null;
      this.telemetrySamples = downsampleIbtTelemetry(latest.report.telemetry);
      this.memoryCheckpoints = latest.report.memoryCheckpoints.slice(
        -MAX_MEMORY_CHECKPOINTS
      );
      this.heapSampling = latest.report.heapSampling;
      this.sections = latest.report.sections;
      this.channelTotals.clear();
      for (const channel of latest.report.channelActivity)
        this.channelTotals.set(channel.name, {
          processorExecutions: channel.processorExecutions,
          publications: channel.publications,
          deliveries: channel.deliveries,
        });
      this.capture = {
        active: false,
        samples: latest.report.samples,
        reportPath: latest.path,
        error: latest.report.error,
        telemetry: [],
        memoryCheckpoints: [],
        baseline: this.baseline,
        heapSampling: this.heapSampling,
        hottestSections: latest.report.hottestSections,
        channelActivity: latest.report.channelActivity,
      };
      return true;
    });
  }
  load(name: unknown, speed: unknown) {
    return this.serial(async () => {
      this.requireEnabled();
      validateIbtName(name);
      if (
        speed !== 'max' &&
        (typeof speed !== 'number' ||
          !Number.isFinite(speed) ||
          speed < 0.25 ||
          speed > 100)
      )
        throw new Error('Invalid playback speed');
      const root = await realpath(this.deps.directory);
      const input = await realpath(path.join(root, name));
      if (path.dirname(input) !== root)
        throw new Error('IBT must remain inside the telemetry directory');
      if (!(await stat(input)).isFile()) throw new Error('Not an IBT file');
      await mkdir(this.deps.workDirectory, { recursive: true });
      const temporary = await mkdtemp(
        path.join(this.deps.workDirectory, 'input-')
      );
      let switchAttempted = false;
      try {
        const info = await importIbt(input, path.join(temporary, 'input.irdt'));
        this.requireEnabled();
        await this.stopInternal();
        switchAttempted = true;
        await this.deps.switchSource(path.join(temporary, 'input.irdt'), speed);
        const playback = this.deps.getPlayback();
        if (!playback || playback.failed)
          throw new Error(
            playback?.error || 'Replay transport did not initialize'
          );
        this.temporary = temporary;
        this.file = name;
        this.warnings = info.warnings;
        this.input = info;
      } catch (error) {
        const errors: unknown[] = [error];
        if (switchAttempted) {
          try {
            await this.deps.switchSource(null);
          } catch (cleanupError) {
            errors.push(cleanupError);
          }
        }
        try {
          await rm(temporary, { recursive: true, force: true });
        } catch (cleanupError) {
          errors.push(cleanupError);
        }
        throw new AggregateError(errors, errors.map(String).join('; '), {
          cause: error,
        });
      }
    });
  }
  command(command: TapeReplayCommand) {
    return this.serial(async () => {
      this.requireEnabled();
      if (!this.file) throw new Error('Load an IBT first');
      if (
        this.capture.active &&
        ['seek', 'step', 'loop', 'speed'].includes(command.type)
      )
        throw new Error(
          'Stop capture before seeking or changing replay controls'
        );
      this.deps.command(command);
    });
  }
  saveScenario() {
    return this.serial(async () => {
      this.requireEnabled();
      const playback = this.deps.getPlayback();
      if (!this.file || !playback || !this.deps.saveScenario)
        throw new Error('Load an IBT first');
      await this.deps.saveScenario({
        file: this.file,
        profileId: this.deps.getProfileId?.() ?? 'default',
        speed: playback.maximumSpeed ? 'max' : playback.speed,
        position: playback.position,
        loop: playback.loop ?? null,
      });
    });
  }
  stop() {
    return this.serial(() => this.stopInternal());
  }
  private async stopInternal() {
    let captureError: unknown;
    try {
      await this.finishCapture();
    } catch (error) {
      captureError = error;
    }
    if (this.file || this.temporary) await this.deps.switchSource(null);
    this.file = null;
    this.warnings = [];
    this.input = null;
    if (this.temporary) {
      await rm(this.temporary, { recursive: true, force: true });
      this.temporary = null;
    }
    if (captureError) throw captureError;
  }
  startCapture() {
    return this.serial(async () => {
      this.requireEnabled();
      if (!this.file || !this.deps.getPlayback())
        throw new Error('Load an IBT first');
      if (this.capture.active) throw new Error('Capture is already running');
      const runs = path.join(this.deps.workDirectory, 'runs');
      await mkdir(runs, { recursive: true });
      // Retain at most ten runs, each capped at 64 MiB / one hour.
      const previous = (await readdir(runs, { withFileTypes: true }))
        .filter((e) => e.isDirectory() && /^\d+-[a-f0-9-]+$/.test(e.name))
        .sort((a, b) => a.name.localeCompare(b.name));
      for (const entry of previous.slice(0, Math.max(0, previous.length - 9)))
        await rm(path.join(runs, entry.name), { recursive: true, force: true });
      const output = path.join(runs, `${Date.now()}-${randomUUID()}`);
      await mkdir(output);
      this.baseline =
        this.capture.reportPath && this.telemetrySamples.length
          ? {
              label: 'Previous capture',
              telemetry: downsampleIbtTelemetry(this.telemetrySamples),
              memoryCheckpoints: this.memoryCheckpoints.slice(
                -MAX_MEMORY_CHECKPOINTS
              ),
            }
          : null;
      this.capture = {
        active: true,
        samples: 0,
        reportPath: path.join(output, 'report.json'),
        error: null,
        telemetry: [],
        memoryCheckpoints: [],
        baseline: this.baseline,
        heapSampling: { attachedTargets: 0, skippedTargets: 0 },
        hottestSections: [],
        channelActivity: [],
      };
      this.captureStart = this.deps.getPlayback();
      this.started = performance.now();
      this.bytes = 0;
      this.cpuSum = 0;
      this.cpuSamples = 0;
      this.maxWorkingSetMB = null;
      this.sections = {};
      this.telemetrySamples = [];
      this.memoryCheckpoints = [];
      this.channelTotals.clear();
      this.reportQueue = Promise.resolve();
      try {
        this.heapSampling = this.deps.rendererHeapSampler?.start() ?? {
          attachedTargets: 0,
          skippedTargets: 0,
        };
      } catch {
        this.heapSampling = { attachedTargets: 0, skippedTargets: 1 };
      }
      this.capture.heapSampling = this.heapSampling;
      this.writer = createWriteStream(path.join(output, 'samples.ndjson'), {
        flags: 'wx',
      });
      this.writer.on('error', (error) => {
        this.capture.error = error.message;
        void this.stopCapture().catch(() => undefined);
      });
      this.unsubscribe = onPerfReport((report) => {
        this.reportQueue = this.reportQueue
          .then(() => this.record(report))
          .catch((error) => {
            this.capture.error =
              error instanceof Error ? error.message : String(error);
          });
      });
      this.timer = setTimeout(() => {
        void this.stopCapture().catch(() => undefined);
      }, 3600_000);
    });
  }
  private async record(report: PerfReport) {
    if (!this.writer || !this.capture.active) return;
    let rendererHeaps: IbtInspectorRendererHeapSample[] = [];
    try {
      rendererHeaps = (await this.deps.rendererHeapSampler?.sample()) ?? [];
    } catch {
      // Renderer heap is optional; process and main-heap metrics still record.
    }
    const processMemory = process.memoryUsage();
    const elapsedSeconds = Math.max(
      0,
      (performance.now() - this.started) / 1000
    );
    const channelMetrics = report.channelMetrics;
    const channelNames = new Set([
      ...Object.keys(channelMetrics?.processorExecutions ?? {}),
      ...Object.keys(channelMetrics?.publications ?? {}),
      ...Object.keys(channelMetrics?.deliveries ?? {}),
    ]);
    const channelActivity = [...channelNames].map((name) => ({
      name,
      processorExecutions: channelMetrics?.processorExecutions[name] ?? 0,
      publications: channelMetrics?.publications[name] ?? 0,
      deliveries: channelMetrics?.deliveries[name] ?? 0,
    }));
    const line =
      JSON.stringify({
        ...report,
        inspectorMemory: {
          elapsedSeconds,
          mainV8HeapUsedMB: processMemory.heapUsed / 1024 / 1024,
          mainExternalMemoryMB: processMemory.external / 1024 / 1024,
          rendererHeaps,
        },
      }) + '\n';
    if (
      this.bytes + Buffer.byteLength(line) > 64 * 1024 * 1024 ||
      this.writer.writableLength > 1024 * 1024
    ) {
      this.capture.error = 'Capture limit reached or disk cannot keep up';
      this.unsubscribe?.();
      void this.stopCapture().catch(() => undefined);
      return;
    }
    this.bytes += Buffer.byteLength(line);
    this.writer.write(line);
    this.capture.samples++;
    this.telemetrySamples.push({
      elapsedSeconds,
      intervalSeconds:
        Number.isFinite(report.intervalMs) && report.intervalMs > 0
          ? report.intervalMs / 1000
          : 1,
      appCpuPercent: metricOrNull(report.totalAppCpuPercent),
      appWorkingSetMB: metricOrNull(report.totalAppMemoryMB),
      appPrivateMemoryMB: metricOrNull(report.totalAppPrivateMemoryMB),
      mainV8HeapUsedMB: processMemory.heapUsed / 1024 / 1024,
      mainExternalMemoryMB: processMemory.external / 1024 / 1024,
      tickRateHz: metricOrNull(report.tickRateHz),
      eventLoopP99Ms: metricOrNull(report.eventLoopDelayMs?.p99),
      eventLoopMaxMs: metricOrNull(report.eventLoopDelayMs?.max),
      channelActivity,
      processes: (report.processes ?? []).map((process) => ({
        key: `${process.pid}:${process.creationTime ?? ''}`,
        pid: process.pid,
        creationTime: process.creationTime,
        type: process.type,
        name: process.name,
        cpuPercent: metricOrNull(process.cpuPercent),
        cpuTimeMsPerSecond: metricOrNull(process.cpuTimeMsPerSecond),
        memoryMB: metricOrNull(process.memoryMB),
        privateMemoryMB: metricOrNull(process.privateMemoryMB),
      })),
      rendererHeaps,
    });
    if (this.telemetrySamples.length > TELEMETRY_COMPACTION_THRESHOLD)
      this.telemetrySamples = downsampleIbtTelemetry(
        this.telemetrySamples,
        MAX_CHART_TELEMETRY_POINTS
      );
    const cpu = report.processes?.map((p) => p.cpuTimeMsPerSecond);
    if (cpu?.length && cpu.every((v) => typeof v === 'number')) {
      this.cpuSum += cpu.reduce<number>((sum, v) => sum + (v ?? 0), 0);
      this.cpuSamples++;
    }
    if (typeof report.totalAppMemoryMB === 'number')
      this.maxWorkingSetMB = Math.max(
        this.maxWorkingSetMB ?? 0,
        report.totalAppMemoryMB
      );
    for (const [name, value] of Object.entries(report.sections)) {
      const total = (this.sections[name] ??= {
        count: 0,
        totalWallMs: 0,
        maxWallMs: 0,
      });
      total.count += value.count;
      total.totalWallMs += value.count * value.avgMs;
      total.maxWallMs = Math.max(total.maxWallMs, value.maxMs);
    }
    if (channelMetrics) {
      for (const name of channelNames) {
        const total = this.channelTotals.get(name) ?? {
          processorExecutions: 0,
          publications: 0,
          deliveries: 0,
        };
        total.processorExecutions +=
          channelMetrics.processorExecutions[name] ?? 0;
        total.publications += channelMetrics.publications[name] ?? 0;
        total.deliveries += channelMetrics.deliveries[name] ?? 0;
        this.channelTotals.set(name, total);
      }
    }
    const playback = this.deps.getPlayback();
    if (playback?.failed)
      this.capture.error = playback.error || 'Replay source failed';
    if (playback?.ended || playback?.failed)
      void this.stopCapture().catch(() => undefined);
  }
  private getMemoryTrends() {
    const processPoints = new Map<
      string,
      {
        process: IbtInspectorProcessSample;
        workingSet: { elapsedSeconds: number; value: number | null }[];
        privateMemory: { elapsedSeconds: number; value: number | null }[];
      }
    >();
    const processCheckpointPoints = new Map<
      string,
      {
        process: IbtInspectorProcessSample;
        privateMemory: { elapsedSeconds: number; value: number | null }[];
      }
    >();
    const rendererPoints = new Map<
      string,
      {
        renderer: IbtInspectorRendererHeapSample;
        live: { elapsedSeconds: number; value: number | null }[];
        postGc: { elapsedSeconds: number; value: number | null }[];
      }
    >();
    for (const sample of this.telemetrySamples) {
      for (const process of sample.processes) {
        if (process.creationTime === undefined) continue;
        const points = processPoints.get(process.key) ?? {
          process,
          workingSet: [],
          privateMemory: [],
        };
        points.workingSet.push({
          elapsedSeconds: sample.elapsedSeconds,
          value: process.memoryMB,
        });
        points.privateMemory.push({
          elapsedSeconds: sample.elapsedSeconds,
          value: process.privateMemoryMB,
        });
        processPoints.set(process.key, points);
      }
      for (const renderer of sample.rendererHeaps) {
        const points = rendererPoints.get(renderer.key) ?? {
          renderer,
          live: [],
          postGc: [],
        };
        points.live.push({
          elapsedSeconds: sample.elapsedSeconds,
          value: renderer.usedHeapMB,
        });
        rendererPoints.set(renderer.key, points);
      }
    }
    for (const checkpoint of this.memoryCheckpoints) {
      for (const process of checkpoint.processes) {
        if (process.creationTime === undefined) continue;
        const points = processCheckpointPoints.get(process.key) ?? {
          process,
          privateMemory: [],
        };
        points.privateMemory.push({
          elapsedSeconds: checkpoint.elapsedSeconds,
          value: process.privateMemoryMB,
        });
        processCheckpointPoints.set(process.key, points);
      }
      for (const renderer of checkpoint.rendererHeaps) {
        const points = rendererPoints.get(renderer.key) ?? {
          renderer,
          live: [],
          postGc: [],
        };
        points.postGc.push({
          elapsedSeconds: checkpoint.elapsedSeconds,
          value: renderer.usedHeapMB,
        });
        rendererPoints.set(renderer.key, points);
      }
    }
    return {
      appWorkingSet: summarizeIbtInspectorTrend(
        this.telemetrySamples.map((sample) => ({
          elapsedSeconds: sample.elapsedSeconds,
          value: sample.appWorkingSetMB,
        }))
      ),
      appPrivateMemory: summarizeIbtInspectorTrend(
        this.telemetrySamples.map((sample) => ({
          elapsedSeconds: sample.elapsedSeconds,
          value: sample.appPrivateMemoryMB,
        }))
      ),
      appPrivateMemoryAtCheckpoints: summarizeIbtInspectorTrend(
        this.memoryCheckpoints.map((checkpoint) => ({
          elapsedSeconds: checkpoint.elapsedSeconds,
          value: checkpoint.appPrivateMemoryMB,
        }))
      ),
      mainV8Heap: summarizeIbtInspectorTrend(
        this.telemetrySamples.map((sample) => ({
          elapsedSeconds: sample.elapsedSeconds,
          value: sample.mainV8HeapUsedMB,
        }))
      ),
      mainV8HeapAtCheckpoints: summarizeIbtInspectorTrend(
        this.memoryCheckpoints.map((checkpoint) => ({
          elapsedSeconds: checkpoint.elapsedSeconds,
          value: checkpoint.mainV8HeapUsedMB,
        }))
      ),
      processes: [...processPoints.values()].map(({ process, ...points }) => ({
        key: process.key,
        pid: process.pid,
        type: process.type,
        name: process.name,
        workingSet: summarizeIbtInspectorTrend(points.workingSet),
        privateMemory: summarizeIbtInspectorTrend(points.privateMemory),
        privateMemoryAtCheckpoints: summarizeIbtInspectorTrend(
          processCheckpointPoints.get(process.key)?.privateMemory ?? []
        ),
      })),
      renderers: [...rendererPoints.values()].map(
        ({ renderer, ...points }) => ({
          key: renderer.key,
          pid: renderer.pid,
          route: renderer.route,
          liveHeap: summarizeIbtInspectorTrend(points.live),
          postGcHeap: summarizeIbtInspectorTrend(points.postGc),
        })
      ),
    };
  }
  stopCapture() {
    return this.serial(() => this.finishCapture());
  }
  checkpointMemory() {
    return this.serial(async () => {
      this.requireEnabled();
      if (!this.capture.active || !this.writer)
        throw new Error('Start a performance capture first');
      if (!this.deps.rendererHeapSampler)
        throw new Error('Renderer heap sampling is unavailable');
      if (this.heapSampling.attachedTargets === 0)
        throw new Error('No renderer windows are available for GC checkpoint');
      if (!this.telemetrySamples.length)
        throw new Error('Wait for the first performance sample');

      const queued = this.reportQueue.then(async () => {
        if (!this.capture.active || !this.writer)
          throw new Error('Performance capture has ended');
        const rendererHeaps =
          await this.deps.rendererHeapSampler?.collectGarbageAndSample();
        const mainMemory = process.memoryUsage();
        let processes = this.telemetrySamples.at(-1)?.processes ?? [];
        try {
          processes = this.deps.getProcessMemorySnapshot?.() ?? processes;
        } catch {
          // Keep the nearest periodic process snapshot if Electron metrics fail.
        }
        const sum = (
          read: (process: IbtInspectorProcessSample) => number | null
        ) => {
          const values = processes.map(read);
          return values.length > 0 && values.every((value) => value !== null)
            ? values.reduce<number>((total, value) => total + (value ?? 0), 0)
            : null;
        };
        const checkpoint: IbtInspectorMemoryCheckpoint = {
          elapsedSeconds: Math.max(
            0,
            (performance.now() - this.started) / 1000
          ),
          appWorkingSetMB: sum((process) => process.memoryMB),
          appPrivateMemoryMB: sum((process) => process.privateMemoryMB),
          mainV8HeapUsedMB: mainMemory.heapUsed / 1024 / 1024,
          mainExternalMemoryMB: mainMemory.external / 1024 / 1024,
          processes,
          rendererHeaps: rendererHeaps ?? [],
        };
        const line = JSON.stringify({ inspectorCheckpoint: checkpoint }) + '\n';
        const writer = this.writer;
        if (
          this.bytes + Buffer.byteLength(line) > 64 * 1024 * 1024 ||
          writer.writableLength > 1024 * 1024
        ) {
          this.capture.error = 'Capture limit reached or disk cannot keep up';
          this.unsubscribe?.();
          void this.stopCapture().catch(() => undefined);
          throw new Error(this.capture.error);
        }
        this.bytes += Buffer.byteLength(line);
        writer.write(line);
        this.memoryCheckpoints.push(checkpoint);
        if (this.memoryCheckpoints.length > MAX_MEMORY_CHECKPOINTS)
          this.memoryCheckpoints.shift();
      });
      this.reportQueue = queued.catch((error) => {
        this.capture.error =
          error instanceof Error ? error.message : String(error);
      });
      await queued;
    });
  }
  private async finishCapture() {
    if (!this.capture.active) return;
    this.unsubscribe?.();
    this.unsubscribe = undefined;
    await this.reportQueue;
    this.capture.active = false;
    this.deps.rendererHeapSampler?.stop();
    clearTimeout(this.timer);
    const writer = this.writer;
    this.writer = null;
    if (writer) {
      writer.end();
      try {
        await finished(writer);
      } catch (error) {
        this.capture.error = String(error);
      }
    }
    if (!this.capture.reportPath) return;
    const after = this.deps.getPlayback();
    const before = this.captureStart;
    try {
      await writeFile(
        this.capture.reportPath,
        JSON.stringify(
          {
            schemaVersion: 2,
            file: this.file,
            source: 'ibt',
            input: this.input,
            coverage: this.input
              ? replayWidgetCoverage(
                  this.input.variables ?? [],
                  this.deps.getWidgetTypes?.() ?? []
                )
              : [],
            profile: 'current overlays',
            elapsedWallSeconds: (performance.now() - this.started) / 1000,
            samples: this.capture.samples,
            before,
            after,
            averageCpuMsPerSecond: this.cpuSamples
              ? this.cpuSum / this.cpuSamples
              : null,
            maxWorkingSetMB: this.maxWorkingSetMB,
            sections: this.sections,
            hottestSections: this.getHottestSections(),
            channelActivity: this.getChannelActivity(),
            telemetry: this.telemetrySamples,
            memoryCheckpoints: this.memoryCheckpoints,
            memoryTrends: this.getMemoryTrends(),
            heapSampling: this.heapSampling,
            chartPoints: this.telemetrySamples.length,
            warnings: this.warnings,
            error: this.capture.error,
            limitations: [
              'Periodic process reports include Inspector/Settings overhead and interval boundaries.',
              'Live V8 samples do not force GC or provide retaining paths. Manual checkpoints force GC in renderers only; main-process heap and all private-memory values remain live samples.',
              'No renderer draw timings, GPU-engine utilization or game FPS measured.',
              'SDK frame counts do not prove one draw per sample. IBT contains one session snapshot.',
              'CPU average is over valid process samples; process churn can make coverage incomplete.',
            ],
            sdkFramesReturned:
              before?.framesDelivered !== undefined &&
              after?.framesDelivered !== undefined
                ? after.framesDelivered - before.framesDelivered
                : null,
            sourceFramesSuperseded:
              before?.framesConsumed !== undefined &&
              after?.framesConsumed !== undefined &&
              before?.framesDelivered !== undefined &&
              after?.framesDelivered !== undefined
                ? after.framesConsumed -
                  before.framesConsumed -
                  (after.framesDelivered - before.framesDelivered)
                : null,
            sourceFramesConsumed:
              before?.framesConsumed !== undefined &&
              after?.framesConsumed !== undefined
                ? after.framesConsumed - before.framesConsumed
                : null,
          },
          null,
          2
        )
      );
    } catch (error) {
      this.capture.error =
        error instanceof Error ? error.message : String(error);
      this.capture.reportPath = null;
      throw error;
    }
  }
}
