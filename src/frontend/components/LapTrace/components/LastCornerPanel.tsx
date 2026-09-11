import { useEffect, useRef, useState } from 'react';
import { GaugeIcon, RulerIcon, TimerIcon } from '@phosphor-icons/react';
import { formatDelta } from '@irdashies/utils/time';
import type { SpeedUnit } from '@irdashies/utils/units';
import type { LastCornerDisplayColumn } from '@irdashies/types';

/** One line in the panel. Deltas are null while the corner is still being driven. */
export interface LastCornerPanelEntry {
  sectionId: string;
  label: string;
  timeDeltaSec: number | null;
  /** Independent of timeDeltaSec/apexSpeedDelta — can stay null on an otherwise-resolved entry. */
  brakePointDeltaM: number | null;
  /** Already converted to `speedUnit` by the caller. */
  apexSpeedDelta: number | null;
  /**
   * `Date.now()` when this corner was completed, used to retire the hero after
   * HERO_HOLD_MS. Optional: without it the entry never ages, which is what a
   * story or a test with a fixed set of rows wants.
   */
  completedAt?: number;
}

export const LAST_CORNER_DEFAULT_FONT_SIZE = 10;

/**
 * How long the corner just finished holds the hero block before dropping into
 * the history rows below it.
 *
 * Left there indefinitely it goes stale: on a long straight, or after a lap
 * that ends in the pits, the panel keeps shouting about a corner from a while
 * ago as though it had just happened. Retiring it leaves the hero blank until
 * the next corner — the slot keeps its space, so a top- or bottom-placed panel
 * never nudges the trace when the timer fires.
 */
export const HERO_HOLD_MS = 5000;

export type LastCornerPlacement = 'top' | 'bottom' | 'left' | 'right';

/** Vertical gap between lines, in px. Matches the `gap-0.5` class below. */
const ROW_GAP_PX = 2;

/**
 * Column width budgets, in em (i.e. multiples of the text size), so the pixel
 * width always scales with the chosen font.
 *
 * Each metric budget covers that chip's icon (1em), its widest realistic
 * value, its unit, and the two 0.15em gaps between them, measured against
 * Lato's advance widths with tabular numerals. Apex speed is the widest of the
 * three because "km/h" is nearly four characters of unit on its own; brake is
 * the narrowest. They are deliberately sized to the content rather than
 * rounded up generously: the panel sits beside the trace, and every em spent
 * here is trace the driver does not get.
 *
 * These are a budget, not a guarantee. Every chip also clips, so an unusually
 * large value shortens itself rather than painting over the column to its
 * right.
 */
const SIDE_TIME_EM = 4.7;
const SIDE_BRAKE_EM = 4.5;
const SIDE_APEX_EM = 6.2;

/**
 * Bounds on the corner-name column, which is sized to the current track's own
 * names rather than to a fixed budget. Turn numbers ("T5", "T12A") need a
 * fraction of what a name like "Variante Tamburello A" does, and reserving the
 * larger for both wasted most of the column on every numbered circuit.
 */
const LABEL_MIN_EM = 3.5;
const LABEL_MAX_EM = 9;

/**
 * Line height of the label when it is allowed to wrap, as a multiple of the
 * font size. Matches Tailwind's `leading-tight`, which the label uses.
 */
const LABEL_LINE_EM = 1.25;

/**
 * Rough advance width of a label, in em. Capitals and digits are wider than
 * lower case, spaces much narrower — close enough to decide a column width and
 * whether a name needs a second line, without measuring text in the DOM.
 */
const labelWidthEm = (label: string): number =>
  [...label].reduce((width, character) => {
    if (character === ' ') return width + 0.28;
    if (/[A-Z0-9]/.test(character)) return width + 0.65;
    return width + 0.52;
  }, 0);

