import type { Meta, StoryObj } from '@storybook/react-vite';
import type { ComponentType } from 'react';
import { RacePlanDecorator } from '@irdashies/storybook';
import {
  DEMO_DRIVER_IDS,
  demoRacePlanSnapshot,
  demoRacePlanState,
  demoRepairStop,
  type DemoSnapshotOptions,
} from '@irdashies/domain';
import type { RacePlanProgressSnapshot } from '@irdashies/types';
import { StrategyTimeline } from './StrategyTimeline';

/** Driver B is the logged-in user: stints 2, 8, 14 and 20. */
const USER_ID = DEMO_DRIVER_IDS[1];

const sizedTo = (width: number, height: number) => (Story: ComponentType) => (
  <div style={{ width, height }}>
    <Story />
  </div>
);

const story = (
  snapshot: RacePlanProgressSnapshot | undefined,
  { width = 440, height = 480, state = demoRacePlanState } = {}
): Pick<Story, 'decorators'> => ({
  decorators: [
    sizedTo(width, height),
    RacePlanDecorator({ snapshot, state, userId: USER_ID }),
  ],
});

const racing = (options: DemoSnapshotOptions = {}, size = {}) =>
  story(demoRacePlanSnapshot(options), size);

const fuelStop = {
  ...demoRepairStop,
  lap: 147,
  elapsedSec: 15_800,
  durationSec: 41,
  fuelAdded: 18.5,
};

const meta: Meta<typeof StrategyTimeline> = {
  component: StrategyTimeline,
  title: 'widgets/StrategyTimeline',
  args: {
    background: { opacity: 80 },
    showElapsedTime: true,
    showStrip: true,
    showDoneStints: true,
    showStops: true,
  },
};

export default meta;

type Story = StoryObj<typeof StrategyTimeline>;

/**
 * Done, current, upcoming, rebuilt after a stop, an extra unassigned stint
 * and a planned stint that no longer fits.
 */
export const AllStatuses: Story = racing({
  driftSec: 134,
  rebuiltFrom: 5,
  unassignedExtra: true,
  dropLast: true,
  stops: [demoRepairStop],
});

export const OnPlan: Story = racing();

/** The last planned stint no longer fits; Driver E loses it. */
export const StintDropped: Story = racing({ driftSec: 600, dropLast: true });

/** The race needs one more stint than the plan has drivers for. */
export const ExtraStintUnassigned: Story = racing({
  driftSec: -300,
  unassignedExtra: true,
});

export const UnplannedStops: Story = racing({
  currentStint: 5,
  driftSec: 240,
  rebuiltFrom: 5,
  stops: [demoRepairStop, fuelStop],
});

/** Fifteen minutes behind: one clash with an unavailable driver and one warning. */
export const Clashes: Story = racing({ driftSec: 900 });

/** While Driver B is in the car. */
export const DrivingNow: Story = racing({ currentStint: 8, lapsInStint: 3 });

export const UpcomingOnly: Story = {
  ...racing({ driftSec: 134, stops: [demoRepairStop] }),
  args: { showDoneStints: false, showElapsedTime: false },
};

/** As a Gantry dock panel: the planned and status columns give way. */
export const DockedNarrow: Story = racing(
  { driftSec: 900, rebuiltFrom: 5, stops: [demoRepairStop] },
  { width: 260, height: 360 }
);

export const DockedMedium: Story = racing(
  { driftSec: 134, unassignedExtra: true },
  { width: 340, height: 360 }
);

export const WaitingForGreen: Story = story(
  demoRacePlanSnapshot({ status: 'waiting' })
);

export const Finished: Story = story(
  demoRacePlanSnapshot({ status: 'finished', currentStint: 23, driftSec: 75 })
);

export const PlanMismatch: Story = racing({ mismatches: ['track'] });

export const NoPlan: Story = story(
  { ...demoRacePlanSnapshot(), status: 'no-plan', stints: [] },
  { state: { ...demoRacePlanState, planning: null } }
);

export const Replay: Story = story({
  ...demoRacePlanSnapshot(),
  status: 'replay',
});
