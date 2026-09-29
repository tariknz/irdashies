import type { Meta, StoryObj } from '@storybook/react-vite';
import {
  CaptureChannelDecorator,
  TelemetryDecoratorWithConfig,
} from '@irdashies/storybook';
import { DashboardProvider } from '@irdashies/context';
import {
  mockDashboardBridge,
  mockDashboardBridgeState,
} from '../../../../.storybook/mockDashboardBridge';
import { Radar } from './Radar';

/**
 * Recordings with cars inside the radar's range, so the story exercises the
 * real widget — session, channel snapshots and all — rather than props
 * assembled by hand.
 */
const INTERLAGOS = '/test-data/1752616787256';
const TWO_ABREAST_GRID = '/test-data/road-atlanta-grid';
const VIRGINIA = '/test-data/1735296198162';
/**
 * Interlagos with the sim reporting a car to the player's left. The car sits
 * 4.6 m back on the same centreline, so without the overlap verdict it draws
 * straight through the player.
 */
const ALONGSIDE = '/test-data/1747384033336';

/** The disc sizes itself to its overlay window, so stories supply one. */
const frame = (children: React.ReactNode) => (
  <div style={{ width: 320, height: 320, background: '#1e293b' }}>
    {children}
  </div>
);

export default {
  component: Radar,
  title: 'widgets/Radar',
} as Meta<typeof Radar>;

type Story = StoryObj<typeof Radar>;

const story = (
  capture: string,
  config: Record<string, unknown> = {}
): Story => ({
  decorators: [
    CaptureChannelDecorator(capture),
    (Story, context) =>
      frame(
        TelemetryDecoratorWithConfig(capture, { radar: config })(Story, context)
      ),
  ],
});

export const Primary: Story = story(INTERLAGOS);

/** The session label says single file; pace telemetry reports two columns. */
export const StartingGrid: Story = {
  ...story(TWO_ABREAST_GRID, {
    radarRange: 40,
    showOnlyWhenOnTrack: false,
    fadeSeconds: 0,
    showTrackMap: false,
  }),
  name: 'Two-abreast starting grid',
};

export const WideRange: Story = {
  ...story(INTERLAGOS, { radarRange: 25 }),
  name: 'Wide range',
};

/** Every car on pit road is on the racing line's centreline, so it would read
 * as a car directly in front; the toggle is what removes them. */
export const CarsInPitShown: Story = {
  ...story(VIRGINIA, { hideInPit: false }),
  name: 'Cars in pit shown',
};

export const CarsInPitHidden: Story = {
  ...story(VIRGINIA, { hideInPit: true }),
  name: 'Cars in pit hidden',
};

export const CarAbreast: Story = {
  ...story(ALONGSIDE, { radarRange: 15 }),
  name: 'Car abreast',
};

/**
 * Range pulled in to 9 m, so the capture's 8 m cars land right at the edge of
 * the view. They are drawn at full strength there, which is the behaviour this
 * story pins down now that edge cars no longer fade.
 */
export const AtTheRangeEdge: Story = {
  ...story(INTERLAGOS, {
    radarRange: 9,
    fadeSeconds: 0,
  }),
  name: 'Cars at the range edge',
};

export const ShownOnlyWhenNear: Story = {
  ...story(INTERLAGOS, {
    showWhenNearby: true,
    showRange: 5,
    fadeSeconds: 0,
  }),
  name: 'Shown only when a car is near',
};

/**
 * Demo mode has no telemetry at all: the disc is fed the widget's own demo
 * cars. Driven by the bridge state rather than a capture, so the story fails
 * in the same way the app does if demo mode stops painting anything.
 */
export const DemoMode: Story = {
  decorators: [
    (Story) => {
      mockDashboardBridgeState.isDemoMode = true;
      try {
        return frame(
          <DashboardProvider bridge={mockDashboardBridge}>
            <Story />
          </DashboardProvider>
        );
      } finally {
        mockDashboardBridgeState.isDemoMode = false;
      }
    },
  ],
  name: 'Demo mode',
};
