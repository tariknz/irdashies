import { useEffect, useRef, type ReactNode } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import {
  LiveChannelBridgeDecorator,
  TelemetryDecorator,
} from '@irdashies/storybook';
import { DEFAULT_LAP_TRACE_COLORS, type LayoutNode } from '@irdashies/types';
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
const LayoutPreview = ({ tree }: { tree: LayoutNode }) => {
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
            entries={entries}
            count={3}
            placement={lapTraceElementSide(tree, 'corners') ?? 'right'}
            speedUnit="km/h"
            showTime
            showBrakeDelta
            showApexSpeed
            cornerLabels={entries.map((entry) => entry.label)}
            latestScale={1.4}
          />
        );
      case 'brakeCue':
        return (
          <LitBars side={lapTraceElementSide(tree, 'brakeCue') ?? 'right'} />
        );
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
      <LapTraceLayout tree={tree} renderElement={renderElement} />
    </div>
  );
};

const box = (widget: string): LayoutNode => ({
  id: `box-${widget}`,
  type: 'box',
  direction: 'col',
  widgets: [widget],
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

/** The panel and a countdown strip stacked together beside the trace. */
export const StackedBeside: Story = {
  args: {
    tree: split('root', 'row', [
      box('plot'),
      split('side', 'col', [box('corners'), box('brakeCue')]),
    ]),
  },
};