/**
 * Width of the corner-name column: the widest name the track can produce,
 * clamped and rounded up to a half em.
 *
 * Measured over every corner on the circuit, not the handful currently in the
 * panel. Sizing to the history would be narrower on average, but the column
 * would then change width as corners came and went — beside the trace that
 * reads as the plot twitching. One width per track is both fixed and as narrow
 * as that track allows.
 *
 * Rounding to a half em keeps the estimate from expressing false precision;
 * clamping stops a circuit with one very long name from taking the panel over.
 */
const labelColumnEmFor = (labels: string[]): number => {
  let widest = 0;
  for (const label of labels) {
    if (label) widest = Math.max(widest, labelWidthEm(label));
  }
  const clamped = Math.min(Math.max(widest, LABEL_MIN_EM), LABEL_MAX_EM);
  return Math.ceil(clamped * 2) / 2;
};

const metricWidthEm: Record<
  Exclude<LastCornerDisplayColumn, 'corner'>,
  number
> = {
  cornerTimeDelta: SIDE_TIME_EM,
  brakePointDelta: SIDE_BRAKE_EM,
  apexSpeedDelta: SIDE_APEX_EM,
};

const columnWidthEm = (
  column: LastCornerDisplayColumn,
  labelEm: number
): number => (column === 'corner' ? labelEm : metricWidthEm[column]);

/**
 * Row height in px. A row is as tall as its label box, and never shorter than
 * the single line of metrics beside it.
 */
const rowHeightFor = (fontSize: number, labelLines: 1 | 2) =>
  Math.round(fontSize * Math.max(1.6, LABEL_LINE_EM * labelLines));

/** Does this label exceed the corner-name column and need a second line? */
const labelLinesFor = (label: string | undefined, labelEm: number): 1 | 2 => {
  if (!label) return 1;
  return labelWidthEm(label) > labelEm + 0.5 ? 2 : 1;
};

/**
 * A label that wraps onto a second line and only then clips with an ellipsis.
 * `break-words` so a single long word still wraps rather than overflowing.
 */
const labelClassFor = (labelLines: number) =>
  labelLines > 1 ? 'line-clamp-2 break-words leading-tight' : 'truncate';

/**
 * Green always means "you were better", which is why the good direction is a
 * parameter rather than a copy of the ternary per metric. The three metrics
 * don't agree on which sign that is: less time is good (negative), more apex
 * speed is good (positive), and braking later than the reference reads as
 * good (positive) too — so a red +0.22s can and will sit beside a green +7m
 * and a green +2.4km/h. Colour is the invariant a driver reads at a glance;
 * the sign and unit are there for when they have time to look properly.
 */
const deltaColour = (value: number | null, goodIsNegative: boolean): string => {
  if (value === null) return 'text-zinc-500';
  if (value === 0) return 'text-green-400';
  const isGood = goodIsNegative ? value < 0 : value > 0;
  return isGood ? 'text-green-400' : 'text-red-400';
};

/** Matches DeltaSpeed's convention: explicit sign both ways, one decimal. */
const formatSpeedDelta = (value: number): string =>
  `${value >= 0 ? '+' : '-'}${Math.abs(value).toFixed(1)}`;

/** Whole metres — the underlying value is already rounded, this just signs it. */
const formatBrakePointDelta = (value: number): string =>
  `${value > 0 ? '+' : ''}${value}`;

const DEFAULT_DISPLAY_ORDER: LastCornerDisplayColumn[] = [
  'corner',
  'cornerTimeDelta',
  'brakePointDelta',
  'apexSpeedDelta',
];

const normalizeDisplayOrder = (
  displayOrder: LastCornerDisplayColumn[] | undefined
): LastCornerDisplayColumn[] => {
  const order = displayOrder ?? DEFAULT_DISPLAY_ORDER;
  return [
    ...order.filter(
      (column, index) =>
        DEFAULT_DISPLAY_ORDER.includes(column) &&
        order.indexOf(column) === index
    ),
    ...DEFAULT_DISPLAY_ORDER.filter((column) => !order.includes(column)),
  ];
};

