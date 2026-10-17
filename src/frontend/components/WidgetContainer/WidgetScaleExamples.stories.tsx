import type { Meta, StoryObj } from '@storybook/react-vite';
import type { ReactNode } from 'react';
import {
  ChannelSnapshotDecorator,
  TelemetryDecorator,
  sessionBarStorySnapshot,
  standingsStorySnapshot,
  trackStateStorySnapshot,
} from '@irdashies/storybook';
import { WidgetScale } from '@irdashies/domain/widgetPresentation/WidgetScale';
import { Standings } from '../Standings/Standings';
import { Input } from '../Input/Input';
import { LapTimeLog } from '../LapTimeLog/LapTimeLog';
import { FlatTrackMapCanvas } from '../TrackMap/FlatTrackMapCanvas';
import { LapGraphCanvas } from '../Gantry/components/LapGraph/LapGraphCanvas';

const Frame = ({
  title,
  scale,
  children,
}: {
  title: string;
  scale?: number;
  children: ReactNode;
}) => (
  <section className="space-y-2">
    <h3 className="text-sm text-slate-300">{title}</h3>
    <div className="h-80 w-[560px] border border-sky-500">
      <WidgetScale scale={scale}>{children}</WidgetScale>
    </div>
  </section>
);

const meta = {
  title: 'widgets/WidgetContainer/Scaling',
  component: WidgetScale,
  args: { scale: 100, children: null },
  argTypes: {
    scale: { control: { type: 'range', min: 50, max: 200, step: 5 } },
  },
  decorators: [
    TelemetryDecorator(),
    ChannelSnapshotDecorator({
      'standings.snapshot': standingsStorySnapshot,
      'track-state.snapshot': trackStateStorySnapshot,
      'session-bar.snapshot': sessionBarStorySnapshot,
    }),
  ],
  render: ({ scale }) => (
    <div className="flex flex-wrap gap-6 bg-slate-950 p-4">
      <Frame title="Standings" scale={scale}>
        <Standings />
      </Frame>
      <Frame title="Inputs" scale={scale}>
        <Input />
      </Frame>
      <Frame title="Lap Time Log" scale={scale}>
        <LapTimeLog />
      </Frame>
      <Frame title="Canvas map" scale={scale}>
        <FlatTrackMapCanvas
          drivers={[]}
          trackDrawing={{
            active: { inside: '', outside: '' },
            startFinish: {},
          }}
        />
      </Frame>
      <Frame title="Interactive chart" scale={scale}>
        <LapGraphCanvas
          series={[
            {
              carIdx: 1,
              carNumber: '1',
              displayName: 'Driver',
              color: '#38bdf8',
              dash: [],
              isPlayer: true,
              points: Array.from({ length: 20 }, (_, i) => ({
                lap: i + 1,
                value: Math.sin(i),
              })),
            },
          ]}
          mode="trace"
          axisCaption="Lap time delta"
          pinnedCarIdxs={[]}
          focusedCarIdx={null}
          onTogglePin={() => undefined}
        />
      </Frame>
      <Frame title="Embedded content" scale={scale}>
        <iframe
          title="Embedded widget example"
          className="h-full w-full border-0"
          srcDoc={
            '<body style="margin:0;background:#1e293b;color:white;font:16px sans-serif;padding:16px"><h2>Embedded widget</h2><p>Content scales inside the same frame.</p></body>'
          }
        />
      </Frame>
    </div>
  ),
} satisfies Meta<typeof WidgetScale>;

export default meta;
type Story = StoryObj<typeof meta>;
export const Normal: Story = {};
export const Small: Story = { args: { scale: 50 } };
export const Large: Story = { args: { scale: 200 } };
