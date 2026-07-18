import { memo, useMemo } from 'react';
import * as d3 from 'd3';
import { formatTime } from '@irdashies/utils/time';
import { getColor } from '@irdashies/utils/colors';
import type { LapEntry } from '../demoData';

interface LapHistoryChartProps {
  history: LapEntry[];
  best?: number;
  overall?: number;
  alltime?: number;
  foregroundOpacity?: number;
}

const WIDTH = 240;
const HEIGHT = 60;
const PADDING_X = 6;
const PADDING_Y = 8;

const isSameLapTime = (left?: number, right?: number) =>
  left !== undefined &&
  right !== undefined &&
  left > 0 &&
  Math.abs(left - right) < 0.001;

export const LapHistoryChart = memo(
  ({ history, best, overall, alltime, foregroundOpacity }: LapHistoryChartProps) => {
    // chronological order: oldest lap on the left, newest on the right
    const laps = useMemo(
      () => [...history].sort((a, b) => a.lap - b.lap),
      [history]
    );

    const chart = useMemo(() => {
      if (laps.length === 0) return undefined;

      const times = laps.map((lap) => lap.time);
      const min = Math.min(...times);
      const max = Math.max(...times);
      const domainPad = (max - min) * 0.15 || 0.5;

      const xScale = d3
        .scalePoint<number>()
        .domain(laps.map((_, i) => i) as unknown as number[])
        .range([PADDING_X, WIDTH - PADDING_X]);

      const yScale = d3
        .scaleLinear()
        .domain([min - domainPad, max + domainPad])
        .range([HEIGHT - PADDING_Y, PADDING_Y]);

      const line = d3
        .line<LapEntry>()
        .x((_, i) => xScale(i) ?? 0)
        .y((d) => yScale(d.time))
        .curve(d3.curveMonotoneX);

      const average = times.reduce((sum, t) => sum + t, 0) / times.length;

      return {
        pathD: line(laps) ?? '',
        yScale,
        average,
        points: laps.map((entry, i) => ({
          x: xScale(i) ?? 0,
          y: yScale(entry.time),
          entry,
        })),
      };
    }, [laps]);

    const pointColor = (entry: LapEntry) => {
      if (entry.dirty) return getColor('zinc', 400);
      if (isSameLapTime(entry.time, alltime)) return getColor('yellow', 400);
      if (isSameLapTime(entry.time, overall)) return getColor('purple', 400);
      if (isSameLapTime(entry.time, best)) return getColor('green', 400);
      if (chart && entry.time > chart.average) return getColor('red', 400);
      return getColor('slate', 200);
    };

    if (!chart) return null;

    const opacity = foregroundOpacity ?? 70;

    return (
      <div
        className="w-full p-1 bg-slate-900/[var(--fg-alpha)] rounded-sm"
        style={{ '--fg-alpha': `${opacity / 3}%` } as React.CSSProperties}
      >
        <svg
          width="100%"
          viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
          preserveAspectRatio="none"
        >
          {best !== undefined && best > 0 && (
            <line
              x1={0}
              x2={WIDTH}
              y1={chart.yScale(best)}
              y2={chart.yScale(best)}
              stroke={getColor('green', 400)}
              strokeDasharray="2,2"
              strokeOpacity={0.5}
            />
          )}
          <line
            x1={0}
            x2={WIDTH}
            y1={chart.yScale(chart.average)}
            y2={chart.yScale(chart.average)}
            stroke={getColor('sky', 400)}
            strokeDasharray="4,3"
            strokeOpacity={0.5}
          />
          <path
            d={chart.pathD}
            fill="none"
            stroke={getColor('slate', 300)}
            strokeWidth={1.5}
          />
          {chart.points.map(({ x, y, entry }) => (
            <circle key={entry.lap} cx={x} cy={y} r={2.5} fill={pointColor(entry)} />
          ))}
        </svg>
        <div className="flex justify-between text-[0.65em] text-zinc-400 tabular-nums px-1">
          <span>
            L{laps[0].lap} · {formatTime(laps[0].time)}
          </span>
          <span className="text-sky-400">AVG {formatTime(chart.average)}</span>
          <span>
            L{laps[laps.length - 1].lap} · {formatTime(laps[laps.length - 1].time)}
          </span>
        </div>
      </div>
    );
  }
);

LapHistoryChart.displayName = 'LapHistoryChart';
