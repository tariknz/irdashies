import type { Meta, StoryObj } from '@storybook/react-vite';
import {
  CaptureChannelDecorator,
  TelemetryDecoratorWithConfig,
} from '@irdashies/storybook';
import { Radar } from './Radar';

/**
 * Recordings with cars inside the radar's range, so the story exercises the
 * real widget — session, channel snapshots and all — rather than props
 * assembled by hand.
 */
const INTERLAGOS = '/test-data/1752616787256';
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
 * Range pulled in to 9 m and a 4 m band, so the capture's 8 m cars land near
 * the edge of the view and come through clearly faded. At the default 15 m
 * range those same cars sit well inside the band and are solid, which is why
 * the fade is invisible there.
 */
export const FadingInCars: Story = {
  ...story(INTERLAGOS, {
    radarRange: 9,
    fadeInCars: true,
    fadeBandM: 4,
    fadeSeconds: 0,
  }),
  name: 'Fading in at the range edge',
};

export const WithoutFadingIn: Story = {
  ...story(INTERLAGOS, {
    radarRange: 9,
    fadeInCars: false,
    fadeSeconds: 0,
  }),
  name: 'Without fading in',
};

export const ShownOnlyWhenNear: Story = {
  ...story(INTERLAGOS, {
    showWhenNearby: true,
    showRange: 5,
    fadeSeconds: 0,
  }),
  name: 'Shown only when a car is near',
};
