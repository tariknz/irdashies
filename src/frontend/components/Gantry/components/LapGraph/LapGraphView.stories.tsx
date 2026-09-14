import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import {
  GantryChannelDecorator,
  GantryDecorator,
  buildLapHistory,
  emptyLapHistory,
  enduranceLapHistory,
  enduranceSession,
  fixtureDrivers,
  fixturePlans,
  gantryArgTypes,
  gantryStoryArgs,
} from '@irdashies/storybook';
import type { LapGraphMode } from '@irdashies/domain';
import { LapGraphView } from './LapGraphView';

const CLASS_IDS = [
  ...new Set(fixtureDrivers.map((driver) => String(driver.CarClassID))),
];

interface LapGraphArgs {
  followedCarIdx: number | null;
  chosenMode: LapGraphMode | null;
  selectedClassId: string | null;
  chosenPins: number[] | null;
  yAxisMode: (typeof gantryStoryArgs)['yAxisMode'];
  lapWindow: number;
  autoPin: boolean;
  driverNameFormat: (typeof gantryStoryArgs)['driverNameFormat'];
}

/**
 * The view is fully controlled, so the story owns the state its callbacks
 * write to. Seeded from args and remounted when they change, so the controls
 * take effect while clicking still works.
 */
const Harness = (args: LapGraphArgs) => {
  const [classId, setClassId] = useState(args.selectedClassId);
  const [mode, setMode] = useState(args.chosenMode);
  const [pins, setPins] = useState<readonly number[] | null>(args.chosenPins);

  return (
    <div className="h-screen bg-slate-900 text-white">
      <LapGraphView
        followedCarIdx={args.followedCarIdx}
        selectedClassId={classId}
        onClassChange={setClassId}
        chosenMode={mode}
        onModeChange={setMode}
        chosenPins={pins}
        onPinsChange={setPins}
      />
    </div>
  );
};

const meta: Meta = {
  component: LapGraphView,
  title: 'widgets/Gantry/components/LapGraphView',
  parameters: { layout: 'fullscreen' },
  args: {
    followedCarIdx: null,
    chosenMode: null,
    selectedClassId: null,
    chosenPins: null,
    yAxisMode: gantryStoryArgs.yAxisMode,
    lapWindow: gantryStoryArgs.lapWindow,
    autoPin: gantryStoryArgs.autoPin,
    driverNameFormat: gantryStoryArgs.driverNameFormat,
  },
  argTypes: {
    followedCarIdx: {
      control: 'number',
      description:
        'Driver whose line is lifted above the field. Null follows nobody.',
      table: { category: 'Props' },
    },
    chosenMode: {
      control: 'inline-radio',
      options: [null, 'trace', 'position', 'gap'],
      description: 'Y axis the user picked. Null falls back to the config.',
      table: { category: 'Props' },
    },
    selectedClassId: {
      control: 'select',
      options: [null, ...CLASS_IDS],
      description: "Car class plotted. Null uses the player's class.",
      table: { category: 'Props' },
    },
    chosenPins: {
      control: 'object',
      description: 'Car indexes drawn at full strength. Null uses auto-pin.',
      table: { category: 'Props' },
    },
    yAxisMode: gantryArgTypes.yAxisMode,
    lapWindow: gantryArgTypes.lapWindow,
    autoPin: gantryArgTypes.autoPin,
    driverNameFormat: gantryArgTypes.driverNameFormat,
  },
  render: (args) => (
    <Harness key={JSON.stringify(args)} {...(args as LapGraphArgs)} />
  ),
};
export default meta;
type Story = StoryObj<LapGraphArgs>;

/** A 28-lap sprint over the mock grid. Trace is the default mode. */
export const Default: Story = {
  decorators: [GantryDecorator(), GantryChannelDecorator()],
};

/** The player pits at lap 12, which reads as a step down in trace mode. */
export const MidRacePitStop: Story = {
  decorators: [
    GantryDecorator(),
    GantryChannelDecorator({
      'lap-history.snapshot': buildLapHistory(
        fixturePlans({ laps: 28, pitCarIdx: 4, pitLap: 12 })
      ),
    }),
  ],
};

/** 60 cars over 2 classes, 500 laps. Past the 300-lap cap the ring has wrapped. */
export const Endurance: Story = {
  decorators: [
    GantryDecorator({ session: enduranceSession }),
    GantryChannelDecorator({ 'lap-history.snapshot': enduranceLapHistory }),
  ],
};

/** Race session, no crossings recorded yet. */
export const Empty: Story = {
  decorators: [
    GantryDecorator(),
    GantryChannelDecorator({ 'lap-history.snapshot': emptyLapHistory }),
  ],
};
