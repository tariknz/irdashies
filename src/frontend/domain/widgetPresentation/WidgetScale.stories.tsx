import type { Meta, StoryObj } from '@storybook/react-vite';
import { WidgetScale } from './WidgetScale';

const Sample = () => (
  <div className="rounded bg-slate-800 p-2 text-sm text-white">
    <div className="mb-2 text-lg font-bold">Standings</div>
    {[
      ['1', 'A. Smith', '1:42.123'],
      ['2', 'B. Jones', '+0.8'],
      ['3', 'C. Lee', '+1.4'],
    ].map(([position, driver, gap]) => (
      <div key={position} className="flex gap-4 border-t border-slate-700 py-1">
        <span className="text-amber-300">{position}</span>
        <span className="flex-1">{driver}</span>
        <span>{gap}</span>
      </div>
    ))}
  </div>
);

const meta = {
  title: 'domain/WidgetScale',
  component: WidgetScale,
  args: { scale: 125, children: null },
  argTypes: {
    scale: { control: { type: 'range', min: 50, max: 200, step: 5 } },
  },
  render: ({ scale }) => (
    <div className="h-64 w-96 border border-sky-500">
      <WidgetScale scale={scale}>
        <Sample />
      </WidgetScale>
    </div>
  ),
} satisfies Meta<typeof WidgetScale>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const Small: Story = { args: { scale: 50 } };
export const Large: Story = { args: { scale: 200 } };
export const BottomAligned: Story = {
  render: ({ scale }) => (
    <div className="h-64 w-96 border border-sky-500">
      <WidgetScale scale={scale}>
        <div className="flex h-full flex-col justify-end">
          <Sample />
        </div>
      </WidgetScale>
    </div>
  ),
};
export const IndependentPanels: Story = {
  render: ({ scale }) => (
    <div className="h-96 w-[800px] border border-sky-500">
      <WidgetScale scale={scale}>
        <div className="flex h-full flex-col text-white">
          <div className="bg-slate-700 p-2 text-lg">Host widget</div>
          <div className="flex min-h-0 flex-1">
            <div className="min-w-0 flex-1">
              <WidgetScale scale={75}>
                <Sample />
              </WidgetScale>
            </div>
            <div className="min-w-0 flex-1">
              <WidgetScale scale={150}>
                <Sample />
              </WidgetScale>
            </div>
          </div>
        </div>
      </WidgetScale>
    </div>
  ),
};