/**
 * The columns that actually get drawn: the name plus the metrics switched on.
 *
 * A metric that is off loses its column entirely rather than reserving an
 * empty one, so switching two of them off genuinely narrows the panel. A
 * metric that is on but has no value for this corner keeps its column, so the
 * chips stay aligned down the history while a pairing is missing.
 */
const visibleColumnsFor = (
  displayOrder: LastCornerDisplayColumn[],
  showTime: boolean,
  showBrakeDelta: boolean,
  showApexSpeed: boolean
): LastCornerDisplayColumn[] =>
  displayOrder.filter(
    (column) =>
      column === 'corner' ||
      (column === 'cornerTimeDelta' && showTime) ||
      (column === 'brakePointDelta' && showBrakeDelta) ||
      (column === 'apexSpeedDelta' && showApexSpeed)
  );

/** Total width in em of the columns being drawn. */
const sideWidthEmFor = (
  columns: LastCornerDisplayColumn[],
  labelEm: number
): number =>
  columns.reduce((total, column) => total + columnWidthEm(column, labelEm), 0);

interface LastCornerChipProps {
  column: Exclude<LastCornerDisplayColumn, 'corner'>;
  entry: LastCornerPanelEntry | null;
  speedUnit: SpeedUnit;
  iconSize: number;
}

/**
 * One delta chip, shared between the history rows and the larger hero row —
 * same markup either way, just a different fontSize/iconSize from the parent.
 *
 * The outer span is the grid cell and clips; the inner one never wraps. That
 * pairing is what stops a wide value (a three-figure brake delta, "km/h" on a
 * big font) from spilling sideways over the next column, which is what the
 * width budgets alone could not guarantee.
 */
const LastCornerChip = ({
  column,
  entry,
  speedUnit,
  iconSize,
}: LastCornerChipProps) => {
  const chipClass = (value: number, goodIsNegative: boolean) =>
    `flex items-center gap-[0.15em] whitespace-nowrap font-semibold ${deltaColour(value, goodIsNegative)}`;

  const content = (() => {
    if (column === 'cornerTimeDelta') {
      const value = entry?.timeDeltaSec;
      if (value == null) return null;
      return (
        <span className={chipClass(value, true)}>
          <TimerIcon size={iconSize} weight="bold" className="text-slate-500" />
          {formatDelta(value)}
          <span className="font-normal text-slate-500">s</span>
        </span>
      );
    }
    if (column === 'brakePointDelta') {
      const value = entry?.brakePointDeltaM;
      if (value == null) return null;
      return (
        <span className={chipClass(value, false)}>
          <RulerIcon size={iconSize} weight="bold" className="text-slate-500" />
          {formatBrakePointDelta(value)}
          <span className="font-normal text-slate-500">m</span>
        </span>
      );
    }
    const value = entry?.apexSpeedDelta;
    if (value == null) return null;
    return (
      <span className={chipClass(value, false)}>
        <GaugeIcon size={iconSize} weight="bold" className="text-slate-500" />
        {formatSpeedDelta(value)}
        <span className="font-normal text-slate-500">{speedUnit}</span>
      </span>
    );
  })();

  return (
    <span className="flex min-w-0 items-center overflow-hidden">{content}</span>
  );
};

interface LastCornerRowProps {
  entry: LastCornerPanelEntry | null;
  speedUnit: SpeedUnit;
  fontSize: number;
  columns: LastCornerDisplayColumn[];
  labelEm: number;
  /**
   * The corner just finished. Same single row as the history below it, drawn
   * at a larger size with a brighter, bolder name so it reads as "this just
   * happened" before the driver looks at the numbers at all.
   */
  hero?: boolean;
}

/**
 * One corner's line: name and every enabled delta on a single row.
 *
 * A null entry is an unused slot and a pending entry is the corner being
 * driven right now — both keep their full height so the panel does not change
 * size as history builds.
 */
