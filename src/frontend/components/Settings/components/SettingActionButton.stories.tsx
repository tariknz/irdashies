import { Meta, StoryObj } from '@storybook/react-vite';
import { SettingActionButton } from './SettingActionButton';

const meta: Meta<typeof SettingActionButton> = {
  component: SettingActionButton,
  title: 'components/SettingActionButton',
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    label: 'Reset to Defaults',
    onClick: () => alert('Button clicked!'),
  },
};