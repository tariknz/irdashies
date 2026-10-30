import type { DamageBodyStyle } from '../bodyStyle';

export interface CarSilhouetteProps {
  style: DamageBodyStyle;
  /** FL FC FR CL CR RL RC RR */
  panelFill: string[];
  wheelFill: string[];
  punctured: boolean[];
  integrityLabel: string | null;
}

const stroke = '#94a3b8';

const Wheel = ({
  x,
  y,
  w = 8,
  h = 18,
  fill,
  punctured,
}: {
  x: number;
  y: number;
  w?: number;
  h?: number;
  fill: string;
  punctured: boolean;
}) => (
  <rect
    x={x}
    y={y}
    width={w}
    height={h}
    rx={1.5}
    fill={punctured ? 'none' : fill}
    stroke={punctured ? '#ef4444' : stroke}
    strokeWidth={punctured ? 1.4 : 0.6}
  />
);

const Integrity = ({ label }: { label: string | null }) =>
  label ? (
    <text
      x="50"
      y="78"
      textAnchor="middle"
      dominantBaseline="middle"
      fill="#f8fafc"
      fontSize="11"
      fontFamily="ui-monospace, monospace"
      fontWeight="600"
    >
      {label}
    </text>
  ) : null;

function GtCar({
  p,
  w,
  punctured,
  integrityLabel,
}: {
  p: string[];
  w: string[];
  punctured: boolean[];
  integrityLabel: string | null;
}) {
  return (
    <>
      <rect x="28" y="6" width="44" height="5" rx="1" fill={p[1]} stroke={stroke} strokeWidth="0.6" />
      <path d="M32 14 L50 11 L68 14 L72 28 L28 28 Z" fill={p[1]} stroke={stroke} strokeWidth="0.7" />
      <path d="M18 30 L28 28 L28 52 L16 54 L14 40 Z" fill={p[0]} stroke={stroke} strokeWidth="0.7" />
      <path d="M72 28 L82 30 L86 40 L84 54 L72 52 Z" fill={p[2]} stroke={stroke} strokeWidth="0.7" />
      <path d="M28 28 L72 28 L70 52 L30 52 Z" fill={p[1]} stroke={stroke} strokeWidth="0.7" opacity="0.85" />
      <path d="M16 54 L30 52 L30 96 L16 98 Z" fill={p[3]} stroke={stroke} strokeWidth="0.7" />
      <path d="M70 52 L84 54 L84 98 L70 96 Z" fill={p[4]} stroke={stroke} strokeWidth="0.7" />
      <path d="M30 52 L70 52 L68 96 L32 96 Z" fill="#1e293b" stroke={stroke} strokeWidth="0.7" />
      <path d="M16 98 L30 96 L32 124 L18 122 L14 110 Z" fill={p[5]} stroke={stroke} strokeWidth="0.7" />
      <path d="M70 96 L84 98 L86 110 L82 122 L68 124 Z" fill={p[7]} stroke={stroke} strokeWidth="0.7" />
      <path d="M32 96 L68 96 L72 128 L28 128 Z" fill={p[6]} stroke={stroke} strokeWidth="0.7" />
      <rect x="26" y="130" width="48" height="6" rx="1" fill={p[6]} stroke={stroke} strokeWidth="0.6" />
      <Wheel x={8} y={34} fill={w[0]} punctured={punctured[0]} />
      <Wheel x={84} y={34} fill={w[1]} punctured={punctured[1]} />
      <Wheel x={8} y={108} fill={w[2]} punctured={punctured[2]} />
      <Wheel x={84} y={108} fill={w[3]} punctured={punctured[3]} />
      <Integrity label={integrityLabel} />
    </>
  );
}

