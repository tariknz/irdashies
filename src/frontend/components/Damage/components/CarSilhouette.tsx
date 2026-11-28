import type { DamageBodyStyle } from '../bodyStyle';
import { BODY_FILL, SUSP_OK_ACCENT } from '../logic';

export interface DamageAreaLabels {
  front?: string | null;
  rear?: string | null;
  left?: string | null;
  right?: string | null;
  centre?: string | null;
  fl?: string | null;
  fr?: string | null;
  rl?: string | null;
  rr?: string | null;
}

export interface CarSilhouetteProps {
  style: DamageBodyStyle;
  bodyStroke: [string, string, string, string];
  wingFill: string;
  wheelFill: string[];
  suspFill: string[];
  labels?: DamageAreaLabels;
}

const OK_BODY = BODY_FILL.ok;
const CABIN = '#3f3f46';

interface Layout {
  midX: number;
  noseY: number;
  noseW: number;
  hoodY: number;
  cabinY: number;
  cabinH: number;
  cabinInset: number;
  rearDeckY: number;
  tailY: number;
  bodyW: number;
  wheelW: number;
  wheelH: number;
  frontWheelY: number;
  rearWheelY: number;
  wingY: number;
  wingH: number;
  wingExtra: number;
}

const HATCH_LAYOUT: Layout = {
  midX: 60,
  noseY: 16,
  noseW: 36,
  hoodY: 32,
  cabinY: 42,
  cabinH: 46,
  cabinInset: 7,
  rearDeckY: 92,
  tailY: 112,
  bodyW: 50,
  wheelW: 10,
  wheelH: 18,
  frontWheelY: 34,
  rearWheelY: 94,
  wingY: 118,
  wingH: 4,
  wingExtra: 2,
};

const STOCK_LAYOUT: Layout = {
  midX: 60,
  noseY: 8,
  noseW: 34,
  hoodY: 40,
  cabinY: 52,
  cabinH: 38,
  cabinInset: 9,
  rearDeckY: 94,
  tailY: 126,
  bodyW: 56,
  wheelW: 10,
  wheelH: 20,
  frontWheelY: 34,
  rearWheelY: 104,
  wingY: 132,
  wingH: 5,
  wingExtra: 2,
};

const TRUCK_LAYOUT: Layout = {
  midX: 60,
  noseY: 10,
  noseW: 48,
  hoodY: 30,
  cabinY: 38,
  cabinH: 30,
  cabinInset: 7,
  rearDeckY: 72,
  tailY: 128,
  bodyW: 60,
  wheelW: 11,
  wheelH: 21,
  frontWheelY: 30,
  rearWheelY: 102,
  wingY: 132,
  wingH: 4,
  wingExtra: -4,
};

function layoutFor(style: DamageBodyStyle): Layout {
  if (style === 'hatch') return HATCH_LAYOUT;
  if (style === 'stock') return STOCK_LAYOUT;
  if (style === 'truck') return TRUCK_LAYOUT;
  const open = style === 'openwheel';
  const proto = style === 'prototype';
  const frontHeavy = style === 'gtFront';
  const rearHeavy = style === 'gtRear';

  const bodyW = open ? 42 : 50;
  const noseW = open ? 18 : proto ? 28 : frontHeavy ? 36 : 30;
  const cabinInset = open ? 10 : 8;

  return {
    midX: 60,
    noseY: frontHeavy ? 8 : open ? 14 : 10,
    noseW,
    hoodY: frontHeavy ? 36 : open ? 30 : rearHeavy ? 28 : 32,
    cabinY: frontHeavy ? 48 : open ? 42 : rearHeavy ? 40 : 44,
    cabinH: open ? 36 : rearHeavy ? 34 : 40,
    cabinInset,
    rearDeckY: open ? 88 : rearHeavy ? 86 : 92,
    tailY: open ? 118 : rearHeavy ? 126 : 122,
    bodyW,
    wheelW: open ? 12 : 10,
    wheelH: open ? 22 : 20,
    frontWheelY: frontHeavy ? 34 : open ? 32 : 36,
    rearWheelY: open ? 100 : rearHeavy ? 108 : 106,
    wingY: open ? 128 : 136,
    wingH: open ? 9 : 7,
    wingExtra: open ? 22 : 14,
  };
}

const Pct = ({
  x,
  y,
  label,
  anchor = 'middle',
}: {
  x: number;
  y: number;
  label: string | null | undefined;
  anchor?: 'start' | 'middle' | 'end';
}) => {
  if (!label) return null;
  return (
    <text
      x={x}
      y={y}
      textAnchor={anchor}
      dominantBaseline="middle"
      fill="#f8fafc"
      fontSize="9"
      fontFamily="ui-monospace, monospace"
      fontWeight="700"
      style={{ paintOrder: 'stroke', stroke: '#0f172a', strokeWidth: 2.5 }}
    >
      {label}
    </text>
  );
};

