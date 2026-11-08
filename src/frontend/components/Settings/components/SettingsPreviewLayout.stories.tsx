import type { Meta, StoryObj } from '@storybook/react-vite';
import { TelemetryDecorator } from '@irdashies/storybook';
import { SettingsPreviewLayout } from './SettingsPreviewLayout';

export default {
  title: 'components/Settings/SettingsPreviewLayout',
  component: SettingsPreviewLayout,
  decorators: [TelemetryDecorator()],
  args: {
    widgetId: 'input',
    children: (
      <div className="space-y-4 text-slate-200">
        <h3>Widget options</h3>
        <p>Settings stay beside the preview when both columns fit.</p>
      </div>
    ),
  },
} satisfies Meta<typeof SettingsPreviewLayout>;

type Story = StoryObj<typeof SettingsPreviewLayout>;
export const Wide: Story = {
  decorators: [
    (Story) => (
      <div className="flex h-[700px] w-[1100px] flex-col bg-slate-900 p-5">
        <Story />
      </div>
    ),
  ],
};
export const Narrow: Story = {
  decorators: [
    (Story) => (
      <div className="flex h-[700px] w-[650px] flex-col bg-slate-900 p-5">
        <Story />
      </div>
    ),
  ],
};
export const TallWidget: Story = { ...Wide, args: { widgetId: 'standings' } };
