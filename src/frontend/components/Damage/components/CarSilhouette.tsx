import type { DamageBodyStyle } from '../bodyStyle';
import { BODY_FILL, TUB_FILL } from '../logic';

export interface CarSilhouetteProps {
  style: DamageBodyStyle;
  /** FL FC FR CL CR RL RC RR */
  panelFill: string[];
  integrityLabel: string | null;
}

const NEON = BODY_FILL.ok;

/**
 * Keep the iRacing wireframe look: coloured stroke always.
 * Damaged panels get a light tint only — solid fills made the car look like boxes.
 */
function panelProps(color: string, sw = 1.15) {
  const ok = color === NEON;
  return {
    fill: ok ? 'none' : color,
    fillOpacity: ok ? 0 : 0.22,
    stroke: color,
    strokeWidth: sw,
  };
}

function detail(color: string) {
  return color === NEON ? NEON : color;
}

const Integrity = ({ label, y = 78 }: { label: string | null; y?: number }) =>
  label ? (
    <g>
      <rect
        x="32"
        y={y - 8}
        width="36"
        height="16"
        rx="2"
        fill="#0f172a"
        fillOpacity="0.75"
      />
      <text
        x="50"
        y={y}
        textAnchor="middle"
        dominantBaseline="middle"
        fill="#f8fafc"
        fontSize="11"
        fontFamily="ui-monospace, monospace"
        fontWeight="700"
      >
        {label}
      </text>
    </g>
  ) : null;

interface BodyProps {
  p: string[];
  integrityLabel: string | null;
  damaged: boolean;
}

/** Front-engine GT (BMW M4 GT3 style) — long hood, headlights, roof scoop, wing. */
function GtFrontCar({ p, integrityLabel, damaged }: BodyProps) {
  const d = (c: string) => detail(c);
  return (
    <>
      {/* Long hood + splitter */}
      <path d="M30 6 L50 2 L70 6 L78 28 L22 28 Z" {...panelProps(p[1], 1.15)} />
      <path d="M24 28 L76 28 L74 52 L26 52 Z" {...panelProps(p[1])} />
      {/* Hood vents / extractors */}
      <path
        d="M36 12 L42 10 L46 22 L40 24 Z"
        fill="none"
        stroke={d(p[1])}
        strokeWidth="0.75"
      />
      <path
        d="M54 10 L60 12 L60 24 L54 22 Z"
        fill="none"
        stroke={d(p[1])}
        strokeWidth="0.75"
      />
      <path
        d="M44 14 L50 12 L56 14 L54 26 L46 26 Z"
        fill="none"
        stroke={d(p[1])}
        strokeWidth="0.65"
        opacity="0.8"
      />
      <path
        d="M38 32 L46 30 L54 30 L62 32 M40 40 L60 40 M42 48 L58 48"
        fill="none"
        stroke={d(p[1])}
        strokeWidth="0.5"
        opacity="0.65"
      />
      {/* Headlight rings */}
      <circle
        cx="30"
        cy="18"
        r="3.2"
        fill="none"
        stroke={d(p[1])}
        strokeWidth="0.85"
      />
      <circle
        cx="70"
        cy="18"
        r="3.2"
        fill="none"
        stroke={d(p[1])}
        strokeWidth="0.85"
      />
      <circle
        cx="30"
        cy="18"
        r="1.4"
        fill="none"
        stroke={d(p[1])}
        strokeWidth="0.5"
        opacity="0.7"
      />
      <circle
        cx="70"
        cy="18"
        r="1.4"
        fill="none"
        stroke={d(p[1])}
        strokeWidth="0.5"
        opacity="0.7"
      />

      {/* Front corners + mirrors */}
      <path
        d="M14 40 L26 32 L30 54 L16 60 L12 48 Z"
        {...panelProps(p[0], 1.1)}
      />
      <path
        d="M74 32 L86 40 L88 48 L84 60 L70 54 Z"
        {...panelProps(p[2], 1.1)}
      />
      <path
        d="M20 24 L26 34"
        stroke={d(p[0])}
        strokeWidth="1.35"
        strokeLinecap="round"
      />
      <path
        d="M80 24 L74 34"
        stroke={d(p[2])}
        strokeWidth="1.35"
        strokeLinecap="round"
      />

      {/* Doors */}
      <path d="M14 60 L30 54 L34 100 L18 106 Z" {...panelProps(p[3])} />
      <path d="M70 54 L86 60 L82 106 L66 100 Z" {...panelProps(p[4])} />

      {/* Cabin set farther back + roof scoop */}
      <path
        d="M30 54 L70 54 L68 92 L32 92 Z"
        fill={damaged ? TUB_FILL : 'none'}
        stroke={damaged ? '#cbd5e1' : NEON}
        strokeWidth="1.05"
      />
      <path
        d="M34 58 L50 56 L66 58 L64 82 L36 82 Z"
        fill="none"
        stroke={d(p[1])}
        strokeWidth="0.7"
        opacity="0.85"
      />
      <line
        x1="50"
        y1="56"
        x2="50"
        y2="82"
        stroke={damaged ? '#e2e8f0' : '#f8fafc'}
        strokeWidth="1.05"
      />
      <rect
        x="44"
        y="84"
        width="12"
        height="6"
        rx="0.8"
        fill="none"
        stroke={d(p[1])}
        strokeWidth="0.8"
      />
      <path
        d="M46 86 L54 86 M47 88 L53 88"
        fill="none"
        stroke={d(p[1])}
        strokeWidth="0.4"
        opacity="0.7"
      />

      {/* Rear quarters */}
      <path
        d="M16 106 L32 100 L36 128 L20 134 L12 118 Z"
        {...panelProps(p[5])}
      />
      <path
        d="M68 100 L84 106 L88 118 L80 134 L64 128 Z"
        {...panelProps(p[7])}
      />
      <path d="M32 100 L68 100 L70 128 L30 128 Z" {...panelProps(p[6])} />
      <path
        d="M36 108 L64 108 M38 116 L62 116 M40 124 L60 124"
        fill="none"
        stroke={d(p[6])}
        strokeWidth="0.45"
        opacity="0.6"
      />

      {/* Wide rear wing */}
      <path
        d="M22 130 L50 136 L78 130 L76 144 L50 150 L24 144 Z"
        {...panelProps(p[6], 1.2)}
      />
      <path
        d="M28 138 L72 138 M32 142 L68 142"
        fill="none"
        stroke={d(p[6])}
        strokeWidth="0.5"
        opacity="0.65"
      />
      <rect
        x="20"
        y="132"
        width="4"
        height="12"
        rx="0.4"
        {...panelProps(p[6], 0.9)}
      />
      <rect
        x="76"
        y="132"
        width="4"
        height="12"
        rx="0.4"
        {...panelProps(p[6], 0.9)}
      />

      <Integrity label={integrityLabel} y={70} />
    </>
  );
}