const Wheel = ({
  x,
  y,
  w,
  h,
  fill,
}: {
  x: number;
  y: number;
  w: number;
  h: number;
  fill: string;
}) => <rect x={x} y={y} width={w} height={h} rx={2.5} fill={fill} />;

const SuspCorner = ({
  side,
  cx,
  cy,
  fill,
}: {
  side: 'left' | 'right';
  cx: number;
  cy: number;
  fill: string;
}) => {
  const ok = fill === SUSP_OK_ACCENT || fill === BODY_FILL.ok;
  const bar = ok ? SUSP_OK_ACCENT : fill;
  const chevron = ok ? OK_BODY : fill;
  const barX = side === 'left' ? cx - 5 : cx + 2;
  const chevronX = side === 'left' ? cx + 2 : cx - 10;
  const points =
    side === 'left'
      ? `${chevronX},${cy - 5} ${chevronX + 7},${cy} ${chevronX},${cy + 5}`
      : `${chevronX + 7},${cy - 5} ${chevronX},${cy} ${chevronX + 7},${cy + 5}`;

  return (
    <g>
      <rect x={barX} y={cy - 7} width={3} height={14} rx={0.8} fill={bar} />
      <polygon points={points} fill={chevron} />
    </g>
  );
};

export const CarSilhouette = ({
  style,
  bodyStroke,
  wingFill,
  wheelFill,
  suspFill,
  labels = {},
}: CarSilhouetteProps) => {
  const L = layoutFor(style);
  const [front, right, rear, left] = bodyStroke;
  const mid = L.midX;
  const half = L.bodyW / 2;
  const leftX = mid - half;
  const rightX = mid + half;
  const noseHalf = L.noseW / 2;
  const cabinL = leftX + L.cabinInset;
  const cabinR = rightX - L.cabinInset;
  const cabinB = L.cabinY + L.cabinH;
  const strokeW = 2.8;

  const wheelGap = 3;
  const flX = leftX - L.wheelW - wheelGap;
  const frX = rightX + wheelGap;
  const wheels = [
    wheelFill[0] ?? SUSP_OK_ACCENT,
    wheelFill[1] ?? SUSP_OK_ACCENT,
    wheelFill[2] ?? SUSP_OK_ACCENT,
    wheelFill[3] ?? SUSP_OK_ACCENT,
  ];
  const susp = [
    suspFill[0] ?? OK_BODY,
    suspFill[1] ?? OK_BODY,
    suspFill[2] ?? OK_BODY,
    suspFill[3] ?? OK_BODY,
  ];

  const wingW = L.bodyW + L.wingExtra;
  const wingX = mid - wingW / 2;

  const frontPath = [
    `M ${mid - noseHalf} ${L.noseY + 4}`,
    `Q ${mid} ${L.noseY - 2} ${mid + noseHalf} ${L.noseY + 4}`,
    `L ${rightX - 2} ${L.hoodY}`,
    `L ${leftX + 2} ${L.hoodY}`,
    `Z`,
  ].join(' ');

  const leftPath = [
    `M ${leftX + 2} ${L.hoodY}`,
    `L ${leftX} ${L.frontWheelY + 2}`,
    `L ${leftX - 1} ${L.frontWheelY + L.wheelH}`,
    `L ${leftX} ${cabinB}`,
    `L ${leftX - 1} ${L.rearWheelY}`,
    `L ${leftX} ${L.rearWheelY + L.wheelH}`,
    `L ${leftX + 3} ${L.tailY}`,
  ].join(' ');

  const rightPath = [
    `M ${rightX - 2} ${L.hoodY}`,
    `L ${rightX} ${L.frontWheelY + 2}`,
    `L ${rightX + 1} ${L.frontWheelY + L.wheelH}`,
    `L ${rightX} ${cabinB}`,
    `L ${rightX + 1} ${L.rearWheelY}`,
    `L ${rightX} ${L.rearWheelY + L.wheelH}`,
    `L ${rightX - 3} ${L.tailY}`,
  ].join(' ');

  const rearPath = [
    `M ${leftX + 3} ${L.tailY}`,
    `L ${mid - noseHalf * 0.7} ${L.tailY + 4}`,
    `Q ${mid} ${L.tailY + 8} ${mid + noseHalf * 0.7} ${L.tailY + 4}`,
    `L ${rightX - 3} ${L.tailY}`,
  ].join(' ');

  const cabinPath = [
    `M ${cabinL} ${L.cabinY}`,
    `L ${cabinR} ${L.cabinY}`,
    `L ${cabinR - 2} ${cabinB}`,
    `L ${cabinL + 2} ${cabinB}`,
    `Z`,
  ].join(' ');

  const hoodLineY = (L.hoodY + L.cabinY) / 2;
  const rearDeckLineY = (cabinB + L.tailY) / 2;

  return (
    <svg
      viewBox="0 0 120 168"
      className="h-full w-full"
      aria-label="Car damage"
    >
      <defs>
        <filter id="damageGlow" x="-40%" y="-40%" width="180%" height="180%">
          <feGaussianBlur stdDeviation="1.1" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      <g filter="url(#damageGlow)">
        <path
          d={frontPath}
          fill="none"
          stroke={front}
          strokeWidth={strokeW}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        <path
          d={leftPath}
          fill="none"
          stroke={left}
          strokeWidth={strokeW}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d={rightPath}
          fill="none"
          stroke={right}
          strokeWidth={strokeW}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d={rearPath}
          fill="none"
          stroke={rear}
          strokeWidth={strokeW}
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        <path
          d={cabinPath}
          fill="none"
          stroke={CABIN}
          strokeWidth={1.4}
          strokeLinejoin="round"
        />
        <line
          x1={mid}
          y1={L.cabinY + 4}
          x2={mid}
          y2={cabinB - 4}
          stroke={CABIN}
          strokeWidth={1}
          opacity={0.85}
        />
        <path
          d={`M ${leftX + 6} ${hoodLineY} L ${rightX - 6} ${hoodLineY}`}
          fill="none"
          stroke={front}
          strokeWidth={1}
          opacity={0.45}
        />
        <path
          d={`M ${leftX + 6} ${rearDeckLineY} L ${rightX - 6} ${rearDeckLineY}`}
          fill="none"
          stroke={rear}
          strokeWidth={1}
          opacity={0.4}
        />

        <rect
          x={wingX}
          y={L.wingY}
          width={wingW}
          height={L.wingH}
          rx={2}
          fill={wingFill}
        />
        <rect
          x={wingX + 2}
          y={L.wingY - 5}
          width={3}
          height={6}
          rx={0.6}
          fill={wingFill}
        />
        <rect
          x={wingX + wingW - 5}
          y={L.wingY - 5}
          width={3}
          height={6}
          rx={0.6}
          fill={wingFill}
        />

        <Wheel
          x={flX}
          y={L.frontWheelY}
          w={L.wheelW}
          h={L.wheelH}
          fill={wheels[0]}
        />
        <Wheel
          x={frX}
          y={L.frontWheelY}
          w={L.wheelW}
          h={L.wheelH}
          fill={wheels[1]}
        />
        <Wheel
          x={flX}
          y={L.rearWheelY}
          w={L.wheelW}
          h={L.wheelH}
          fill={wheels[2]}
        />
        <Wheel
          x={frX}
          y={L.rearWheelY}
          w={L.wheelW}
          h={L.wheelH}
          fill={wheels[3]}
        />

        <SuspCorner
          side="left"
          cx={leftX + 9}
          cy={L.frontWheelY + L.wheelH / 2}
          fill={susp[0]}
        />
        <SuspCorner
          side="right"
          cx={rightX - 9}
          cy={L.frontWheelY + L.wheelH / 2}
          fill={susp[1]}
        />
        <SuspCorner
          side="left"
          cx={leftX + 9}
          cy={L.rearWheelY + L.wheelH / 2}
          fill={susp[2]}
        />
        <SuspCorner
          side="right"
          cx={rightX - 9}
          cy={L.rearWheelY + L.wheelH / 2}
          fill={susp[3]}
        />
      </g>

      <Pct x={mid} y={L.noseY - 4} label={labels.front} />
      <Pct x={mid} y={(L.cabinY + cabinB) / 2} label={labels.centre} />
      <Pct x={mid} y={L.wingY + L.wingH + 10} label={labels.rear} />
      <Pct
        x={leftX - 12}
        y={(L.cabinY + cabinB) / 2}
        label={labels.left}
        anchor="end"
      />
      <Pct
        x={rightX + 12}
        y={(L.cabinY + cabinB) / 2}
        label={labels.right}
        anchor="start"
      />
      <Pct
        x={flX - 2}
        y={L.frontWheelY + L.wheelH / 2}
        label={labels.fl}
        anchor="end"
      />
      <Pct
        x={frX + L.wheelW + 2}
        y={L.frontWheelY + L.wheelH / 2}
        label={labels.fr}
        anchor="start"
      />
      <Pct
        x={flX - 2}
        y={L.rearWheelY + L.wheelH / 2}
        label={labels.rl}
        anchor="end"
      />
      <Pct
        x={frX + L.wheelW + 2}
        y={L.rearWheelY + L.wheelH / 2}
        label={labels.rr}
        anchor="start"
      />
    </svg>
  );
};
