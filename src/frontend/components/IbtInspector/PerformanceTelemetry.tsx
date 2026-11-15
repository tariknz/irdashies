import { useState } from 'react';
import { summarizeIbtInspectorTrend } from '@irdashies/types';
import type {
  IbtInspectorCaptureStatus,
  IbtInspectorProcessSample,
  IbtInspectorTelemetrySample,
} from '@irdashies/types';

interface ChartSeries {
  label: string;
  color: string;
  values: (number | null)[];
  times?: (number | null)[];
  dashed?: boolean;
}

const formatDuration = (seconds: number) => {
  const total = Math.max(0, Math.floor(seconds));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const remainder = total % 60;
  return hours
    ? `${hours}:${String(minutes).padStart(2, '0')}:${String(remainder).padStart(2, '0')}`
    : `${minutes}:${String(remainder).padStart(2, '0')}`;
};

const formatMetric = (value: number | null | undefined, digits = 1) =>
  value === null || value === undefined || !Number.isFinite(value)
    ? '—'
    : value.toFixed(digits);

const formatSlope = (value: number | null) =>
  value === null
    ? 'not enough data'
    : `${value >= 0 ? '+' : ''}${formatMetric(value)} MB/min`;

function TelemetryLineChart({
  title,
  unit,
  samples,
  series,
  digits = 1,
}: {
  title: string;
  unit: string;
  samples: IbtInspectorTelemetrySample[];
  series: ChartSeries[];
  digits?: number;
}) {
  const [hiddenSeries, setHiddenSeries] = useState<Set<string>>(
    () => new Set()
  );
  const activeSeries = series.filter((line) => !hiddenSeries.has(line.label));
  const values = activeSeries.flatMap((line) =>
    line.values.filter((value): value is number => value !== null)
  );
  const allValues = series.flatMap((line) =>
    line.values.filter((value): value is number => value !== null)
  );
  if (!samples.length || !allValues.length) {
    return (
      <div className="rounded-md border border-slate-700/80 bg-slate-900/40 p-3">
        <h3 className="text-sm font-medium text-slate-200">{title}</h3>
        <p className="mt-8 flex h-32 items-center justify-center text-xs text-slate-500">
          No samples available
        </p>
      </div>
    );
  }

  const plottedValues = values.length ? values : allValues;
  const rawMin = Math.min(...plottedValues);
  const rawMax = Math.max(...plottedValues);
  const range = rawMax - rawMin;
  const padding =
    range > 0 ? range * 0.1 : Math.max(Math.abs(rawMax) * 0.05, 1);
  const minY = Math.max(0, rawMin - padding);
  const maxY = rawMax + padding || 1;
  const left = 54;
  const top = 12;
  const width = 640;
  const height = 142;
  const seriesTimes = activeSeries.flatMap((line) =>
    (line.times ?? []).filter((value): value is number => value !== null)
  );
  const start = Math.min(samples[0].elapsedSeconds, ...seriesTimes);
  const end = Math.max(samples.at(-1)?.elapsedSeconds ?? start, ...seriesTimes);
  const duration = end > start ? end - start : 1;
  const xAt = (seconds: number) =>
    left + ((seconds - start) / duration) * width;
  const yAt = (value: number) =>
    top + (1 - (value - minY) / (maxY - minY || 1)) * height;
  const makePath = (line: ChartSeries) => {
    let path = '';
    let connected = false;
    line.values.forEach((value, index) => {
      if (value === null || !Number.isFinite(value)) {
        connected = false;
        return;
      }
      const elapsedSeconds =
        line.times?.[index] ?? samples[index]?.elapsedSeconds;
      if (elapsedSeconds === undefined || elapsedSeconds === null) return;
      path += `${connected ? 'L' : 'M'}${xAt(elapsedSeconds).toFixed(1)},${yAt(value).toFixed(1)} `;
      connected = true;
    });
    return path.trim();
  };
  const yTicks = Array.from(
    { length: 4 },
    (_, index) => maxY - ((maxY - minY) * index) / 3
  );

  return (
    <div className="min-w-0 rounded-md border border-slate-700/80 bg-slate-900/40 p-3">
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="text-sm font-medium text-slate-200">{title}</h3>
        <span className="text-[10px] text-slate-500">{unit}</span>
      </div>
      <svg
        role="img"
        aria-label={`${title} over replay time`}
        viewBox="0 0 720 190"
        className="mt-2 h-44 w-full"
        preserveAspectRatio="none"
      >
        <title>{title} over replay time</title>
        {yTicks.map((tick, index) => {
          const y = top + (height * index) / 3;
          return (
            <g key={index}>
              <line
                x1={left}
                x2={left + width}
                y1={y}
                y2={y}
                className="stroke-slate-700/80"
                strokeWidth="1"
              />
              <text
                x={left - 7}
                y={y + 3}
                textAnchor="end"
                className="fill-slate-500 text-[9px]"
              >
                {tick.toFixed(digits)}
              </text>
            </g>
          );
        })}
        <line
          x1={left}
          x2={left + width}
          y1={top + height}
          y2={top + height}
          className="stroke-slate-600"
          strokeWidth="1"
        />
        <text
          x={left}
          y={top + height + 19}
          textAnchor="start"
          className="fill-slate-500 text-[9px]"
        >
          {formatDuration(start)}
        </text>
        <text
          x={left + width}
          y={top + height + 19}
          textAnchor="end"
          className="fill-slate-500 text-[9px]"
        >
          {formatDuration(end)}
        </text>
        {activeSeries.map((line) => (
          <g key={line.label} className={line.color}>
            <path
              d={makePath(line)}
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinejoin="round"
              strokeLinecap="round"
              strokeDasharray={line.dashed ? '5 4' : undefined}
            />
            {line.values.map((value, index) => {
              const stride = Math.max(1, Math.ceil(line.values.length / 24));
              const elapsedSeconds =
                line.times?.[index] ?? samples[index]?.elapsedSeconds;
              if (
                value === null ||
                elapsedSeconds === undefined ||
                elapsedSeconds === null ||
                (index % stride !== 0 && index !== line.values.length - 1)
              )
                return null;
              return (
                <circle
                  key={`${line.label}-${index}`}
                  cx={xAt(elapsedSeconds)}
                  cy={yAt(value)}
                  r="2.5"
                  fill="currentColor"
                >
                  <title>{`${formatDuration(elapsedSeconds)} · ${line.label}: ${formatMetric(value, digits)} ${unit}`}</title>
                </circle>
              );
            })}
          </g>
        ))}
      </svg>
      <div className="mt-1 flex flex-wrap gap-x-2 gap-y-1">
        {series.map((line) => {
          const hidden = hiddenSeries.has(line.label);
          return (
            <button
              key={line.label}
              type="button"
              aria-pressed={!hidden}
              onClick={() =>
                setHiddenSeries((previous) => {
                  const next = new Set(previous);
                  if (next.has(line.label)) next.delete(line.label);
                  else next.add(line.label);
                  return next;
                })
              }
              className={`inline-flex items-center gap-1.5 rounded px-1 py-0.5 text-[10px] text-slate-400 hover:bg-slate-800 ${hidden ? 'opacity-40' : ''}`}
            >
              <span
                aria-hidden="true"
                className={`h-2 w-2 rounded-full bg-current ${line.color}`}
              />
              {line.label}
            </button>
          );
        })}
      </div>
      <p className="mt-1 text-[10px] text-slate-600">
        Y-axis scales to the observed range.
      </p>
    </div>
  );
}

