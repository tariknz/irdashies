import type { Meta, StoryObj } from '@storybook/react-vite';
import { useEffect } from 'react';
import { TelemetryDecorator } from '@irdashies/storybook';
import type { FuelLapData } from '@irdashies/types';
import { defaultFuelCalculatorSettings } from '../defaults';
import { useFuelStore } from '../FuelStore';
import { FuelHistory } from './FuelHistory';

const usages = [3.91, 3.88, 3.92, 3.85, 3.9];

const HistoryProvider = ({
  children,
  lapCount,
  sessionNum,
  history,
}: {
  children: React.ReactNode;
  lapCount: number;
  sessionNum: number;
  history?: FuelLapData[];
}) => {
  useEffect(() => {
    const laps: FuelLapData[] =
      history ??
      Array.from({ length: lapCount }, (_, index) => ({
        lapNumber: index + 1,
        sessionNum,
        fuelUsed: usages[index % usages.length],
        lapTime: 90,
        isGreenFlag: true,
        isValidForCalc: true,
        isOutLap: false,
        timestamp: Date.UTC(2026, 0, 1) + index * 90000,
      }));
    useFuelStore.getState().clearAllData();
    useFuelStore.getState().updateSessionInfo(sessionNum);
    useFuelStore.getState().setProjectionLaps(laps);
    return () => useFuelStore.getState().clearAllData();
  }, [lapCount, sessionNum, history]);
  return <>{children}</>;
};

const tableSettings = {
  ...defaultFuelCalculatorSettings,
  fuelHistoryType: 'table' as const,
  fuelHistoryLapCount: 5,
};

const meta = {
  component: FuelHistory,
  title: 'widgets/FuelCalculator/FuelHistory',
  args: {
    fuelUnits: 'L',
    widgetId: 'fuelGraph',
    settings: tableSettings,
    customStyles: { labelFontSize: 12, valueFontSize: 16 },
  },
  decorators: [
    TelemetryDecorator(),
    (Story, context) => (
      <HistoryProvider
        lapCount={context.parameters.lapCount ?? 5}
        sessionNum={context.parameters.sessionNum ?? 0}
        history={context.parameters.history}
      >
        <div className="w-[260px] rounded-sm bg-slate-900 p-2 text-white">
          <Story />
        </div>
      </HistoryProvider>
    ),
  ],
} satisfies Meta<typeof FuelHistory>;
export default meta;
type Story = StoryObj<typeof meta>;

/** Last three completed laps, newest first. */
export const TableThreeLaps: Story = {
  args: { settings: { ...tableSettings, fuelHistoryLapCount: 3 } },
};

/** Five rows with aligned numbers and units. */
export const TableFiveLaps: Story = {};

/** Any count within the retained history can be selected. */
export const TableEightLaps: Story = {
  parameters: { lapCount: 12 },
  args: { settings: { ...tableSettings, fuelHistoryLapCount: 8 } },
};

export const Gallons: Story = { args: { fuelUnits: 'gal' } };

export const Compact: Story = { args: { compactMode: 'compact' } };

export const UltraCompact: Story = {
  args: {
    compactMode: 'ultra',
    customStyles: { labelFontSize: 10, valueFontSize: 12 },
  },
};

/** A single recorded lap is enough to show real history. */
export const FirstCompletedLap: Story = { parameters: { lapCount: 1 } };

/** No synthetic consumption values appear while waiting for the first lap. */
export const WaitingForFirstLap: Story = { parameters: { lapCount: 0 } };

export const Histogram: Story = {
  args: { settings: { ...tableSettings, fuelHistoryType: 'histogram' } },
};

export const LineChart: Story = {
  args: { settings: { ...tableSettings, fuelHistoryType: 'line' } },
};

/** Qualifying lap numbers restart in the race; only the race lap is displayed. */
export const NewRaceSession: Story = {
  parameters: {
    sessionNum: 1,
    history: [
      { lapNumber: 1, sessionNum: 1, fuelUsed: 3.9, timestamp: 3000 },
      { lapNumber: 20, sessionNum: 0, fuelUsed: 3.8, timestamp: 2000 },
      { lapNumber: 1, sessionNum: 0, fuelUsed: 3.1, timestamp: 1000 },
    ].map((lap) => ({
      ...lap,
      lapTime: 90,
      isGreenFlag: true,
      isValidForCalc: true,
      isOutLap: false,
    })) satisfies FuelLapData[],
  },
};
