import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { blipLabel, type RadarBlip } from '../radarBlips';
import { abreastWindowM } from '../overlapSides';
import {
  useRadarMotion,
  type RadarDrawPositions,
  type RadarMotionDraw,
} from '../hooks/useRadarMotion';

export interface RadarDisplayProps {
  blips: readonly RadarBlip[];
  /** Metres from the player to the edge of the view. */
  radarRange: number;
  vehicleWidth: number;
  vehicleLength: number;
  showCarNumbers: boolean;
  /** Every rival blip is filled with this; the player is `colorPlayer`. */
  colorRival: string;
  colorPlayer: string;
  viewMode: 'top' | 'rear';
  rearCameraTilt: number;
  bgOpacity: number;
  sideIndicatorStyle:
    | 'soft-glow'
    | 'double-arc'
    | 'follow-sector'
    | 'distance-pulse'
    | 'trail'
    | 'static-pulse';
  sideIndicatorColor: string;
  sideIndicatorOpacity: number;
  sideIndicatorEnabled: boolean;
  /** Track length in metres; drives blip motion between snapshots. */
  trackLengthM: number;
  showFollowingMap: boolean;
  /** Interleaved along-track and rightward lateral offsets, in metres. */
  followingMapPath: Float64Array;
  followingMapPointCount: number;
  /** Total metres of road shown in the following map. */
  followingMapWindowM: number;
  followingMapBorderColor: string;
  followingMapBorderOpacity: number;
  followingMapFillColor: string;
  followingMapFillOpacity: number;
  /** Original track path, used when the browser supports Path2D. */
  followingMapSvgPath?: string | null;
  followingMapCameraPlayerX?: number;
  followingMapCameraPlayerY?: number;
  followingMapCameraForwardX?: number;
  followingMapCameraForwardY?: number;
  followingMapCameraRightX?: number;
  followingMapCameraRightY?: number;
  followingMapUnitsPerMetre?: number;
  nowSeconds: number;
}

export const PULSE_STEPS_PER_SECOND = 4;

export const pulseAlpha = (seconds: number): number => {
  const phase = (seconds * PULSE_STEPS_PER_SECOND) % 1;
  return (
    Math.round((0.45 + 0.55 * Math.abs(Math.sin(Math.PI * phase))) * 8) / 8
  );
};

interface Size {
  width: number;
  height: number;
}

const SMOOTHING_WEIGHTS = [1, 4, 6, 4, 1] as const;

const rivalColor = (blip: RadarBlip, props: RadarDisplayProps): string =>
  blip.color ?? props.colorRival;

/**
 * A car the driver cannot identify defeats the point of drawing it, so map
 * vehicles keep a body the driver can see and label even at long range.
 */
export const MAP_VEHICLE_MIN_WIDTH_PX = 12;

/** The minimum body width that can still carry a car number or PACE tag. */
export const VEHICLE_LABEL_MIN_WIDTH_PX = 8;

