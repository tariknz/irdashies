import type { Meta, StoryObj } from '@storybook/react-vite';
import { TelemetryDecorator } from '@irdashies/storybook';
import { HeartRateEmbed } from './components/HeartRateEmbed';

// The widget embeds HypeRate's overlay. In Storybook (a browser, not Electron)
// it falls back to an <iframe> and loads live content — the sample session may
// be offline.
const meta: Meta<typeof HeartRateEmbed> = {
  component: HeartRateEmbed,
  title: 'widgets/HeartRate',
  decorators: [
    TelemetryDecorator(),
    (Story) => (
      <div style={{ width: '240px', height: '160px' }}>
        <Story />
      </div>
    ),
  ],
  args: {
    deviceId: 'KiY',
  },
};

export default meta;

type Story = StoryObj<typeof HeartRateEmbed>;

export const DefaultOverlay: Story = {};

export const NamedWidget: Story = {
  args: { deviceId: 'KiY', widgetUrl: 'Bouncing_Heart_Widget' },
};

export const AnimationRoute: Story = {
  args: { deviceId: 'KiY', widgetUrl: 'app.hyperate.io/animation/59/YOUR-ID-HERE' },
};