function PrototypeCar({
  p,
  w,
  punctured,
  integrityLabel,
}: {
  p: string[];
  w: string[];
  punctured: boolean[];
  integrityLabel: string | null;
}) {
  return (
    <>
      <path d="M38 8 L50 4 L62 8 L70 22 L30 22 Z" fill={p[1]} stroke={stroke} strokeWidth="0.7" />
      <path d="M22 24 L30 22 L32 48 L18 50 L16 34 Z" fill={p[0]} stroke={stroke} strokeWidth="0.7" />
      <path d="M70 22 L78 24 L84 34 L82 50 L68 48 Z" fill={p[2]} stroke={stroke} strokeWidth="0.7" />
      <path d="M30 22 L70 22 L68 48 L32 48 Z" fill={p[1]} stroke={stroke} strokeWidth="0.7" opacity="0.9" />
      <path d="M18 50 L32 48 L34 100 L20 102 Z" fill={p[3]} stroke={stroke} strokeWidth="0.7" />
      <path d="M68 48 L82 50 L80 102 L66 100 Z" fill={p[4]} stroke={stroke} strokeWidth="0.7" />
      <path d="M32 48 L68 48 L66 100 L34 100 Z" fill="#1e293b" stroke={stroke} strokeWidth="0.7" />
      <path d="M20 102 L34 100 L36 126 L22 124 L16 114 Z" fill={p[5]} stroke={stroke} strokeWidth="0.7" />
      <path d="M66 100 L80 102 L84 114 L78 124 L64 126 Z" fill={p[7]} stroke={stroke} strokeWidth="0.7" />
      <path d="M34 100 L66 100 L70 130 L30 130 Z" fill={p[6]} stroke={stroke} strokeWidth="0.7" />
      <rect x="18" y="132" width="64" height="8" rx="1" fill={p[6]} stroke={stroke} strokeWidth="0.7" />
      <Wheel x={6} y={32} fill={w[0]} punctured={punctured[0]} />
      <Wheel x={86} y={32} fill={w[1]} punctured={punctured[1]} />
      <Wheel x={6} y={110} fill={w[2]} punctured={punctured[2]} />
      <Wheel x={86} y={110} fill={w[3]} punctured={punctured[3]} />
      <Integrity label={integrityLabel} />
    </>
  );
}

function OpenWheelCar({
  p,
  w,
  punctured,
  integrityLabel,
}: {
  p: string[];
  w: string[];
  punctured: boolean[];
  integrityLabel: string | null;
}) {
  return (
    <>
      <path d="M46 6 L50 2 L54 6 L58 28 L42 28 Z" fill={p[1]} stroke={stroke} strokeWidth="0.7" />
      <path d="M30 30 L42 28 L44 50 L28 52 L26 38 Z" fill={p[0]} stroke={stroke} strokeWidth="0.7" />
      <path d="M58 28 L70 30 L74 38 L72 52 L56 50 Z" fill={p[2]} stroke={stroke} strokeWidth="0.7" />
      <path d="M42 28 L58 28 L56 50 L44 50 Z" fill={p[1]} stroke={stroke} strokeWidth="0.7" />
      <path d="M28 52 L44 50 L46 95 L32 98 Z" fill={p[3]} stroke={stroke} strokeWidth="0.7" />
      <path d="M56 50 L72 52 L68 98 L54 95 Z" fill={p[4]} stroke={stroke} strokeWidth="0.7" />
      <path d="M44 50 L56 50 L54 95 L46 95 Z" fill="#1e293b" stroke={stroke} strokeWidth="0.7" />
      <path d="M32 98 L46 95 L48 120 L34 122 L28 110 Z" fill={p[5]} stroke={stroke} strokeWidth="0.7" />
      <path d="M54 95 L68 98 L72 110 L66 122 L52 120 Z" fill={p[7]} stroke={stroke} strokeWidth="0.7" />
      <path d="M46 95 L54 95 L58 124 L42 124 Z" fill={p[6]} stroke={stroke} strokeWidth="0.7" />
      <rect x="22" y="126" width="56" height="10" rx="1" fill={p[6]} stroke={stroke} strokeWidth="0.8" />
      <Wheel x={4} y={28} w={10} h={20} fill={w[0]} punctured={punctured[0]} />
      <Wheel x={86} y={28} w={10} h={20} fill={w[1]} punctured={punctured[1]} />
      <Wheel x={4} y={108} w={10} h={20} fill={w[2]} punctured={punctured[2]} />
      <Wheel x={86} y={108} w={10} h={20} fill={w[3]} punctured={punctured[3]} />
      <Integrity label={integrityLabel} />
    </>
  );
}

