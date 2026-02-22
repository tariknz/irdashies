import { Meta, StoryObj } from '@storybook/react-vite';
import { TitleBar } from './TitleBar';
import type { WindowControlsBridge } from '@irdashies/types';

const mockWindowControls = (isMaximized = false): WindowControlsBridge => ({
  minimize: () => Promise.resolve(),
  maximize: () => Promise.resolve(),
  close: () => Promise.resolve(),
  isMaximized: () => Promise.resolve(isMaximized),
  onMaximizeChange: () => () => undefined,
});

const meta: Meta<typeof TitleBar> = {
  component: TitleBar,
  title: 'components/TitleBar',
  decorators: [
    (Story, context) => {
      const maximized =
        (context.args as { isMaximized?: boolean }).isMaximized ?? false;
      window.windowControlsBridge = mockWindowControls(maximized);
      return (
        <div style={{ width: '800px' }}>
          <Story />
        </div>
      );
    },
  ],
};

export default meta;

type Story = StoryObj<typeof TitleBar>;

export const Default: Story = {
  args: { isMaximized: false },
};

export const Maximized: Story = {
  args: { isMaximized: true },
};
