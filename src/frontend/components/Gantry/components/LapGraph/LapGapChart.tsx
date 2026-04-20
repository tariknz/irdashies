import { memo, useRef, useState, useMemo } from 'react';

export interface ChartDriver {
  carIdx: number;
  name: string;
  carNumber: string;
  classColor: number;
  gaps: Record<number, number>;
}

interface TooltipState {
  x: number;
  y: number;
  driverName: string;
  carNumber: string;
  lapNum: number;
  gap: number;
  color: string;
}

interface Props {
  drivers: ChartDriver[];
}

const W = 560;
const H = 240;
const PAD = { top: 16, right: 20, bottom: 32, left: 44 };
const CHART_W = W - PAD.left - PAD.right;
const CHART_H = H - PAD.top - PAD.bottom;

function niceStep(maxVal: number): number {
  if (maxVal <= 20) return 5;
  if (maxVal <= 60) return 10;
  return 30;
}

export const LapGapChart = memo(({ drivers }: Props) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const [hoveredCarIdx, setHoveredCarIdx] = useState<number | null>(null);
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);

  const { minLap, maxLap, maxGap } = useMemo(() => {
    let minLap = Infinity;
    let maxLap = 0;
    let maxGap = 0;
    for (const d of drivers) {
      for (const [lapStr, gap] of Object.entries(d.gaps)) {
        const lap = Number(lapStr);
        if (lap < minLap) minLap = lap;
        if (lap > maxLap) maxLap = lap;
        if (gap > maxGap) maxGap = gap;
      }
    }
    if (!isFinite(minLap)) return { minLap: 1, maxLap: 2, maxGap: 30 };
    if (maxLap <= minLap) maxLap = minLap + 1;
    if (maxGap <= 0) maxGap = 30;
    const step = niceStep(maxGap);
    return {
      minLap,
      maxLap,
      maxGap: Math.ceil(maxGap / step) * step,
    };
  }, [drivers]);

  const lapRange = maxLap - minLap || 1;
  const toX = (lap: number) => PAD.left + ((lap - minLap) / lapRange) * CHART_W;
  const toY = (gap: number) => PAD.top + CHART_H - (gap / maxGap) * CHART_H;

  const gridStep = niceStep(maxGap);
  const gridValues = useMemo(() => {
    const vals: number[] = [];
    for (let g = 0; g <= maxGap; g += gridStep) vals.push(g);
    return vals;
  }, [maxGap, gridStep]);

  const lapStep = useMemo(() => {
    const total = maxLap - minLap + 1;
    if (total <= 10) return 1;
    if (total <= 20) return 2;
    if (total <= 50) return 5;
    return 10;
  }, [minLap, maxLap]);

  const lapLabels = useMemo(() => {
    const labels: number[] = [];
    for (let lap = minLap; lap <= maxLap; lap++) {
      if ((lap - minLap) % lapStep === 0) labels.push(lap);
    }
    return labels;
  }, [minLap, maxLap, lapStep]);

  const hasData = drivers.some((d) => Object.keys(d.gaps).length >= 1);

  if (!hasData) {
    return (
      <div className="flex items-center justify-center h-full text-slate-600 text-sm">
        No lap data yet
      </div>
    );
  }

  return (
    <div className="relative w-full h-full">
      <svg
        ref={svgRef}
        viewBox={`0 0 ${W} ${H}`}
        className="w-full h-full"
        preserveAspectRatio="xMidYMid meet"
        onMouseLeave={() => {
          setHoveredCarIdx(null);
          setTooltip(null);
        }}
      >
        {/* Y-axis grid + labels */}
        {gridValues.map((g) => (
          <g key={g}>
            <line
              x1={PAD.left}
              y1={toY(g)}
              x2={PAD.left + CHART_W}
              y2={toY(g)}
              stroke={
                g === 0 ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.06)'
              }
              strokeWidth={1}
            />
            <text
              x={PAD.left - 6}
              y={toY(g) + 4}
              fill="rgba(255,255,255,0.35)"
              fontSize={9}
              textAnchor="end"
              fontFamily="Lato, sans-serif"
            >
              {g}
            </text>
          </g>
        ))}

        {/* Y-axis title */}
        <text
          x={8}
          y={PAD.top + CHART_H / 2}
          fill="rgba(255,255,255,0.25)"
          fontSize={8}
          textAnchor="middle"
          transform={`rotate(-90, 8, ${PAD.top + CHART_H / 2})`}
          fontFamily="Lato, sans-serif"
        >
          Gap (s)
        </text>

        {/* X-axis labels */}
        {lapLabels.map((lap) => (
          <text
            key={lap}
            x={toX(lap)}
            y={PAD.top + CHART_H + 16}
            fill="rgba(255,255,255,0.35)"
            fontSize={9}
            textAnchor="middle"
            fontFamily="Lato, sans-serif"
          >
            {lap}
          </text>
        ))}

        {/* X-axis title */}
        <text
          x={PAD.left + CHART_W / 2}
          y={H - 2}
          fill="rgba(255,255,255,0.25)"
          fontSize={8}
          textAnchor="middle"
          fontFamily="Lato, sans-serif"
        >
          Lap
        </text>

        {/* Axes */}
        <line
          x1={PAD.left}
          y1={PAD.top}
          x2={PAD.left}
          y2={PAD.top + CHART_H}
          stroke="rgba(255,255,255,0.15)"
          strokeWidth={1}
        />
        <line
          x1={PAD.left}
          y1={PAD.top + CHART_H}
          x2={PAD.left + CHART_W}
          y2={PAD.top + CHART_H}
          stroke="rgba(255,255,255,0.15)"
          strokeWidth={1}
        />

        {/* Lines per driver */}
        {drivers.map((d) => {
          const color = `#${d.classColor.toString(16).padStart(6, '0')}`;
          const laps = Object.keys(d.gaps)
            .map(Number)
            .sort((a, b) => a - b);
          if (laps.length < 1) return null;

          const points = laps
            .map(
              (lap) => `${toX(lap).toFixed(1)},${toY(d.gaps[lap]).toFixed(1)}`
            )
            .join(' ');

          const isHovered = hoveredCarIdx === d.carIdx;
          const isDimmed = hoveredCarIdx !== null && !isHovered;

          return (
            <polyline
              key={d.carIdx}
              points={points}
              fill="none"
              stroke={color}
              strokeWidth={isHovered ? 2.5 : 1.5}
              opacity={isDimmed ? 0.2 : 1}
              strokeLinejoin="round"
              strokeLinecap="round"
              style={{ cursor: 'pointer' }}
              onMouseEnter={() => setHoveredCarIdx(d.carIdx)}
              onMouseMove={(e) => {
                if (!svgRef.current) return;
                const rect = svgRef.current.getBoundingClientRect();
                const mouseXInSvg = ((e.clientX - rect.left) / rect.width) * W;

                let nearestLap = laps[0];
                let minDist = Infinity;
                for (const lap of laps) {
                  const dist = Math.abs(toX(lap) - mouseXInSvg);
                  if (dist < minDist) {
                    minDist = dist;
                    nearestLap = lap;
                  }
                }

                setTooltip({
                  x: e.clientX - rect.left,
                  y: e.clientY - rect.top,
                  driverName: d.name,
                  carNumber: d.carNumber,
                  lapNum: nearestLap,
                  gap: d.gaps[nearestLap],
                  color,
                });
              }}
              onMouseLeave={() => {
                setHoveredCarIdx(null);
                setTooltip(null);
              }}
            />
          );
        })}

        {/* Hover dot */}
        {tooltip && (
          <circle
            cx={toX(tooltip.lapNum)}
            cy={toY(tooltip.gap)}
            r={4}
            fill={tooltip.color}
            stroke="rgba(255,255,255,0.8)"
            strokeWidth={1.5}
            style={{ pointerEvents: 'none' }}
          />
        )}
      </svg>

      {/* Tooltip */}
      {tooltip && (
        <div
          className="absolute pointer-events-none z-10 bg-slate-900 border border-slate-600 rounded px-2 py-1 text-xs text-white shadow-lg whitespace-nowrap"
          style={{ left: tooltip.x + 14, top: tooltip.y - 32 }}
        >
          <span className="font-bold">#{tooltip.carNumber}</span>{' '}
          <span className="text-slate-300">{tooltip.driverName}</span>
          <br />
          <span className="text-slate-400">L{tooltip.lapNum}</span>{' '}
          <span className="tabular-nums">+{tooltip.gap.toFixed(1)}s</span>
        </div>
      )}
    </div>
  );
});
LapGapChart.displayName = 'LapGapChart';
