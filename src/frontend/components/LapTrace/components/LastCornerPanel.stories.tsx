import type { Meta, StoryObj } from '@storybook/react-vite';
import { LastCornerPanel, type LastCornerPanelEntry } from './LastCornerPanel';

const entry = (
  sectionId: string,
  label: string,
  timeDeltaSec: number | null,
  brakePointDeltaM: number | null,
  apexSpeedDelta: number | null
): LastCornerPanelEntry => ({
  sectionId,
  label,
  timeDeltaSec,
  brakePointDeltaM,
  apexSpeedDelta,
});

/** A short sequence, newest first, as it would read leaving a set of esses. */
const sequence: LastCornerPanelEntry[] = [
  entry('t5', 'T5', -0.2, -5, 2.1),
  entry('t4', 'T4', 0.05, 3, -0.4),
  entry('t3', 'T3', -0.12, -2, 1.2),
];

export default {
  component: LastCornerPanel,
  title: 'widgets/LapTrace/LastCornerPanel',
  args: {
    entries: sequence,
    count: 3,
    placement: 'bottom',
    speedUnit: 'km/h',
    showTime: true,
    showBrakeDelta: true,
    showApexSpeed: true,
  },
  decorators: [
    // An explicit height, not just a width: the panel measures its own
    // rendered height via ResizeObserver to decide how many rows fit, so an
    // auto-height ancestor gives it nothing independent to measure against —
    // the container's height would depend entirely on how many rows are
    // currently rendered, which is exactly what it's trying to decide.
    //
    // The panel itself caps at half of whatever height it's given (so it can
    // never crowd the trace out of the real widget), so this box has to be
    // roughly double what the panel actually needs — sized here for the
    // tallest of the default-count(3) stories, LatestCornerEmphasis.
    // FiveCorners (5 rows) needs more and gets its own taller decorator,
    // the same way Vertical already does for its side placement.
    (Story) => (
      <div className="w-[396px] h-[190px] bg-slate-900 p-1.5">
        <Story />
      </div>
    ),
  ],
} as Meta<typeof LastCornerPanel>;

type Story = StoryObj<typeof LastCornerPanel>;

/** Three corners of a sequence, all still readable after the fact. */
export const History: Story = {};

/**
 * Mid-corner: the corner being driven holds the leading slot with its label but
 * no numbers, so its result never appears while you are still in it.
 */
export const CornerInProgress: Story = {
  args: {
    entries: [entry('t6', 'T6', null, null, null), ...sequence.slice(0, 2)],
  },
};

/** Before anything has been driven — the panel still holds its slots. */
export const Empty: Story = {
  args: { entries: [] },
};

/** A single corner, the way the panel behaved before it kept a history. */
export const SingleCorner: Story = {
  args: { entries: sequence.slice(0, 1), count: 1 },
};

/**
 * The maximum history, where older entries have to stay compact. Five rows
 * (a hero plus four compact) need more room than the meta decorator's
 * default height gives — see that decorator's comment.
 */
export const FiveCorners: Story = {
  args: {
    count: 5,
    entries: [
      ...sequence,
      entry('t2', 'T2', 0.31, 8, -1.6),
      entry('t1', 'T1', -0.08, -4, 0.9),
    ],
  },
  decorators: [
    (Story) => (
      <div className="w-[396px] h-[230px] bg-slate-900 p-1.5">
        <Story />
      </div>
    ),
  ],
};

/** Stacked down the side of the graph, as with the left or right placement. */
export const Vertical: Story = {
  args: { placement: 'right' },
  decorators: [
    (Story) => (
      <div className="flex h-[120px] w-[396px] flex-row gap-1.5 bg-slate-900 p-1.5">
        <Story />
        <div className="flex-1 rounded-sm bg-slate-800/60" />
      </div>
    ),
  ],
};

/**
 * Side placement with a single metric at a small font — the case that used to
 * strand two chips' worth of empty space to the right. The column now sizes to
 * just the label plus the time chip, at 8px text, leaving the rest to the
 * trace.
 */
export const VerticalTimeOnlySmall: Story = {
  args: {
    placement: 'right',
    fontSize: 8,
    showBrakeDelta: false,
    showApexSpeed: false,
  },
  decorators: [
    (Story) => (
      <div className="flex h-[120px] w-[396px] flex-row gap-1.5 bg-slate-900 p-1.5">
        <Story />
        <div className="flex-1 rounded-sm bg-slate-800/60" />
      </div>
    ),
  ],
};

/** Time only, for a driver working purely on lap time. */
export const TimeOnly: Story = {
  args: { showBrakeDelta: false, showApexSpeed: false },
};

/** Brake-point delta switched off, the way it renders for anyone who only wants time/speed. */
export const NoBrakePointDelta: Story = {
  args: { showBrakeDelta: false },
};

/**
 * A long corner name wraps onto a second line rather than pushing the numbers
 * out, and only ellipses if it still does not fit. Every row is sized for two
 * lines, so the panel's height does not jump about as names of different
 * lengths come and go.
 */
export const LongCornerName: Story = {
  args: {
    entries: [
      entry('roggia', 'Variante della Roggia', -0.2, -5, 2.1),
      ...sequence,
    ],
  },
  decorators: [
    (Story) => (
      <div className="w-[396px] h-[230px] bg-slate-900 p-1.5">
        <Story />
      </div>
    ),
  ],
};

/**
 * Imola, where the track data splits four corners into two halves each. They
 * stay two rows — they are two corners to drive — lettered apart so the driver
 * can tell which half a result belongs to. The reference brakes once for the
 * complex, so only the half the braking began in carries a brake delta.
 */
export const SplitComplexNames: Story = {
  args: {
    entries: [
      entry('gresini_b', 'GRESINI B', 0.08, null, -0.6),
      entry('gresini_a', 'GRESINI A', -0.11, -4, 1.4),
      entry('acque_minerali_b', 'Acque Minerali B', 0.03, null, -0.2),
    ],
  },
  decorators: [
    (Story) => (
      <div className="w-[396px] h-[230px] bg-slate-900 p-1.5">
        <Story />
      </div>
    ),
  ],
};

/**
 * The same corners labelled by turn number instead. Numbers never need a
 * second line, so the rows stay as compact as they have always been.
 */
export const TurnNumbers: Story = {
  args: {
    entries: [
      entry('gresini_b', 'T6B', 0.08, null, -0.6),
      entry('gresini_a', 'T6A', -0.11, -4, 1.4),
      entry('acque_minerali_b', 'T5B', 0.03, null, -0.2),
    ],
  },
};

export const Imperial: Story = {
  args: { speedUnit: 'mph' },
};

/** Scaled up for a larger widget or a screen further away. */
export const LargeText: Story = {
  args: { fontSize: 16, count: 2 },
};

/** The corner just finished draws noticeably bigger than the ones behind it. */
export const LatestCornerEmphasis: Story = {
  args: { latestScale: 1.5 },
};