function HatchCar({
  p,
  w,
  punctured,
  integrityLabel,
}: {
  p: string[];
  w: string[];
  punctured: boolean[];
  integrityLabel: string | null;
}) {
  return (
    <>
      <path d="M30 16 L50 12 L70 16 L74 36 L26 36 Z" fill={p[1]} stroke={stroke} strokeWidth="0.7" />
      <path d="M16 38 L26 36 L28 58 L14 60 L12 46 Z" fill={p[0]} stroke={stroke} strokeWidth="0.7" />
      <path d="M74 36 L84 38 L88 46 L86 60 L72 58 Z" fill={p[2]} stroke={stroke} strokeWidth="0.7" />
      <path d="M26 36 L74 36 L72 58 L28 58 Z" fill={p[1]} stroke={stroke} strokeWidth="0.7" opacity="0.85" />
      <path d="M14 60 L28 58 L30 100 L16 102 Z" fill={p[3]} stroke={stroke} strokeWidth="0.7" />
      <path d="M72 58 L86 60 L84 102 L70 100 Z" fill={p[4]} stroke={stroke} strokeWidth="0.7" />
      <path d="M28 58 L72 58 L70 100 L30 100 Z" fill="#1e293b" stroke={stroke} strokeWidth="0.7" />
      <path d="M16 102 L30 100 L34 128 L20 126 L12 114 Z" fill={p[5]} stroke={stroke} strokeWidth="0.7" />
      <path d="M70 100 L84 102 L88 114 L80 126 L66 128 Z" fill={p[7]} stroke={stroke} strokeWidth="0.7" />
      <path d="M30 100 L70 100 L74 132 L26 132 Z" fill={p[6]} stroke={stroke} strokeWidth="0.7" />
      <Wheel x={6} y={40} fill={w[0]} punctured={punctured[0]} />
      <Wheel x={86} y={40} fill={w[1]} punctured={punctured[1]} />
      <Wheel x={6} y={112} fill={w[2]} punctured={punctured[2]} />
      <Wheel x={86} y={112} fill={w[3]} punctured={punctured[3]} />
      <Integrity label={integrityLabel} />
    </>
  );
}

function StockCar({
  p,
  w,
  punctured,
  integrityLabel,
}: {
  p: string[];
  w: string[];
  punctured: boolean[];
  integrityLabel: string | null;
}) {
  return (
    <>
      <path d="M24 14 L50 10 L76 14 L80 34 L20 34 Z" fill={p[1]} stroke={stroke} strokeWidth="0.7" />
      <path d="M14 36 L20 34 L22 58 L12 60 L10 44 Z" fill={p[0]} stroke={stroke} strokeWidth="0.7" />
      <path d="M80 34 L86 36 L90 44 L88 60 L78 58 Z" fill={p[2]} stroke={stroke} strokeWidth="0.7" />
      <path d="M20 34 L80 34 L78 58 L22 58 Z" fill={p[1]} stroke={stroke} strokeWidth="0.7" opacity="0.85" />
      <path d="M12 60 L22 58 L24 102 L14 104 Z" fill={p[3]} stroke={stroke} strokeWidth="0.7" />
      <path d="M78 58 L88 60 L86 104 L76 102 Z" fill={p[4]} stroke={stroke} strokeWidth="0.7" />
      <path d="M22 58 L78 58 L76 102 L24 102 Z" fill="#1e293b" stroke={stroke} strokeWidth="0.7" />
      <path d="M14 104 L24 102 L26 130 L16 128 L10 116 Z" fill={p[5]} stroke={stroke} strokeWidth="0.7" />
      <path d="M76 102 L86 104 L90 116 L84 128 L74 130 Z" fill={p[7]} stroke={stroke} strokeWidth="0.7" />
      <path d="M24 102 L76 102 L80 134 L20 134 Z" fill={p[6]} stroke={stroke} strokeWidth="0.7" />
      <Wheel x={4} y={38} fill={w[0]} punctured={punctured[0]} />
      <Wheel x={88} y={38} fill={w[1]} punctured={punctured[1]} />
      <Wheel x={4} y={112} fill={w[2]} punctured={punctured[2]} />
      <Wheel x={88} y={112} fill={w[3]} punctured={punctured[3]} />
      <Integrity label={integrityLabel} />
    </>
  );
}