/** Mid-engine GT (Ferrari 296 / R8 style) — short nose, cabin forward, louvred engine cover. */
function GtMidCar({ p, integrityLabel, damaged }: BodyProps) {
  const d = (c: string) => detail(c);
  return (
    <>
      {/* Short nose / splitter */}
      <path d="M34 6 L50 3 L66 6 L74 22 L26 22 Z" {...panelProps(p[1], 1.15)} />
      <path d="M28 22 L72 22 L70 42 L30 42 Z" {...panelProps(p[1])} />
      <path
        d="M36 10 L42 14 M50 6 L50 20 M58 14 L64 10"
        fill="none"
        stroke={d(p[1])}
        strokeWidth="0.55"
        opacity="0.75"
      />
      <path
        d="M40 26 L46 30 L54 30 L60 26"
        fill="none"
        stroke={d(p[1])}
        strokeWidth="0.5"
        opacity="0.7"
      />

      <path
        d="M16 36 L28 26 L32 48 L18 54 L14 44 Z"
        {...panelProps(p[0], 1.1)}
      />
      <path
        d="M72 26 L84 36 L86 44 L82 54 L68 48 Z"
        {...panelProps(p[2], 1.1)}
      />
      <path
        d="M22 18 L28 28"
        stroke={d(p[0])}
        strokeWidth="1.3"
        strokeLinecap="round"
      />
      <path
        d="M78 18 L72 28"
        stroke={d(p[2])}
        strokeWidth="1.3"
        strokeLinecap="round"
      />

      <path d="M16 54 L32 48 L34 88 L18 94 Z" {...panelProps(p[3])} />
      <path d="M68 48 L84 54 L82 94 L66 88 Z" {...panelProps(p[4])} />

      {/* Cabin forward of mid point */}
      <path
        d="M30 44 L70 44 L68 78 L32 78 Z"
        fill={damaged ? TUB_FILL : 'none'}
        stroke={damaged ? '#cbd5e1' : NEON}
        strokeWidth="1.05"
      />
      <path
        d="M34 48 L50 46 L66 48 L64 72 L36 72 Z"
        fill="none"
        stroke={d(p[1])}
        strokeWidth="0.7"
        opacity="0.85"
      />
      <line
        x1="50"
        y1="46"
        x2="50"
        y2="72"
        stroke={damaged ? '#e2e8f0' : '#f8fafc'}
        strokeWidth="1.1"
      />

      {/* Engine cover louvers behind cabin */}
      <path d="M18 94 L34 88 L36 124 L20 130 L14 110 Z" {...panelProps(p[5])} />
      <path d="M66 88 L82 94 L86 110 L80 130 L64 124 Z" {...panelProps(p[7])} />
      <path d="M34 78 L66 78 L68 124 L32 124 Z" {...panelProps(p[6])} />
      <path
        d="M38 84 L62 84 M38 90 L62 90 M38 96 L62 96 M38 102 L62 102 M38 108 L62 108 M40 114 L60 114 M42 120 L58 120"
        fill="none"
        stroke={d(p[6])}
        strokeWidth="0.55"
        opacity="0.8"
      />

      <path
        d="M26 126 L50 132 L74 126 L72 140 L50 146 L28 140 Z"
        {...panelProps(p[6], 1.15)}
      />
      <path
        d="M32 134 L68 134"
        fill="none"
        stroke={d(p[6])}
        strokeWidth="0.55"
        opacity="0.65"
      />
      <rect
        x="24"
        y="128"
        width="3.5"
        height="11"
        rx="0.4"
        {...panelProps(p[6], 0.9)}
      />
      <rect
        x="72.5"
        y="128"
        width="3.5"
        height="11"
        rx="0.4"
        {...panelProps(p[6], 0.9)}
      />

      <Integrity label={integrityLabel} />
    </>
  );
}