const LastCornerRow = ({
  entry,
  speedUnit,
  fontSize,
  columns,
  labelEm,
  hero = false,
}: LastCornerRowProps) => {
  const labelLines = labelLinesFor(entry?.label, labelEm);

  return (
    <div
      data-hero={hero ? 'true' : undefined}
      className="grid w-full flex-none items-center gap-[0.3em]"
      style={{
        gridTemplateColumns: columns
          .map((column) => `${columnWidthEm(column, labelEm)}em`)
          .join(' '),
        height: `${rowHeightFor(fontSize, labelLines)}px`,
        fontSize: `${fontSize}px`,
      }}
    >
      {columns.map((column) =>
        column === 'corner' ? (
          <span
            key={column}
            className={[
              'min-w-0 tracking-wide',
              hero ? 'font-bold text-slate-300' : 'text-slate-400',
              labelClassFor(labelLines),
            ].join(' ')}
          >
            {entry?.label ?? ''}
          </span>
        ) : (
          <LastCornerChip
            key={column}
            column={column}
            entry={entry}
            speedUnit={speedUnit}
            iconSize={Math.round(fontSize)}
          />
        )
      )}
    </div>
  );
};

export interface LastCornerPanelProps {
  /** Newest first. May be shorter than `count`; may be empty. */
  entries: LastCornerPanelEntry[];
  /** Lines to show, space permitting. */
  count: number;
  placement: LastCornerPlacement;
  speedUnit: SpeedUnit;
  showTime: boolean;
  showBrakeDelta: boolean;
  showApexSpeed: boolean;
  displayOrder?: LastCornerDisplayColumn[];
  /**
   * Every corner name the current track can produce, which fixes the width of
   * the name column for the whole session. Falls back to the names in
   * `entries` when the track's corners are not to hand — a story, or a test
   * with a fixed set of rows.
   */
  cornerLabels?: string[];
  fontSize?: number;
  /**
   * How much bigger the newest corner (always the first entry/row — see
   * `entries`) is drawn relative to the rest, as a multiple of `fontSize`.
   * Defaults to 1 (no emphasis) so every existing caller that doesn't pass
   * this renders identically to before.
   */
  latestScale?: number;
}

/**
 * The recently completed corners, newest at the top, every one measured
 * against the reference lap. Every corner is a single row; the newest is drawn
 * larger and brighter than the history beneath it.
 *
 * Props-only and hook-free apart from its own size measurement: the widget
 * owns the data, so this renders identically in a story with no telemetry.
 *
 * The panel never grows past the room it is given. When the widget is too
 * short for every configured line it drops the oldest, which are the ones the
 * driver has already had time to read.
 */
