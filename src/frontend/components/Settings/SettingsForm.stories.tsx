import { Meta, StoryObj } from '@storybook/react';
import { SettingsForm } from './SettingsForm';

export default {
  component: SettingsForm,
} as Meta;

type Story = StoryObj<typeof SettingsForm>;

export const Primary: Story = {
  args: {
    currentDashboard: {
      widgets: [
        {
          id: 'test',
          enabled: false,
          layout: {
            x: 0,
            y: 0,
            width: 0,
            height: 0,
          },
        },
      ],
    },
  },
};