/** Rear-engine GT (Porsche 911 style) — cabin forward, long rear deck, teardrop tail. */
function GtRearCar({ p, integrityLabel, damaged }: BodyProps) {
  const d = (c: string) => detail(c);
  return (
    <>
      {/* Short curved nose */}
      <path d="M32 8 L50 4 L68 8 L76 26 L24 26 Z" {...panelProps(p[1], 1.15)} />
      <path d="M26 26 L74 26 L72 44 L28 44 Z" {...panelProps(p[1])} />
      <path
        d="M40 12 L50 10 L60 12 L58 22 L42 22 Z"
        fill="none"
        stroke={d(p[1])}
        strokeWidth="0.7"
        opacity="0.8"
      />
      <path
        d="M36 30 L46 28 L54 28 L64 30"
        fill="none"
        stroke={d(p[1])}
        strokeWidth="0.5"
        opacity="0.65"
      />

      <path
        d="M14 38 L26 30 L30 52 L16 58 L12 46 Z"
        {...panelProps(p[0], 1.1)}
      />
      <path
        d="M74 30 L86 38 L88 46 L84 58 L70 52 Z"
        {...panelProps(p[2], 1.1)}
      />
      <path
        d="M20 20 L26 32"
        stroke={d(p[0])}
        strokeWidth="1.35"
        strokeLinecap="round"
      />
      <path
        d="M80 20 L74 32"
        stroke={d(p[2])}
        strokeWidth="1.35"
        strokeLinecap="round"
      />

      <path d="M14 58 L30 52 L34 92 L18 98 Z" {...panelProps(p[3])} />
      <path d="M70 52 L86 58 L82 98 L66 92 Z" {...panelProps(p[4])} />

      {/* Cabin far forward */}
      <path
        d="M28 46 L72 46 L70 78 L30 78 Z"
        fill={damaged ? TUB_FILL : 'none'}
        stroke={damaged ? '#cbd5e1' : NEON}
        strokeWidth="1.05"
      />
      <path
        d="M32 50 L50 48 L68 50 L66 72 L34 72 Z"
        fill="none"
        stroke={d(p[1])}
        strokeWidth="0.7"
        opacity="0.85"
      />
      <line
        x1="50"
        y1="48"
        x2="50"
        y2="72"
        stroke={damaged ? '#e2e8f0' : '#f8fafc'}
        strokeWidth="1.05"
      />

      {/* Long sloping rear deck / engine cover */}
      <path d="M16 98 L32 92 L36 126 L20 132 L12 112 Z" {...panelProps(p[5])} />
      <path d="M68 92 L84 98 L88 112 L80 132 L64 126 Z" {...panelProps(p[7])} />
      <path d="M30 78 L70 78 L72 126 L28 126 Z" {...panelProps(p[6])} />
      {/* Teardrop taper + louvers */}
      <path
        d="M34 82 L66 82 M34 90 L66 90 M36 98 L64 98 M38 106 L62 106 M40 114 L60 114 M42 122 L58 122"
        fill="none"
        stroke={d(p[6])}
        strokeWidth="0.5"
        opacity="0.75"
      />
      <path
        d="M36 84 Q50 88 64 84"
        fill="none"
        stroke={d(p[6])}
        strokeWidth="0.55"
        opacity="0.55"
      />

      {/* Wing at very rear */}
      <path
        d="M24 128 L50 134 L76 128 L74 142 L50 148 L26 142 Z"
        {...panelProps(p[6], 1.2)}
      />
      <path
        d="M30 136 L70 136 M34 140 L66 140"
        fill="none"
        stroke={d(p[6])}
        strokeWidth="0.5"
        opacity="0.65"
      />
      <rect
        x="22"
        y="130"
        width="3.5"
        height="11"
        rx="0.4"
        {...panelProps(p[6], 0.9)}
      />
      <rect
        x="74.5"
        y="130"
        width="3.5"
        height="11"
        rx="0.4"
        {...panelProps(p[6], 0.9)}
      />

      <Integrity label={integrityLabel} y={62} />
    </>
  );
}