export const LastCornerPanel = ({
  entries,
  count,
  placement,
  speedUnit,
  showTime,
  showBrakeDelta,
  showApexSpeed,
  displayOrder: configuredDisplayOrder,
  cornerLabels,
  fontSize = LAST_CORNER_DEFAULT_FONT_SIZE,
  latestScale = 1,
}: LastCornerPanelProps) => {
  const container = useRef<HTMLDivElement>(null);
  const requested = Math.max(1, count);
  const [visible, setVisible] = useState(requested);
  const latestFontSize = fontSize * latestScale;
  const displayOrder = normalizeDisplayOrder(configuredDisplayOrder);
  const columns = visibleColumnsFor(
    displayOrder,
    showTime,
    showBrakeDelta,
    showApexSpeed
  );
  // Sized off the track's own corner names so the width holds for the whole
  // session. Entries are the fallback only when no track labels were passed;
  // even then it reads every entry rather than the visible ones, since the
  // visible count depends on row heights, which depend on this.
  const labelEm = labelColumnEmFor(
    cornerLabels?.length
      ? cornerLabels
      : entries.map((entry) => entry.label).filter(Boolean)
  );

  // The hero holds the newest corner for HERO_HOLD_MS, then everything shifts
  // down a slot and the hero blanks. Keyed on the newest corner's own clock, so
  // a corner completing restarts the hold rather than inheriting what is left
  // of the previous one's.
  const newestCompletedAt = entries[0]?.completedAt;
  const [heroExpired, setHeroExpired] = useState(false);

  useEffect(() => {
    setHeroExpired(false);
    // No clock on the entry: it is a fixed row from a story or a test, and
    // ages out of the hero only when a newer corner pushes it out.
    if (newestCompletedAt === undefined) return;

    const remainingMs = newestCompletedAt + HERO_HOLD_MS - Date.now();
    if (remainingMs <= 0) {
      setHeroExpired(true);
      return;
    }
    const timer = setTimeout(() => setHeroExpired(true), remainingMs);
    return () => clearTimeout(timer);
  }, [newestCompletedAt]);

  /**
   * Where slot `i` reads from: one behind once the hero has been retired.
   * Measurement below uses `heroExpired` directly rather than the guarded
   * `demoted`, which depends on `visible` — the two only disagree at a single
   * visible slot, where the height is the hero's either way.
   */
  const heroOffset = heroExpired ? 1 : 0;

  useEffect(() => {
    const el = container.current;
    if (!el || typeof ResizeObserver === 'undefined') {
      setVisible(requested);
      return;
    }

    const measure = () => {
      const available = el.clientHeight;
      const labelAt = (slot: number) => entries[slot - heroOffset]?.label;
      // One row like any other, just at the hero's larger size — plus its own
      // trailing gap, matching how the compact rows below are counted.
      const heroH =
        rowHeightFor(latestFontSize, labelLinesFor(labelAt(0), labelEm)) +
        ROW_GAP_PX;
      // At least one line always shows: a panel that has been switched on but
      // renders nothing reads as broken rather than as short of room.
      if (available < heroH) {
        setVisible(1);
        return;
      }
      let used = heroH;
      let fitting = 1;
      for (let i = 1; i < requested; i += 1) {
        used += rowHeightFor(fontSize, labelLinesFor(labelAt(i), labelEm));
        used += ROW_GAP_PX;
        if (used > available) break;
        fitting += 1;
      }
      setVisible(fitting);
    };

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [entries, requested, fontSize, latestFontSize, heroOffset, labelEm]);

  const onSide = placement === 'left' || placement === 'right';
  // With a single slot the hero *is* the history, so retiring it would leave
  // the panel showing nothing at all — which reads as broken rather than as
  // "that corner was a while ago".
  const demoted = heroExpired && visible > 1;
  const slots = Array.from(
    { length: visible },
    (_, i) => entries[i - (demoted ? 1 : 0)] ?? null
  );

  return (
    <div
      ref={container}
      data-testid="last-corner-panel"
      data-placement={placement}
      className={[
        'flex flex-col gap-0.5 overflow-hidden leading-none tabular-nums',
        // Beside the plot the column runs the full height; above or below it
        // takes only what its lines need, capped so it can never crowd out the
        // trace entirely.
        onSide ? 'h-full flex-none' : 'flex-none',
      ].join(' ')}
      style={{
        fontSize: `${fontSize}px`,
        // A fixed width beside the plot: sizing to content would nudge the
        // trace sideways whenever a delta or a name changed length. The em
        // budget scales with the font and covers only the columns actually
        // drawn, and the name column is pinned to this track's widest corner
        // name, so a numbered circuit is not padded out to fit "Variante
        // Tamburello A". Keyed to the hero's larger font, the widest row.
        ...(onSide
          ? {
              width: `${Math.round(
                latestFontSize * sideWidthEmFor(columns, labelEm)
              )}px`,
            }
          : {}),
      }}
    >
      {/* Keyed by slot, not by section: the same corner legitimately appears
          twice once history spans a lap boundary, and these are fixed
          positions (newest first) rather than a reorderable list. */}
      {slots.map((entry, i) => (
        <LastCornerRow
          key={`slot-${i}`}
          entry={entry}
          speedUnit={speedUnit}
          columns={columns}
          labelEm={labelEm}
          fontSize={i === 0 ? latestFontSize : fontSize}
          hero={i === 0}
        />
      ))}
    </div>
  );
};
