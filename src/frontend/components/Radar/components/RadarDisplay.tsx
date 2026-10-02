import { memo, useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { TrackGeometry } from '@irdashies/domain/track';
import {
  drawRadar,
  type RadarDrawCar,
  type RadarDrawFollow,
  type RadarStyle,
} from '../radarDraw';

export interface RadarFrameCar {
  carIdx: number;
  dist: number;
  closingSpeed: number;
  lane: number;
  offTrack: boolean;
}

/** One snapshot's worth of positions; extrapolated until the next arrives. */
export interface RadarFrame {
  playerPct: number;
  playerSpeed: number;
  trackLength: number;
  cars: readonly RadarFrameCar[];
  /** The car to line up behind while pacing, if any. */
  follow?: { carIdx: number; dist: number; isPaceCar: boolean } | null;
}

export interface RadarCarAppearance {
  fill: string;
  textColor: string;
  label: string;
  /** Body size in metres. */
  length: number;
  width: number;
}

export interface RadarDisplayProps {
  frame: RadarFrame;
  appearance: ReadonlyMap<number, RadarCarAppearance>;
  geometry: TrackGeometry | null;
  style: RadarStyle;
  /** Paused while the widget is hidden, so a hidden radar costs nothing. */
  active?: boolean;
}

/** Snapshots arrive at 25 Hz; never extrapolate further than a few missed. */
const MAX_EXTRAPOLATION_S = 0.15;
/** Gap between lane centres beyond the car's own width, in metres. */
const LANE_GAP_M = 0.7;

const FALLBACK_APPEARANCE: RadarCarAppearance = {
  fill: '#94a3b8',
  textColor: '#0f172a',
  label: '',
  length: 4.5,
  width: 1.9,
};

export const RadarDisplay = memo(
  ({
    frame,
    appearance,
    geometry,
    style,
    active = true,
  }: RadarDisplayProps) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [size, setSize] = useState(0);

    const latest = useRef({ frame, appearance, geometry, style, at: 0 });
    useLayoutEffect(() => {
      latest.current = {
        frame,
        appearance,
        geometry,
        style,
        at: performance.now(),
      };
    }, [frame, appearance, geometry, style]);

    useLayoutEffect(() => {
      const container = containerRef.current;
      if (!container) return;
      const observer = new ResizeObserver(([entry]) => {
        const { width, height } = entry.contentRect;
        setSize(Math.floor(Math.min(width, height)));
      });
      observer.observe(container);
      return () => observer.disconnect();
    }, []);

    useEffect(() => {
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext('2d');
      if (!canvas || !ctx || size <= 0) return;
      const ratio = window.devicePixelRatio || 1;
      canvas.width = Math.round(size * ratio);
      canvas.height = Math.round(size * ratio);

      const cars: RadarDrawCar[] = [];
      const follow: RadarDrawFollow = { carIdx: null, dist: 0, label: '' };
      let handle = 0;
      const paint = () => {
        const current = latest.current;
        const { frame: snap, style: look } = current;
        const elapsed = Math.min(
          Math.max((performance.now() - current.at) / 1000, 0),
          MAX_EXTRAPOLATION_S
        );
        const laneWidth = look.carWidth + LANE_GAP_M;
        cars.length = snap.cars.length;
        for (let index = 0; index < snap.cars.length; index += 1) {
          const car = snap.cars[index];
          const looks =
            current.appearance.get(car.carIdx) ?? FALLBACK_APPEARANCE;
          const target = cars[index] ?? ({} as RadarDrawCar);
          target.carIdx = car.carIdx;
          target.dist = car.dist + car.closingSpeed * elapsed;
          target.lateral = -car.lane * laneWidth;
          target.offTrack = car.offTrack;
          target.fill = looks.fill;
          target.textColor = looks.textColor;
          target.label = looks.label;
          target.length = looks.length;
          target.width = looks.width;
          cars[index] = target;
        }
        let followTarget: RadarDrawFollow | null = null;
        if (snap.follow) {
          const { carIdx, dist, isPaceCar } = snap.follow;
          const tracked = isPaceCar
            ? undefined
            : cars.find((car) => car.carIdx === carIdx);
          follow.carIdx = isPaceCar ? null : carIdx;
          follow.dist = tracked ? tracked.dist : dist;
          follow.label = isPaceCar
            ? 'PACE'
            : current.appearance.get(carIdx)?.label
              ? `#${current.appearance.get(carIdx)?.label}`
              : '';
          followTarget = follow;
        }
        const playerPct =
          snap.trackLength > 0
            ? snap.playerPct + (snap.playerSpeed * elapsed) / snap.trackLength
            : snap.playerPct;

        ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
        drawRadar(ctx, {
          size,
          geometry: current.geometry,
          trackLength: snap.trackLength,
          playerPct,
          cars,
          follow: followTarget,
          style: look,
          time: performance.now() / 1000,
        });
        if (active) handle = requestAnimationFrame(paint);
      };
      paint();
      return () => cancelAnimationFrame(handle);
    }, [size, active]);

    return (
      <div
        ref={containerRef}
        className="w-full h-full flex items-center justify-center"
      >
        <canvas ref={canvasRef} style={{ width: size, height: size }} />
      </div>
    );
  }
);
RadarDisplay.displayName = 'RadarDisplay';