/** Hypercar / LMP2 / LMP3 — long nose, fender arches, canopy, sidepods, big wing. */
function PrototypeCar({ p, integrityLabel, damaged }: BodyProps) {
  const d = (c: string) => detail(c);
  return (
    <>
      <path
        d="M42 2 L50 0.5 L58 2 L68 12 L74 28 L80 50 L82 78 L78 110 L70 132 L58 146 L50 148 L42 146 L30 132 L22 110 L18 78 L20 50 L26 28 L32 12 Z"
        fill="none"
        stroke={d(p[1])}
        strokeWidth="0.5"
        opacity="0.3"
      />

      {/* Nose / splitter */}
      <path d="M40 3 L50 1 L60 3 L70 16 L30 16 Z" {...panelProps(p[1], 1.15)} />
      <path d="M30 16 L70 16 L68 36 L32 36 Z" {...panelProps(p[1])} />
      <path
        d="M36 8 L42 12 M50 3 L50 16 M58 12 L64 8"
        fill="none"
        stroke={d(p[1])}
        strokeWidth="0.5"
        opacity="0.7"
      />
      <path
        d="M38 20 L46 24 L54 24 L62 20 M40 28 L60 28"
        fill="none"
        stroke={d(p[1])}
        strokeWidth="0.45"
        opacity="0.65"
      />

      {/* Front fenders */}
      <path
        d="M12 26 L30 18 L34 46 L18 52 L10 38 Z"
        {...panelProps(p[0], 1.1)}
      />
      <path
        d="M70 18 L88 26 L90 38 L82 52 L66 46 Z"
        {...panelProps(p[2], 1.1)}
      />
      <path
        d="M16 28 Q8 38 16 48"
        fill="none"
        stroke={d(p[0])}
        strokeWidth="0.95"
      />
      <path
        d="M84 28 Q92 38 84 48"
        fill="none"
        stroke={d(p[2])}
        strokeWidth="0.95"
      />
      <path
        d="M20 32 L28 28 M20 42 L28 40"
        fill="none"
        stroke={d(p[0])}
        strokeWidth="0.45"
        opacity="0.55"
      />
      <path
        d="M80 32 L72 28 M80 42 L72 40"
        fill="none"
        stroke={d(p[2])}
        strokeWidth="0.45"
        opacity="0.55"
      />

      {/* Canopy */}
      <ellipse
        cx="50"
        cy="56"
        rx="12"
        ry="17"
        fill={damaged ? TUB_FILL : 'none'}
        stroke={damaged ? '#cbd5e1' : NEON}
        strokeWidth="1.1"
      />
      <ellipse
        cx="50"
        cy="54"
        rx="7.5"
        ry="11.5"
        fill="none"
        stroke={d(p[1])}
        strokeWidth="0.55"
        opacity="0.7"
      />
      <path
        d="M50 44 L50 64"
        stroke={damaged ? '#e2e8f0' : '#f8fafc'}
        strokeWidth="0.9"
      />
      <path
        d="M44 50 Q50 48 56 50"
        fill="none"
        stroke={d(p[1])}
        strokeWidth="0.45"
        opacity="0.55"
      />

      {/* Sidepods */}
      <path d="M14 52 L34 46 L38 102 L18 108 Z" {...panelProps(p[3])} />
      <path d="M66 46 L86 52 L82 108 L62 102 Z" {...panelProps(p[4])} />
      <path
        d="M18 60 L32 56 M18 76 L34 72 M18 92 L34 88"
        fill="none"
        stroke={d(p[3])}
        strokeWidth="0.45"
        opacity="0.5"
      />
      <path
        d="M82 60 L68 56 M82 76 L66 72 M82 92 L66 88"
        fill="none"
        stroke={d(p[4])}
        strokeWidth="0.45"
        opacity="0.5"
      />
      <path
        d="M34 48 L66 48 L64 100 L36 100 Z"
        fill="none"
        stroke={d(p[1])}
        strokeWidth="0.55"
        opacity="0.4"
      />

      {/* Engine cover / rear deck */}
      <path
        d="M18 108 L38 102 L40 126 L24 132 L12 118 Z"
        {...panelProps(p[5])}
      />
      <path
        d="M62 102 L82 108 L88 118 L76 132 L60 126 Z"
        {...panelProps(p[7])}
      />
      <path d="M38 102 L62 102 L64 126 L36 126 Z" {...panelProps(p[6])} />
      <path
        d="M42 108 L50 106 L58 108 M42 116 L58 116 M44 122 L56 122"
        fill="none"
        stroke={d(p[6])}
        strokeWidth="0.45"
        opacity="0.65"
      />

      {/* Rear wing + endplates */}
      <path
        d="M18 130 L34 126 L50 124 L66 126 L82 130 L82 140 L66 144 L50 146 L34 144 L18 140 Z"
        {...panelProps(p[6], 1.2)}
      />
      <path
        d="M22 135 L78 135 M26 139 L74 139"
        fill="none"
        stroke={d(p[6])}
        strokeWidth="0.5"
        opacity="0.65"
      />
      <rect
        x="16"
        y="128"
        width="4"
        height="14"
        rx="0.4"
        {...panelProps(p[6], 0.95)}
      />
      <rect
        x="80"
        y="128"
        width="4"
        height="14"
        rx="0.4"
        {...panelProps(p[6], 0.95)}
      />

      <Integrity label={integrityLabel} y={72} />
    </>
  );
}

