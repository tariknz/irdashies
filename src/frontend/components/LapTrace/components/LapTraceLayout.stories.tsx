import { useEffect, useRef, type ReactNode } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import {
  LiveChannelBridgeDecorator,
  TelemetryDecorator,
} from '@irdashies/storybook';
import {
  DEFAULT_LAP_TRACE_COLORS,
  lapTraceTreeFromLegacy,
  type LayoutNode,
} from '@irdashies/types';
import { useLapTraceStore } from '@irdashies/context';
import { hydrateLapTrace } from '../../../domain/lapTrace/hydrateLapTrace';
import { makeSyntheticLapTrace } from '../fixtures/syntheticLap';
import { LapTracePlot } from '../LapTracePlot';
import { lapTraceElementSide } from '../layoutTree';
import { LapTraceLayout } from './LapTraceLayout';
import { LastCornerPanel, type LastCornerPanelEntry } from './LastCornerPanel';
import {
  BrakeCueBars,
  BRAKE_CUE_UNLIT_COLOR,
  brakeCueColor,
  isBrakeCueBarLit,
  isBrakeCueHorizontal,
  type BrakeCueBarSide,
} from './BrakeCueBars';

const seedReference = () => {
  const record = makeSyntheticLapTrace({ trackLengthM: 5000 });
  useLapTraceStore.setState({
    trackId: record.trackId,
    trackConfigName: record.trackConfigName,
    carPath: record.carPath,
    trackLengthM: record.trackLengthM,
    referenceLap: hydrateLapTrace(record),
    referenceError: null,
  });
};

/** Long names on purpose: they set the panel's width beside the trace. */
const entries: LastCornerPanelEntry[] = [
  {
    sectionId: 'tertre',
    label: 'Tertre Rouge',
    timeDeltaSec: -0.21,
    brakePointDeltaM: 6,
    apexSpeedDelta: 2.4,
  },
  {
    sectionId: 'dunlop',
    label: 'Dunlop Chicane',
    timeDeltaSec: 0.08,
    brakePointDeltaM: -3,
    apexSpeedDelta: -0.6,
  },
  {
    sectionId: 'ford',
    label: 'Ford Chicane',
    timeDeltaSec: -0.05,
    brakePointDeltaM: 2,
    apexSpeedDelta: 1.1,
  },
];

/**
 * The countdown, pinned two bars from the brake point by writing the DOM the
 * live loop would.
 */
const LitBars = ({ side }: { side: BrakeCueBarSide }) => {
  const strip = useRef<HTMLDivElement>(null);
  const bars = useRef<(HTMLDivElement | null)[]>([]);
  const fill = useRef<HTMLDivElement>(null);
  const distance = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const lit = brakeCueColor('amber');
    if (strip.current) strip.current.style.visibility = 'visible';
    if (isBrakeCueHorizontal(side)) {
      if (fill.current) {
        fill.current.style.width = '55%';
        fill.current.style.backgroundColor = lit;
      }
    } else {
      bars.current.forEach((el, i) => {
        if (el) {
          el.style.backgroundColor = isBrakeCueBarLit(i, 2, 'top')
            ? lit
            : BRAKE_CUE_UNLIT_COLOR;
        }
      });
    }
    if (distance.current) {
      distance.current.textContent = '86m';
      distance.current.style.color = lit;
    }
  }, [side]);

  return (
    <BrakeCueBars
      stripRef={strip}
      barsRef={bars}
      fillRef={fill}
      distanceRef={distance}
      side={side}
      lastBar="top"
    />
  );
};

/** The widget's own frame: padding, background and the reference header. */
const LayoutPreview = ({
  tree,
  cornersUnavailable = false,
}: {
  tree: LayoutNode;
  /** A track and layout with no corner data, as the widget sees it. */
  cornersUnavailable?: boolean;
}) => {
  const barSide = lapTraceElementSide(tree, 'brakeCue') ?? 'right';
  const renderElement = (id: string): ReactNode => {
    switch (id) {
      case 'plot':
        return (
          <div className="min-h-0 min-w-0 flex-1">
            <LapTracePlot
              metersBehind={200}
              metersAhead={200}
              showThrottle
              showBrake
              showSpeed
              showGhost
              showGearLabels
              showBrakePointMarkers
              showThrottlePointMarkers
              ghostOpacity={1}
              referenceFilled={false}
              strokeWidth={3}
              colors={DEFAULT_LAP_TRACE_COLORS}
              carDistanceMOverride={340}
            />
          </div>
        );
      case 'corners':
        return (
          <LastCornerPanel
            entries={cornersUnavailable ? [] : entries}
            count={3}
            placement={lapTraceElementSide(tree, 'corners') ?? 'right'}
            speedUnit="km/h"
            showTime
            showBrakeDelta
            showApexSpeed
            cornerLabels={
              cornersUnavailable ? [] : entries.map((entry) => entry.label)
            }
            latestScale={1.4}
            unavailable={cornersUnavailable}
          />
        );
      case 'brakeCue':
        return <LitBars side={barSide} />;
      default:
        return null;
    }
  };

  return (
    <div
      className="flex h-full flex-col overflow-hidden rounded-sm p-1.5 text-white"
      style={{ backgroundColor: 'rgba(15, 23, 42, 0.7)' }}
    >
      <div className="mb-1 flex flex-none items-baseline gap-2 text-[11px] leading-none">
        <span className="text-[9px] uppercase tracking-wide text-slate-400">
          Personal Best
        </span>
        <span className="font-semibold tabular-nums text-amber-300">
          1:45.432
        </span>
      </div>
      <LapTraceLayout
        tree={tree}
        barsVertical={!isBrakeCueHorizontal(barSide)}
        renderElement={renderElement}
      />
    </div>
  );
};