function TruckCar({
  p,
  w,
  punctured,
  integrityLabel,
}: {
  p: string[];
  w: string[];
  punctured: boolean[];
  integrityLabel: string | null;
}) {
  return (
    <>
      <path d="M28 10 L50 6 L72 10 L78 40 L22 40 Z" fill={p[1]} stroke={stroke} strokeWidth="0.7" />
      <path d="M12 42 L22 40 L24 70 L10 72 L8 52 Z" fill={p[0]} stroke={stroke} strokeWidth="0.7" />
      <path d="M78 40 L88 42 L92 52 L90 72 L76 70 Z" fill={p[2]} stroke={stroke} strokeWidth="0.7" />
      <path d="M22 40 L78 40 L76 70 L24 70 Z" fill={p[1]} stroke={stroke} strokeWidth="0.7" opacity="0.9" />
      <path d="M10 72 L24 70 L26 108 L12 110 Z" fill={p[3]} stroke={stroke} strokeWidth="0.7" />
      <path d="M76 70 L90 72 L88 110 L74 108 Z" fill={p[4]} stroke={stroke} strokeWidth="0.7" />
      <path d="M24 70 L76 70 L74 108 L26 108 Z" fill="#1e293b" stroke={stroke} strokeWidth="0.7" />
      <path d="M12 110 L26 108 L28 138 L14 136 L8 124 Z" fill={p[5]} stroke={stroke} strokeWidth="0.7" />
      <path d="M74 108 L88 110 L92 124 L86 136 L72 138 Z" fill={p[7]} stroke={stroke} strokeWidth="0.7" />
      <path d="M26 108 L74 108 L78 142 L22 142 Z" fill={p[6]} stroke={stroke} strokeWidth="0.7" />
      <Wheel x={2} y={44} w={9} h={20} fill={w[0]} punctured={punctured[0]} />
      <Wheel x={89} y={44} w={9} h={20} fill={w[1]} punctured={punctured[1]} />
      <Wheel x={2} y={116} w={9} h={20} fill={w[2]} punctured={punctured[2]} />
      <Wheel x={89} y={116} w={9} h={20} fill={w[3]} punctured={punctured[3]} />
      <Integrity label={integrityLabel} />
    </>
  );
}

export const CarSilhouette = ({
  style,
  panelFill,
  wheelFill,
  punctured,
  integrityLabel,
}: CarSilhouetteProps) => {
  const p =
    panelFill.length === 8
      ? panelFill
      : Array.from({ length: 8 }, () => '#64748b');
  const w =
    wheelFill.length === 4
      ? wheelFill
      : Array.from({ length: 4 }, () => '#10b981');
  const punct =
    punctured.length === 4 ? punctured : [false, false, false, false];

  const body =
    style === 'prototype' ? (
      <PrototypeCar p={p} w={w} punctured={punct} integrityLabel={integrityLabel} />
    ) : style === 'openwheel' ? (
      <OpenWheelCar p={p} w={w} punctured={punct} integrityLabel={integrityLabel} />
    ) : style === 'hatch' ? (
      <HatchCar p={p} w={w} punctured={punct} integrityLabel={integrityLabel} />
    ) : style === 'stock' ? (
      <StockCar p={p} w={w} punctured={punct} integrityLabel={integrityLabel} />
    ) : style === 'truck' ? (
      <TruckCar p={p} w={w} punctured={punct} integrityLabel={integrityLabel} />
    ) : (
      <GtCar p={p} w={w} punctured={punct} integrityLabel={integrityLabel} />
    );

  return (
    <svg viewBox="0 0 100 160" className="h-full w-full" aria-label="Car damage">
      {body}
    </svg>
  );
};