/** Formula / FF1600 — front wing, nose, wishbones, tub, sidepods, rear wing. */
function OpenWheelCar({ p, integrityLabel, damaged }: BodyProps) {
  const arm = damaged ? '#94a3b8' : NEON;
  const d = (c: string) => detail(c);
  return (
    <>
      {/* Front wing */}
      <rect
        x="18"
        y="3"
        width="64"
        height="6"
        rx="1"
        {...panelProps(p[1], 1.2)}
      />
      <path
        d="M22 6 L28 9 M50 3 L50 9 M72 6 L78 9"
        fill="none"
        stroke={d(p[1])}
        strokeWidth="0.5"
        opacity="0.7"
      />
      <rect
        x="18"
        y="2"
        width="3"
        height="8"
        rx="0.3"
        {...panelProps(p[1], 0.9)}
      />
      <rect
        x="79"
        y="2"
        width="3"
        height="8"
        rx="0.3"
        {...panelProps(p[1], 0.9)}
      />

      {/* Nose */}
      <path
        d="M44 10 L50 8 L56 10 L60 30 L40 30 Z"
        {...panelProps(p[1], 1.1)}
      />
      <path
        d="M46 14 L50 12 L54 14 M47 20 L53 20"
        fill="none"
        stroke={d(p[1])}
        strokeWidth="0.45"
        opacity="0.65"
      />

      {/* Front uprights / body */}
      <path d="M32 32 L42 30 L46 50 L36 54 L30 42 Z" {...panelProps(p[0])} />
      <path d="M58 30 L68 32 L70 42 L64 54 L54 50 Z" {...panelProps(p[2])} />
      <path d="M42 30 L58 30 L56 50 L44 50 Z" {...panelProps(p[1])} />

      {/* Front wishbones */}
      <path
        d="M14 34 L34 32 L14 42 L32 40"
        fill="none"
        stroke={arm}
        strokeWidth="0.95"
      />
      <path
        d="M86 34 L66 32 L86 42 L68 40"
        fill="none"
        stroke={arm}
        strokeWidth="0.95"
      />
      <circle
        cx="14"
        cy="38"
        r="1.2"
        fill="none"
        stroke={arm}
        strokeWidth="0.7"
      />
      <circle
        cx="86"
        cy="38"
        r="1.2"
        fill="none"
        stroke={arm}
        strokeWidth="0.7"
      />

      {/* Sidepods */}
      <path d="M28 54 L44 50 L48 96 L34 100 Z" {...panelProps(p[3])} />
      <path d="M56 50 L72 54 L66 100 L52 96 Z" {...panelProps(p[4])} />
      <path
        d="M32 60 L42 58 M32 76 L44 74 M34 90 L44 88"
        fill="none"
        stroke={d(p[3])}
        strokeWidth="0.4"
        opacity="0.5"
      />
      <path
        d="M68 60 L58 58 M68 76 L56 74 M66 90 L56 88"
        fill="none"
        stroke={d(p[4])}
        strokeWidth="0.4"
        opacity="0.5"
      />

      {/* Tub / cockpit */}
      <path
        d="M44 50 L56 50 L54 96 L46 96 Z"
        fill={damaged ? TUB_FILL : 'none'}
        stroke={damaged ? '#cbd5e1' : NEON}
        strokeWidth="1.05"
      />
      <ellipse
        cx="50"
        cy="72"
        rx="5.5"
        ry="12"
        fill="none"
        stroke={arm}
        strokeWidth="0.65"
      />
      <path
        d="M47 64 L50 62 L53 64 L52 78 L48 78 Z"
        fill="none"
        stroke={arm}
        strokeWidth="0.5"
        opacity="0.7"
      />
      <line
        x1="50"
        y1="58"
        x2="50"
        y2="86"
        stroke={damaged ? '#e2e8f0' : '#f8fafc'}
        strokeWidth="0.85"
      />

      {/* Rear body */}
      <path
        d="M34 100 L48 96 L50 120 L38 124 L30 112 Z"
        {...panelProps(p[5])}
      />
      <path
        d="M52 96 L66 100 L70 112 L62 124 L50 120 Z"
        {...panelProps(p[7])}
      />
      <path d="M46 96 L54 96 L56 120 L44 120 Z" {...panelProps(p[6])} />

      {/* Rear wishbones */}
      <path
        d="M14 112 L34 110 L14 122 L32 118"
        fill="none"
        stroke={arm}
        strokeWidth="0.95"
      />
      <path
        d="M86 112 L66 110 L86 122 L68 118"
        fill="none"
        stroke={arm}
        strokeWidth="0.95"
      />

      {/* Rear wing */}
      <rect
        x="16"
        y="126"
        width="68"
        height="9"
        rx="1"
        {...panelProps(p[6], 1.2)}
      />
      <path
        d="M20 130 L80 130 M24 133 L76 133"
        fill="none"
        stroke={d(p[6])}
        strokeWidth="0.45"
        opacity="0.65"
      />
      <rect
        x="44"
        y="123"
        width="12"
        height="5"
        rx="0.4"
        {...panelProps(p[6], 0.9)}
      />
      <rect
        x="16"
        y="125"
        width="3.5"
        height="11"
        rx="0.3"
        {...panelProps(p[6], 0.9)}
      />
      <rect
        x="80.5"
        y="125"
        width="3.5"
        height="11"
        rx="0.3"
        {...panelProps(p[6], 0.9)}
      />

      <Integrity label={integrityLabel} />
    </>
  );
}

