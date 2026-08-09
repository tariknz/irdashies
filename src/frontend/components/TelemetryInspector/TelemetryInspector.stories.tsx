import type { Meta, StoryObj } from '@storybook/react-vite';
import { TelemetryDecorator } from '@irdashies/storybook';
import { TelemetryInspector } from './TelemetryInspector';

const InspectorStory = () => (
  <TelemetryInspector
    properties={[
      { source: 'telemetry', path: 'Speed', label: 'Speed' },
      {
        source: 'session',
        path: 'WeekendInfo.TrackDisplayName',
        label: 'Track',
      },
    ]}
  />
);

const meta = {
  component: InspectorStory,
  decorators: [TelemetryDecorator()],
} satisfies Meta<typeof InspectorStory>;

export default meta;
type Story = StoryObj<typeof meta>;

export const TelemetryAndSessionValues: Story = {};
