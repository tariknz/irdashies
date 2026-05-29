import { InputGear, InputGearProps } from '../InputGear/InputGear';

export interface SteerDialProps {
  /** Steering wheel angle in radians (raw `SteeringWheelAngle` value). */
  angleRad?: number;
  gear?: number;
  /** Speed in m/s (raw `Speed` value). */
  speedMs?: number;
  /** `DisplayUnits` value (0 = imperial, 1 = metric). */
  unit?: number;
  /** Gear/speed display config, reused from the standalone Gear section. */
  gearSettings?: InputGearProps['settings'];
}

// --- Geometry (SVG user units, viewBox 0 0 100 100) ----------------------
const CENTER = 50;
const RING_RADIUS = 44; // centreline of the black ring
const RING_WIDTH = 8; // black ring thickness (outer edge at 48)
const MARKER_WIDTH = 4.5; // ~75% of the ring width
const MARKER_SWEEP_DEG = 18; // ~75% of the previous marker size
const HALF = (MARKER_SWEEP_DEG / 2) * (Math.PI / 180);

// Marker arc endpoints, centred at the top (12 o'clock) when wheel is straight.
const X1 = (CENTER - RING_RADIUS * Math.sin(HALF)).toFixed(3);
const Y1 = (CENTER - RING_RADIUS * Math.cos(HALF)).toFixed(3);
const X2 = (CENTER + RING_RADIUS * Math.sin(HALF)).toFixed(3);
const MARKER_PATH = `M ${X1} ${Y1} A ${RING_RADIUS} ${RING_RADIUS} 0 0 1 ${X2} ${Y1}`;

/**
 * Compact "ring" steering display: a black ring with a white marker running
 * around it to show wheel position. The centre is transparent so the widget's
 * own background shows through, with gear + speed rendered on top. The marker
 * uses the same rotation sign as the icon wheels, so direction matches exactly.
 */
export function SteerDial({
  angleRad = 0,
  gear,
  speedMs,
  unit,
  gearSettings,
}: SteerDialProps) {
  const steerDeg = angleRad * -1 * (180 / Math.PI);

  return (
    <div className="w-full h-full flex items-center justify-center">
      <div className="relative h-full aspect-square max-w-full">
        <svg viewBox="0 0 100 100" className="w-full h-full">
          {/* black ring; centre stays transparent so the widget bg shows through */}
          <circle
            cx={CENTER}
            cy={CENTER}
            r={RING_RADIUS}
            fill="none"
            strokeWidth={RING_WIDTH}
            className="stroke-black"
          />
          {/* white steering marker */}
          <g
            transform={`rotate(${steerDeg} ${CENTER} ${CENTER})`}
            style={{ willChange: 'transform' }}
          >
            <path
              d={MARKER_PATH}
              fill="none"
              strokeWidth={MARKER_WIDTH}
              strokeLinecap="round"
              className="stroke-white"
            />
          </g>
        </svg>

        {/* gear + speed in the centre */}
        {gearSettings && (
          <div className="absolute inset-[16%]">
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
