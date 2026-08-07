import { memo, useRef, useState, useMemo } from 'react';
import { Tooltip } from '../Tooltip/Tooltip';

export interface ChartDriver {
  carIdx: number;
  name: string;
  carNumber: string;
  classColor: number;
  isPlayer: boolean;
  position: number;
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
const PAD = { top: 16, right: 20, bottom: 34, left: 46 };
const CHART_W = W - PAD.left - PAD.right;
const CHART_H = H - PAD.top - PAD.bottom;

// Fixed palette validated for this dark surface - order matters (slot index
// picks the colour), do not reorder, regenerate, or add more entries.
const HIGHLIGHT_COLORS = [
  '#3987e5',
  '#d95926',
  '#199e70',
  '#c98500',
  '#d55181',
  '#008300',
  '#9085e9',
  '#e66767',
];
const MAX_COLORED = HIGHLIGHT_COLORS.length;
const MUTED_STROKE = 'rgba(148,163,184,0.28)';
const MUTED_HIGHLIGHT_STROKE = 'rgba(203,213,225,0.9)';

function niceStep(maxVal: number): number {
  if (maxVal <= 20) return 5;
  if (maxVal <= 60) return 10;
  return 30;
}

function shortName(fullName: string): string {
  const parts = fullName.trim().split(/\s+/);
  return parts[parts.length - 1] || fullName;
}

export const LapGapChart = memo(({ drivers }: Props) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const [hoveredCarIdx, setHoveredCarIdx] = useState<number | null>(null);
  const [selectedCarIdx, setSelectedCarIdx] = useState<number | null>(null);
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);
  const activeCarIdx = hoveredCarIdx ?? selectedCarIdx;

  // Stable carIdx -> palette-slot assignment, kept in a ref so it survives
  // re-renders. Positions reshuffle lap to lap; a driver that stays in the
  // coloured set must keep the slot it already has rather than being
  // reassigned from scratch (which would repaint survivors a new colour).
  //
  // This mutates a ref during render, which is normally worth avoiding. It is
  // safe here because the operation is idempotent: running it twice on the same
  // driver list produces the same map, since the second pass finds every car
  // already holding a slot and changes nothing.
  const slotsRef = useRef<Map<number, number>>(new Map());
  const colorByCarIdx = useMemo(() => {
    const slots = slotsRef.current;
    const presentCarIdxs = new Set(drivers.map((d) => d.carIdx));
    for (const carIdx of slots.keys()) {
      if (!presentCarIdxs.has(carIdx)) slots.delete(carIdx);
    }

    // Desired set: player first, then fill by current class position.
    const desired: number[] = [];
    const player = drivers.find((d) => d.isPlayer);
    if (player) desired.push(player.carIdx);
    const byPosition = [...drivers].sort((a, b) => a.position - b.position);
    for (const d of byPosition) {
      if (desired.length >= MAX_COLORED) break;
      if (!desired.includes(d.carIdx)) desired.push(d.carIdx);
    }
    const desiredSet = new Set(desired);

    for (const carIdx of slots.keys()) {
      if (!desiredSet.has(carIdx)) slots.delete(carIdx);
    }

    const usedSlots = new Set(slots.values());
    const freeSlots: number[] = [];
    for (let i = 0; i < MAX_COLORED; i++) {
      if (!usedSlots.has(i)) freeSlots.push(i);
    }

    for (const carIdx of desired) {
      if (slots.has(carIdx)) continue;
      const slot = freeSlots.shift();
      if (slot === undefined) break;
      slots.set(carIdx, slot);
    }

    const result = new Map<number, string>();
    for (const [carIdx, slot] of slots) {
      result.set(carIdx, HIGHLIGHT_COLORS[slot]);
    }
    return result;
  }, [drivers]);

  const coloredCount = colorByCarIdx.size;
  const otherCount = drivers.length - coloredCount;
  const showLegend = drivers.length >= 2;

  const legendDrivers = useMemo(
    () =>
      drivers
        .filter((d) => colorByCarIdx.has(d.carIdx))
        .sort(
          (a, b) =>
            (slotsRef.current.get(a.carIdx) ?? 0) -
            (slotsRef.current.get(b.carIdx) ?? 0)
        ),
    [drivers, colorByCarIdx]
  );

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

  const toggleSelected = (carIdx: number) => {
    setSelectedCarIdx((prev) => (prev === carIdx ? null : carIdx));
  };