const drawVehicle = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  widthPx: number,
  lengthPx: number,
  rotation: number,
  fill: string,
  alpha: number,
  label: string | null
) => {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(x, y);
  ctx.rotate(rotation);
  ctx.beginPath();
  ctx.roundRect(
    -widthPx / 2,
    -lengthPx / 2,
    widthPx,
    lengthPx,
    Math.min(widthPx, lengthPx) * 0.25
  );
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.lineWidth = 1;
  ctx.strokeStyle = 'rgba(0,0,0,0.45)';
  ctx.stroke();

  if (label && widthPx >= VEHICLE_LABEL_MIN_WIDTH_PX) {
    ctx.fillStyle = 'rgba(0,0,0,0.85)';
    // Four-character PACE needs a smaller face than a two-digit number.
    const wideLabel = label.length > 3;
    const fontPx = wideLabel
      ? Math.max(6, Math.min(widthPx * 0.45, 10))
      : Math.max(7, Math.min(widthPx * 0.7, 11));
    ctx.font = `600 ${Math.round(fontPx)}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, 0, 0);
  }
  ctx.restore();
};

const drawBlipVehicles = (
  ctx: CanvasRenderingContext2D,
  props: RadarDisplayProps,
  centreX: number,
  centreY: number,
  scale: number,
  widthPx: number,
  lengthPx: number,
  alongM: Float64Array,
  lateralM: Float64Array
) => {
  // A car the sim has not placed on a side is painted on the centreline, which
  // is only right while it is ahead of or behind us. Level with the player it
  // would land on the player's own rectangle — the car drives through you. The
  // disc answers that with the two rim arcs and draws no vehicle; the map has no
  // rim, so there the overlap itself is the signal and the car is drawn on top
  // of the player.
  //
  // The body is the fallback for when the rim cannot answer, so an invisible
  // rim has to hand the job back to it. That is why the side-indicator settings
  // reach this far: they choose which of the two signals is in use, not merely
  // whether an arc is stroked.
  const rimAnswersForTheBody =
    !props.showFollowingMap &&
    props.sideIndicatorEnabled &&
    props.sideIndicatorOpacity > 0;
  for (let i = 0; i < props.blips.length; i++) {
    const blip = props.blips[i];
    const levelAndUnknown =
      rimAnswersForTheBody &&
      blip.rimSignal === 'both' &&
      blip.gapM <= abreastWindowM(props.vehicleLength);
    if (!levelAndUnknown) {
      drawVehicle(
        ctx,
        centreX + lateralM[i] * scale,
        centreY - alongM[i] * scale,
        widthPx,
        lengthPx,
        blip.relYaw,
        rivalColor(blip, props),
        1,
        blipLabel(blip, props.showCarNumbers)
      );
    }
  }
};

const drawPlayer = (
  ctx: CanvasRenderingContext2D,
  props: RadarDisplayProps,
  centreX: number,
  centreY: number,
  widthPx: number,
  lengthPx: number
) => {
  drawVehicle(
    ctx,
    centreX,
    centreY,
    widthPx,
    lengthPx,
    0,
    props.colorPlayer,
    1,
    null
  );
};

const drawFollowingRoad = (
  ctx: CanvasRenderingContext2D,
  props: RadarDisplayProps,
  centreX: number,
  centreY: number,
  scale: number,
  widthPx: number,
  trackPath: Path2D | null
) => {
  if (trackPath) {
    const pathScale = scale / (props.followingMapUnitsPerMetre ?? 1);
    const playerX = props.followingMapCameraPlayerX ?? 0;
    const playerY = props.followingMapCameraPlayerY ?? 0;
    const forwardX = props.followingMapCameraForwardX ?? 1;
    const forwardY = props.followingMapCameraForwardY ?? 0;
    const rightX = props.followingMapCameraRightX ?? 0;
    const rightY = props.followingMapCameraRightY ?? 1;
    const playerAlong = playerX * forwardX + playerY * forwardY;
    const playerRight = playerX * rightX + playerY * rightY;
    const roadPx = Math.max(8, widthPx * 1.9);

    ctx.save();
    ctx.transform(
      pathScale * rightX,
      -pathScale * forwardX,
      pathScale * rightY,
      -pathScale * forwardY,
      centreX - playerRight * pathScale,
      centreY + playerAlong * pathScale
    );
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.lineWidth = (roadPx + 4) / pathScale;
    ctx.globalAlpha =
      Math.min(100, Math.max(0, props.followingMapBorderOpacity)) / 100;
    ctx.strokeStyle = props.followingMapBorderColor;
    ctx.stroke(trackPath);
    ctx.lineWidth = roadPx / pathScale;
    ctx.globalAlpha =
      Math.min(100, Math.max(0, props.followingMapFillOpacity)) / 100;
    ctx.strokeStyle = props.followingMapFillColor;
    ctx.stroke(trackPath);
    ctx.restore();
    return;
  }

  const pointCount = Math.min(
    props.followingMapPointCount,
    Math.floor(props.followingMapPath.length / 2)
  );
  if (pointCount < 2) return;

  // The radar only needs a short local road segment. Drawing every one-metre
  // sample magnifies tiny projection noise into a visibly wavy edge, even on
  // a straight. Use a four-metre polyline and let the cubic segments carry
  // the smooth turns between those stable anchor points.
  const ROAD_SAMPLE_STEP = 4;
  const roadPointCount = Math.ceil((pointCount - 1) / ROAD_SAMPLE_STEP) + 1;
  const roadIndex = (index: number) =>
    Math.min(index * ROAD_SAMPLE_STEP, pointCount - 1);
  const pointX = (index: number) =>
    centreX + props.followingMapPath[roadIndex(index) * 2 + 1] * scale;
  const rawPointY = (index: number) =>
    centreY - props.followingMapPath[roadIndex(index) * 2] * scale;
  // The source track polyline is sampled from SVG geometry and can contain
  // one-pixel-scale reversals. They are very visible when a short local
  // segment is magnified to radar size. A binomial B-spline filter removes
  // that sampling noise while retaining the real centreline shape; car
  // positions are not filtered and remain exactly where the radar placed
  // them.
  const smoothPointY = (index: number, pass: number): number => {
    const radius = 2;
    const weight = (offset: number) => SMOOTHING_WEIGHTS[offset + 2];
    let total = 0;
    let weightTotal = 0;
    for (let offset = -radius; offset <= radius; offset += 1) {
      const sample = Math.max(0, Math.min(roadPointCount - 1, index + offset));
      const w = weight(offset);
      total +=
        (pass === 0 ? rawPointY(sample) : smoothPointY(sample, pass - 1)) * w;
      weightTotal += w;
    }
    return total / weightTotal;
  };
  const pointY = (index: number) => smoothPointY(index, 1);
  ctx.beginPath();
  ctx.moveTo(pointX(0), pointY(0));
  for (let point = 0; point < roadPointCount - 1; point += 1) {
    const previous = Math.max(0, point - 1);
    const next = Math.min(roadPointCount - 1, point + 2);
    ctx.bezierCurveTo(
      pointX(point) + (pointX(point + 1) - pointX(previous)) / 6,
      pointY(point) + (pointY(point + 1) - pointY(previous)) / 6,
      pointX(point + 1) - (pointX(next) - pointX(point)) / 6,
      pointY(point + 1) - (pointY(next) - pointY(point)) / 6,
      pointX(point + 1),
      pointY(point + 1)
    );
  }

  // The road has to be wider than the cars driving on it, or a blip reads as
  // an obstacle standing beside a line rather than traffic using the road.
  // The border goes down first so the surface has a configurable edge.
  const roadPx = Math.max(8, widthPx * 1.9);
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.lineWidth = roadPx + 4;
  ctx.globalAlpha =
    Math.min(100, Math.max(0, props.followingMapBorderOpacity)) / 100;
  ctx.strokeStyle = props.followingMapBorderColor;
  ctx.stroke();
  ctx.lineWidth = roadPx;
  ctx.globalAlpha =
    Math.min(100, Math.max(0, props.followingMapFillOpacity)) / 100;
  ctx.strokeStyle = props.followingMapFillColor;
  ctx.stroke();
  ctx.globalAlpha = 1;
};

const drawRimArch = (
  ctx: CanvasRenderingContext2D,
  centreX: number,
  centreY: number,
  radius: number,
  bearing: number,
  color: string,
  alpha: number,
  style: RadarDisplayProps['sideIndicatorStyle']
) => {
  ctx.save();
  const start = -Math.PI / 2 + bearing;
  const drawArc = (arcRadius: number, arcAlpha: number) => {
    ctx.beginPath();
    ctx.arc(centreX, centreY, arcRadius, start - 0.32, start + 0.32);
    ctx.globalAlpha = arcAlpha;
    ctx.stroke();
  };
  ctx.lineWidth = Math.max(2, radius * 0.06);
  ctx.strokeStyle = color;
  ctx.globalAlpha = alpha;
  if (style === 'follow-sector') {
    for (let index = 0; index < 3; index += 1) {
      const segmentStart = start - 0.24 + index * 0.16;
      ctx.beginPath();
      ctx.arc(centreX, centreY, radius - 5, segmentStart, segmentStart + 0.14);
      ctx.globalAlpha = alpha;
      ctx.stroke();
    }
  } else {
    drawArc(radius - 2, alpha);
    drawArc(radius - Math.max(6, radius * 0.12), alpha * 0.75);
  }
  ctx.restore();
};

const RANGE_RING_SPACING_M = 5;

const drawRangeRings = (
  ctx: CanvasRenderingContext2D,
  centreX: number,
  centreY: number,
  scale: number,
  radarRange: number
) => {
  ctx.save();
  ctx.setLineDash([3, 5]);
  ctx.lineWidth = 1;
  ctx.strokeStyle = 'rgba(148, 163, 184, 0.24)';
  for (
    let distanceM = RANGE_RING_SPACING_M;
    distanceM < radarRange;
    distanceM += RANGE_RING_SPACING_M
  ) {
    ctx.beginPath();
    ctx.arc(centreX, centreY, distanceM * scale, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();
};

/**
 * The disc background is a radial gradient that only depends on the centre,
 * the radius and the configured opacity. Building it once per canvas and
 * reusing it keeps a 60 fps repaint allocation-free. A CanvasGradient survives
 * a canvas resize — resizing resets the context state, not the object — so
 * only those three inputs are part of the key.
 */
const backgroundGradients = new WeakMap<
  HTMLCanvasElement,
  { key: string; gradient: CanvasGradient }
>();

const backgroundGradientFor = (
  ctx: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  centreX: number,
  centreY: number,
  radius: number,
  backgroundColor: string
): CanvasGradient => {
  const key = `${centreX}|${centreY}|${radius}|${backgroundColor}`;
  const cached = backgroundGradients.get(canvas);
  if (cached && cached.key === key) return cached.gradient;

  const gradient = ctx.createRadialGradient(
    centreX,
    centreY,
    0,
    centreX,
    centreY,
    radius
  );
  gradient.addColorStop(0, backgroundColor);
  gradient.addColorStop(0.8, backgroundColor);
  gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
  backgroundGradients.set(canvas, { key, gradient });
  return gradient;
};

/** False when there was nothing to draw yet, so callers can tell it apart. */
const drawRadar = (
  canvas: HTMLCanvasElement,
  props: RadarDisplayProps,
  size: Size,
  positions: RadarDrawPositions,
  trackPath: Path2D | null
): boolean => {
  const { alongM, lateralM } = positions;
  const ctx = canvas.getContext('2d');
  if (!ctx || size.width <= 0 || size.height <= 0) return false;

  const dpr = window.devicePixelRatio || 1;
  const backingWidth = Math.max(1, Math.round(size.width * dpr));
  const backingHeight = Math.max(1, Math.round(size.height * dpr));
  if (canvas.width !== backingWidth) canvas.width = backingWidth;
  if (canvas.height !== backingHeight) canvas.height = backingHeight;

  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, size.width, size.height);

  const centreX = size.width / 2;
  const centreY = size.height / 2;
  const radius = Math.max(1, Math.min(size.width, size.height) / 2 - 2);
  // Cars always use the radar scale. The optional map is a separate layer
  // behind them, not a replacement view with a different car coordinate space.
  const scale = radius / Math.max(1, props.radarRange);
  const followingMapScale = radius / Math.max(1, props.followingMapWindowM / 2);
  const trueWidthPx = Math.max(4, props.vehicleWidth * scale);
  const widthPx = props.showFollowingMap
    ? Math.max(trueWidthPx, MAP_VEHICLE_MIN_WIDTH_PX)
    : trueWidthPx;
  const lengthPx = Math.max(6, props.vehicleLength * scale);

  ctx.save();
  ctx.beginPath();
  ctx.arc(centreX, centreY, radius, 0, Math.PI * 2);
  const backgroundAlpha = Math.min(100, Math.max(0, props.bgOpacity)) / 100;
  const backgroundColor = `rgba(0, 0, 0, ${backgroundAlpha})`;
  // Keep the configured opacity through the inner 80% of the disc, then
  // taper it to zero at the rim. This removes the hard-edged circle while
  // preserving the same centre opacity used by the old setting.
  const backgroundGradient = backgroundGradientFor(
    ctx,
    canvas,
    centreX,
    centreY,
    radius,
    backgroundColor
  );
  // Keep the explicit colour assignment for non-canvas test contexts; the
  // gradient is the final value used by the browser.
  ctx.fillStyle = backgroundColor;
  ctx.fillStyle = backgroundGradient;
  ctx.fill();

  // Both views share the same circular boundary, including the following road
  // and every vehicle, so none of their geometry can escape the widget.
  ctx.beginPath();
  ctx.arc(centreX, centreY, radius, 0, Math.PI * 2);
  ctx.clip();
  if (props.viewMode === 'rear') {
    const angle = (props.rearCameraTilt * Math.PI) / 180;
    ctx.translate(centreX, centreY);
    ctx.transform(1, 0, 0, Math.cos(angle), 0, 0);
    ctx.translate(-centreX, -centreY);
  }
  drawRangeRings(ctx, centreX, centreY, scale, props.radarRange);

  if (props.showFollowingMap) {
    drawFollowingRoad(
      ctx,
      props,
      centreX,
      centreY,
      followingMapScale,
      widthPx,
      trackPath
    );
  }

  drawBlipVehicles(
    ctx,
    props,
    centreX,
    centreY,
    scale,
    widthPx,
    lengthPx,
    alongM,
    lateralM
  );
  ctx.restore();
  ctx.save();
  if (props.viewMode === 'rear') {
    const angle = (props.rearCameraTilt * Math.PI) / 180;
    ctx.translate(centreX, centreY);
    ctx.transform(1, 0, 0, Math.cos(angle), 0, 0);
    ctx.translate(-centreX, -centreY);
  }
  drawPlayer(ctx, props, centreX, centreY, widthPx, lengthPx);

  const pulse = pulseAlpha(props.nowSeconds);
  for (let index = 0; index < props.blips.length; index += 1) {
    const blip = props.blips[index];
    const indicatorBearing =
      props.sideIndicatorStyle === 'follow-sector'
        ? Math.atan2(lateralM[index], alongM[index])
        : 0;
    // The follow-sector arch tracks the car's bearing and reads as part of the
    // car, so it is drawn solid; the double arc is a signal in its own right
    // and pulses.
    const indicatorAlpha =
      props.sideIndicatorStyle === 'follow-sector' ? 1 : pulse;
    if (!props.sideIndicatorEnabled) continue;
    if (props.sideIndicatorStyle === 'follow-sector') {
      drawRimArch(
        ctx,
        centreX,
        centreY,
        radius,
        indicatorBearing,
        props.sideIndicatorColor,
        indicatorAlpha * (props.sideIndicatorOpacity / 100),
        props.sideIndicatorStyle
      );
    } else {
      if (blip.rimSignal === 'left' || blip.rimSignal === 'both') {
        drawRimArch(
          ctx,
          centreX,
          centreY,
          radius,
          -Math.PI / 2,
          props.sideIndicatorColor,
          indicatorAlpha * (props.sideIndicatorOpacity / 100),
          props.sideIndicatorStyle
        );
      }
      if (blip.rimSignal === 'right' || blip.rimSignal === 'both') {
        drawRimArch(
          ctx,
          centreX,
          centreY,
          radius,
          Math.PI / 2,
          props.sideIndicatorColor,
          indicatorAlpha * (props.sideIndicatorOpacity / 100),
          props.sideIndicatorStyle
        );
      }
    }
  }
  ctx.restore();
  return true;
};

/**
 * Every prop that changes how the same blips are drawn, joined. The blips
 * themselves are compared by reference, so this covers only the settings around
 * them. Adding a drawing-affecting prop without adding it here shows up as a
 * canvas that keeps the old appearance until the next snapshot.
 *
 * The type is the prop list minus the blips and the clock, so a new prop is a
 * compile error here rather than a setting that silently stops repainting.
 */
const DRAWING_PROPS = [
  'radarRange',
  'vehicleWidth',
  'vehicleLength',
  'showCarNumbers',
  'colorRival',
  'colorPlayer',
  'viewMode',
  'rearCameraTilt',
  'bgOpacity',
  'sideIndicatorStyle',
  'sideIndicatorColor',
  'sideIndicatorOpacity',
  'sideIndicatorEnabled',
  'showFollowingMap',
  'followingMapBorderColor',
  'followingMapBorderOpacity',
  'followingMapFillColor',
  'followingMapFillOpacity',
  'followingMapSvgPath',
  'followingMapWindowM',
  'followingMapPointCount',
  'followingMapUnitsPerMetre',
  'followingMapCameraPlayerX',
  'followingMapCameraPlayerY',
  'followingMapCameraForwardX',
  'followingMapCameraForwardY',
  'followingMapCameraRightX',
  'followingMapCameraRightY',
  'followingMapPath',
] as const satisfies readonly (keyof RadarDisplayProps)[];

/**
 * Props the repaint key deliberately leaves out, each with its reason. This is a
 * type-level list, so it is read through `keyof` rather than at runtime.
 */
type NotDrawingProp = 'blips' | 'nowSeconds' | 'trackLengthM';

/**
 * A prop that is neither listed as drawing nor excluded is a compile error: the
 * const is typed as `never` in that case, and a value of type `never` does not
 * assign. Deleting the assertion makes the check stop working, so it stays.
 *
 * blips is excluded because a new array is the snapshot itself, compared by
 * reference. nowSeconds is read at paint time and is never a repaint reason.
 * trackLengthM is excluded because only the motion loop uses it, to turn metres
 * into lap fractions: by the time anything is drawn the buffers are metres
 * again, so a new track length arrives as new blip positions and repaints with
 * them.
 */
type UnaccountedProp = Exclude<
  keyof RadarDisplayProps,
  (typeof DRAWING_PROPS)[number] | NotDrawingProp
>;
const everyPropIsAccountedFor: UnaccountedProp extends never
  ? Record<never, never>
  : { [K in UnaccountedProp]: K } = {};
void everyPropIsAccountedFor;

const settingsKey = (props: Omit<RadarDisplayProps, 'nowSeconds'>): string =>
  DRAWING_PROPS.map((prop) => `${prop}=${String(props[prop])}`).join('|');

export const RadarDisplay = (props: Omit<RadarDisplayProps, 'nowSeconds'>) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [size, setSize] = useState<Size>({ width: 0, height: 0 });

  const propsRef = useRef<RadarDisplayProps>({ ...props, nowSeconds: 0 });
  propsRef.current = {
    ...props,
    nowSeconds: propsRef.current.nowSeconds,
  };
  const sizeRef = useRef(size);
  sizeRef.current = size;

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = canvas?.parentElement ?? canvas;
    if (!container) return;
    const observer = new ResizeObserver((entries) => {
      const rect = entries[0]?.contentRect;
      if (!rect) return;
      const next = {
        width: Math.round(rect.width),
        height: Math.round(rect.height),
      };
      // ResizeObserver reports layout passes, not size changes: without this
      // bail-out every layout pass would cost a render and a canvas redraw.
      setSize((current) =>
        current.width === next.width && current.height === next.height
          ? current
          : next
      );
    });
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  // The draw callback reads the latest props and size through refs, so the
  // RAF loop useRadarMotion starts is never restarted by a re-render. The
  // last drawn metre buffers are kept: they grow with the field and are
  // never freed, so a commit that itself repaints — a resize, a theme change —
  // can redraw what the interpolator last produced.
  const alongRef = useRef(new Float64Array(0));
  const lateralRef = useRef(new Float64Array(0));
  const trackPath = useMemo(() => {
    if (!props.followingMapSvgPath || typeof Path2D === 'undefined')
      return null;
    return new Path2D(props.followingMapSvgPath);
  }, [props.followingMapSvgPath]);
  const trackPathRef = useRef(trackPath);
  trackPathRef.current = trackPath;

  const drawRef = useRef<RadarMotionDraw>(() => undefined);
  // Repaints the motion loop will not make on its own. It repaints on every new
  // blip array, so these are the changes it cannot see: a resize, and any
  // settings change that alters how the same blips are drawn.
  //
  // A snapshot is deliberately excluded. useRadarMotion's layout effect runs
  // first — it is declared first — and has already painted this exact blip
  // array, so repainting here would draw the same buffers twice per snapshot.
  const paintedRef = useRef<{
    blips: readonly RadarBlip[];
    width: number;
    height: number;
    settings: string;
  } | null>(null);
  const drawLatest = (blips: readonly RadarBlip[]) => {
    const canvas = canvasRef.current;
    if (!canvas || alongRef.current.length < blips.length) return;
    propsRef.current.nowSeconds = performance.now() / 1000;
    // Only a paint that reached the canvas counts, or the first commit — which
    // has no size yet — would mark the snapshot as done and leave it unpainted
    // until the next one.
    if (
      drawRadar(
        canvas,
        propsRef.current,
        sizeRef.current,
        {
          alongM: alongRef.current,
          lateralM: lateralRef.current,
          count: blips.length,
        },
        trackPathRef.current
      )
    ) {
      paintedRef.current = {
        blips,
        width: sizeRef.current.width,
        height: sizeRef.current.height,
        settings: settingsKey(propsRef.current),
      };
    }
  };
  drawRef.current = ({ alongM, lateralM, count }) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    if (alongRef.current.length < count) {
      alongRef.current = new Float64Array(count);
      lateralRef.current = new Float64Array(count);
    }
    alongRef.current.set(alongM.subarray(0, count));
    lateralRef.current.set(lateralM.subarray(0, count));
    drawLatest(propsRef.current.blips);
  };

  const pulseActive =
    props.sideIndicatorEnabled &&
    props.sideIndicatorStyle !== 'follow-sector' &&
    props.blips.some((blip) => blip.rimSignal !== null);
  useRadarMotion(
    props.blips,
    props.trackLengthM,
    (positions) => drawRef.current(positions),
    pulseActive
  );

  useLayoutEffect(() => {
    const painted = paintedRef.current;
    // Before the first commit there is no frame in the buffers to redraw.
    if (
      painted !== null &&
      painted.blips === props.blips &&
      painted.width === size.width &&
      painted.height === size.height &&
      painted.settings === settingsKey(props)
    ) {
      return;
    }
    drawLatest(props.blips);
  });

  return <canvas ref={canvasRef} className="h-full w-full" />;
};