/** MX-5 / GR86 / TCR / Clio — compact street silhouette. */
function HatchCar({ p, integrityLabel, damaged }: BodyProps) {
  const d = (c: string) => detail(c);
  return (
    <>
      <path
        d="M32 12 L50 8 L68 12 L76 30 L24 30 Z"
        {...panelProps(p[1], 1.1)}
      />
      <path d="M28 30 L72 30 L70 48 L30 48 Z" {...panelProps(p[1])} />
      <path
        d="M36 16 L44 20 M50 10 L50 28 M56 20 L64 16"
        fill="none"
        stroke={d(p[1])}
        strokeWidth="0.5"
        opacity="0.7"
      />
      <path d="M16 38 L28 32 L32 56 L16 62 L12 48 Z" {...panelProps(p[0])} />
      <path d="M72 32 L84 38 L88 48 L84 62 L68 56 Z" {...panelProps(p[2])} />
      <path d="M14 62 L30 56 L34 100 L18 106 Z" {...panelProps(p[3])} />
      <path d="M70 56 L86 62 L82 106 L66 100 Z" {...panelProps(p[4])} />
      <path
        d="M30 50 L70 50 L68 98 L32 98 Z"
        fill={damaged ? TUB_FILL : 'none'}
        stroke={damaged ? '#cbd5e1' : NEON}
        strokeWidth="1.05"
      />
      <path
        d="M34 54 L50 52 L66 54 L64 78 L36 78 Z"
        fill="none"
        stroke={d(p[1])}
        strokeWidth="0.7"
        opacity="0.75"
      />
      <line
        x1="50"
        y1="52"
        x2="50"
        y2="78"
        stroke={damaged ? '#e2e8f0' : '#f8fafc'}
        strokeWidth="0.95"
      />
      <path
        d="M36 84 L64 84 L62 94 L38 94 Z"
        fill="none"
        stroke={d(p[1])}
        strokeWidth="0.5"
        opacity="0.55"
      />
      <path
        d="M16 106 L32 100 L36 132 L20 130 L12 116 Z"
        {...panelProps(p[5])}
      />
      <path
        d="M68 100 L84 106 L88 116 L80 130 L64 132 Z"
        {...panelProps(p[7])}
      />
      <path d="M32 100 L68 100 L72 136 L28 136 Z" {...panelProps(p[6])} />
      <path
        d="M34 108 L66 108 M36 118 L64 118 M38 128 L62 128"
        fill="none"
        stroke={d(p[6])}
        strokeWidth="0.45"
        opacity="0.55"
      />
      <Integrity label={integrityLabel} />
    </>
  );
}