  return (
    <div className="flex flex-col h-full">
      {showLegend && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 px-1 pb-2 shrink-0">
          {legendDrivers.map((d) => {
            const color = colorByCarIdx.get(d.carIdx) as string;
            const isActive = activeCarIdx === d.carIdx;
            const isPinned = selectedCarIdx === d.carIdx;
            return (
              <Tooltip
                key={d.carIdx}
                placement="bottom"
                content={
                  isPinned
                    ? `Click to unpin #${d.carNumber} ${shortName(d.name)} and bring the rest of the field back to full strength.`
                    : `Hovering highlights #${d.carNumber} ${shortName(d.name)} on the chart. Click to pin the line so it stays highlighted and the others stay dimmed.`
                }
              >
                <button
                  type="button"
                  aria-pressed={isActive}
                  onClick={() => toggleSelected(d.carIdx)}
                  onMouseEnter={() => setHoveredCarIdx(d.carIdx)}
                  onMouseLeave={() => setHoveredCarIdx(null)}
                  className={[
                    'flex items-center gap-1.5 rounded px-1 py-0.5 text-[10px] leading-none cursor-pointer transition-colors',
                    isActive ? 'bg-slate-700/60' : 'hover:bg-slate-800/60',
                  ].join(' ')}
                >
                  <span
                    className="w-2 h-2 rounded-full shrink-0"
                    style={{ backgroundColor: color }}
                  />
                  <span className="text-white font-bold">#{d.carNumber}</span>
                  <span className="text-slate-300">{shortName(d.name)}</span>
                </button>
              </Tooltip>
            );
          })}
          {otherCount > 0 && (
            <Tooltip
              placement="bottom"
              content={`${otherCount} more ${otherCount === 1 ? 'driver is' : 'drivers are'} plotted in grey without a legend entry — only the leading ${MAX_COLORED} get a colour. Hover a grey line on the chart to identify it.`}
            >
              <span
                tabIndex={0}
                className="flex items-center gap-1.5 px-1 py-0.5 text-[10px] leading-none text-slate-500 cursor-help focus:outline-none focus:ring-1 focus:ring-sky-400 rounded"
              >
                <span
                  className="w-2 h-2 rounded-full shrink-0"
                  style={{ backgroundColor: MUTED_STROKE }}
                />
                +{otherCount} others
              </span>
            </Tooltip>
          )}
        </div>
      )}

      <div className="relative flex-1 min-h-0">
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
                fill="rgba(255,255,255,0.55)"
                fontSize={11}
                textAnchor="end"
                fontFamily="Lato, sans-serif"
              >
                {g}
              </text>
            </g>
          ))}

          {/* Y-axis title */}
          <text
            x={10}
            y={PAD.top + CHART_H / 2}
            fill="rgba(255,255,255,0.7)"
            fontSize={12}
            textAnchor="middle"
            transform={`rotate(-90, 10, ${PAD.top + CHART_H / 2})`}
            fontFamily="Lato, sans-serif"
          >
            Gap to leader (s)
          </text>

          {/* X-axis labels */}
          {lapLabels.map((lap) => (
            <text
              key={lap}
              x={toX(lap)}
              y={PAD.top + CHART_H + 16}
              fill="rgba(255,255,255,0.55)"
              fontSize={11}
              textAnchor="middle"
              fontFamily="Lato, sans-serif"
            >
              {lap}
            </text>
          ))}

          {/* X-axis title */}
          <text
            x={PAD.left + CHART_W / 2}
            y={H - 4}
            fill="rgba(255,255,255,0.7)"
            fontSize={12}
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

          {/* Lines per driver - muted/context drivers first so coloured ones sit on top */}
          {drivers.map((d) => {
            const assignedColor = colorByCarIdx.get(d.carIdx);
            const isColored = assignedColor !== undefined;
            const isActive = activeCarIdx === d.carIdx;
            const isDimmed = activeCarIdx !== null && !isActive;
            const stroke = isColored
              ? assignedColor
              : isActive
                ? MUTED_HIGHLIGHT_STROKE
                : MUTED_STROKE;

            const laps = Object.keys(d.gaps)
              .map(Number)
              .sort((a, b) => a - b);
            if (laps.length < 1) return null;

            const points = laps
              .map(
                (lap) => `${toX(lap).toFixed(1)},${toY(d.gaps[lap]).toFixed(1)}`
              )
              .join(' ');

            return (
              <polyline
                key={d.carIdx}
                points={points}
                fill="none"
                stroke={stroke}
                strokeWidth={isActive ? 2.5 : isColored ? 1.5 : 1}
                opacity={isDimmed && isColored ? 0.25 : 1}
                strokeLinejoin="round"
                strokeLinecap="round"
                style={{ cursor: 'pointer' }}
                onMouseEnter={() => setHoveredCarIdx(d.carIdx)}
                onMouseMove={(e) => {
                  if (!svgRef.current) return;
                  const rect = svgRef.current.getBoundingClientRect();
                  const mouseXInSvg =
                    ((e.clientX - rect.left) / rect.width) * W;

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
                    color: assignedColor ?? MUTED_HIGHLIGHT_STROKE,
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
    </div>
  );
});
LapGapChart.displayName = 'LapGapChart';
