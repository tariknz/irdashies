import { memo, useMemo, useRef, type ReactNode, type RefObject } from 'react';
import type { LapTraceColors } from '@irdashies/types';
import { carXForWindow } from '@irdashies/domain/lapTrace/lapTraceWindow';
import { REFERENCE_SPAN_SLOTS } from '@irdashies/domain/lapTrace/lapTraceTiles';
import { VIEW_HEIGHT, VIEW_WIDTH, yForNorm } from './layout';
import {
  useLapTraceFrame,
  type LapTraceFrameRefs,
} from './hooks/useLapTraceFrame';

/*
 * All trace/marker/grid colours are user-configurable and arrive via the
 * `colors` prop (defaults in DEFAULT_LAP_TRACE_COLORS). Reference traces read
 * pastel/washed as a background target; the ghost (live) lap reads bright; the
 * fills take a saturated weight so a filled area still says which pedal it is.
 */

const GRID_TICKS = [0, 0.25, 0.5, 0.75, 1];

/**
 * A span of the reference lap: sized, filled and slid by the frame loop. Its
 * own composited layer, so sliding it moves pixels already rasterised instead
 * of repainting them.
 */
const SPAN_CLASS =
  'absolute left-0 top-0 h-full overflow-hidden will-change-transform';

/**
 * A reference layer: one copy of `children` per span slot, each registering
 * itself in `slotsRef` at its index for the frame loop to find.
 */
const SpanLayer = ({
  slotsRef,
  layer,
  children,
}: {
  slotsRef: RefObject<(SVGSVGElement | null)[]>;
  layer: string;
  children: ReactNode;
}) => (
  <>
    {Array.from({ length: REFERENCE_SPAN_SLOTS }, (_, i) => (
      <svg
        key={i}
        ref={(el) => {
          slotsRef.current[i] = el;
        }}
        data-layer={layer}
        className={SPAN_CLASS}
        preserveAspectRatio="none"
      >
        {children}
      </svg>
    ))}
  </>
);

/**
 * A layer of the driver's lap, drawn in window coordinates and rebuilt as it
 * is driven. The whole plot, like the grid beneath it.
 */
