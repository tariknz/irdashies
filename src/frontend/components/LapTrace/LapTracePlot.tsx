import { memo, useMemo, useRef, type RefObject } from 'react';
import type { LapTraceColors } from '@irdashies/types';
import { carXForWindow } from '../../domain/lapTrace/lapTraceWindow';
import {
  MAX_GEAR_LABELS,
  MAX_MARKERS,
  PLOT_BOTTOM,
  PLOT_TOP,
  VIEW_HEIGHT,
  VIEW_WIDTH,
  yForNorm,
} from './layout';
import {
  useLapTraceFrame,
  type LapTraceFrameRefs,
} from './hooks/useLapTraceFrame';

/**
 * All trace/marker/grid colours are user-configurable and arrive via the
 * `colors` prop (defaults in DEFAULT_LAP_TRACE_COLORS). Reference traces read
 * pastel/washed as a background target; the ghost (live) lap reads bright; the
 * fills take a saturated weight so a filled area still says which pedal it is.
 *
 * 'screen' blend mode so the ABS fill lightens/mixes with whatever's beneath
 * it — a filled reference throttle or brake bar it overlaps — instead of just
 * occluding it, so both "ABS was on" and "the reference had the pedal down
 * here" stay readable at once. Against the plot's dark background alone
 * (nothing to mix with) it reads as the plain ABS colour, same as normal alpha
 * blending would.
 */
const ABS_BLEND_MODE = 'screen' as const;

const GRID_TICKS = [0, 0.25, 0.5, 0.75, 1];

/**
 * A fixed pool of vertical marker lines. Rendered once by React and positioned
 * each frame by setting x1/x2, so no node is created in the draw loop.
 *
 * Dotted and run the full height of the trace band, rather than solid and
 * confined to a strip beneath it: a dotted line reads as a position marker
 * without a solid stroke competing with the throttle/brake/speed curves it
 * crosses, and running the full height makes it easy to read off exactly
 * where each curve sits at that point.
 */
const MarkerPool = ({
  poolRef,
  stroke,
  opacity,
}: {
  poolRef: RefObject<(SVGLineElement | null)[]>;
  stroke: string;
  opacity: number;
}) => (
  <>
    {Array.from({ length: MAX_MARKERS }, (_, i) => (
      <line
        key={i}
        ref={(el) => {
          poolRef.current[i] = el;
        }}
        x1={0}
        x2={0}
        y1={PLOT_TOP}
        y2={PLOT_BOTTOM}
        stroke={stroke}
        strokeOpacity={opacity}
        strokeWidth={2}
        strokeLinecap="butt"
        strokeDasharray="4,3"
        style={{ visibility: 'hidden' }}
      />
    ))}
  </>
);

export interface LapTracePlotProps {
  /** Metres of track visible behind the car. */
  metersBehind: number;
  /** Metres of track visible ahead of the car. */
  metersAhead: number;
  showThrottle: boolean;
  showBrake: boolean;
  showSpeed: boolean;
  showGhost: boolean;
  showGearLabels: boolean;
  /** Dotted line at the reference's (and, while driving, your own) brake application/release points. */
  showBrakePointMarkers: boolean;
  /** Dotted line at the reference's throttle application point. */
  showThrottlePointMarkers: boolean;
  /** Highlight the driver's brake trace where ABS engaged. */
  showAbs?: boolean;
  /**
   * 'bar' also fills the area under the brake curve down to the axis where
   * ABS engaged (the Input Trace widget's ABS style); 'overlay' keeps just
   * the coloured line.
   */
  absStyle?: 'overlay' | 'bar';
  /** Also mark ABS activity as a strip beneath the traces. */
  showAbsBar?: boolean;
  ghostOpacity: number;
  driverOpacity?: number;
  /** Fill the reference throttle/brake traces as bars down to the axis. */
  referenceFilled: boolean;
  strokeWidth: number;
  /** Color of the vertical line marking the car's current position. */
  carLineColor?: string;
  /** User-configurable trace/marker/grid colours. */
  colors: LapTraceColors;
  /** Story/testing hook: pin the car to a fixed distance along the lap. */
  carDistanceMOverride?: number;
}

/**
 * The trace itself. React renders the static frame once; the paths and gear
 * labels are updated imperatively from a rAF loop, so this component does not
 * re-render at telemetry rate.
 */
