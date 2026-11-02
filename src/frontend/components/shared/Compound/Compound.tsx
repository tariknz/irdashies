import { memo } from 'react';
import { useDriverTires } from '@irdashies/context';

interface Tire {
  TireIndex: number;
  TireCompoundType: string;
}

interface CompoundProps {
  tireCompound: number;
  /**
   * The four wheels, FL, FR, RL, RR, where the sim reports them per wheel.
   *
   * LMU does; iRacing reports one compound per car, and leaves this undefined.
   * A wheel with no reading is -1. When all four agree the single glyph is
   * drawn as before -- the split view is for when they genuinely differ, which
   * is a real LMU strategy (a car can run a wet front and a dry rear).
   */
  wheelCompounds?: readonly number[];
  mockTires?: Tire[];
}

/** Grey, but visibly a compound: named something this build does not know. */
const UNRECOGNISED = '#888888';
/** Darker grey: no compound at all. The renderer's existing default. */
const NO_DATA = '#4d4d4d';

const COMPOUND_COLORS: Record<string, string> = {
  Hard: '#ffffff',
  Primary: '#ffffff',
  Medium: '#f0d700',
  Soft: '#d40000',
  Alternate: '#d40000',
  Wet: '#078cd1',
  Dry: '#4d4d4d',
};

/**
 * Substring rules, for a name no exact entry covers.
 *
 * LMU names its compounds freely -- "Soft Slick", "Full Wet", a marque's own
 * wording -- where iRacing uses a closed set. Checked in order, and wet comes
 * first on purpose: "Hard Wet" is a wet, and matching "hard" first would paint
 * it as a dry.
 */
const COMPOUND_PATTERNS: readonly [readonly string[], string][] = [
  [['wet', 'rain'], '#078cd1'],
  [['hard'], '#ffffff'],
  [['medium', 'med'], '#f0d700'],
  [['soft'], '#d40000'],
];

const colorForName = (name: string | undefined): string => {
  if (!name) return NO_DATA;
  const exact = COMPOUND_COLORS[name];
  if (exact) return exact;
  const lower = name.toLowerCase();
  for (const [needles, color] of COMPOUND_PATTERNS) {
    if (needles.some((needle) => lower.includes(needle))) return color;
  }
  return UNRECOGNISED;
};

/**
 * The compound name for an index, with iRacing's two-compound special case.
 *
 * When a session offers exactly Hard and Wet, "Hard" is the dry tyre and is
 * labelled as such -- which is how iRacing presents it and what the colour
 * table's `Dry` entry is for.
 */
const nameFor = (
  tires: Tire[] | undefined,
  index: number
): string | undefined => {
  const raw = tires?.find((tire) => tire.TireIndex === index)?.TireCompoundType;
  if (!tires || tires.length !== 2) return raw;
  const types = tires.map((tire) => tire.TireCompoundType);
  if (types.includes('Hard') && types.includes('Wet') && raw === 'Hard') {
    return 'Dry';
  }
  return raw;
};

const Tyre = ({ color }: { color: string }) => (
  <svg
    viewBox="0 0 100 100"
    className="inline-block w-[1.2em] h-[1.2em] shrink-0"
    width="100%"
    height="100%"
  >
    <circle
      cx="50"
      cy="50"
      r="46"
      stroke="#cccccc"
      strokeWidth="6"
      fill="none"
      opacity="0.5"
    />
    <circle
      cx="50"
      cy="50"
      r="34"
      stroke="#333333"
      strokeWidth="20"
      fill="none"
    />
    <circle
      cx="50"
      cy="50"
      r="20"
      stroke={color}
      strokeWidth="12"
      fill="none"
    />
    <circle
      cx="50"
      cy="50"
      r="10"
      stroke="#333333"
      strokeWidth="8"
      fill="none"
    />
    <circle cx="50" cy="50" r="2" fill="none" />
  </svg>
);

/**
 * Four dots laid out as the car, for a mixed set.
 *
 * The same footprint as the single glyph, so a row holding one of each does
 * not change height. Borrowed from LMUTraceHUB, which solves the same problem
 * the same way -- a glyph per corner is unreadable at a standings row's size,
 * where a 2x2 of dots is not.
 */
const WheelDots = ({ colors }: { colors: readonly string[] }) => (
  <span
    className="inline-grid grid-cols-2 grid-rows-2 gap-[0.12em] w-[1.2em] h-[1.2em] shrink-0"
    aria-hidden="true"
  >
    {colors.map((color, wheel) => (
      <span
        key={wheel}
        className="rounded-full w-full h-full"
        style={{ background: color }}
      />
    ))}
  </span>
);

export const Compound = memo(
  ({ tireCompound, wheelCompounds, mockTires }: CompoundProps) => {
    const sessionDriverTires = useDriverTires();
    const tires = mockTires || sessionDriverTires;

    const wheels = wheelCompounds?.length === 4 ? wheelCompounds : undefined;
    const uniform =
      wheels !== undefined && wheels.every((wheel) => wheel === wheels[0]);

    if (wheels && !uniform) {
      return (
        <WheelDots
          colors={wheels.map((wheel) =>
            wheel < 0 ? NO_DATA : colorForName(nameFor(tires, wheel))
          )}
        />
      );
    }

    // Prefer the wheels' own value when they agree: it is the same reading the
    // split view would show, so switching between the two views cannot change
    // the colour.
    const index = uniform && wheels ? wheels[0] : tireCompound;
    if (index < 0) {
      return null;
    }

    return <Tyre color={colorForName(nameFor(tires, index)) || NO_DATA} />;
  }
);

Compound.displayName = 'Compound';