/** NASCAR / Mini Stock — long oval body, short overhangs. */
function StockCar({ p, integrityLabel, damaged }: BodyProps) {
  const d = (c: string) => detail(c);
  return (
    <>
      <path
        d="M20 10 L50 6 L80 10 L86 32 L14 32 Z"
        {...panelProps(p[1], 1.1)}
      />
      <path d="M16 32 L84 32 L82 54 L18 54 Z" {...panelProps(p[1])} />
      <path
        d="M28 14 L36 18 M50 8 L50 30 M64 18 L72 14"
        fill="none"
        stroke={d(p[1])}
        strokeWidth="0.5"
        opacity="0.65"
      />
      <path d="M10 40 L18 34 L22 58 L12 64 L8 48 Z" {...panelProps(p[0])} />
      <path d="M82 34 L90 40 L92 48 L88 64 L78 58 Z" {...panelProps(p[2])} />
      <path d="M10 64 L22 58 L26 104 L14 110 Z" {...panelProps(p[3])} />
      <path d="M78 58 L90 64 L86 110 L74 104 Z" {...panelProps(p[4])} />
      <path
        d="M22 56 L78 56 L76 104 L24 104 Z"
        fill={damaged ? TUB_FILL : 'none'}
        stroke={damaged ? '#cbd5e1' : NEON}
        strokeWidth="1.05"
      />
      <path
        d="M28 60 L50 58 L72 60 L70 86 L30 86 Z"
        fill="none"
        stroke={d(p[1])}
        strokeWidth="0.7"
        opacity="0.7"
      />
      <line
        x1="50"
        y1="58"
        x2="50"
        y2="86"
        stroke={damaged ? '#e2e8f0' : '#f8fafc'}
        strokeWidth="0.95"
      />
      <path
        d="M30 92 L70 92 L68 100 L32 100 Z"
        fill="none"
        stroke={d(p[1])}
        strokeWidth="0.5"
        opacity="0.5"
      />
      <path
        d="M12 110 L24 104 L28 134 L16 132 L10 120 Z"
        {...panelProps(p[5])}
      />
      <path
        d="M76 104 L88 110 L90 120 L84 132 L72 134 Z"
        {...panelProps(p[7])}
      />
      <path d="M24 104 L76 104 L80 138 L20 138 Z" {...panelProps(p[6])} />
      <path
        d="M28 112 L72 112 M30 122 L70 122 M32 132 L68 132"
        fill="none"
        stroke={d(p[6])}
        strokeWidth="0.45"
        opacity="0.55"
      />
      <Integrity label={integrityLabel} />
    </>
  );
}

