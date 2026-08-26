import {
  memo,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type KeyboardEvent as ReactKeyboardEvent,
  type RefObject,
} from 'react';
import { Play } from '@phosphor-icons/react';
import { useElementSize } from '@irdashies/context';
import {
  formatAxisValue,
  lapAxisLabels,
  lapLabelCapacity,
} from './lapGraphScales';
import {
  brushXToLap,
  centreWindowOn,
  clampWindow,
  defaultWindow,
  followWindow,
  isWindowLive,
  lapToX,
  nearestLapAtX,
  panWindow,
  stepWindow,
  windowToBrush,
  xToLap,
  zoomWindow,
  type LapWindow,
} from './lapGraphViewport';
import {
  brightenColor,
  lapBoundsOf,
  prepareLapGraph,
  valueAtLap,
  valueToY,
  type LapGraphGeometry,
  type LapGraphMode,
  type LapGraphSeries,
  type PreparedSeries,
} from './useLapGraphSeries';
import { anchorInsideBounds } from '../Tooltip/tooltipPosition';

export type {
  LapGraphMode,
  LapGraphSeries,
  LapPoint,
} from './useLapGraphSeries';

export interface LapGraphCanvasProps {
  series: readonly LapGraphSeries[];
  mode: LapGraphMode;
  /** Axis caption, e.g. "seconds vs reference pace, higher is better". */
  axisCaption: string;
  /** Explicitly pinned cars, drawn at full strength. */
  pinnedCarIdxs: readonly number[];
  /** Hover/follow focus. Drawn brightest and on top. */
  focusedCarIdx: number | null;
  onTogglePin: (carIdx: number) => void;
  /** Laps visible before the user zooms. Falls back to the module default. */
  defaultLapWindow?: number;
}

/** Vertical pixels within which the pointer counts as being on a line. */
const HIT_RADIUS_PX = 24;

/** Rows shown either side of the hovered line in the readout. */
const READOUT_NEIGHBOURS = 2;

/** Pointer travel that turns a click into a pan. */
const DRAG_THRESHOLD_PX = 4;

const WHEEL_ZOOM_IN = 0.85;
const WHEEL_ZOOM_OUT = 1 / WHEEL_ZOOM_IN;

const BRUSH_ALPHA = 0.35;
const APPROX_LAP_LABEL_PX = 34;

interface CanvasTarget {
  ctx: CanvasRenderingContext2D;
  width: number;
  height: number;
}

/**
 * Backs the canvas with device pixels and returns a context already scaled to
 * CSS pixels, so every draw routine can work in layout units.
 */
const prepareCanvas = (
  canvas: HTMLCanvasElement | null,
  width: number,
  height: number
): CanvasTarget | null => {
  if (!canvas || width <= 0 || height <= 0) return null;
  const dpr = globalThis.devicePixelRatio || 1;
  const deviceWidth = Math.max(1, Math.round(width * dpr));
  const deviceHeight = Math.max(1, Math.round(height * dpr));
  if (canvas.width !== deviceWidth) canvas.width = deviceWidth;
  if (canvas.height !== deviceHeight) canvas.height = deviceHeight;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, width, height);
  return { ctx, width, height };
};

