import { Meta, StoryObj } from '@storybook/react-vite';
import { SessionBar } from './SessionBar';
import { TelemetryDecorator } from '../../../../../../.storybook/telemetryDecorator';
import { getWidgetDefaultConfig } from '@irdashies/types';

export default {
  component: SessionBar,
  title: 'widgets/Standings/components/SessionBar',
  decorators: [TelemetryDecorator()],
} as Meta;

type Story = StoryObj<typeof SessionBar>;

const standingsDefaults = getWidgetDefaultConfig('standings');

export const Primary: Story = {
  args: {
    settings: standingsDefaults.headerBar,
    position: 'header',
  },
};

export const Footer: Story = {
  args: {
    settings: standingsDefaults.footerBar,
    position: 'footer',
  },
};

export const Standalone: Story = {
  args: {
    settings: standingsDefaults.headerBar,
    standalone: true,
  },
};
