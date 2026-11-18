import type { Meta, StoryObj } from '@storybook/react-vite';
import { ResizeHandles } from './ResizeHandle';

export default {
  title: 'components/WidgetContainer/ResizeHandles',
  component: ResizeHandles,
  decorators: [
    (Story) => (
      <div className="relative m-8 h-32 w-64 border border-dashed border-sky-500 bg-slate-900">
        <Story />
      </div>
    ),
  ],
  args: { getResizeHandleProps: () => ({}), visible: true },
} satisfies Meta<typeof ResizeHandles>;

export const Visible: StoryObj<typeof ResizeHandles> = {};