const WindowLayer = ({
  layerRef,
  layer,
  children,
}: {
  layerRef: RefObject<SVGSVGElement | null>;
  layer: string;
  children: ReactNode;
}) => (
  <svg
    ref={layerRef}
    data-layer={layer}
    className="absolute inset-0 h-full w-full"
    viewBox={`0 0 ${VIEW_WIDTH} ${VIEW_HEIGHT}`}
    preserveAspectRatio="none"
  >
    {children}
  </svg>
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
 * The trace itself. React renders the frame once — the static grid and car
 * line, and empty layers — and the frame loop fills and slides them, so this
 * component does not re-render at telemetry rate.
 *
 * Layers stack in paint order: grid, reference, the driver's lap, the ABS
 * fill (blended over everything beneath it), the ABS line and strip, the
 * reference pedal markers, and the car line on top. Nothing here makes the
 * plot a stacking context of its own, so the blend reaches the widget's
 * background too, as it did when every layer was one SVG.
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
    const referenceSpans = useRef<(SVGSVGElement | null)[]>([]);
    const markerSpans = useRef<(SVGSVGElement | null)[]>([]);
    const gearLabelSpans = useRef<(HTMLDivElement | null)[]>([]);
    const ghost = useRef<SVGSVGElement>(null);
    const absArea = useRef<SVGSVGElement>(null);
    const ghostOverlay = useRef<SVGSVGElement>(null);

    const refs = useMemo<LapTraceFrameRefs>(
      () => ({
        referenceSpans,
        markerSpans,
        gearLabelSpans,
        ghost,
        absArea,
        ghostOverlay,
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

    const showAbsLine = showBrake && showAbs;
    const showAbsArea = showAbsLine && absStyle === 'bar';
    const showMarkers = showBrakePointMarkers || showThrottlePointMarkers;

    // Three stacked rows: the trace takes whatever height is left, then the
    // gear labels and the distance axis each hold a fixed strip beneath it.
    // Keeping them as rows rather than overlays is what stops the labels
    // drifting into the trace when the widget is made short.
    return (
      <div className="flex h-full min-h-0 flex-col overflow-hidden">
        <div className="relative min-h-0 flex-1 overflow-hidden">
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
          </svg>

          {/* Reference (the saved lap) is pastel and drawn first, as the
              washed-out background target the ghost is read against. */}
          <SpanLayer slotsRef={referenceSpans} layer="reference">
            <g strokeOpacity={ghostOpacity}>
              {showSpeed && (
                <path
                  data-trace="speed"
                  fill="none"
                  stroke={colors.referenceSpeed}
                  strokeWidth={Math.max(1, strokeWidth - 1)}
                />
              )}
              {showThrottle && (
                <path
                  data-trace="throttle"
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
                  data-trace="brake"
                  fill={referenceFilled ? colors.referenceBrakeFill : 'none'}
                  fillOpacity={
                    referenceFilled ? 0.35 * ghostOpacity : undefined
                  }
                  stroke={colors.referenceBrake}
                  strokeWidth={strokeWidth}
                />
              )}
            </g>
          </SpanLayer>

          {/* Ghost (the lap currently being driven) draws over the
              reference, bright and solid — it is the input the driver is
              actually watching, not a faint background layer. */}
          {showGhost && (
            <WindowLayer layerRef={ghost} layer="ghost">
              <g strokeOpacity={driverOpacity}>
                {showSpeed && (
                  <path
                    data-trace="speed"
                    fill="none"
                    stroke={colors.ghostSpeed}
                    strokeWidth={Math.max(1, strokeWidth - 1)}
                  />
                )}
                {showThrottle && (
                  <path
                    data-trace="throttle"
                    fill="none"
                    stroke={colors.ghostThrottle}
                    strokeWidth={strokeWidth}
                  />
                )}
                {showBrake && (
                  <path
                    data-trace="brake"
                    fill="none"
                    stroke={colors.ghostBrake}
                    strokeWidth={strokeWidth}
                  />
                )}
              </g>
            </WindowLayer>
          )}

          {/* The 'bar' style: brake value down to the axis, wherever ABS
              engaged — same shape the Input Trace widget's ABS bar uses. A
              layer of its own so it can be blended rather than plain alpha,
              visibly mixing with a filled reference trace underneath instead
              of just covering it up; the frame loop sets the blend only
              while there is ABS to draw. */}
          {showGhost && showAbsArea && (
            <WindowLayer layerRef={absArea} layer="abs-area">
              <path
                data-trace="abs-area"
                fill={colors.absFill}
                fillOpacity={0.55 * driverOpacity}
                stroke="none"
              />
            </WindowLayer>
          )}

          {/* Over the fill, so the ABS runs sit on top of the stretch of
              brake they belong to. */}
          {showGhost && (showAbsLine || showAbsBar) && (
            <WindowLayer layerRef={ghostOverlay} layer="ghost-overlay">
              {showAbsLine && (
                <g strokeOpacity={driverOpacity}>
                  <path
                    data-trace="brake-abs"
                    fill="none"
                    stroke={colors.abs}
                    strokeWidth={strokeWidth}
                  />
                </g>
              )}
              {showAbsBar && (
                <path
                  data-trace="abs-bar"
                  fill="none"
                  stroke={colors.abs}
                  strokeWidth={4}
                  strokeLinecap="butt"
                  strokeOpacity={driverOpacity}
                />
              )}
            </WindowLayer>
          )}

          {/* Pedal application points, interpolated between the two
              telemetry samples that straddle the threshold, so these sit at
              the real sub-metre position. Dotted and through the full height
              of the trace band: a dotted line reads as a position marker
              without a solid stroke competing with the curves it crosses.
              Brake and throttle are independent toggles: a driver working
              purely on braking, say, has no use for the throttle marker
              cluttering the plot too. Only the reference lap's brake
              application is marked — not its release, nor the driver's own
              live brake points. */}
          {showMarkers && (
            <SpanLayer slotsRef={markerSpans} layer="markers">
              {showBrakePointMarkers && (
                <path
                  data-trace="brake-markers"
                  fill="none"
                  stroke={colors.brakeMarker}
                  strokeOpacity={0.9 * ghostOpacity}
                  strokeWidth={2}
                  strokeLinecap="butt"
                  strokeDasharray="4,3"
                />
              )}
              {showThrottlePointMarkers && (
                <path
                  data-trace="throttle-markers"
                  fill="none"
                  stroke={colors.throttleMarker}
                  strokeOpacity={0.9 * ghostOpacity}
                  strokeWidth={2}
                  strokeLinecap="butt"
                  strokeDasharray="4,3"
                />
              )}
            </SpanLayer>
          )}

          {/* The car sits wherever the ahead/behind split puts it — the
              midpoint only when the two are equal. */}
          <svg
            className="absolute inset-0 h-full w-full"
            viewBox={`0 0 ${VIEW_WIDTH} ${VIEW_HEIGHT}`}
            preserveAspectRatio="none"
          >
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
            inside it. They are laid out in spans like the reference they
            label, so they slide with it, and their strip is a row of its own beneath the
            trace, the same width, so they stay under the graph however short
            the widget gets. */}
        {showGearLabels && (
          <div
            data-testid="gear-labels"
            className="relative h-3 flex-none pointer-events-none"
          >
            {Array.from({ length: REFERENCE_SPAN_SLOTS }, (_, i) => (
              <div
                key={i}
                ref={(el) => {
                  gearLabelSpans.current[i] = el;
                }}
                className="absolute left-0 top-0 h-full will-change-transform"
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
