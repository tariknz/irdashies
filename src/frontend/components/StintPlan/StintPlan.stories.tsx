import type { Meta, StoryObj } from '@storybook/react-vite';
import type { ComponentType } from 'react';
import { RacePlanDecorator } from '@irdashies/storybook';
import {
  DEMO_DRIVER_IDS,
  demoRacePlanSnapshot,
  demoRacePlanState,
  type DemoSnapshotOptions,
} from '@irdashies/domain';
import type { RacePlanProgressSnapshot, RacePlanState } from '@irdashies/types';
import { StintPlan } from './StintPlan';

const sized = (Story: ComponentType) => (
  <div style={{ width: 300, height: 170 }}>
    <Story />
  </div>
);

const story = (
  snapshot: RacePlanProgressSnapshot | undefined,
  state: RacePlanState | null = demoRacePlanState
): Pick<Story, 'decorators'> => ({
  decorators: [
    sized,
    RacePlanDecorator({ snapshot, state, userId: DEMO_DRIVER_IDS[1] }),
  ],
});

const racing = (options: DemoSnapshotOptions = {}) =>
  story(demoRacePlanSnapshot(options));

const meta: Meta<typeof StintPlan> = {
  component: StintPlan,
  title: 'widgets/StintPlan',
  args: {
    background: { opacity: 80 },
    showElapsedTime: true,
    showFuel: true,
    showNextDriver: true,
  },
};

export default meta;

type Story = StoryObj<typeof StintPlan>;

/** Stint 4 of 23, on plan and on the fuel target. */
export const OnPlan: Story = racing();

/** Two minutes behind, burning more than the plan allows. */
export const BehindPlan: Story = racing({ driftSec: 134, fuelPerLap: 1.08 });

/** The planned box lap is highlighted. */
export const BoxLap: Story = racing({ lapsInStint: 33 });

/** A teammate watching: the team car's fuel cannot be seen, so no fuel row. */
export const Spectating: Story = racing({ fuelVisible: false, driftSec: 20 });

/** Fifteen minutes behind pushes two later stints into driver availability. */
export const Clashes: Story = racing({ driftSec: 900 });

export const WithoutElapsedTime: Story = {
  ...racing({ driftSec: -45 }),
  args: { showElapsedTime: false },
};

export const PlanMismatch: Story = racing({ mismatches: ['team', 'track'] });

export const WaitingForGreen: Story = story(
  demoRacePlanSnapshot({ status: 'waiting' })
);

export const Finished: Story = story(
  demoRacePlanSnapshot({ status: 'finished', currentStint: 23, driftSec: 75 })
);

export const NoPlan: Story = story(
  { ...demoRacePlanSnapshot(), status: 'no-plan', stints: [] },
  { ...demoRacePlanState, planning: null }
);

export const Replay: Story = story({
  ...demoRacePlanSnapshot(),
  status: 'replay',
});

/** Before the first publish on the progress channel. */
export const NoData: Story = story(undefined, null);
