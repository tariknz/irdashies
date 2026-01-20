import { Meta, StoryObj } from '@storybook/react-vite';
import { SessionBar } from './SessionBar';
import { TelemetryDecorator } from '../../../../../../.storybook/telemetryDecorator';

export default {
  component: SessionBar,
  title: 'widgets/Standings/components/SessionBar',
  decorators: [TelemetryDecorator()],
} as Meta;

type Story = StoryObj<typeof SessionBar>;

export const Primary: Story = {};