export const LapTracePlot = memo(
  ({
    metersBehind,
    metersAhead,
    showThrottle,
    showBrake,
    showSpeed,
    showGhost,
    showGearLabels,
    showBrakePointMarkers,
    showThrottlePointMarkers,
    showAbs = true,
    absStyle = 'overlay',
    showAbsBar = false,
    ghostOpacity,
    driverOpacity = 1,
    referenceFilled,
    carLineColor = '#ffffff',
    colors,
    strokeWidth,
    carDistanceMOverride,
  }: LapTracePlotProps) => {
    const refThrottle = useRef<SVGPathElement>(null);
    const refBrake = useRef<SVGPathElement>(null);
    const refSpeed = useRef<SVGPathElement>(null);
    const ghostThrottle = useRef<SVGPathElement>(null);
    const ghostBrake = useRef<SVGPathElement>(null);
    const ghostSpeed = useRef<SVGPathElement>(null);
    const ghostBrakeAbs = useRef<SVGPathElement>(null);
    const ghostAbsArea = useRef<SVGPathElement>(null);
    const absBar = useRef<SVGPathElement>(null);
    const gearLabels = useRef<(HTMLSpanElement | null)[]>([]);
    const plotContainer = useRef<HTMLDivElement>(null);
    const markerRefBrakeOn = useRef<(SVGLineElement | null)[]>([]);
    const markerRefThrottleOn = useRef<(SVGLineElement | null)[]>([]);

    const refs = useMemo<LapTraceFrameRefs>(
      () => ({
        refThrottle,
        refBrake,
        refSpeed,
        ghostThrottle,
        ghostBrake,
        ghostSpeed,
        ghostBrakeAbs,
        ghostAbsArea,
        absBar,
        gearLabels,
        plotContainer,
        markerRefBrakeOn,
        markerRefThrottleOn,
      }),
      []
    );

    useLapTraceFrame(refs, {
      metersBehind,
      metersAhead,
      showThrottle,
      showBrake,
      showSpeed,
      showGhost,
      showGearLabels,
      showBrakePointMarkers,
      showThrottlePointMarkers,
      showAbs,
      absStyle,
      showAbsBar,
      referenceFilled,
      carDistanceMOverride,
    });

    const gridlines = useMemo(
      () => GRID_TICKS.map((tick) => ({ tick, y: yForNorm(tick) })),
      []
    );

    const carX = useMemo(
      () => carXForWindow(metersBehind, metersAhead),
      [metersBehind, metersAhead]
    );

    // Three stacked rows: the trace takes whatever height is left, then the
    // gear labels and the distance axis each hold a fixed strip beneath it.
    // Keeping them as rows rather than overlays is what stops the labels
    // drifting into the trace when the widget is made short.
    return (
      <div className="flex h-full min-h-0 flex-col overflow-hidden">
        <div
          ref={plotContainer}
          className="relative min-h-0 flex-1 overflow-hidden"
        >
          <svg
            className="absolute inset-0 h-full w-full"
            viewBox={`0 0 ${VIEW_WIDTH} ${VIEW_HEIGHT}`}
            preserveAspectRatio="none"
          >
            {gridlines.map(({ tick, y }) => (
              <line
                key={tick}
                x1={0}
                x2={VIEW_WIDTH}
                y1={y}
                y2={y}
                stroke={colors.grid}
                strokeWidth={1}
                strokeDasharray="3,3"
              />
            ))}

            {/* Reference (the saved lap) is pastel and drawn first, as the
                washed-out background target the ghost is read against. */}
            <g strokeOpacity={ghostOpacity}>
              {showSpeed && (
                <path
                  ref={refSpeed}
                  fill="none"
                  stroke={colors.referenceSpeed}
                  strokeWidth={Math.max(1, strokeWidth - 1)}
                />
              )}
              {showThrottle && (
                <path
                  ref={refThrottle}
                  fill={referenceFilled ? colors.referenceThrottleFill : 'none'}
                  fillOpacity={
                    referenceFilled ? 0.35 * ghostOpacity : undefined
                  }
                  stroke={colors.referenceThrottle}
                  strokeWidth={strokeWidth}
                />
              )}
              {showBrake && (
                <path
                  ref={refBrake}
                  fill={referenceFilled ? colors.referenceBrakeFill : 'none'}
                  fillOpacity={
                    referenceFilled ? 0.35 * ghostOpacity : undefined
                  }
                  stroke={colors.referenceBrake}
                  strokeWidth={strokeWidth}
                />
              )}
            </g>

            {/* Ghost (the lap currently being driven) draws over the
                reference, bright and solid — it is the input the driver is
                actually watching, not a faint background layer. */}
            {showGhost && (
              <g strokeOpacity={driverOpacity}>
                {showSpeed && (
                  <path
                    ref={ghostSpeed}
                    fill="none"
                    stroke={colors.ghostSpeed}
                    strokeWidth={Math.max(1, strokeWidth - 1)}
                  />
                )}
                {showThrottle && (
                  <path
                    ref={ghostThrottle}
                    fill="none"
                    stroke={colors.ghostThrottle}
                    strokeWidth={strokeWidth}
                  />
                )}
                {showBrake && (
                  <path
                    ref={ghostBrake}
                    fill="none"
                    stroke={colors.ghostBrake}
                    strokeWidth={strokeWidth}
                  />
                )}
                {/* The 'bar' style: brake value down to the axis, wherever
                    ABS engaged — same shape the Input Trace widget's ABS bar
                    uses. Blended rather than plain alpha so it visibly mixes
                    with a filled reference trace underneath it instead of
                    just covering it up. */}
                {showBrake && showAbs && absStyle === 'bar' && (
                  <path
                    ref={ghostAbsArea}
                    fill={colors.absFill}
                    fillOpacity={0.55 * driverOpacity}
                    stroke="none"
                    style={{ mixBlendMode: ABS_BLEND_MODE }}
                  />
                )}
                {/* Drawn after the brake trace so the ABS runs sit on top of
                    the stretch of brake they belong to. */}
                {showBrake && showAbs && (
                  <path
                    ref={ghostBrakeAbs}
                    fill="none"
                    stroke={colors.abs}
                    strokeWidth={strokeWidth}
                  />
                )}
              </g>
            )}

            {showGhost && showAbsBar && (
              <path
                ref={absBar}
                fill="none"
                stroke={colors.abs}
                strokeWidth={4}
                strokeLinecap="butt"
                strokeOpacity={driverOpacity}
              />
            )}

            {/* Pedal application points, interpolated between the two
                telemetry samples that straddle the threshold, so these sit
                at the real sub-metre position. Brake and throttle are
                independent toggles: a driver working purely on braking, say,
                doesn't need the throttle marker cluttering the plot too.
                Only the reference lap's brake *application* is marked — not its
                release, nor the driver's own live brake points. */}
            {showBrakePointMarkers && (
              <MarkerPool
                poolRef={markerRefBrakeOn}
                stroke={colors.brakeMarker}
                opacity={0.9 * ghostOpacity}
              />
            )}
            {showThrottlePointMarkers && (
              <MarkerPool
                poolRef={markerRefThrottleOn}
                stroke={colors.throttleMarker}
                opacity={0.9 * ghostOpacity}
              />
            )}

            {/* The car sits wherever the ahead/behind split puts it — the
                midpoint only when the two are equal. */}
            <line
              x1={carX}
              x2={carX}
              y1={0}
              y2={VIEW_HEIGHT}
              stroke={carLineColor}
              strokeWidth={2}
            />
          </svg>
        </div>

        {/* Gear labels live in HTML, not the SVG: preserveAspectRatio="none"
            stretches the viewBox non-uniformly and would distort any text
            inside it. The pool is rendered once and positioned each frame.
            Their strip is a row of its own beneath the trace, the same width,
            so they stay under the graph however short the widget gets. */}
        {showGearLabels && (
          <div
            data-testid="gear-labels"
            className="relative h-3 flex-none pointer-events-none"
          >
            {Array.from({ length: MAX_GEAR_LABELS }, (_, i) => (
              <span
                key={i}
                ref={(el) => {
                  gearLabels.current[i] = el;
                }}
                className="absolute left-0 bottom-0 text-[10px] leading-none font-semibold text-slate-300 tabular-nums"
                style={{ visibility: 'hidden' }}
              />
            ))}
          </div>
        )}

        {/* "0" sits above the car marker, which is only centred when
            metersBehind equals metersAhead — not fixed at the midpoint. */}
        <div className="flex-none relative h-3 text-[10px] leading-none text-slate-500 tabular-nums px-0.5 pt-0.5">
          <span className="absolute left-0.5">
            -{Math.round(metersBehind)}m
          </span>
          <span
            className="absolute -translate-x-1/2"
            style={{ left: `${(carX / VIEW_WIDTH) * 100}%` }}
          >
            0
          </span>
          <span className="absolute right-0.5">
            +{Math.round(metersAhead)}m
          </span>
        </div>
      </div>
    );
  }
);

LapTracePlot.displayName = 'LapTracePlot';