const processRole = (process: IbtInspectorProcessSample) =>
  `${process.type}:${process.name ?? ''}`;

const processGroupLabel = (process: IbtInspectorProcessSample) => {
  const role =
    process.type === 'Browser'
      ? 'Main'
      : process.type === 'Tab'
        ? 'Renderer'
        : process.type;
  return `${role}${process.name ? ` · ${process.name}` : ''} total`;
};

const processLabel = (process: IbtInspectorProcessSample) =>
  `${processGroupLabel(process).replace(/ total$/, '')} · ${process.pid}`;

const Stat = ({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail?: string;
}) => (
  <div className="rounded-md border border-slate-700/80 bg-slate-900/40 p-3">
    <p className="text-[11px] text-slate-400">{label}</p>
    <p className="mt-1 font-mono text-lg font-semibold text-slate-100">
      {value}
    </p>
    {detail && <p className="mt-1 text-[10px] text-slate-500">{detail}</p>}
  </div>
);

export function PerformanceTelemetry({
  capture,
}: {
  capture: IbtInspectorCaptureStatus;
}) {
  const [rangeSeconds] = useState<number | null>(null);
  const allSamples = capture.telemetry;
  const latestElapsed = allSamples.at(-1)?.elapsedSeconds ?? 0;
  const rangeStart =
    rangeSeconds === null
      ? Number.NEGATIVE_INFINITY
      : Math.max(0, latestElapsed - rangeSeconds);
  const samples = allSamples.filter(
    (sample) => sample.elapsedSeconds >= rangeStart
  );
  const latest = samples.at(-1);
  const baselineSamples = (capture.baseline?.telemetry ?? []).filter(
    (sample) => sample.elapsedSeconds >= rangeStart
  );
  const memoryCheckpoints = capture.memoryCheckpoints.filter(
    (checkpoint) => checkpoint.elapsedSeconds >= rangeStart
  );
  const privateTrend = summarizeIbtInspectorTrend(
    samples.map((sample) => ({
      elapsedSeconds: sample.elapsedSeconds,
      value: sample.appPrivateMemoryMB,
    }))
  );
  const privateDelta = privateTrend.delta;
  const memorySeries: ChartSeries[] = [
    {
      label: 'App working set',
      color: 'text-sky-400',
      values: samples.map((sample) => sample.appWorkingSetMB),
    },
    {
      label: 'App private memory',
      color: 'text-emerald-400',
      values: samples.map((sample) => sample.appPrivateMemoryMB),
    },
    {
      label: 'Private memory at renderer-GC checkpoint',
      color: 'text-rose-400',
      values: memoryCheckpoints.map(
        (checkpoint) => checkpoint.appPrivateMemoryMB
      ),
      times: memoryCheckpoints.map((checkpoint) => checkpoint.elapsedSeconds),
      dashed: true,
    },
  ];
  if (baselineSamples.length) {
    memorySeries.push(
      {
        label: 'Previous · app working set',
        color: 'text-slate-400',
        dashed: true,
        values: baselineSamples.map((sample) => sample.appWorkingSetMB),
        times: baselineSamples.map((sample) => sample.elapsedSeconds),
      },
      {
        label: 'Previous · app private',
        color: 'text-pink-300',
        dashed: true,
        values: baselineSamples.map((sample) => sample.appPrivateMemoryMB),
        times: baselineSamples.map((sample) => sample.elapsedSeconds),
      }
    );
  }
  const cpuSeries: ChartSeries[] = [
    {
      label: 'Total app CPU',
      color: 'text-amber-300',
      values: samples.map((sample) => sample.appCpuPercent),
    },
    {
      label: 'Main process CPU',
      color: 'text-fuchsia-400',
      values: samples.map(
        (sample) =>
          sample.processes.find((process) => process.type === 'Browser')
            ?.cpuPercent ?? null
      ),
    },
  ];
  if (baselineSamples.length) {
    cpuSeries.push({
      label: 'Previous · app CPU',
      color: 'text-slate-400',
      dashed: true,
      values: baselineSamples.map((sample) => sample.appCpuPercent),
      times: baselineSamples.map((sample) => sample.elapsedSeconds),
    });
  }
  const mainHeapSeries: ChartSeries[] = [
    {
      label: 'Main-process V8 heap',
      color: 'text-violet-400',
      values: samples.map((sample) => sample.mainV8HeapUsedMB),
    },
    {
      label: 'Main-process external memory',
      color: 'text-orange-300',
      values: samples.map((sample) => sample.mainExternalMemoryMB),
    },
  ];
  if (baselineSamples.length) {
    mainHeapSeries.push({
      label: 'Previous · main V8 heap',
      color: 'text-slate-400',
      dashed: true,
      values: baselineSamples.map((sample) => sample.mainV8HeapUsedMB),
      times: baselineSamples.map((sample) => sample.elapsedSeconds),
    });
  }
  const rendererHeapCandidates = new Map<
    string,
    { route: string; pid: number; maxUsedHeapMB: number }
  >();
  for (const sample of samples) {
    for (const heap of sample.rendererHeaps) {
      if (heap.usedHeapMB === null) continue;
      const candidate = rendererHeapCandidates.get(heap.key);
      if (!candidate || heap.usedHeapMB > candidate.maxUsedHeapMB)
        rendererHeapCandidates.set(heap.key, {
          route: heap.route,
          pid: heap.pid,
          maxUsedHeapMB: heap.usedHeapMB,
        });
    }
  }
  const rendererHeapSeries: ChartSeries[] = [
    ...rendererHeapCandidates.entries(),
  ]
    .sort((a, b) => b[1].maxUsedHeapMB - a[1].maxUsedHeapMB)
    .slice(0, 5)
    .map(([key, candidate], index) => ({
      label: `${candidate.route} · ${candidate.pid} live`,
      color: [
        'text-violet-400',
        'text-orange-300',
        'text-lime-300',
        'text-pink-300',
        'text-indigo-300',
      ][index],
      values: samples.map(
        (sample) =>
          sample.rendererHeaps.find((heap) => heap.key === key)?.usedHeapMB ??
          null
      ),
    }));
  if (memoryCheckpoints.length) {
    for (const [index, [key, candidate]] of [
      ...rendererHeapCandidates.entries(),
    ]
      .sort((a, b) => b[1].maxUsedHeapMB - a[1].maxUsedHeapMB)
      .slice(0, 3)
      .entries()) {
      rendererHeapSeries.push({
        label: `${candidate.route} · ${candidate.pid} post-GC`,
        color: ['text-violet-400', 'text-orange-300', 'text-lime-300'][index],
        dashed: true,
        values: memoryCheckpoints.map(
          (checkpoint) =>
            checkpoint.rendererHeaps.find((heap) => heap.key === key)
              ?.usedHeapMB ?? null
        ),
        times: memoryCheckpoints.map((checkpoint) => checkpoint.elapsedSeconds),
      });
    }
  }
  const eventLoopSeries: ChartSeries[] = [
    {
      label: 'Event-loop p99',
      color: 'text-cyan-300',
      values: samples.map((sample) => sample.eventLoopP99Ms),
    },
    {
      label: 'Event-loop max',
      color: 'text-rose-400',
      values: samples.map((sample) => sample.eventLoopMaxMs),
    },
  ];
  const channelDeliveryTotals = new Map<string, number>();
  for (const sample of samples) {
    for (const channel of sample.channelActivity)
      channelDeliveryTotals.set(
        channel.name,
        (channelDeliveryTotals.get(channel.name) ?? 0) + channel.deliveries
      );
  }
  const selectedChannelNames = [...channelDeliveryTotals.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([name]) => name);
  const channelDeliverySeries: ChartSeries[] = selectedChannelNames.map(
    (name, index) => ({
      label: name,
      color: [
        'text-sky-400',
        'text-emerald-400',
        'text-amber-300',
        'text-fuchsia-400',
        'text-cyan-300',
      ][index],
      values: samples.map((sample) => {
        const channel = sample.channelActivity.find(
          (item) => item.name === name
        );
        return channel
          ? channel.deliveries / Math.max(sample.intervalSeconds, 0.001)
          : null;
      }),
    })
  );
  if (baselineSamples.length) {
    for (const [index, name] of selectedChannelNames.entries()) {
      const previousValues = baselineSamples.map((sample) => {
        const channel = sample.channelActivity.find(
          (item) => item.name === name
        );
        return channel
          ? channel.deliveries / Math.max(sample.intervalSeconds, 0.001)
          : null;
      });
      if (previousValues.some((value) => value !== null))
        channelDeliverySeries.push({
          label: `Previous · ${name}`,
          color: ['text-slate-400', 'text-slate-500', 'text-stone-400'][
            index % 3
          ],
          dashed: true,
          values: previousValues,
          times: baselineSamples.map((sample) => sample.elapsedSeconds),
        });
    }
  }
  const processCandidates = new Map<
    string,
    { process: IbtInspectorProcessSample; maxPrivate: number }
  >();
  for (const sample of samples) {
    for (const process of sample.processes) {
      if (
        process.privateMemoryMB === null ||
        process.creationTime === undefined
      )
        continue;
      const candidate = processCandidates.get(process.key);
      if (!candidate || process.privateMemoryMB > candidate.maxPrivate)
        processCandidates.set(process.key, {
          process,
          maxPrivate: process.privateMemoryMB,
        });
    }
  }
  for (const checkpoint of memoryCheckpoints) {
    for (const process of checkpoint.processes) {
      if (
        process.privateMemoryMB === null ||
        process.creationTime === undefined
      )
        continue;
      const candidate = processCandidates.get(process.key);
      if (!candidate || process.privateMemoryMB > candidate.maxPrivate)
        processCandidates.set(process.key, {
          process,
          maxPrivate: process.privateMemoryMB,
        });
    }
  }
  const processMemorySeries: ChartSeries[] = [...processCandidates.entries()]
    .sort((a, b) => b[1].maxPrivate - a[1].maxPrivate)
    .slice(0, 5)
    .map(([key, candidate], index) => ({
      label: `${processLabel(candidate.process)} live`,
      color: [
        'text-violet-400',
        'text-orange-300',
        'text-lime-300',
        'text-pink-300',
        'text-indigo-300',
      ][index],
      values: samples.map(
        (sample) =>
          sample.processes.find((process) => process.key === key)
            ?.privateMemoryMB ?? null
      ),
    }));
  if (memoryCheckpoints.length) {
    for (const [index, [key, candidate]] of [...processCandidates.entries()]
      .sort((a, b) => b[1].maxPrivate - a[1].maxPrivate)
      .slice(0, 3)
      .entries()) {
      processMemorySeries.push({
        label: `${processLabel(candidate.process)} checkpoint`,
        color: ['text-violet-400', 'text-orange-300', 'text-lime-300'][index],
        dashed: true,
        values: memoryCheckpoints.map(
          (checkpoint) =>
            checkpoint.processes.find((process) => process.key === key)
              ?.privateMemoryMB ?? null
        ),
        times: memoryCheckpoints.map((checkpoint) => checkpoint.elapsedSeconds),
      });
    }
  }
  if (baselineSamples.length) {
    const previousRoles = new Map<string, IbtInspectorProcessSample>();
    for (const process of [...processCandidates.values()]
      .sort((a, b) => b.maxPrivate - a.maxPrivate)
      .slice(0, 3)
      .map((candidate) => candidate.process))
      previousRoles.set(processRole(process), process);
    for (const [index, [role, process]] of [
      ...previousRoles.entries(),
    ].entries()) {
      processMemorySeries.push({
        label: `Previous · ${processGroupLabel(process)}`,
        color: ['text-slate-400', 'text-slate-500', 'text-stone-400'][index],
        dashed: true,
        values: baselineSamples.map((sample) => {
          const matches = sample.processes.filter(
            (item) =>
              processRole(item) === role && item.privateMemoryMB !== null
          );
          return matches.length
            ? matches.reduce(
                (sum, item) => sum + (item.privateMemoryMB ?? 0),
                0
              )
            : null;
        }),
        times: baselineSamples.map((sample) => sample.elapsedSeconds),
      });
    }
  }
  const lastProcesses = latest?.processes ?? [];
  const processRows = [...lastProcesses]
    .sort(
      (a, b) =>
        (b.privateMemoryMB ?? b.memoryMB ?? -1) -
        (a.privateMemoryMB ?? a.memoryMB ?? -1)
    )
    .slice(0, 8)
    .map((process) => {
      const trend = summarizeIbtInspectorTrend(
        process.creationTime === undefined
          ? []
          : samples.flatMap((sample) => {
              const match = sample.processes.find(
                (candidate) => candidate.key === process.key
              );
              return match
                ? [
                    {
                      elapsedSeconds: sample.elapsedSeconds,
                      value: match.privateMemoryMB,
                    },
                  ]
                : [];
            })
      );
      return {
        process,
        delta: trend.delta,
        slopePerMinute: trend.slopePerMinute,
        trendPoints: trend.points,
        trendDurationSeconds: trend.durationSeconds,
      };
    });
  const checkpointRows = [...capture.memoryCheckpoints].reverse().slice(0, 8);

  return (
    <section className="rounded-lg border border-slate-700 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold">Performance telemetry</h2>
          <p className="mt-1 text-xs text-slate-400">
            {capture.active
              ? `Live capture · ${capture.samples} reports`
              : `${capture.samples} reports · ${samples.length} chart points`}
          </p>
        </div>
        {capture.baseline && (
          <span className="text-[10px] text-slate-500">
            Dashed lines compare {capture.baseline.label} at equal elapsed time;
            inputs and window topology are not automatically matched.
          </span>
        )}
        {capture.samples > 240 && (
          <span className="text-[10px] text-slate-500">
            Downsampled evenly to 240 points; raw reports are retained in the
            capture file.
          </span>
        )}
      </div>

      {samples.length ? (
        <>
          {samples.some((sample) => sample.gameFrames) && (
            <section className="mt-4 space-y-3">
              <h3 className="text-sm font-semibold">iRacing · PresentMon</h3>
              <p className="text-xs text-slate-400">
                Each point covers one report interval. 5%/1% low = 1000 divided
                by the mean of the slowest 5%/1% frame times; requires at least
                20/100 frames. Timings describe the busiest game swap chain.
                Missing CPU/GPU metrics remain unavailable.
              </p>
              {samples.some(
                (sample) => sample.gameFrames?.timingSource === 'cpu-frame'
              ) && (
                <p className="text-xs text-amber-300">
                  This PresentMon schema reports CPU frame cadence. FPS and lows
                  use CPU FrameTime rather than present-to-present intervals.
                </p>
              )}
              <div className="grid gap-3 md:grid-cols-2">
                <TelemetryLineChart
                  title="Game FPS and lows"
                  unit="FPS"
                  samples={samples}
                  series={[
                    {
                      label: 'FPS',
                      color: 'text-sky-400',
                      values: samples.map((s) => s.gameFrames?.fps ?? null),
                    },
                    {
                      label: '5% low',
                      color: 'text-amber-400',
                      values: samples.map((s) => s.gameFrames?.low5Fps ?? null),
                    },
                    {
                      label: '1% low',
                      color: 'text-red-400',
                      values: samples.map((s) => s.gameFrames?.low1Fps ?? null),
                    },
                  ]}
                />
                <TelemetryLineChart
                  title="Game frame time"
                  unit="ms"
                  samples={samples}
                  series={[
                    {
                      label: 'Mean',
                      color: 'text-sky-400',
                      values: samples.map(
                        (s) => s.gameFrames?.frameTimeMs ?? null
                      ),
                    },
                    {
                      label: 'p95',
                      color: 'text-amber-400',
                      values: samples.map(
                        (s) => s.gameFrames?.p95FrameTimeMs ?? null
                      ),
                    },
                    {
                      label: 'p99',
                      color: 'text-red-400',
                      values: samples.map(
                        (s) => s.gameFrames?.p99FrameTimeMs ?? null
                      ),
                    },
                    {
                      label: 'CPU busy',
                      color: 'text-violet-400',
                      values: samples.map(
                        (s) => s.gameFrames?.cpuBusyMs ?? null
                      ),
                    },
                    {
                      label: 'GPU time',
                      color: 'text-emerald-400',
                      values: samples.map(
                        (s) => s.gameFrames?.gpuTimeMs ?? null
                      ),
                    },
                  ]}
                />
              </div>
            </section>
          )}
          <div className="mt-4 grid gap-3 sm:grid-cols-2 md:grid-cols-3 2xl:grid-cols-5">
            <Stat
              label="Latest app CPU"
              value={`${formatMetric(latest?.appCpuPercent)}%`}
              detail="Sum of app process CPU percentages"
            />
            <Stat
              label="App working set"
              value={`${formatMetric(latest?.appWorkingSetMB)} MB`}
            />
            <Stat
              label="App private memory"
              value={`${formatMetric(latest?.appPrivateMemoryMB)} MB`}
              detail={`Change: ${privateDelta === null ? 'unavailable' : `${privateDelta >= 0 ? '+' : ''}${formatMetric(privateDelta)} MB`} · slope ${formatSlope(privateTrend.slopePerMinute)}`}
            />
            <Stat
              label="Main V8 heap"
              value={`${formatMetric(latest?.mainV8HeapUsedMB)} MB`}
              detail="Main process only"
            />
            <Stat
              label="Telemetry tick rate"
              value={`${formatMetric(latest?.tickRateHz)} Hz`}
              detail={`Event-loop p99: ${formatMetric(latest?.eventLoopP99Ms)} ms`}
            />
          </div>
          <p className="mt-3 text-[10px] text-slate-500">
            Renderer heap sampling attached to{' '}
            {capture.heapSampling.attachedTargets} window(s);{' '}
            {capture.heapSampling.skippedTargets} skipped because DevTools was
            already attached or the target was unavailable. Inspector itself is
            excluded. Periodic heap samples are live; explicit checkpoints force
            GC in attached renderers only.
          </p>

          <div className="mt-3 grid gap-3 md:grid-cols-2">
            <TelemetryLineChart
              title="Application memory"
              unit="MB"
              samples={samples}
              series={memorySeries}
            />
            <TelemetryLineChart
              title="Application CPU"
              unit="%"
              samples={samples}
              series={cpuSeries}
            />
            <TelemetryLineChart
              title="Channel deliveries"
              unit="deliveries / s"
              samples={samples}
              series={channelDeliverySeries}
            />
            <TelemetryLineChart
              title="Per-process private memory"
              unit="MB"
              samples={samples}
              series={processMemorySeries}
            />
            <TelemetryLineChart
              title="JavaScript heap"
              unit="MB"
              samples={samples}
              series={mainHeapSeries}
            />
            <TelemetryLineChart
              title="Renderer V8 heap"
              unit="MB"
              samples={samples}
              series={rendererHeapSeries}
            />
            <TelemetryLineChart
              title="Main-process event loop"
              unit="ms"
              samples={samples}
              series={eventLoopSeries}
            />
          </div>

          <div className="mt-4 grid gap-4 xl:grid-cols-2">
            <div className="min-w-0">
              <h3 className="text-xs font-semibold text-slate-200">
                Process breakdown
              </h3>
              <p className="mt-1 text-[10px] text-slate-500">
                Current values and per-process least-squares private-memory
                slope. PID lifetimes are tracked separately.
              </p>
              <div className="mt-2 overflow-x-auto rounded-md border border-slate-700/80">
                <table className="w-full min-w-[680px] text-left text-[11px]">
                  <thead className="bg-slate-800 text-slate-400">
                    <tr>
                      <th className="px-2 py-2 font-medium">Process</th>
                      <th className="px-2 py-2 text-right font-medium">CPU</th>
                      <th className="px-2 py-2 text-right font-medium">
                        Working set
                      </th>
                      <th className="px-2 py-2 text-right font-medium">
                        Private
                      </th>
                      <th className="px-2 py-2 text-right font-medium">
                        Δ private
                      </th>
                      <th className="px-2 py-2 text-right font-medium">
                        Slope
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {processRows.length ? (
                      processRows.map(({ process, delta, slopePerMinute }) => (
                        <tr
                          key={process.key}
                          className="border-t border-slate-700/70 text-slate-300"
                        >
                          <td className="max-w-56 truncate px-2 py-2">
                            {processLabel(process)}
                          </td>
                          <td className="px-2 py-2 text-right font-mono">
                            {formatMetric(process.cpuPercent)}%
                          </td>
                          <td className="px-2 py-2 text-right font-mono">
                            {formatMetric(process.memoryMB)} MB
                          </td>
                          <td className="px-2 py-2 text-right font-mono">
                            {formatMetric(process.privateMemoryMB)} MB
                          </td>
                          <td className="px-2 py-2 text-right font-mono">
                            {delta === null
                              ? '—'
                              : `${delta >= 0 ? '+' : ''}${formatMetric(delta)} MB`}
                          </td>
                          <td className="px-2 py-2 text-right font-mono">
                            {formatSlope(slopePerMinute)}
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td
                          colSpan={6}
                          className="px-2 py-4 text-center text-slate-500"
                        >
                          Process metrics unavailable
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="min-w-0">
              <h3 className="text-xs font-semibold text-slate-200">
                Highest-cost measured sections
              </h3>
              <p className="mt-1 text-[10px] text-slate-500">
                Cumulative wall time; nested sections can overlap.
              </p>
              <div className="mt-2 overflow-x-auto rounded-md border border-slate-700/80">
                <table className="w-full min-w-[420px] text-left text-[11px]">
                  <thead className="bg-slate-800 text-slate-400">
                    <tr>
                      <th className="px-2 py-2 font-medium">Section</th>
                      <th className="px-2 py-2 text-right font-medium">
                        Calls
                      </th>
                      <th className="px-2 py-2 text-right font-medium">
                        Total
                      </th>
                      <th className="px-2 py-2 text-right font-medium">
                        Avg / max
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {capture.hottestSections.length ? (
                      capture.hottestSections.map((section) => (
                        <tr
                          key={section.name}
                          className="border-t border-slate-700/70 text-slate-300"
                        >
                          <td className="max-w-48 truncate px-2 py-2">
                            {section.name}
                          </td>
                          <td className="px-2 py-2 text-right font-mono">
                            {section.count.toLocaleString()}
                          </td>
                          <td className="px-2 py-2 text-right font-mono">
                            {formatMetric(section.totalWallMs)} ms
                          </td>
                          <td className="px-2 py-2 text-right font-mono">
                            {formatMetric(section.averageMs)} /{' '}
                            {formatMetric(section.maxWallMs)} ms
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td
                          colSpan={4}
                          className="px-2 py-4 text-center text-slate-500"
                        >
                          Section timings unavailable
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <div className="mt-4">
            <h3 className="text-xs font-semibold text-slate-200">
              Renderer GC checkpoints
            </h3>
            <p className="mt-1 text-[10px] text-slate-500">
              Explicit GC applies to attached renderers only. Process-private
              memory and main V8 heap are live measurements after renderer GC;
              the main process is not collected.
            </p>
            <div className="mt-2 overflow-x-auto rounded-md border border-slate-700/80">
              <table className="w-full min-w-[920px] text-left text-[11px]">
                <thead className="bg-slate-800 text-slate-400">
                  <tr>
                    <th className="px-2 py-2 font-medium">Elapsed</th>
                    <th className="px-2 py-2 text-right font-medium">
                      App private
                    </th>
                    <th className="px-2 py-2 text-right font-medium">
                      Main V8 live
                    </th>
                    <th className="px-2 py-2 font-medium">Process private</th>
                    <th className="px-2 py-2 font-medium">
                      Renderer V8 after GC
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {checkpointRows.length ? (
                    checkpointRows.map((checkpoint) => (
                      <tr
                        key={`${checkpoint.elapsedSeconds}`}
                        className="border-t border-slate-700/70 text-slate-300"
                      >
                        <td className="px-2 py-2 font-mono">
                          {formatDuration(checkpoint.elapsedSeconds)}
                        </td>
                        <td className="px-2 py-2 text-right font-mono">
                          {formatMetric(checkpoint.appPrivateMemoryMB)} MB
                        </td>
                        <td className="px-2 py-2 text-right font-mono">
                          {formatMetric(checkpoint.mainV8HeapUsedMB)} MB
                        </td>
                        <td className="max-w-[300px] px-2 py-2">
                          {checkpoint.processes
                            .map(
                              (process) =>
                                `${processLabel(process)}: ${formatMetric(process.privateMemoryMB)} MB`
                            )
                            .join(' · ') || 'Unavailable'}
                        </td>
                        <td className="max-w-[360px] px-2 py-2">
                          {checkpoint.rendererHeaps
                            .filter((heap) => heap.usedHeapMB !== null)
                            .map(
                              (heap) =>
                                `${heap.route} (${heap.pid}): ${formatMetric(heap.usedHeapMB)} MB`
                            )
                            .join(' · ') || 'Renderer heap unavailable'}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td
                        colSpan={5}
                        className="px-2 py-4 text-center text-slate-500"
                      >
                        No manual post-GC checkpoints yet
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="mt-4">
            <h3 className="text-xs font-semibold text-slate-200">
              Channel activity
            </h3>
            <p className="mt-1 text-[10px] text-slate-500">
              Totals for this capture; processor executions, publications and
              deliveries are separate counters.
            </p>
            <div className="mt-2 overflow-x-auto rounded-md border border-slate-700/80">
              <table className="w-full min-w-[520px] text-left text-[11px]">
                <thead className="bg-slate-800 text-slate-400">
                  <tr>
                    <th className="px-2 py-2 font-medium">Channel</th>
                    <th className="px-2 py-2 text-right font-medium">
                      Executions
                    </th>
                    <th className="px-2 py-2 text-right font-medium">
                      Publications
                    </th>
                    <th className="px-2 py-2 text-right font-medium">
                      Deliveries
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {capture.channelActivity.length ? (
                    capture.channelActivity.map((channel) => (
                      <tr
                        key={channel.name}
                        className="border-t border-slate-700/70 text-slate-300"
                      >
                        <td className="max-w-64 truncate px-2 py-2">
                          {channel.name}
                        </td>
                        <td className="px-2 py-2 text-right font-mono">
                          {channel.processorExecutions.toLocaleString()}
                        </td>
                        <td className="px-2 py-2 text-right font-mono">
                          {channel.publications.toLocaleString()}
                        </td>
                        <td className="px-2 py-2 text-right font-mono">
                          {channel.deliveries.toLocaleString()}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td
                        colSpan={4}
                        className="px-2 py-4 text-center text-slate-500"
                      >
                        Channel counters unavailable
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <p className="mt-4 text-[10px] leading-relaxed text-slate-500">
            Periodic values are live samples; manual checkpoints force GC in
            attached renderers only and do not provide retaining paths. Slopes
            require at least three valid samples across 30 seconds. GPU-engine
            utilization, renderer drawing and game frame time are not measured.
            A rising working set alone does not prove a leak; compare private
            memory and live/post-GC renderer heap trends, then use a
            retaining-path profile to identify retained JavaScript objects.
          </p>
        </>
      ) : (
        <p className="mt-4 rounded-md border border-dashed border-slate-700 p-6 text-center text-xs text-slate-500">
          Start a performance capture to build time-series charts for CPU,
          working set, private memory, event-loop delay and process ownership.
        </p>
      )}
    </section>
  );
}
