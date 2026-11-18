import type { Meta, StoryObj } from '@storybook/react-vite';
import { GantryPanel } from './GantryPanel';

const meta: Meta<typeof GantryPanel> = {
  component: GantryPanel,
  title: 'widgets/Gantry/components/GantryPanel',
  parameters: { layout: 'fullscreen' },
  decorators: [
    (Story) => (
      <div className="h-[320px] w-[480px] bg-settings-page p-3">
        <Story />
      </div>
    ),
  ],
};
export default meta;

type Story = StoryObj<typeof GantryPanel>;

const body = <div className="p-4 text-sm text-slate-300">Panel content</div>;

export const Titled: Story = {
  args: { title: 'Standings', children: body },
};

export const WithAside: Story = {
  args: {
    title: 'Incidents',
    aside: <span className="text-sm text-slate-400">15 shown</span>,
    children: body,
  },
};

/** The body keeps overlay fonts and colours; only the frame is themed. */
export const OverlayContent: Story = {
  args: { overlayContent: true, children: body },
};
