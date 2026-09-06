/**
 * Per-driver line identity: colour + dash pattern, keyed off qualifying grid
 * slot (1-based). Fixed for the whole race — carIdx and qualifying position
 * never change mid-session, so a driver's identity never does either.
 *
 * identityIndex = slot - 1
 * colorIndex    = identityIndex % 10
 * patternIndex  = floor(identityIndex / 10) % 4
 *
 * 10 colours x 4 patterns = 40 unique identities, then the ramp repeats.
 * Slot 41 collides with slot 1. Deliberate: cars that deep in the field are
 * drawn at context (faint background) strength anyway, and the readout and
 * driver list always resolve identity from carIdx, never from colour alone.
 */

/**
 * Qualifying positions 1-10, solid.
 *
 * Stepped for the dark plot surface (#0f172a) and ordered so that adjacent
 * grid slots sit as far apart as possible, which is what a reader actually
 * compares. Verified with the dataviz palette validator on the adjacent
 * pairlist (the one that applies to line charts): worst adjacent deltaE 13.2
 * under deuteranopia, 19.3 under normal vision, every check passing.
 *
 * Do not re-order or re-shade by eye. The previous ramp was a smooth hue
 * sweep, which put emerald next to teal at deltaE 5.2 (normal vision) and
 * fuchsia next to violet at 0.4 (protanopia) — indistinguishable in practice.
 * Re-run the validator before changing any value here.
 *
 * Ten colours cannot all be mutually distinguishable: under an all-pairs test
 * only three clear the floors, on any surface. Identity therefore also rests
 * on the dash pattern, the driver-list swatch, and the hover readout, which
 * name the car directly.
 */
export const IDENTITY_COLORS: readonly string[] = [
  '#199e70', // 1 aqua
  '#9085e9', // 2 violet
  '#e66767', // 3 red
  '#c026d3', // 4 fuchsia
  '#008300', // 5 green
  '#0891b2', // 6 cyan
  '#c98500', // 7 gold
  '#d55181', // 8 magenta
  '#3987e5', // 9 blue
  '#d95926', // 10 orange
];

/** Base canvas dash arrays at lineWidth 1 (CSS px), in ramp order. */
const BASE_CANVAS_DASH: readonly (readonly number[])[] = [
  [], // solid: positions 1-10
  [7, 4], // dashed: positions 11-20
  [2, 3], // dotted: positions 21-30
  [7, 3, 2, 3], // dash-dot: positions 31-40
];

/**
 * `stroke-dasharray` values for the driver-list legend swatch. Tuned smaller
 * than the canvas dash table above: the swatch is ~14px wide and needs its
 * own numbers to read as a pattern rather than a line with a stray gap.
 * `undefined` for solid omits the attribute entirely.
 */
const SWATCH_DASH_ARRAYS: readonly (string | undefined)[] = [
  undefined,
  '4 2',
  '1.5 2',
  '4 1.5 1 1.5',
];

export interface LineIdentity {
  color: string;
  /** Unscaled base dash pattern, at lineWidth 1. Scale with `scaleDash`. */
  dash: readonly number[];
}

/**
 * Slots are 1-based. Anything lower (or non-finite) would index the ramps
 * negatively and hand back `undefined`, which reaches the canvas as a crash
 * rather than a wrong colour, so clamp rather than trust the caller.
 */
const identityIndexForGridSlot = (slot: number): number =>
  Number.isFinite(slot) ? Math.max(0, Math.floor(slot) - 1) : 0;

const patternIndexForGridSlot = (slot: number): number =>
  Math.floor(identityIndexForGridSlot(slot) / IDENTITY_COLORS.length) %
  BASE_CANVAS_DASH.length;

/** Colour + base dash pattern for a 1-based qualifying grid slot. */
export const identityForGridSlot = (slot: number): LineIdentity => ({
  color:
    IDENTITY_COLORS[identityIndexForGridSlot(slot) % IDENTITY_COLORS.length],
  dash: BASE_CANVAS_DASH[patternIndexForGridSlot(slot)],
});

/**
 * Scales a base dash pattern to a stroke width, so dash and gap length stay
 * proportional to the line rather than shrinking into a blob at width 1 or
 * blowing out at width 3. Solid (`[]`) is unaffected either way.
 */
export const scaleDash = (
  dash: readonly number[],
  lineWidth: number
): number[] => dash.map((segment) => segment * lineWidth);

/** `stroke-dasharray` for the driver-list legend swatch at a grid slot. */
export const swatchDashArrayForGridSlot = (slot: number): string | undefined =>
  SWATCH_DASH_ARRAYS[patternIndexForGridSlot(slot)];