/** Pro truck / off-road — wide, tall, short nose. */
function TruckCar({ p, integrityLabel, damaged }: BodyProps) {
  const d = (c: string) => detail(c);
  return (
    <>
      <path d="M24 6 L50 2 L76 6 L84 36 L16 36 Z" {...panelProps(p[1], 1.15)} />
      <path d="M20 36 L80 36 L78 62 L22 62 Z" {...panelProps(p[1])} />
      <path
        d="M32 10 L40 16 M50 4 L50 34 M60 16 L68 10"
        fill="none"
        stroke={d(p[1])}
        strokeWidth="0.55"
        opacity="0.7"
      />
      <path
        d="M32 42 L68 42 L66 56 L34 56 Z"
        fill="none"
        stroke={d(p[1])}
        strokeWidth="0.65"
        opacity="0.65"
      />
      <path d="M8 44 L20 38 L24 68 L10 74 L6 54 Z" {...panelProps(p[0])} />
      <path d="M80 38 L92 44 L94 54 L90 74 L76 68 Z" {...panelProps(p[2])} />
      <path d="M8 74 L24 68 L28 108 L12 114 Z" {...panelProps(p[3])} />
      <path d="M76 68 L92 74 L88 114 L72 108 Z" {...panelProps(p[4])} />
      <path
        d="M24 64 L76 64 L74 108 L26 108 Z"
        fill={damaged ? TUB_FILL : 'none'}
        stroke={damaged ? '#cbd5e1' : NEON}
        strokeWidth="1.05"
      />
      <path
        d="M30 70 L50 68 L70 70 L68 92 L32 92 Z"
        fill="none"
        stroke={d(p[1])}
        strokeWidth="0.65"
        opacity="0.65"
      />
      <line
        x1="50"
        y1="68"
        x2="50"
        y2="92"
        stroke={damaged ? '#e2e8f0' : '#f8fafc'}
        strokeWidth="0.95"
      />
      <path
        d="M12 114 L28 108 L32 142 L16 140 L8 126 Z"
        {...panelProps(p[5])}
      />
      <path
        d="M72 108 L88 114 L92 126 L84 140 L68 142 Z"
        {...panelProps(p[7])}
      />
      <path d="M28 108 L72 108 L76 146 L24 146 Z" {...panelProps(p[6])} />
      <path
        d="M32 116 L68 116 M34 128 L66 128 M36 138 L64 138"
        fill="none"
        stroke={d(p[6])}
        strokeWidth="0.5"
        opacity="0.55"
      />
      <Integrity label={integrityLabel} y={88} />
    </>
  );
}

export const CarSilhouette = ({
  style,
  panelFill,
  integrityLabel,
}: CarSilhouetteProps) => {
  const p =
    panelFill.length === 8 ? panelFill : Array.from({ length: 8 }, () => NEON);
  const damaged = p.some((color) => color !== NEON);

  const props: BodyProps = {
    p,
    integrityLabel,
    damaged,
  };

  const body =
    style === 'prototype' ? (
      <PrototypeCar {...props} />
    ) : style === 'openwheel' ? (
      <OpenWheelCar {...props} />
    ) : style === 'hatch' ? (
      <HatchCar {...props} />
    ) : style === 'stock' ? (
      <StockCar {...props} />
    ) : style === 'truck' ? (
      <TruckCar {...props} />
    ) : style === 'gtFront' ? (
      <GtFrontCar {...props} />
    ) : style === 'gtRear' ? (
      <GtRearCar {...props} />
    ) : (
      <GtMidCar {...props} />
    );

  return (
    <svg
      viewBox="0 0 100 160"
      className="h-full w-full"
      aria-label="Car damage"
    >
      {body}
    </svg>
  );
};
