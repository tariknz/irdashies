import { Meta, StoryObj } from '@storybook/react-vite';
import {
  ChannelSnapshotDecorator,
  TelemetryDecoratorWithConfig,
} from '@irdashies/storybook';
import type { CarSystemAdjustment, CarSystemsSnapshot } from '@irdashies/types';
import { CarSystems } from './CarSystems';

const adjustment = (
  key: string,
  label: string,
  value: number,
  extra: Partial<CarSystemAdjustment> = {}
): CarSystemAdjustment => ({
  key,
  label,
  value,
  isOff: false,
  precision: 0,
  ...extra,
});

const brakeBias = (value: number) =>
  adjustment('dcBrakeBias', 'Brake Bias', value, {
    precision: 1,
    unit: '%',
  });

const snapshot = (adjustments: CarSystemAdjustment[]): CarSystemsSnapshot => ({
  adjustments,
  discovered: true,
  sessionNum: 0,
  version: 1,
});

const ROWS = [
  'dcBrakeBias',
  'dcABS',
  'dcTractionControl',
  'dcTractionControl2',
  'dcThrottleShape',
];

const story = (
  systems: CarSystemsSnapshot,
  config: Record<string, unknown> = {}
) => ({
  decorators: [
    TelemetryDecoratorWithConfig('/test-data/1747384033336', {
      carsystems: { rows: ROWS, showUnsupportedRows: true, ...config },
    }),
    ChannelSnapshotDecorator({ 'car-systems.snapshot': systems }),
    // The widget is full-width by design and takes its size from its overlay
    // window, so the story supplies one rather than letting it span the page.
    // Wide enough for a strip of columns rather than the old stacked table.
    (Story: React.ComponentType) => (
      <div style={{ width: 420 }}>
        <Story />
      </div>
    ),
  ],
});

const meta: Meta<typeof CarSystems> = {
  component: CarSystems,
  title: 'widgets/CarSystems',
};

export default meta;

type Story = StoryObj<typeof CarSystems>;

/** A GT3 car: every configured row is supported. */
export const Gt3: Story = {
  ...story(
    snapshot([
      brakeBias(54.5),
      adjustment('dcABS', 'ABS', 2),
      adjustment('dcTractionControl', 'TC', 3),
      adjustment('dcTractionControl2', 'TC2', 5),
      adjustment('dcThrottleShape', 'Throttle Shape', 1),
    ])
  ),
};

/**
 * A Formula Vee exposes brake bias alone. The other rows are kept so the table
 * does not change shape between cars.
 */
export const BrakeBiasOnly: Story = {
  ...story(snapshot([brakeBias(48)])),
};

/** The same car with the blank rows turned off. */
export const SupportedRowsOnly: Story = {
  ...story(snapshot([brakeBias(48)]), { showUnsupportedRows: false }),
};

/** ABS and TC switched off: subdued, and distinguishable from a blank row. */
export const AssistsOff: Story = {
  ...story(
    snapshot([
      brakeBias(52),
      adjustment('dcABS', 'ABS', 0, { isOff: true }),
      adjustment('dcTractionControl', 'TC', 0, { isOff: true }),
    ])
  ),
};

/**
 * A signed scale. The BMW M Hybrid V8 reports ABS between -5 and -3, so a zero
 * there is an ordinary setting and must not read as off.
 */
export const SignedScale: Story = {
  ...story(
    snapshot([
      brakeBias(51.5),
      adjustment('dcABS', 'ABS', 0),
      adjustment('dcTractionControl', 'TC', 4),
    ])
  ),
};

/** Every adjustment a heavily configurable car might expose. */
export const AllRows: Story = {
  ...story(
    snapshot([
      brakeBias(53.5),
      adjustment('dcABS', 'ABS', 4),
      adjustment('dcTractionControl', 'TC', 6),
      adjustment('dcTractionControl2', 'TC2', 2),
      adjustment('dcThrottleShape', 'Throttle Shape', 3),
      adjustment('dcEnginePower', 'Engine Power', 5),
      adjustment('dcFuelMixture', 'Fuel Mixture', 2),
      adjustment('dcAntiRollFront', 'ARB Front', 4),
      adjustment('dcAntiRollRear', 'ARB Rear', 3),
    ]),
    {
      rows: [
        'dcBrakeBias',
        'dcABS',
        'dcTractionControl',
        'dcTractionControl2',
        'dcThrottleShape',
        'dcEnginePower',
        'dcFuelMixture',
        'dcAntiRollFront',
        'dcAntiRollRear',
      ],
    }
  ),
};
