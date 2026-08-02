import { InputGear, InputGearProps } from '../InputGear/InputGear';

export interface SteerDialProps {
  /** Steering wheel angle in radians (raw `SteeringWheelAngle` value). */
  angleRad?: number;
  gear?: number;
  /** Speed in m/s (raw `Speed` value). */
  speedMs?: number;
  /** `DisplayUnits` value (0 = imperial, 1 = metric). */
  unit?: number;
  /** Light/dark colour scheme, matching the icon wheels. */
  wheelColor?: 'dark' | 'light';
  /** Gear/speed display config, reused from the standalone Gear section. */
  gearSettings?: InputGearProps['settings'];
}

// --- Geometry (SVG user units, viewBox 0 0 100 100) ----------------------
const CENTER = 50;
const RING_RADIUS = 46; // centreline of the ring (thin ring => large clear centre)
const RING_WIDTH = 5; // ring thickness (spans r43.5–48.5, inner clear Ø87%)
// Top centre marker: a straight trapezoid wedge at 12 o'clock that rotates with
// the wheel to show direction — wide at the rim, tapering toward the centre.
const MARKER_OUTER_R = 49.5; // outer edge (at the rim)
const MARKER_INNER_R = 42; // inner edge (toward the centre) — shorter wedge
const MARKER_OUTER_HW = 6; // half-width at the wide (rim) end
const MARKER_INNER_HW = 4.5; // half-width at the narrow (centre) end — gentle taper
const MARKER_POINTS = [
  `${CENTER - MARKER_OUTER_HW},${CENTER - MARKER_OUTER_R}`,
  `${CENTER + MARKER_OUTER_HW},${CENTER - MARKER_OUTER_R}`,
  `${CENTER + MARKER_INNER_HW},${CENTER - MARKER_INNER_R}`,
  `${CENTER - MARKER_INNER_HW},${CENTER - MARKER_INNER_R}`,
].join(' ');

/**
 * Compact "ring" steering display: a thin rim with a straight top-centre marker
 * that rotates with the wheel to show position. The centre stays clear for
 * gear + speed. The marker uses the same rotation sign as the icon wheels, so
 * direction matches exactly.
 */
export function SteerDial({
  angleRad = 0,
  gear,
  speedMs,
  unit,
  wheelColor = 'light',
  gearSettings,
}: SteerDialProps) {
  const steerDeg = angleRad * -1 * (180 / Math.PI);

  // Match the icon wheels: 'dark' = black ring with a white marker,
  // 'light' = white ring with a black marker.
  const ringClass = wheelColor === 'dark' ? 'stroke-black' : 'stroke-white';
  const markerFillClass = wheelColor === 'dark' ? 'fill-white' : 'fill-black';

  return (
    <div className="@container-[size] w-full h-full flex items-center justify-center">
      {/* Square sized by the smaller dimension so the dial is always as large
          as possible and stays square — fixes the wheel shrinking / distorting
          when the widget is stretched vertically. */}
      <div
        className="relative aspect-square"
        style={{ width: 'min(100cqw, 100cqh)' }}
      >
        <svg viewBox="0 0 100 100" className="w-full h-full">
          {/* black ring; centre stays transparent so the widget bg shows through */}
          <circle
            cx={CENTER}
            cy={CENTER}
            r={RING_RADIUS}
            fill="none"
            strokeWidth={RING_WIDTH}
            className={ringClass}
          />
          {/* straight top-centre marker that rotates with the wheel */}
          <g
            transform={`rotate(${steerDeg} ${CENTER} ${CENTER})`}
            style={{ willChange: 'transform' }}
          >
            <polygon points={MARKER_POINTS} className={markerFillClass} />
          </g>
        </svg>

        {/* gear + speed in the centre — inset so the square content box stays
            inside the ring's clear inner circle (Ø80%) and never overlaps it */}
        {gearSettings && (
          <div className="absolute inset-[12%]">
            <InputGear
              gear={gear}
              speedMs={speedMs}
              unit={unit}
              settings={gearSettings}
            />
          </div>
        )}
      </div>
    </div>
  );
}
