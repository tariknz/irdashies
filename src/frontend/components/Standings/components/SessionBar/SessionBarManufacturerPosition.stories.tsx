import { Meta, StoryObj } from '@storybook/react-vite';
import { useEffect } from 'react';
import type { ComponentType } from 'react';
import { SessionBar } from './SessionBar';
import {
  DashboardProvider,
  useSessionStore,
  useTelemetryStore,
} from '@irdashies/context';
import { mockDashboardBridge } from '../../../../../../.storybook/mockDashboardBridge';
import { getWidgetDefaultConfig } from '@irdashies/types';
import type { Telemetry } from '@irdashies/types';

// carId 56 = NASCAR Cup Series Toyota Camry, carId 30 = Ford Mustang FR500S
const TOYOTA_CAR_ID = 56;
const FORD_CAR_ID = 30;
const PLAYER_CAR_IDX = 4;

const standingsDefaults = getWidgetDefaultConfig('standings');

// These stories bypass TelemetryDecorator: the 60Hz mock stream would clobber
// injected CarIdxPosition values since the mock bridge does not include that key.
// Instead, only DashboardProvider is used and stores are seeded directly.

interface SeederProps {
  drivers: { CarIdx: number; CarID: number }[];
  positionsByIdx: number[];
}

const ManufacturerPositionSeeder = ({ drivers, positionsByIdx }: SeederProps) => {
  useEffect(() => {
    useSessionStore.setState({
      session: {
        DriverInfo: {
          DriverCarIdx: PLAYER_CAR_IDX,
          Drivers: drivers,
        },
      } as never,
    });
    useTelemetryStore.getState().setTelemetry({
      CarIdxPosition: { value: positionsByIdx },
    } as Telemetry);
    return () => useTelemetryStore.getState().resetTelemetry();
  }, [drivers, positionsByIdx]);
  return null;
};

// 5 Toyotas (player at carIdx 4 is 3rd), 2 Fords
const MULTI_MAKE_DRIVERS = [
  { CarIdx: 0, CarID: TOYOTA_CAR_ID },
  { CarIdx: 1, CarID: TOYOTA_CAR_ID },
  { CarIdx: 2, CarID: TOYOTA_CAR_ID },
  { CarIdx: 3, CarID: TOYOTA_CAR_ID },
  { CarIdx: 4, CarID: TOYOTA_CAR_ID }, // player
  { CarIdx: 5, CarID: FORD_CAR_ID },
  { CarIdx: 6, CarID: FORD_CAR_ID },
];
// carIdx 4 (player) → position 3 among Toyotas sorted by pos
const MULTI_MAKE_POSITIONS = [1, 2, 4, 5, 3, 6, 7];

// All 6 drivers on Toyota
const SINGLE_MAKE_DRIVERS = [
  { CarIdx: 0, CarID: TOYOTA_CAR_ID },
  { CarIdx: 1, CarID: TOYOTA_CAR_ID },
  { CarIdx: 2, CarID: TOYOTA_CAR_ID },
  { CarIdx: 3, CarID: TOYOTA_CAR_ID },
  { CarIdx: 4, CarID: TOYOTA_CAR_ID }, // player
  { CarIdx: 5, CarID: TOYOTA_CAR_ID },
];
const SINGLE_MAKE_POSITIONS = [1, 2, 3, 4, 5, 6];

// Player (carIdx 4) is the only Toyota; others are Ford
const SOLE_TOYOTA_DRIVERS = [
  { CarIdx: 0, CarID: FORD_CAR_ID },
  { CarIdx: 1, CarID: FORD_CAR_ID },
  { CarIdx: 2, CarID: FORD_CAR_ID },
  { CarIdx: 3, CarID: FORD_CAR_ID },
  { CarIdx: 4, CarID: TOYOTA_CAR_ID }, // player (only Toyota)
  { CarIdx: 5, CarID: FORD_CAR_ID },
];
const SOLE_TOYOTA_POSITIONS = [2, 3, 4, 5, 1, 6];

export default {
  component: SessionBar,
  title: 'widgets/Standings/components/SessionBar/ManufacturerPosition',
  decorators: [
    (Story: ComponentType) => (
      <DashboardProvider bridge={mockDashboardBridge}>
        <Story />
      </DashboardProvider>
    ),
  ],
} as Meta;

type Story = StoryObj<typeof SessionBar>;

// Multi-make race: player (Toyota) is 3rd of 5, 2 Fords also in session
export const ManufacturerPosition: Story = {
  args: {
    settings: {
      ...standingsDefaults.headerBar,
      manufacturerPosition: { enabled: true },
      displayOrder: ['manufacturerPosition'],
    },
    position: 'header',
  },
  render: (args) => (
    <>
      <ManufacturerPositionSeeder
        drivers={MULTI_MAKE_DRIVERS}
        positionsByIdx={MULTI_MAKE_POSITIONS}
      />
      <SessionBar {...args} />
    </>
  ),
};

// Single-make session with hideIfSingleMake:false — item still shows (player is 5th of 6 Toyotas)
export const ManufacturerPositionSingleMakeVisible: Story = {
  args: {
    settings: {
      ...standingsDefaults.headerBar,
      manufacturerPosition: { enabled: true, hideIfSingleMake: false },
      displayOrder: ['manufacturerPosition'],
    },
    position: 'header',
  },
  render: (args) => (
    <>
      <ManufacturerPositionSeeder
        drivers={SINGLE_MAKE_DRIVERS}
        positionsByIdx={SINGLE_MAKE_POSITIONS}
      />
      <SessionBar {...args} />
    </>
  ),
};

// Single-make session with hideIfSingleMake:true — item hides (no output)
export const ManufacturerPositionHideIfSingleMake: Story = {
  args: {
    settings: {
      ...standingsDefaults.headerBar,
      manufacturerPosition: { enabled: true, hideIfSingleMake: true },
      displayOrder: ['manufacturerPosition'],
    },
    position: 'header',
  },
  render: (args) => (
    <>
      <ManufacturerPositionSeeder
        drivers={SINGLE_MAKE_DRIVERS}
        positionsByIdx={SINGLE_MAKE_POSITIONS}
      />
      <SessionBar {...args} />
    </>
  ),
};

// Player is the only Toyota with hideIfSingleDriver:false — shows "Toyota 1/1"
export const ManufacturerPositionSoleDriver: Story = {
  args: {
    settings: {
      ...standingsDefaults.headerBar,
      manufacturerPosition: { enabled: true, hideIfSingleDriver: false },
      displayOrder: ['manufacturerPosition'],
    },
    position: 'header',
  },
  render: (args) => (
    <>
      <ManufacturerPositionSeeder
        drivers={SOLE_TOYOTA_DRIVERS}
        positionsByIdx={SOLE_TOYOTA_POSITIONS}
      />
      <SessionBar {...args} />
    </>
  ),
};

// Player is the only Toyota with hideIfSingleDriver:true — item hides (no output)
export const ManufacturerPositionHideIfSingleDriver: Story = {
  args: {
    settings: {
      ...standingsDefaults.headerBar,
      manufacturerPosition: { enabled: true, hideIfSingleDriver: true },
      displayOrder: ['manufacturerPosition'],
    },
    position: 'header',
  },
  render: (args) => (
    <>
      <ManufacturerPositionSeeder
        drivers={SOLE_TOYOTA_DRIVERS}
        positionsByIdx={SOLE_TOYOTA_POSITIONS}
      />
      <SessionBar {...args} />
    </>
  ),
};