const box = (...widgets: string[]): LayoutNode => ({
  id: `box-${widgets.join('-')}`,
  type: 'box',
  direction: 'col',
  widgets,
});

const split = (
  id: string,
  direction: 'row' | 'col',
  children: LayoutNode[]
): LayoutNode => ({ id, type: 'split', direction, children });

/** The default widget size, as the settings preview shows it. */
const defaultSize = (Story: () => ReactNode) => (
  <div className="h-[120px] w-[396px]">
    <Story />
  </div>
);

const wide = (Story: () => ReactNode) => (
  <div className="h-[160px] w-[640px]">
    <Story />
  </div>
);

/**
 * The lap trace laid out from the editor, with a filled corner panel and the
 * countdown lit, so how the pieces share a small widget can be checked. The
 * live widget only fills them while driving.
 */
export default {
  component: LayoutPreview,
  title: 'widgets/LapTrace/Layout',
  decorators: [
    defaultSize,
    TelemetryDecorator('/test-data/1735296198162'),
    LiveChannelBridgeDecorator(),
  ],
  loaders: [async () => (seedReference(), {})],
} as Meta<typeof LayoutPreview>;

type Story = StoryObj<typeof LayoutPreview>;

const threeColumns = split('root', 'row', [
  box('corners'),
  box('plot'),
  box('brakeCue'),
]);

/** Corner panel, trace and countdown side by side in the default size. */
export const ThreeColumns: Story = { args: { tree: threeColumns } };

/** Three columns on a track and layout with no corner data. */
export const CornersUnavailable: Story = {
  args: { tree: threeColumns, cornersUnavailable: true },
};

/** The panel below the trace, on a track and layout with no corner data. */
export const CornersUnavailableBelow: Story = {
  args: {
    tree: split('root', 'col', [box('plot'), box('corners')]),
    cornersUnavailable: true,
  },
};

/** The same at a width that suits three columns. */
export const ThreeColumnsWide: Story = {
  args: { tree: threeColumns },
  decorators: [wide],
};

/** The panel beside the trace, no countdown. */
export const PanelBeside: Story = {
  args: { tree: split('root', 'row', [box('plot'), box('corners')]) },
};

/** The countdown beside the trace and the panel across the bottom. */
export const PanelBelow: Story = {
  args: {
    tree: split('root', 'col', [
      split('trace-row', 'row', [box('plot'), box('brakeCue')]),
      box('corners'),
    ]),
  },
};

/**
 * The panel and the countdown stacked together beside the trace. Both are
 * beside it, so the bars run as a column under the panel and keep their
 * width when the panel narrows.
 */
export const StackedBeside: Story = {
  args: {
    tree: split('root', 'row', [
      box('plot'),
      split('side', 'col', [box('corners'), box('brakeCue')]),
    ]),
  },
};

/** The panel and the countdown in one box beside the trace. */
export const SharedBoxBeside: Story = {
  args: {
    tree: split('root', 'row', [box('plot'), box('corners', 'brakeCue')]),
  },
};

/**
 * The panel and the countdown side by side above the trace. Both are above
 * it, so the countdown runs across.
 */
export const BothAbove: Story = {
  args: {
    tree: split('root', 'col', [
      split('top', 'row', [box('corners'), box('brakeCue')]),
      box('plot'),
    ]),
  },
};

/**
 * A layout from before the editor: the panel below the trace with three
 * corners, in the default size. Short of room, it drops the oldest corner
 * whole rather than cutting through it.
 */
export const LegacyPanelBelow: Story = {
  args: {
    tree: lapTraceTreeFromLegacy({
      showLastCorner: true,
      lastCornerPosition: 'bottom',
    }),
  },
};

/** The countdown alone, without the trace: it takes the full height. */
export const BarsOnly: Story = {
  args: { tree: split('root', 'col', [box('brakeCue')]) },
};

/** The corner panel alone, without the trace: it fills the widget. */
export const PanelOnly: Story = {
  args: { tree: split('root', 'col', [box('corners')]) },
};

/** The panel and the countdown without the trace. */
export const PanelAndBars: Story = {
  args: { tree: split('root', 'row', [box('corners'), box('brakeCue')]) },
};