const strokeSeries = (
  target: CanvasTarget,
  prepared: PreparedSeries,
  geometry: LapGraphGeometry,
  override?: { color: string; width: number; alpha: number }
) => {
  const points = prepared.points;
  if (points.length === 0) return;
  const style = override ?? prepared.stroke;
  const { ctx, width, height } = target;
  ctx.globalAlpha = style.alpha;
  ctx.strokeStyle = style.color;
  ctx.lineWidth = style.width;
  ctx.beginPath();
  for (let i = 0; i < points.length; i++) {
    const x = lapToX(points[i].lap, geometry.window, width);
    const y = valueToY(
      points[i].value,
      geometry.axis,
      height,
      geometry.inverted
    );
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();
  ctx.globalAlpha = 1;
};

const drawAllSeries = (
  target: CanvasTarget,
  geometry: LapGraphGeometry,
  override?: { color: string; width: number; alpha: number }
) => {
  const { ctx } = target;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  for (const prepared of geometry.ordered) {
    strokeSeries(target, prepared, geometry, override);
  }
};

interface ReadoutRow {
  carIdx: number;
  carNumber: string;
  displayName: string;
  color: string;
  value: number;
  isHovered: boolean;
}

interface ReadoutState {
  x: number;
  y: number;
  lap: number;
  rows: readonly ReadoutRow[];
}

interface ReadoutHandle {
  show: (state: ReadoutState | null) => void;
}

interface ReadoutProps {
  handle: RefObject<ReadoutHandle | null>;
  mode: LapGraphMode;
  bounds: { width: number; height: number };
}

/**
 * Owns its own state so a pointer move never re-renders the chart around it.
 * The plot pushes updates through the imperative handle.
 */
const LapGraphReadout = memo(({ handle, mode, bounds }: ReadoutProps) => {
  const [state, setState] = useState<ReadoutState | null>(null);
  useImperativeHandle(handle, () => ({ show: setState }), []);

  if (!state || state.rows.length === 0) return null;

  const anchor = anchorInsideBounds(
    { x: state.x, y: state.y },
    bounds,
    12
  ) as Record<string, number>;

  return (
    <div
      className="absolute z-10 pointer-events-none rounded-sm bg-slate-900/90 border border-slate-700 px-2 py-1.5 text-xs shadow-lg"
      style={anchor}
    >
      <div className="text-slate-500 font-bold uppercase tracking-wider mb-1">
        Lap {state.lap}
      </div>
      <table>
        <tbody>
          {state.rows.map((row) => (
            <tr
              key={row.carIdx}
              className={row.isHovered ? 'text-white' : 'text-slate-400'}
            >
              <td className="pr-1.5">
                <span
                  className="inline-block w-1.5 h-3 rounded-xs align-middle"
                  style={{ backgroundColor: row.color }}
                />
              </td>
              <td className="pr-2 tabular-nums">#{row.carNumber}</td>
              <td className="pr-3 max-w-40 truncate">{row.displayName}</td>
              <td className="text-right tabular-nums">
                {formatAxisValue(mode, row.value)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
});
LapGraphReadout.displayName = 'LapGraphReadout';

export const LapGraphCanvas = memo(
  ({
    series,
    mode,
    axisCaption,
    pinnedCarIdxs,
    focusedCarIdx,
    onTogglePin,
    defaultLapWindow,
  }: LapGraphCanvasProps) => {
    const plotRef = useRef<HTMLDivElement>(null);
    const brushRef = useRef<HTMLDivElement>(null);
    const baseCanvasRef = useRef<HTMLCanvasElement>(null);
    const overlayCanvasRef = useRef<HTMLCanvasElement>(null);
    const brushCanvasRef = useRef<HTMLCanvasElement>(null);
    const readoutRef = useRef<ReadoutHandle | null>(null);

    const plotSize = useElementSize(plotRef);
    const brushSize = useElementSize(brushRef);

    const [windowState, setWindowState] = useState<LapWindow | null>(null);
    const [follow, setFollow] = useState(true);

    const bounds = useMemo(() => lapBoundsOf(series), [series]);

    const activeWindow = useMemo(() => {
      const base = windowState ?? defaultWindow(bounds, defaultLapWindow);
      return follow ? followWindow(base, bounds) : clampWindow(base, bounds);
    }, [windowState, follow, bounds, defaultLapWindow]);

    const geometry = useMemo(
      () =>
        prepareLapGraph({
          series,
          mode,
          window: activeWindow,
          plotWidth: plotSize.width,
          pinnedCarIdxs,
          focusedCarIdx,
        }),
      [series, mode, activeWindow, plotSize.width, pinnedCarIdxs, focusedCarIdx]
    );

    const brushGeometry = useMemo(
      () =>
        prepareLapGraph({
          series,
          mode,
          window: { start: bounds.minLap, end: bounds.maxLap },
          plotWidth: brushSize.width,
          pinnedCarIdxs,
          focusedCarIdx,
        }),
      [series, mode, bounds, brushSize.width, pinnedCarIdxs, focusedCarIdx]
    );

    // Event handlers read the latest draw inputs through refs, so their own
    // identity never changes and never invalidates the base draw.
    const geometryRef = useRef(geometry);
    const plotSizeRef = useRef(plotSize);
    const accentRef = useRef('#94a3b8');

    useEffect(() => {
      geometryRef.current = geometry;
      plotSizeRef.current = plotSize;
    }, [geometry, plotSize]);

    /** Applies a window change and re-arms Follow only if it lands live. */
    const applyWindow = useCallback((next: LapWindow) => {
      setWindowState(next);
      setFollow(isWindowLive(next, geometryRef.current.bounds));
    }, []);

    const clearOverlay = useCallback(() => {
      const size = plotSizeRef.current;
      prepareCanvas(overlayCanvasRef.current, size.width, size.height);
      readoutRef.current?.show(null);
    }, []);

    /** Base canvas: every series, redrawn only when the drawing inputs move. */
    useEffect(() => {
      const target = prepareCanvas(
        baseCanvasRef.current,
        plotSize.width,
        plotSize.height
      );
      if (plotRef.current) {
        accentRef.current = getComputedStyle(plotRef.current).color;
      }
      if (!target) return;
      drawAllSeries(target, geometry);
    }, [geometry, plotSize.width, plotSize.height]);

    /** A geometry change invalidates whatever the overlay was showing. */
    useEffect(() => {
      clearOverlay();
    }, [geometry, plotSize.width, plotSize.height, clearOverlay]);

    /** Overview strip: the whole race, faint, behind the window rectangle. */
    useEffect(() => {
      const target = prepareCanvas(
        brushCanvasRef.current,
        brushSize.width,
        brushSize.height
      );
      if (!target) return;
      drawAllSeries(target, brushGeometry, {
        color: accentRef.current,
        width: 1,
        alpha: BRUSH_ALPHA,
      });
    }, [brushGeometry, brushSize.width, brushSize.height]);

    const hoveredCarIdxRef = useRef<number | null>(null);
    const dragRef = useRef<{
      pointerId: number;
      startX: number;
      startWindow: LapWindow;
      moved: boolean;
    } | null>(null);

    /**
     * Draws only the overlay: crosshair, the hovered line at focus strength
     * and its point marker. Never touches the base canvas.
     */
    const drawHover = useCallback((clientX: number, clientY: number) => {
      const element = plotRef.current;
      const size = plotSizeRef.current;
      const geo = geometryRef.current;
      if (!element || size.width <= 0 || size.height <= 0) return;

      const rect = element.getBoundingClientRect();
      const x = clientX - rect.left;
      const y = clientY - rect.top;
      const lap = nearestLapAtX(x, geo.window, size.width, geo.bounds);

      let hovered: PreparedSeries | null = null;
      let hoveredValue = 0;
      let bestDistance = HIT_RADIUS_PX;
      const candidates: {
        prepared: PreparedSeries;
        value: number;
        y: number;
      }[] = [];

      for (const prepared of geo.ordered) {
        const value = valueAtLap(prepared.source.points, lap);
        if (value === null) continue;
        const py = valueToY(value, geo.axis, size.height, geo.inverted);
        candidates.push({ prepared, value, y: py });
        const distance = Math.abs(py - y);
        if (distance < bestDistance) {
          bestDistance = distance;
          hovered = prepared;
          hoveredValue = value;
        }
      }

      hoveredCarIdxRef.current = hovered?.source.carIdx ?? null;

      const target = prepareCanvas(
        overlayCanvasRef.current,
        size.width,
        size.height
      );
      if (!target) return;
      const { ctx } = target;
      const crosshairX = lapToX(lap, geo.window, size.width);

      ctx.save();
      ctx.globalAlpha = 0.5;
      ctx.strokeStyle = accentRef.current;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(crosshairX, 0);
      ctx.lineTo(crosshairX, size.height);
      ctx.stroke();
      ctx.restore();

      if (!hovered) {
        readoutRef.current?.show(null);
        return;
      }

      strokeSeries(target, hovered, geo, {
        color: brightenColor(hovered.source.color),
        width: 3,
        alpha: 1,
      });

      const markerY = valueToY(
        hoveredValue,
        geo.axis,
        size.height,
        geo.inverted
      );
      ctx.fillStyle = brightenColor(hovered.source.color);
      ctx.beginPath();
      ctx.arc(crosshairX, markerY, 3.5, 0, Math.PI * 2);
      ctx.fill();

      candidates.sort((a, b) => a.y - b.y);
      const hoveredIndex = candidates.findIndex(
        (entry) => entry.prepared === hovered
      );
      const from = Math.max(0, hoveredIndex - READOUT_NEIGHBOURS);
      const rows = candidates
        .slice(from, hoveredIndex + READOUT_NEIGHBOURS + 1)
        .map((entry) => ({
          carIdx: entry.prepared.source.carIdx,
          carNumber: entry.prepared.source.carNumber,
          displayName: entry.prepared.source.displayName,
          color: entry.prepared.source.color,
          value: entry.value,
          isHovered: entry.prepared === hovered,
        }));

      readoutRef.current?.show({ x, y: markerY, lap, rows });
    }, []);

    const handlePointerDown = useCallback(
      (event: ReactPointerEvent<HTMLDivElement>) => {
        event.currentTarget.setPointerCapture(event.pointerId);
        dragRef.current = {
          pointerId: event.pointerId,
          startX: event.clientX,
          startWindow: geometryRef.current.window,
          moved: false,
        };
      },
      []
    );

    const handlePointerMove = useCallback(
      (event: ReactPointerEvent<HTMLDivElement>) => {
        const drag = dragRef.current;
        if (!drag) {
          drawHover(event.clientX, event.clientY);
          return;
        }

        const travel = event.clientX - drag.startX;
        if (!drag.moved && Math.abs(travel) < DRAG_THRESHOLD_PX) return;
        drag.moved = true;

        const size = plotSizeRef.current;
        const geo = geometryRef.current;
        const span = geo.window.end - geo.window.start;
        const lapsPerPixel = size.width > 0 ? span / size.width : 0;
        applyWindow(
          panWindow(drag.startWindow, geo.bounds, -travel * lapsPerPixel)
        );
      },
      [applyWindow, drawHover]
    );

    const handlePointerUp = useCallback(
      (event: ReactPointerEvent<HTMLDivElement>) => {
        const drag = dragRef.current;
        dragRef.current = null;
        if (event.currentTarget.hasPointerCapture(event.pointerId)) {
          event.currentTarget.releasePointerCapture(event.pointerId);
        }
        if (drag?.moved) return;
        const carIdx = hoveredCarIdxRef.current;
        if (carIdx !== null) onTogglePin(carIdx);
      },
      [onTogglePin]
    );

    const handlePointerLeave = useCallback(() => {
      hoveredCarIdxRef.current = null;
      clearOverlay();
    }, [clearOverlay]);

    const handleWheel = useCallback(
      (event: React.WheelEvent<HTMLDivElement>) => {
        const element = plotRef.current;
        const size = plotSizeRef.current;
        const geo = geometryRef.current;
        if (!element || size.width <= 0) return;
        const rect = element.getBoundingClientRect();
        const anchorLap = xToLap(
          event.clientX - rect.left,
          geo.window,
          size.width
        );
        const factor = event.deltaY < 0 ? WHEEL_ZOOM_IN : WHEEL_ZOOM_OUT;
        applyWindow(zoomWindow(geo.window, geo.bounds, factor, anchorLap));
      },
      [applyWindow]
    );

    const handleKeyDown = useCallback(
      (event: ReactKeyboardEvent<HTMLDivElement>) => {
        const geo = geometryRef.current;
        if (event.key === 'ArrowLeft') {
          event.preventDefault();
          applyWindow(stepWindow(geo.window, geo.bounds, -1));
        } else if (event.key === 'ArrowRight') {
          event.preventDefault();
          applyWindow(stepWindow(geo.window, geo.bounds, 1));
        }
      },
      [applyWindow]
    );

    const brushRect = useMemo(
      () => windowToBrush(geometry.window, bounds, 100),
      [geometry.window, bounds]
    );

    const brushDragRef = useRef<{
      pointerId: number;
      startX: number;
      startWindow: LapWindow;
    } | null>(null);

    const handleBrushDown = useCallback(
      (event: ReactPointerEvent<HTMLDivElement>) => {
        const element = brushRef.current;
        if (!element) return;
        event.currentTarget.setPointerCapture(event.pointerId);
        const rect = element.getBoundingClientRect();
        const geo = geometryRef.current;
        const rectPixels = windowToBrush(geo.window, geo.bounds, rect.width);
        const x = event.clientX - rect.left;
        const inside =
          x >= rectPixels.x && x <= rectPixels.x + rectPixels.width;

        const next = inside
          ? geo.window
          : centreWindowOn(
              geo.window,
              geo.bounds,
              brushXToLap(x, geo.bounds, rect.width)
            );
        if (!inside) applyWindow(next);
        brushDragRef.current = {
          pointerId: event.pointerId,
          startX: event.clientX,
          startWindow: next,
        };
      },
      [applyWindow]
    );

    const handleBrushMove = useCallback(
      (event: ReactPointerEvent<HTMLDivElement>) => {
        const drag = brushDragRef.current;
        const element = brushRef.current;
        if (!drag || !element) return;
        const rect = element.getBoundingClientRect();
        const geo = geometryRef.current;
        const total = geo.bounds.maxLap - geo.bounds.minLap;
        const lapsPerPixel = rect.width > 0 ? total / rect.width : 0;
        applyWindow(
          panWindow(
            drag.startWindow,
            geo.bounds,
            (event.clientX - drag.startX) * lapsPerPixel
          )
        );
      },
      [applyWindow]
    );

    const handleBrushUp = useCallback(
      (event: ReactPointerEvent<HTMLDivElement>) => {
        brushDragRef.current = null;
        if (event.currentTarget.hasPointerCapture(event.pointerId)) {
          event.currentTarget.releasePointerCapture(event.pointerId);
        }
      },
      []
    );

    const lapLabels = useMemo(() => {
      const from = Math.ceil(geometry.window.start);
      const to = Math.floor(geometry.window.end);
      return lapAxisLabels(
        from,
        Math.max(from, to),
        lapLabelCapacity(plotSize.width, APPROX_LAP_LABEL_PX)
      );
    }, [geometry.window, plotSize.width]);

    const hasData = geometry.ordered.length > 0;

    return (
      <div className="flex flex-col h-full min-h-0 select-none text-xs">
        <div className="flex items-center justify-between gap-2 pb-1 shrink-0">
          <span className="text-slate-400 truncate">{axisCaption}</span>
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-slate-500 tabular-nums">
              {`Laps ${Math.ceil(geometry.window.start)}-${Math.floor(geometry.window.end)}`}
            </span>
            <button
              type="button"
              aria-pressed={follow}
              onClick={() => setFollow(true)}
              className={[
                'flex items-center gap-1 px-2 py-0.5 rounded font-bold uppercase tracking-wider transition-colors',
                follow
                  ? 'bg-amber-500 text-slate-900'
                  : 'bg-slate-800 text-slate-400 hover:text-slate-200',
              ].join(' ')}
            >
              <Play size={12} weight="fill" />
              Follow live
            </button>
          </div>
        </div>

        <div className="flex-1 min-h-0 flex">
          <div className="w-14 shrink-0 relative">
            {geometry.axis.values.map((value) => (
              <div
                key={value}
                className="absolute right-1.5 -translate-y-1/2 text-slate-400 tabular-nums"
                style={{
                  top: `${valueToY(value, geometry.axis, 100, geometry.inverted)}%`,
                }}
              >
                {formatAxisValue(mode, value)}
              </div>
            ))}
          </div>

          <div
            ref={plotRef}
            tabIndex={0}
            aria-label="Lap graph plot"
            className="relative flex-1 min-h-0 text-slate-400 touch-none cursor-crosshair focus:outline-none focus:ring-1 focus:ring-sky-400 rounded-sm"
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
            onPointerLeave={handlePointerLeave}
            onWheel={handleWheel}
            onKeyDown={handleKeyDown}
          >
            {geometry.axis.values.map((value) => (
              <div
                key={value}
                className="absolute left-0 right-0 border-t border-slate-700/50"
                style={{
                  top: `${valueToY(value, geometry.axis, 100, geometry.inverted)}%`,
                }}
              />
            ))}
            {lapLabels.map((lap) => (
              <div
                key={lap}
                className="absolute top-0 bottom-0 border-l border-slate-800/70"
                style={{ left: `${lapToX(lap, geometry.window, 100)}%` }}
              />
            ))}
            <canvas
              ref={baseCanvasRef}
              data-testid="lap-graph-base"
              className="absolute inset-0 w-full h-full"
            />
            <canvas
              ref={overlayCanvasRef}
              data-testid="lap-graph-overlay"
              className="absolute inset-0 w-full h-full pointer-events-none"
            />
            {!hasData && (
              <div className="absolute inset-0 flex items-center justify-center text-slate-500">
                Waiting for lap data.
              </div>
            )}
            <LapGraphReadout
              handle={readoutRef}
              mode={mode}
              bounds={plotSize}
            />
          </div>
        </div>

        <div className="flex h-5 shrink-0">
          <div className="w-14 shrink-0" />
          <div className="relative flex-1">
            {lapLabels.map((lap) => (
              <div
                key={lap}
                className="absolute -translate-x-1/2 text-slate-400 tabular-nums"
                style={{ left: `${lapToX(lap, geometry.window, 100)}%` }}
              >
                {lap}
              </div>
            ))}
          </div>
        </div>

        <div className="flex h-10 shrink-0 pt-1">
          <div className="w-14 shrink-0 flex items-start justify-end pr-1.5 text-slate-500">
            Race
          </div>
          <div
            ref={brushRef}
            aria-label="Lap window overview"
            className="relative flex-1 rounded-sm bg-slate-900/40 touch-none cursor-ew-resize"
            onPointerDown={handleBrushDown}
            onPointerMove={handleBrushMove}
            onPointerUp={handleBrushUp}
            onPointerCancel={handleBrushUp}
          >
            <canvas
              ref={brushCanvasRef}
              data-testid="lap-graph-brush"
              className="absolute inset-0 w-full h-full"
            />
            <div
              className="absolute inset-y-0 border-x border-sky-400/70 bg-sky-400/10"
              style={{
                left: `${brushRect.x}%`,
                width: `${brushRect.width}%`,
              }}
            />
          </div>
        </div>
      </div>
    );
  }
);
LapGraphCanvas.displayName = 'LapGraphCanvas';
