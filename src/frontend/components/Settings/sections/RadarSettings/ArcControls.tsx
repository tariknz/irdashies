import { useEffect, useRef } from 'react';
import type { RadarArcStyle } from '@irdashies/types';
import { ToggleSwitch } from '../../components/ToggleSwitch';
import { arcThicknessPx, paintRimArc } from '../../../Radar/radarArcs';

export const ARC_STYLES: {
  value: RadarArcStyle;
  label: string;
  description: string;
}[] = [
  {
    value: 'arc',
    label: 'Arc',
    description: 'A solid arc on the rim.',
  },
  {
    value: 'segments',
    label: 'Segments',
    description:
      'Three short strokes; the more urgent, the more of them light.',
  },
  {
    value: 'glow',
    label: 'Glow',
    description:
      'A soft band in from the rim, with no hard edge. Calmer to see.',
  },
  {
    value: 'sector',
    label: 'Sector',
    description:
      'A see-through wedge from your car towards the other: the direction reads even from the corner of your eye.',
  },
];

const THUMB_PX = 72;

/** A small radar disc with one mark of `style`, as the picker's picture. */
const ArcThumb = ({
  style,
  color,
  bearing,
  thickness,
}: {
  style: RadarArcStyle;
  color: string;
  bearing: number;
  thickness: number;
}) => {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    // jsdom has no canvas; the picker still works without its pictures.
    let ctx: CanvasRenderingContext2D | null;
    try {
      ctx = canvas?.getContext('2d') ?? null;
    } catch {
      ctx = null;
    }
    if (!canvas || !ctx) return;
    const ratio = window.devicePixelRatio || 1;
    canvas.width = THUMB_PX * ratio;
    canvas.height = THUMB_PX * ratio;
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    const centre = THUMB_PX / 2;
    const radius = centre - 1;
    ctx.clearRect(0, 0, THUMB_PX, THUMB_PX);
    ctx.beginPath();
    ctx.arc(centre, centre, radius, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
    ctx.fill();
    ctx.fillStyle = 'rgba(148, 163, 184, 0.2)';
    ctx.fillRect(centre - radius * 0.2, 1, radius * 0.4, THUMB_PX - 2);
    ctx.fillStyle = '#f1f5f9';
    ctx.fillRect(centre - 2.5, centre - 6, 5, 12);
    paintRimArc(
      ctx,
      centre,
      radius,
      bearing,
      (24 * Math.PI) / 180,
      color,
      style,
      2 / 3,
      // Thicker than on the radar, so the style reads at this size.
      arcThicknessPx(radius, thickness * 1.5)
    );
  }, [style, color, bearing, thickness]);
  return (
    <canvas
      ref={ref}
      style={{ width: THUMB_PX, height: THUMB_PX }}
      aria-hidden="true"
    />
  );
};

export interface ArcEventCardProps {
  title: string;
  description: string;
  enabled: boolean;
  onToggle: (enabled: boolean) => void;
  style: RadarArcStyle;
  onStyle: (style: RadarArcStyle) => void;
  /** The module itself is off, so its arc never shows. */
  moduleOff: boolean;
  moduleName: string;
  color: string;
  /** Where the pictures put the mark, radians in canvas angles. */
  bearing: number;
  thickness: number;
}

/** One event's arc: on or off, and which style, picked from pictures. */
export const ArcEventCard = ({
  title,
  description,
  enabled,
  onToggle,
  style,
  onStyle,
  moduleOff,
  moduleName,
  color,
  bearing,
  thickness,
}: ArcEventCardProps) => {
  const picked = ARC_STYLES.find((option) => option.value === style);
  return (
    <div className="rounded-lg border border-slate-700 p-3 space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h4 className="text-md font-medium text-slate-300">{title}</h4>
          <p className="text-sm text-slate-500">
            {moduleOff
              ? `${moduleName} is off, so this arc never shows.`
              : description}
          </p>
        </div>
        <ToggleSwitch
          enabled={enabled}
          onToggle={onToggle}
          disabled={moduleOff}
          disabledReason={`Turn ${moduleName} on first`}
        />
      </div>
      {enabled && !moduleOff && (
        <>
          <div
            role="radiogroup"
            aria-label={`${title} style`}
            className="grid grid-cols-2 sm:grid-cols-4 gap-2"
          >
            {ARC_STYLES.map((option) => (
              <button
                key={option.value}
                type="button"
                role="radio"
                aria-checked={option.value === style}
                onClick={() => onStyle(option.value)}
                className={`flex flex-col items-center gap-1 rounded-md border p-1.5 text-xs transition-colors ${
                  option.value === style
                    ? 'border-accent-500 bg-accent-600/20 text-white'
                    : 'border-transparent bg-slate-800 text-slate-400 hover:text-slate-200'
                }`}
              >
                <ArcThumb
                  style={option.value}
                  color={color}
                  bearing={bearing}
                  thickness={thickness}
                />
                {option.label}
              </button>
            ))}
          </div>
          {picked && (
            <p className="text-sm text-slate-500">{picked.description}</p>
          )}
        </>
      )}
    </div>
  );
};
